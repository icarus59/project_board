require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },  // 50MB 제한
});

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const app        = express();
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'my-diary-secret-key';

// ════════════════════════════════
//  미들웨어 설정
// ════════════════════════════════

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ════════════════════════════════
//  DB 연결 & 테이블 초기화
// ════════════════════════════════

let pool;

async function initDB() {
  // 1단계: DB 이름 없이 먼저 연결
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  // 2단계: DB가 없으면 자동 생성
  await conn.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
  await conn.end();

  // 3단계: 생성한 DB로 pool 연결
  pool = mysql.createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // 4단계: users 테이블 생성
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id         INT          AUTO_INCREMENT PRIMARY KEY,
      username   VARCHAR(50)  NOT NULL UNIQUE,
      password   VARCHAR(255) NOT NULL,
      phone      VARCHAR(20)  NOT NULL DEFAULT '',
      birth_date DATE         NULL
    )
  `);
  // 기존 테이블에 phone, birth_date 컬럼 없으면 추가
  await pool.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NOT NULL DEFAULT ''`);
  await pool.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE NULL`);

  // 5단계: diaries 테이블 생성
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS diaries (
      id      INT           AUTO_INCREMENT PRIMARY KEY,
      user_id INT           NOT NULL,
      title   VARCHAR(255)  NOT NULL,
      content TEXT          NOT NULL,
      date    VARCHAR(50)   NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 6단계: images 테이블 생성
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS images (
      id       INT          AUTO_INCREMENT PRIMARY KEY,
      user_id  INT          NOT NULL,
      url      VARCHAR(500) NOT NULL,
      key_name VARCHAR(200) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 7단계: family_photos 테이블 생성
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS family_photos (
      id          INT          AUTO_INCREMENT PRIMARY KEY,
      user_id     INT          NOT NULL,
      url         VARCHAR(500) NOT NULL,
      key_name    VARCHAR(200) NOT NULL,
      description VARCHAR(300) NOT NULL DEFAULT '',
      date        VARCHAR(50)  NOT NULL,
      file_type   VARCHAR(10)  NOT NULL DEFAULT 'image',
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  // 기존 테이블에 file_type 컬럼 없으면 추가
  await pool.execute(`
    ALTER TABLE family_photos ADD COLUMN IF NOT EXISTS file_type VARCHAR(10) NOT NULL DEFAULT 'image'
  `);

  console.log('DB 연결 성공!');
}

// ════════════════════════════════
//  인증 미들웨어
// ════════════════════════════════

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.status(401).json({ message: '토큰이 유효하지 않습니다. 다시 로그인해주세요.' });
  }
}

// ════════════════════════════════
//  통계 API (인증 불필요)
// ════════════════════════════════

// 가입자 수 조회
app.get('/api/stats', async function (req, res) {
  const [[row]] = await pool.execute('SELECT COUNT(*) AS count FROM users');
  res.json({ userCount: row.count });
});

// ════════════════════════════════
//  인증 API
// ════════════════════════════════

// 회원가입
app.post('/api/auth/register', async function (req, res) {
  const { username, password, phone, birthDate } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: '아이디와 비밀번호를 입력해주세요.' });
  }

  const [existing] = await pool.execute(
    'SELECT id FROM users WHERE username = ?',
    [username]
  );
  if (existing.length > 0) {
    return res.status(400).json({ message: '이미 사용 중인 아이디입니다.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.execute(
    'INSERT INTO users (username, password, phone, birth_date) VALUES (?, ?, ?, ?)',
    [username, hashedPassword, phone || '', birthDate || null]
  );

  res.status(201).json({ message: '회원가입 성공!' });
});

// 내 정보 조회
app.get('/api/auth/me', authMiddleware, async function (req, res) {
  const [rows] = await pool.execute(
    'SELECT username, phone, birth_date FROM users WHERE id = ?',
    [req.userId]
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
  }
  res.json(rows[0]);
});

// 회원 탈퇴
app.delete('/api/auth/me', authMiddleware, async function (req, res) {
  // 1. 다이어리 사진 R2 삭제
  const [images] = await pool.execute(
    'SELECT key_name FROM images WHERE user_id = ?',
    [req.userId]
  );
  for (const img of images) {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: img.key_name }));
  }

  // 2. 가족앨범 R2 삭제
  const [familyPhotos] = await pool.execute(
    'SELECT key_name FROM family_photos WHERE user_id = ?',
    [req.userId]
  );
  for (const fp of familyPhotos) {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: fp.key_name }));
  }

  // 3. DB 데이터 삭제 (순서 중요: 자식 테이블 먼저)
  await pool.execute('DELETE FROM diaries      WHERE user_id = ?', [req.userId]);
  await pool.execute('DELETE FROM images       WHERE user_id = ?', [req.userId]);
  await pool.execute('DELETE FROM family_photos WHERE user_id = ?', [req.userId]);
  await pool.execute('DELETE FROM users        WHERE id = ?',      [req.userId]);

  res.json({ message: '탈퇴가 완료되었습니다.' });
});

// 로그인
app.post('/api/auth/login', async function (req, res) {
  const { username, password } = req.body;

  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE username = ?',
    [username]
  );
  if (rows.length === 0) {
    return res.status(401).json({ message: '아이디 또는 비밀번호가 틀렸습니다.' });
  }

  const user    = rows[0];
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: '아이디 또는 비밀번호가 틀렸습니다.' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

// ════════════════════════════════
//  REST API (CRUD) — 로그인 필요
// ════════════════════════════════

// R: 내 일기 목록 조회
app.get('/api/diaries', authMiddleware, async function (req, res) {
  const [rows] = await pool.execute(
    'SELECT * FROM diaries WHERE user_id = ? ORDER BY id DESC',
    [req.userId]
  );
  res.json(rows);
});

// C: 일기 추가
app.post('/api/diaries', authMiddleware, async function (req, res) {
  const { title, content } = req.body;
  const date = new Date().toLocaleDateString('ko-KR');

  const [result] = await pool.execute(
    'INSERT INTO diaries (user_id, title, content, date) VALUES (?, ?, ?, ?)',
    [req.userId, title, content, date]
  );

  const [rows] = await pool.execute(
    'SELECT * FROM diaries WHERE id = ?',
    [result.insertId]
  );
  res.status(201).json(rows[0]);
});

// U: 일기 수정
app.put('/api/diaries/:id', authMiddleware, async function (req, res) {
  const id = Number(req.params.id);
  const { title, content } = req.body;

  const [result] = await pool.execute(
    'UPDATE diaries SET title = ?, content = ? WHERE id = ? AND user_id = ?',
    [title, content, id, req.userId]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: '일기를 찾을 수 없습니다.' });
  }

  const [rows] = await pool.execute('SELECT * FROM diaries WHERE id = ?', [id]);
  res.json(rows[0]);
});

// D: 일기 삭제
app.delete('/api/diaries/:id', authMiddleware, async function (req, res) {
  const id = Number(req.params.id);
  await pool.execute(
    'DELETE FROM diaries WHERE id = ? AND user_id = ?',
    [id, req.userId]
  );
  res.json({ message: '삭제되었습니다.' });
});

// ════════════════════════════════
//  사진 API — 로그인 필요
// ════════════════════════════════

// 내 사진 목록 조회
app.get('/api/images', authMiddleware, async function (req, res) {
  const [rows] = await pool.execute(
    'SELECT id, url FROM images WHERE user_id = ? ORDER BY id ASC',
    [req.userId]
  );
  res.json(rows);
});

// 사진 업로드
app.post('/api/images', authMiddleware, upload.single('image'), async function (req, res) {
  if (!req.file) {
    return res.status(400).json({ message: '사진 데이터가 없습니다.' });
  }

  const keyName = `${req.userId}/${Date.now()}-${req.file.originalname}`;

  const uploader = new Upload({
    client: s3,
    params: {
      Bucket:      process.env.R2_BUCKET_NAME,
      Key:         keyName,
      Body:        req.file.buffer,
      ContentType: req.file.mimetype,
    },
  });

  await uploader.done();

  const url = `${process.env.R2_PUBLIC_URL}/${keyName}`;

  const [result] = await pool.execute(
    'INSERT INTO images (user_id, url, key_name) VALUES (?, ?, ?)',
    [req.userId, url, keyName]
  );

  res.status(201).json({ id: result.insertId, url });
});

// 사진 삭제
app.delete('/api/images/:id', authMiddleware, async function (req, res) {
  const id = Number(req.params.id);

  const [rows] = await pool.execute(
    'SELECT key_name FROM images WHERE id = ? AND user_id = ?',
    [id, req.userId]
  );

  if (rows.length > 0) {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key:    rows[0].key_name,
    }));
  }

  await pool.execute(
    'DELETE FROM images WHERE id = ? AND user_id = ?',
    [id, req.userId]
  );
  res.json({ message: '삭제되었습니다.' });
});

// ════════════════════════════════
//  가족앨범 API — 로그인 필요
// ════════════════════════════════

// 가족앨범 목록 조회
app.get('/api/family', authMiddleware, async function (req, res) {
  const [rows] = await pool.execute(
    'SELECT id, url, description, date, file_type FROM family_photos WHERE user_id = ? ORDER BY id DESC',
    [req.userId]
  );
  res.json(rows);
});

// 가족앨범 사진 업로드
app.post('/api/family', authMiddleware, upload.single('image'), async function (req, res) {
  if (!req.file) {
    return res.status(400).json({ message: '사진 데이터가 없습니다.' });
  }

  const description = req.body.description || '';
  const date        = new Date().toLocaleDateString('ko-KR');
  const fileType    = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  const keyName     = `family/${req.userId}/${Date.now()}-${req.file.originalname}`;

  const uploader = new Upload({
    client: s3,
    params: {
      Bucket:      process.env.R2_BUCKET_NAME,
      Key:         keyName,
      Body:        req.file.buffer,
      ContentType: req.file.mimetype,
    },
  });

  await uploader.done();

  const url = `${process.env.R2_PUBLIC_URL}/${keyName}`;

  const [result] = await pool.execute(
    'INSERT INTO family_photos (user_id, url, key_name, description, date, file_type) VALUES (?, ?, ?, ?, ?, ?)',
    [req.userId, url, keyName, description, date, fileType]
  );

  res.status(201).json({ id: result.insertId, url, description, date, file_type: fileType });
});

// 가족앨범 설명 수정
app.patch('/api/family/:id', authMiddleware, async function (req, res) {
  const id          = Number(req.params.id);
  const { description } = req.body;
  await pool.execute(
    'UPDATE family_photos SET description = ? WHERE id = ? AND user_id = ?',
    [description, id, req.userId]
  );
  res.json({ message: '수정되었습니다.' });
});

// 가족앨범 사진 삭제
app.delete('/api/family/:id', authMiddleware, async function (req, res) {
  const id = Number(req.params.id);

  const [rows] = await pool.execute(
    'SELECT key_name FROM family_photos WHERE id = ? AND user_id = ?',
    [id, req.userId]
  );

  if (rows.length > 0) {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key:    rows[0].key_name,
    }));
  }

  await pool.execute(
    'DELETE FROM family_photos WHERE id = ? AND user_id = ?',
    [id, req.userId]
  );
  res.json({ message: '삭제되었습니다.' });
});

// ════════════════════════════════
//  서버 시작
// ════════════════════════════════

initDB().then(function () {
  app.listen(PORT, function () {
    console.log(`서버가 실행됐어요! http://localhost:${PORT}`);
  });
});
