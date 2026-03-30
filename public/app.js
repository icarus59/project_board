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
let editingId = null;

async function renderDiaries(searchTerm = '', searchType = 'title') {
  const diaries = await fetchDiaries();
  diaryList.innerHTML = '';

  const filtered = searchTerm
    ? diaries.filter(d =>
        (searchType === 'title' ? d.title : d.content)
          .toLowerCase().includes(searchTerm.toLowerCase()))
    : diaries;

  if (filtered.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" class="board-empty">등록된 일기가 없어요.</td>`;
    diaryList.appendChild(tr);
    return;
  }

  filtered.forEach(function (diary) {
    const tr = document.createElement('tr');
    tr.dataset.id      = diary.id;
    tr.dataset.title   = diary.title;
    tr.dataset.content = diary.content;
    tr.dataset.date    = diary.date;
    tr.innerHTML = `
      <td class="col-check"><input type="checkbox" class="row-check" data-id="${diary.id}" /></td>
      <td class="col-title">
        <span class="diary-title">${diary.title}</span>
        <span class="row-actions">
          <button class="edit-btn" data-id="${diary.id}">수정</button>
          <button class="delete-btn" data-id="${diary.id}">삭제</button>
        </span>
      </td>
      <td class="col-author">${getUsername()}</td>
      <td class="col-date">${diary.date}</td>
    `;
    diaryList.appendChild(tr);
  });
}

function openWritePanel(diary = null) {
  const panel       = document.getElementById('write-panel');
  const panelTitle  = document.getElementById('write-panel-title');
  const titleInput  = document.getElementById('title-input');
  const contentInput= document.getElementById('content-input');
  const saveBtn     = document.getElementById('save-btn');

  if (diary) {
    editingId = diary.id;
    panelTitle.textContent  = '일기 수정';
    titleInput.value        = diary.title;
    contentInput.value      = diary.content;
    saveBtn.textContent     = '수정 완료';
  } else {
    editingId = null;
    panelTitle.textContent  = '일기 쓰기';
    titleInput.value        = '';
    contentInput.value      = '';
    saveBtn.textContent     = '저장하기';
  }

  panel.classList.add('open');
  document.getElementById('write-toggle-btn').textContent = '닫기';
  titleInput.focus();
}

function closeWritePanel() {
  document.getElementById('write-panel').classList.remove('open');
  document.getElementById('write-toggle-btn').textContent = '글쓰기';
  editingId = null;
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
    img.src             = photos[current].url;
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

// 이미지 압축 함수 (최대 1280px, 품질 80%)
function compressImage(file) {
  return new Promise(function (resolve) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const MAX = 1280;
        let w = img.width;
        let h = img.height;

        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }

        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);

        canvas.toBlob(function (blob) {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// 사진 올리기
document.getElementById('photo-input').addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;

  const compressed = await compressImage(file);

  const formData = new FormData();
  formData.append('image', compressed);

  await fetch(`${API_URL}/api/images`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body:    formData,
  });

  await loadPhotos();
  current = photos.length - 1;  // 방금 올린 사진으로 이동
  renderSlide();

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

// 저장 / 수정 완료 버튼
document.getElementById('save-btn').addEventListener('click', async function () {
  const title   = document.getElementById('title-input').value.trim();
  const content = document.getElementById('content-input').value.trim();

  if (!title || !content) {
    alert('제목과 내용을 모두 입력해주세요!');
    return;
  }

  if (editingId) {
    await updateDiary(editingId, title, content);
  } else {
    await createDiary(title, content);
  }

  closeWritePanel();
  await renderDiaries();
});

// 제목 클릭 → 내용 펼치기 / 접기
function toggleDetail(tr) {
  const next   = tr.nextElementSibling;
  const isOpen = next && next.classList.contains('detail-row');

  // 열려 있는 다른 행 모두 닫기
  document.querySelectorAll('.detail-row').forEach(r => r.remove());
  document.querySelectorAll('tr.row-active').forEach(r => r.classList.remove('row-active'));

  if (!isOpen) {
    const detailTr = document.createElement('tr');
    detailTr.classList.add('detail-row');
    detailTr.innerHTML = `
      <td colspan="4">
        <div class="detail-content">
          <h3>${tr.dataset.title}</h3>
          <p>${tr.dataset.content}</p>
          <small>${tr.dataset.date}</small>
        </div>
      </td>
    `;
    tr.insertAdjacentElement('afterend', detailTr);
    tr.classList.add('row-active');
  }
}

// 수정 / 삭제 버튼 + 제목 클릭 (이벤트 위임)
diaryList.addEventListener('click', async function (event) {
  const btn = event.target;
  const id  = Number(btn.dataset.id);

  // 제목 클릭
  if (btn.classList.contains('diary-title')) {
    toggleDetail(btn.closest('tr'));
    return;
  }

  if (btn.classList.contains('edit-btn')) {
    const diaries = await fetchDiaries();
    const diary   = diaries.find(d => d.id === id);
    openWritePanel(diary);
  }

  if (btn.classList.contains('delete-btn')) {
    if (!confirm('이 일기를 삭제하시겠습니까?')) return;
    await deleteDiary(id);
    await renderDiaries();
  }
});

// 글쓰기 토글 버튼
document.getElementById('write-toggle-btn').addEventListener('click', function () {
  const panel = document.getElementById('write-panel');
  if (panel.classList.contains('open')) {
    closeWritePanel();
  } else {
    openWritePanel();
  }
});

// 취소 버튼
document.getElementById('cancel-write-btn').addEventListener('click', function () {
  closeWritePanel();
});

// 검색 버튼
document.getElementById('search-btn').addEventListener('click', async function () {
  const searchTerm = document.getElementById('search-input').value.trim();
  const searchType = document.getElementById('search-type').value;
  await renderDiaries(searchTerm, searchType);
});

// 검색창 엔터키
document.getElementById('search-input').addEventListener('keydown', async function (e) {
  if (e.key === 'Enter') {
    const searchType = document.getElementById('search-type').value;
    await renderDiaries(this.value.trim(), searchType);
  }
});

// 전체 선택 체크박스
document.getElementById('check-all').addEventListener('change', function () {
  document.querySelectorAll('.row-check').forEach(cb => cb.checked = this.checked);
});

// 선택 삭제 버튼
document.getElementById('bulk-delete-btn').addEventListener('click', async function () {
  const checked = document.querySelectorAll('.row-check:checked');
  if (checked.length === 0) {
    alert('삭제할 항목을 선택해주세요.');
    return;
  }
  if (!confirm(`${checked.length}개의 일기를 삭제하시겠습니까?`)) return;

  const ids = Array.from(checked).map(cb => Number(cb.dataset.id));
  await Promise.all(ids.map(id => deleteDiary(id)));
  await renderDiaries();
});

// ════════════════════════════════
//  초기 실행 — 토큰 있으면 바로 앱 화면으로
// ════════════════════════════════

if (getToken()) {
  showApp();
} else {
  showAuth();
}
