require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');

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
      id       INT          AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50)  NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    )
  `);

  // 5단계: diaries 테이블 재생성 (user_id 포함)
  await pool.execute(`DROP TABLE IF EXISTS diaries`);
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
      id      INT           AUTO_INCREMENT PRIMARY KEY,
      user_id INT           NOT NULL,
      data    LONGTEXT      NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
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
//  인증 API
// ════════════════════════════════

// 회원가입
app.post('/api/auth/register', async function (req, res) {
  const { username, password } = req.body;

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
    'INSERT INTO users (username, password) VALUES (?, ?)',
    [username, hashedPassword]
  );

  res.status(201).json({ message: '회원가입 성공!' });
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
    'SELECT id, data FROM images WHERE user_id = ? ORDER BY id ASC',
    [req.userId]
  );
  res.json(rows);
});

// 사진 업로드
app.post('/api/images', authMiddleware, async function (req, res) {
  const { data } = req.body;

  if (!data) {
    return res.status(400).json({ message: '사진 데이터가 없습니다.' });
  }

  const [result] = await pool.execute(
    'INSERT INTO images (user_id, data) VALUES (?, ?)',
    [req.userId, data]
  );

  res.status(201).json({ id: result.insertId, data });
});

// 사진 삭제
app.delete('/api/images/:id', authMiddleware, async function (req, res) {
  const id = Number(req.params.id);
  await pool.execute(
    'DELETE FROM images WHERE id = ? AND user_id = ?',
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
