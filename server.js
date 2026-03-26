require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ════════════════════════════════
//  미들웨어 설정
// ════════════════════════════════

app.use(cors());
app.use(express.json());
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

  // 4단계: 테이블 생성
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS diaries (
      id      INT           AUTO_INCREMENT PRIMARY KEY,
      title   VARCHAR(255)  NOT NULL,
      content TEXT          NOT NULL,
      date    VARCHAR(50)   NOT NULL
    )
  `);
  console.log('DB 연결 성공!');
}

// ════════════════════════════════
//  REST API (CRUD)
// ════════════════════════════════

// R: 전체 일기 목록 조회
app.get('/api/diaries', async function (_req, res) {
  const [rows] = await pool.execute('SELECT * FROM diaries ORDER BY id DESC');
  res.json(rows);
});

// C: 일기 추가
app.post('/api/diaries', async function (req, res) {
  const { title, content } = req.body;
  const date = new Date().toLocaleDateString('ko-KR');

  const [result] = await pool.execute(
    'INSERT INTO diaries (title, content, date) VALUES (?, ?, ?)',
    [title, content, date]
  );

  const [rows] = await pool.execute(
    'SELECT * FROM diaries WHERE id = ?',
    [result.insertId]
  );
  res.status(201).json(rows[0]);
});

// U: 일기 수정
app.put('/api/diaries/:id', async function (req, res) {
  const id = Number(req.params.id);
  const { title, content } = req.body;

  const [result] = await pool.execute(
    'UPDATE diaries SET title = ?, content = ? WHERE id = ?',
    [title, content, id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: '일기를 찾을 수 없습니다.' });
  }

  const [rows] = await pool.execute('SELECT * FROM diaries WHERE id = ?', [id]);
  res.json(rows[0]);
});

// D: 일기 삭제
app.delete('/api/diaries/:id', async function (req, res) {
  const id = Number(req.params.id);
  await pool.execute('DELETE FROM diaries WHERE id = ?', [id]);
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
