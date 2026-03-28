// ════════════════════════════════
//  API 주소 설정
//  배포 후 이 값을 클라우드타입 주소로 바꾸세요
// ════════════════════════════════

const API_URL = 'https://port-0-project-board-mn7inx3x932cf37f.sel3.cloudtype.app';

// ════════════════════════════════
//  인증 상태 관리 (localStorage)
// ════════════════════════════════

function getToken()    { return localStorage.getItem('token'); }
function getUsername() { return localStorage.getItem('username'); }

function saveAuth(token, username) {
  localStorage.setItem('token',    token);
  localStorage.setItem('username', username);
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
}

// API 요청 시 공통으로 쓸 헤더 (토큰 포함)
function authHeaders() {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

// ════════════════════════════════
//  화면 전환
// ════════════════════════════════

function showApp() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('app-section').style.display  = 'block';
  document.getElementById('welcome-text').textContent   = `${getUsername()}님, 안녕하세요!`;
  loadPhotos();
  renderDiaries();
}

function showAuth() {
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('app-section').style.display  = 'none';
}

// ════════════════════════════════
//  인증 API 통신
// ════════════════════════════════

async function login(username, password) {
  return await fetch(`${API_URL}/api/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password }),
  });
}

async function register(username, password) {
  return await fetch(`${API_URL}/api/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password }),
  });
}

// ════════════════════════════════
//  일기 API 통신 (토큰 필요)
// ════════════════════════════════

async function fetchDiaries() {
  const response = await fetch(`${API_URL}/api/diaries`, {
    headers: authHeaders(),
  });
  return await response.json();
}

async function createDiary(title, content) {
  await fetch(`${API_URL}/api/diaries`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({ title, content }),
  });
}

async function updateDiary(id, newTitle, newContent) {
  await fetch(`${API_URL}/api/diaries/${id}`, {
    method:  'PUT',
    headers: authHeaders(),
    body:    JSON.stringify({ title: newTitle, content: newContent }),
  });
}

async function deleteDiary(id) {
  await fetch(`${API_URL}/api/diaries/${id}`, {
    method:  'DELETE',
    headers: authHeaders(),
  });
}

// ════════════════════════════════
//  화면 렌더링
// ════════════════════════════════

const diaryList = document.getElementById('diary-list');

async function renderDiaries() {
  const diaries = await fetchDiaries();
  diaryList.innerHTML = '';

  diaries.forEach(function (diary) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="card-header">
        <h3>${diary.title}</h3>
        <div>
          <button class="edit-btn"   data-id="${diary.id}">수정</button>
          <button class="delete-btn" data-id="${diary.id}">삭제</button>
        </div>
      </div>
      <p>${diary.content}</p>
      <small>${diary.date}</small>
    `;
    diaryList.appendChild(li);
  });
}

function renderEditForm(li, diary) {
  li.innerHTML = `
    <input    class="edit-input"    data-id="${diary.id}" value="${diary.title}" />
    <textarea class="edit-textarea" data-id="${diary.id}">${diary.content}</textarea>
    <div>
      <button class="confirm-btn" data-id="${diary.id}">완료</button>
      <button class="cancel-btn">취소</button>
    </div>
  `;
}

// ════════════════════════════════
//  사진 슬라이드
// ════════════════════════════════

let photos  = [];  // 사진 목록
let current = 0;   // 현재 보고 있는 사진 번호

// 사진 목록 서버에서 가져오기
async function fetchPhotos() {
  const response = await fetch(`${API_URL}/api/images`, {
    headers: authHeaders(),
  });
  return await response.json();
}

// 슬라이드 화면 업데이트
function renderSlide() {
  const img     = document.getElementById('slide-img');
  const noMsg   = document.getElementById('no-photo-msg');
  const counter = document.getElementById('slide-counter');

  if (photos.length === 0) {
    // 사진이 없을 때
    img.style.display   = 'none';
    noMsg.style.display = 'block';
    counter.textContent = '';
  } else {
    // 사진이 있을 때
    img.src             = photos[current].data;
    img.style.display   = 'block';
    noMsg.style.display = 'none';
    counter.textContent = `${current + 1} / ${photos.length}`;
  }
}

// 사진 불러오고 슬라이드 표시
async function loadPhotos() {
  photos  = await fetchPhotos();
  current = 0;
  renderSlide();
}

// ◀ 이전 버튼
document.getElementById('prev-btn').addEventListener('click', function () {
  if (photos.length === 0) return;
  current = (current - 1 + photos.length) % photos.length;
  renderSlide();
});

// ▶ 다음 버튼
document.getElementById('next-btn').addEventListener('click', function () {
  if (photos.length === 0) return;
  current = (current + 1) % photos.length;
  renderSlide();
});

// 사진 올리기
document.getElementById('photo-input').addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;

  // 사진을 base64 텍스트로 변환
  const reader = new FileReader();
  reader.onload = async function (e) {
    const base64 = e.target.result;

    await fetch(`${API_URL}/api/images`, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify({ data: base64 }),
    });

    await loadPhotos();
    current = photos.length - 1;  // 방금 올린 사진으로 이동
    renderSlide();
  };
  reader.readAsDataURL(file);

  this.value = '';  // 같은 파일 다시 올릴 수 있게 초기화
});

// 현재 사진 삭제
document.getElementById('delete-photo-btn').addEventListener('click', async function () {
  if (photos.length === 0) return;

  const id = photos[current].id;
  await fetch(`${API_URL}/api/images/${id}`, {
    method:  'DELETE',
    headers: authHeaders(),
  });

  await loadPhotos();
  current = Math.min(current, photos.length - 1);
  renderSlide();
});

// ════════════════════════════════
//  이벤트 처리 — 인증
// ════════════════════════════════

// 로그인 버튼
document.getElementById('login-btn').addEventListener('click', async function () {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!username || !password) {
    alert('아이디와 비밀번호를 입력해주세요!');
    return;
  }

  const response = await login(username, password);
  const data     = await response.json();

  if (!response.ok) {
    alert(data.message);
    return;
  }

  saveAuth(data.token, data.username);
  showApp();
});

// 회원가입 버튼
document.getElementById('register-btn').addEventListener('click', async function () {
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value.trim();

  if (!username || !password) {
    alert('아이디와 비밀번호를 입력해주세요!');
    return;
  }

  const response = await register(username, password);
  const data     = await response.json();

  if (!response.ok) {
    alert(data.message);
    return;
  }

  document.getElementById('register-modal').style.display = 'none';
  alert('회원가입 성공! 로그인해주세요.');
});

// 로그아웃 버튼
document.getElementById('logout-btn').addEventListener('click', function () {
  clearAuth();
  showAuth();
});

// 회원가입 모달 열기 / 닫기
document.getElementById('show-register').addEventListener('click', function (e) {
  e.preventDefault();
  document.getElementById('register-username').value = '';
  document.getElementById('register-password').value = '';
  document.getElementById('register-modal').style.display = 'flex';
});

document.getElementById('modal-close-btn').addEventListener('click', function () {
  document.getElementById('register-modal').style.display = 'none';
});

// 모달 바깥 클릭하면 닫기
document.getElementById('register-modal').addEventListener('click', function (e) {
  if (e.target === this) {
    this.style.display = 'none';
  }
});

// ════════════════════════════════
//  이벤트 처리 — 일기
// ════════════════════════════════

// 저장 버튼
document.getElementById('save-btn').addEventListener('click', async function () {
  const title   = document.getElementById('title-input').value.trim();
  const content = document.getElementById('content-input').value.trim();

  if (!title || !content) {
    alert('제목과 내용을 모두 입력해주세요!');
    return;
  }

  await createDiary(title, content);
  await renderDiaries();

  document.getElementById('title-input').value   = '';
  document.getElementById('content-input').value = '';
});

// 수정 / 완료 / 취소 / 삭제 버튼 (이벤트 위임)
diaryList.addEventListener('click', async function (event) {
  const btn = event.target;
  const id  = Number(btn.dataset.id);
  const li  = btn.closest('li');

  if (btn.classList.contains('edit-btn')) {
    const diaries = await fetchDiaries();
    const diary   = diaries.find(d => d.id === id);
    renderEditForm(li, diary);
  }

  if (btn.classList.contains('confirm-btn')) {
    const newTitle   = li.querySelector('.edit-input').value.trim();
    const newContent = li.querySelector('.edit-textarea').value.trim();

    if (!newTitle || !newContent) {
      alert('제목과 내용을 모두 입력해주세요!');
      return;
    }

    await updateDiary(id, newTitle, newContent);
    await renderDiaries();
  }

  if (btn.classList.contains('cancel-btn')) {
    await renderDiaries();
  }

  if (btn.classList.contains('delete-btn')) {
    await deleteDiary(id);
    await renderDiaries();
  }
});

// ════════════════════════════════
//  초기 실행 — 토큰 있으면 바로 앱 화면으로
// ════════════════════════════════

if (getToken()) {
  showApp();
} else {
  showAuth();
}
