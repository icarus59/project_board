// ════════════════════════════════
//  API 주소 설정
//  배포 후 이 값을 클라우드타입 주소로 바꾸세요
// ════════════════════════════════

const API_URL = 'https://port-0-project-board-mn7inx3x932cf37f.sel3.cloudtype.app';

// ════════════════════════════════
//  통계
// ════════════════════════════════

async function loadUserCount() {
  try {
    const url  = window.location.hostname === 'localhost' ? '/api/stats' : `${API_URL}/api/stats`;
    const res  = await fetch(url);
    const data = await res.json();
    const el   = document.getElementById('user-count-text');
    if (el) el.textContent = `현재 가입자 수: ${data.userCount}명`;
  } catch (e) {
    // 조회 실패 시 무시
  }
}

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
  loadFamilyPhotos();
  renderFamilyPosts();
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

async function fetchMyInfo() {
  return await fetch(`${API_URL}/api/auth/me`, {
    headers: authHeaders(),
  });
}

async function withdrawAccount() {
  return await fetch(`${API_URL}/api/auth/me`, {
    method:  'DELETE',
    headers: authHeaders(),
  });
}

async function register(username, password, phone, birthDate) {
  return await fetch(`${API_URL}/api/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password, phone, birthDate }),
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
  const files = Array.from(this.files);
  if (files.length === 0) return;

  const uploadLabel = document.getElementById('upload-label');
  const originalText = uploadLabel.childNodes[0].nodeValue;

  for (let i = 0; i < files.length; i++) {
    if (files.length > 1) {
      uploadLabel.childNodes[0].nodeValue = `업로드 중... (${i + 1}/${files.length})`;
    }

    const compressed = await compressImage(files[i]);
    const formData = new FormData();
    formData.append('image', compressed);

    await fetch(`${API_URL}/api/images`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body:    formData,
    });
  }

  uploadLabel.childNodes[0].nodeValue = originalText;
  await loadPhotos();
  current = photos.length - 1;  // 방금 올린 마지막 사진으로 이동
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
  const username  = document.getElementById('register-username').value.trim();
  const password  = document.getElementById('register-password').value.trim();
  const phone     = document.getElementById('register-phone').value.trim();
  const birthDate = document.getElementById('register-birth-date').value;

  if (!username || !password) {
    alert('아이디와 비밀번호를 입력해주세요!');
    return;
  }

  const response = await register(username, password, phone, birthDate);
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

// 마이페이지 열기
document.getElementById('mypage-btn').addEventListener('click', async function () {
  const res  = await fetchMyInfo();
  const data = await res.json();

  document.getElementById('mypage-username').textContent = data.username || '-';
  document.getElementById('mypage-phone').textContent    = data.phone || '미입력';
  document.getElementById('mypage-birth').textContent    = data.birth_date
    ? data.birth_date.slice(0, 10)
    : '미입력';

  document.getElementById('mypage-modal').style.display = 'flex';
});

// 마이페이지 닫기
document.getElementById('mypage-close-btn').addEventListener('click', function () {
  document.getElementById('mypage-modal').style.display = 'none';
});

document.getElementById('mypage-modal').addEventListener('click', function (e) {
  if (e.target === this) this.style.display = 'none';
});

// 회원 탈퇴
document.getElementById('withdraw-btn').addEventListener('click', async function () {
  const confirmed = confirm('정말 탈퇴하시겠습니까?\n모든 일기, 사진, 가족앨범이 영구 삭제됩니다.');
  if (!confirmed) return;

  const res = await withdrawAccount();
  if (res.ok) {
    alert('탈퇴가 완료되었습니다.');
    clearAuth();
    document.getElementById('mypage-modal').style.display = 'none';
    showAuth();
  } else {
    const data = await res.json();
    alert(data.message || '탈퇴 처리 중 오류가 발생했습니다.');
  }
});

// 회원가입 모달 열기 / 닫기
document.getElementById('show-register').addEventListener('click', function (e) {
  e.preventDefault();
  document.getElementById('register-username').value   = '';
  document.getElementById('register-password').value   = '';
  document.getElementById('register-phone').value      = '';
  document.getElementById('register-birth-date').value = '';
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
//  탭 전환
// ════════════════════════════════

document.querySelectorAll('.tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');

    const tab = this.dataset.tab;
    document.getElementById('tab-diary').style.display  = tab === 'diary'  ? 'block' : 'none';
    document.getElementById('tab-family').style.display = tab === 'family' ? 'block' : 'none';

    if (tab === 'family') {
      loadFamilyPhotos();
      renderFamilyPosts();
    }
    if (tab === 'diary') {
      loadPhotos();
      renderDiaries();
    }
  });
});

// ════════════════════════════════
//  가족앨범
// ════════════════════════════════

let familyFiles   = [];
let familyPhotos  = [];
let familyCurrent = 0;
let familyModalId = null;

async function loadFamilyPhotos() {
  const response = await fetch(`${API_URL}/api/family`, { headers: authHeaders() });
  familyPhotos   = await response.json();
  familyCurrent  = 0;
  renderFamilyCarousel();
}

function renderFamilyCarousel() {
  const track    = document.getElementById('family-carousel-track');
  const emptyMsg = document.getElementById('family-empty-msg');
  const counter  = document.getElementById('family-counter');
  const carousel = document.getElementById('family-carousel');

  track.innerHTML = '';

  if (familyPhotos.length === 0) {
    carousel.style.display  = 'none';
    emptyMsg.style.display  = 'block';
    counter.textContent     = '';
    return;
  }

  carousel.style.display = 'flex';
  emptyMsg.style.display = 'none';
  counter.textContent    = `${familyCurrent + 1} / ${familyPhotos.length}`;

  // 현재, 이전, 다음 인덱스
  const total = familyPhotos.length;
  const indices = total === 1
    ? [familyCurrent]
    : total === 2
      ? [familyCurrent, (familyCurrent + 1) % total]
      : [
          (familyCurrent - 1 + total) % total,
          familyCurrent,
          (familyCurrent + 1) % total,
        ];

  indices.forEach(function (idx, pos) {
    const photo   = familyPhotos[idx];
    const isCenter = (total === 1) || (total === 2 ? pos === 0 : pos === 1);
    const item    = document.createElement('div');
    item.className = 'carousel-item' + (isCenter ? ' carousel-center' : ' carousel-side');
    item.dataset.id = photo.id;

    const media = photo.file_type === 'video'
      ? `<video src="${photo.url}" preload="metadata"></video>`
      : `<img src="${photo.url}" alt="가족사진" loading="lazy" />`;

    item.innerHTML = `
      ${media}
      ${isCenter && photo.description ? `<div class="carousel-desc">${photo.description}</div>` : ''}
    `;

    item.addEventListener('click', function () {
      if (isCenter) {
        openFamilyModal(photo);
      } else {
        familyCurrent = idx;
        renderFamilyCarousel();
      }
    });

    track.appendChild(item);
  });
}

function openFamilyModal(photo) {
  familyModalId = photo.id;
  const mediaEl = document.getElementById('family-modal-media');
  mediaEl.innerHTML = photo.file_type === 'video'
    ? `<video src="${photo.url}" controls></video>`
    : `<img src="${photo.url}" alt="가족사진" />`;

  document.getElementById('family-modal-date').textContent     = photo.date;
  document.getElementById('family-modal-desc-input').value     = photo.description || '';
  document.getElementById('family-modal').style.display        = 'flex';
}

// 모달 닫기
document.getElementById('family-modal-close').addEventListener('click', function () {
  document.getElementById('family-modal').style.display = 'none';
});
document.getElementById('family-modal').addEventListener('click', function (e) {
  if (e.target === this) this.style.display = 'none';
});

// 모달 수정 저장
document.getElementById('family-modal-save-btn').addEventListener('click', async function () {
  const description = document.getElementById('family-modal-desc-input').value.trim();
  await fetch(`${API_URL}/api/family/${familyModalId}`, {
    method:  'PATCH',
    headers: authHeaders(),
    body:    JSON.stringify({ description }),
  });
  document.getElementById('family-modal').style.display = 'none';
  await loadFamilyPhotos();
});

// 모달 삭제
document.getElementById('family-modal-delete-btn').addEventListener('click', async function () {
  if (!confirm('이 사진을 삭제하시겠습니까?')) return;
  await fetch(`${API_URL}/api/family/${familyModalId}`, {
    method:  'DELETE',
    headers: authHeaders(),
  });
  document.getElementById('family-modal').style.display = 'none';
  await loadFamilyPhotos();
});

// 캐러셀 이전/다음 버튼
document.getElementById('family-prev-btn').addEventListener('click', function () {
  if (familyPhotos.length === 0) return;
  familyCurrent = (familyCurrent - 1 + familyPhotos.length) % familyPhotos.length;
  renderFamilyCarousel();
});
document.getElementById('family-next-btn').addEventListener('click', function () {
  if (familyPhotos.length === 0) return;
  familyCurrent = (familyCurrent + 1) % familyPhotos.length;
  renderFamilyCarousel();
});

// 큐에 파일 추가 후 미리보기 렌더링
async function addToFamilyQueue(file) {
  if (file.type.startsWith('video/')) {
    if (file.size > 50 * 1024 * 1024) {
      alert('동영상은 50MB 이하만 업로드 가능합니다.');
      return;
    }
    familyFiles.push(file);
  } else {
    const compressed = await compressImage(file);
    familyFiles.push(compressed);
  }
  renderFamilyQueue();
  document.getElementById('family-upload-form').style.display = 'block';
}

function renderFamilyQueue() {
  const queue = document.getElementById('family-queue');
  queue.innerHTML = '';
  familyFiles.forEach(function (file, idx) {
    const item = document.createElement('div');
    item.className = 'family-queue-item';

    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.className = 'family-queue-thumb';
      item.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.className = 'family-queue-thumb';
      item.appendChild(img);
    }

    const del = document.createElement('button');
    del.className   = 'family-queue-del';
    del.textContent = '✕';
    del.addEventListener('click', function () {
      familyFiles.splice(idx, 1);
      if (familyFiles.length === 0) {
        document.getElementById('family-upload-form').style.display = 'none';
      } else {
        renderFamilyQueue();
      }
    });
    item.appendChild(del);
    queue.appendChild(item);
  });
}

// 파일 선택 (여러 장 동시 선택 지원)
document.getElementById('family-photo-input').addEventListener('change', async function () {
  const files = Array.from(this.files);
  if (files.length === 0) return;
  this.value = '';
  for (const file of files) {
    await addToFamilyQueue(file);
  }
  document.getElementById('family-description').value = '';
});

// "+ 더 추가" 파일 선택
document.getElementById('family-photo-input-more').addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;
  this.value = '';
  await addToFamilyQueue(file);
});

// 저장 버튼
document.getElementById('family-save-btn').addEventListener('click', async function () {
  if (familyFiles.length === 0) return;

  const description = document.getElementById('family-description').value.trim();
  const saveBtn     = document.getElementById('family-save-btn');
  saveBtn.disabled  = true;

  for (let i = 0; i < familyFiles.length; i++) {
    saveBtn.textContent = familyFiles.length > 1
      ? `업로드 중... (${i + 1}/${familyFiles.length})`
      : '저장 중...';
    const formData = new FormData();
    formData.append('image', familyFiles[i]);
    formData.append('description', description);
    await fetch(`${API_URL}/api/family`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body:    formData,
    });
  }

  saveBtn.textContent = '저장하기';
  saveBtn.disabled    = false;
  document.getElementById('family-upload-form').style.display = 'none';
  familyFiles = [];
  await loadFamilyPhotos();
});

// 취소 버튼
document.getElementById('family-cancel-btn').addEventListener('click', function () {
  document.getElementById('family-upload-form').style.display = 'none';
  familyFiles = [];
});

// ════════════════════════════════
//  가족 게시판
// ════════════════════════════════

let familyEditingId = null;
const familyPostList = document.getElementById('family-post-list');

async function fetchFamilyPosts() {
  const res = await fetch(`${API_URL}/api/family-posts`, { headers: authHeaders() });
  return await res.json();
}

async function renderFamilyPosts(searchTerm = '', searchType = 'title') {
  const posts = await fetchFamilyPosts();
  familyPostList.innerHTML = '';

  const filtered = searchTerm
    ? posts.filter(p =>
        (searchType === 'title' ? p.title : p.content)
          .toLowerCase().includes(searchTerm.toLowerCase()))
    : posts;

  if (filtered.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" class="board-empty">등록된 글이 없어요.</td>`;
    familyPostList.appendChild(tr);
    return;
  }

  filtered.forEach(function (post) {
    const tr = document.createElement('tr');
    tr.dataset.id      = post.id;
    tr.dataset.title   = post.title;
    tr.dataset.content = post.content;
    tr.dataset.date    = post.date;
    tr.innerHTML = `
      <td class="col-check"><input type="checkbox" class="family-row-check" data-id="${post.id}" /></td>
      <td class="col-title">
        <span class="diary-title">${post.title}</span>
        <span class="row-actions">
          <button class="edit-btn family-edit-btn" data-id="${post.id}">수정</button>
          <button class="delete-btn family-delete-btn" data-id="${post.id}">삭제</button>
        </span>
      </td>
      <td class="col-author">${post.author}</td>
      <td class="col-date">${post.date}</td>
    `;
    familyPostList.appendChild(tr);
  });
}

function openFamilyWritePanel(post = null) {
  const panel        = document.getElementById('family-write-panel');
  const panelTitle   = document.getElementById('family-write-panel-title');
  const titleInput   = document.getElementById('family-title-input');
  const contentInput = document.getElementById('family-content-input');
  const saveBtn      = document.getElementById('family-save-post-btn');

  if (post) {
    familyEditingId        = post.id;
    panelTitle.textContent = '글 수정';
    titleInput.value       = post.title;
    contentInput.value     = post.content;
    saveBtn.textContent    = '수정 완료';
  } else {
    familyEditingId        = null;
    panelTitle.textContent = '글쓰기';
    titleInput.value       = '';
    contentInput.value     = '';
    saveBtn.textContent    = '저장하기';
  }

  panel.classList.add('open');
  document.getElementById('family-write-toggle-btn').textContent = '닫기';
  titleInput.focus();
}

function closeFamilyWritePanel() {
  document.getElementById('family-write-panel').classList.remove('open');
  document.getElementById('family-write-toggle-btn').textContent = '글쓰기';
  familyEditingId = null;
}

// 저장 / 수정 완료
document.getElementById('family-save-post-btn').addEventListener('click', async function () {
  const title   = document.getElementById('family-title-input').value.trim();
  const content = document.getElementById('family-content-input').value.trim();

  if (!title || !content) {
    alert('제목과 내용을 모두 입력해주세요!');
    return;
  }

  if (familyEditingId) {
    await fetch(`${API_URL}/api/family-posts/${familyEditingId}`, {
      method:  'PUT',
      headers: authHeaders(),
      body:    JSON.stringify({ title, content }),
    });
  } else {
    await fetch(`${API_URL}/api/family-posts`, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify({ title, content }),
    });
  }

  closeFamilyWritePanel();
  await renderFamilyPosts();
});

// 취소 버튼
document.getElementById('family-cancel-write-btn').addEventListener('click', function () {
  closeFamilyWritePanel();
});

// 글쓰기 토글
document.getElementById('family-write-toggle-btn').addEventListener('click', function () {
  const panel = document.getElementById('family-write-panel');
  if (panel.classList.contains('open')) {
    closeFamilyWritePanel();
  } else {
    openFamilyWritePanel();
  }
});

// 수정 / 삭제 / 제목 클릭 (이벤트 위임)
familyPostList.addEventListener('click', async function (event) {
  const btn = event.target;
  const id  = Number(btn.dataset.id);

  if (btn.classList.contains('diary-title')) {
    toggleDetail(btn.closest('tr'));
    return;
  }

  if (btn.classList.contains('family-edit-btn')) {
    const posts = await fetchFamilyPosts();
    const post  = posts.find(p => p.id === id);
    openFamilyWritePanel(post);
  }

  if (btn.classList.contains('family-delete-btn')) {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return;
    await fetch(`${API_URL}/api/family-posts/${id}`, {
      method:  'DELETE',
      headers: authHeaders(),
    });
    await renderFamilyPosts();
  }
});

// 전체 선택
document.getElementById('family-check-all').addEventListener('change', function () {
  document.querySelectorAll('.family-row-check').forEach(cb => cb.checked = this.checked);
});

// 선택 삭제
document.getElementById('family-bulk-delete-btn').addEventListener('click', async function () {
  const checked = document.querySelectorAll('.family-row-check:checked');
  if (checked.length === 0) {
    alert('삭제할 항목을 선택해주세요.');
    return;
  }
  if (!confirm(`${checked.length}개의 게시글을 삭제하시겠습니까?`)) return;

  const ids = Array.from(checked).map(cb => Number(cb.dataset.id));
  await Promise.all(ids.map(id =>
    fetch(`${API_URL}/api/family-posts/${id}`, {
      method:  'DELETE',
      headers: authHeaders(),
    })
  ));
  await renderFamilyPosts();
});

// 검색
document.getElementById('family-search-btn').addEventListener('click', async function () {
  const searchTerm = document.getElementById('family-search-input').value.trim();
  const searchType = document.getElementById('family-search-type').value;
  await renderFamilyPosts(searchTerm, searchType);
});

document.getElementById('family-search-input').addEventListener('keydown', async function (e) {
  if (e.key === 'Enter') {
    const searchType = document.getElementById('family-search-type').value;
    await renderFamilyPosts(this.value.trim(), searchType);
  }
});

// ════════════════════════════════
//  배경음악 플레이어 (셔플 + 첫 인터랙션 자동재생)
// ════════════════════════════════

const bgAudio         = new Audio();
bgAudio.volume        = 0.45;
let musicTracks       = [];
let musicOrder        = [];
let musicIndex        = 0;
let musicPlaying      = false;
let userInteracted    = false;

function shuffleTracks(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function setMusicTrack(idx) {
  const track = musicTracks[idx];
  bgAudio.src = track.url;
  document.getElementById('music-track-name').textContent = '♪ ' + track.name.replace(/\.mp3$/i, '');
}

function startPlayback() {
  if (musicTracks.length === 0 || musicPlaying) return;
  bgAudio.play().then(function () {
    musicPlaying = true;
    document.getElementById('music-play-btn').textContent = '⏸';
  }).catch(function () {});
}

function playMusicNext() {
  musicIndex = (musicIndex + 1) % musicOrder.length;
  if (musicIndex === 0) musicOrder = shuffleTracks(musicOrder);
  setMusicTrack(musicOrder[musicIndex]);
  bgAudio.play().catch(function () {});
}

bgAudio.addEventListener('ended', playMusicNext);

async function initMusicPlayer() {
  try {
    const baseUrl = window.location.hostname === 'localhost' ? '' : API_URL;
    const res     = await fetch(baseUrl + '/api/music');
    musicTracks   = await res.json();
    if (musicTracks.length === 0) return;

    musicOrder = shuffleTracks(musicTracks.map(function (_, i) { return i; }));
    musicIndex = 0;
    setMusicTrack(musicOrder[musicIndex]);

    // 이미 인터랙션이 있었으면 바로 재생
    if (userInteracted) startPlayback();
  } catch (e) {
    // 음악 없으면 조용히 무시
  }
}

// 플레이어 영역 외 첫 클릭/키입력 시 자동재생
function onFirstInteraction(e) {
  if (e.target.closest && e.target.closest('#music-player')) return;
  document.removeEventListener('click',   onFirstInteraction);
  document.removeEventListener('keydown', onFirstInteraction);
  userInteracted = true;
  startPlayback();
}
document.addEventListener('click',   onFirstInteraction);
document.addEventListener('keydown', onFirstInteraction);

document.getElementById('music-play-btn').addEventListener('click', function () {
  if (musicTracks.length === 0) return;
  userInteracted = true;
  if (musicPlaying) {
    bgAudio.pause();
    musicPlaying = false;
    this.textContent = '▶';
  } else {
    bgAudio.play().then(function () {
      musicPlaying = true;
      document.getElementById('music-play-btn').textContent = '⏸';
    }).catch(function () {});
  }
});

document.getElementById('music-prev-btn').addEventListener('click', function () {
  if (musicTracks.length === 0) return;
  musicIndex = (musicIndex - 1 + musicOrder.length) % musicOrder.length;
  setMusicTrack(musicOrder[musicIndex]);
  if (musicPlaying) bgAudio.play().catch(function () {});
});

document.getElementById('music-next-btn').addEventListener('click', function () {
  if (musicTracks.length === 0) return;
  playMusicNext();
  document.getElementById('music-play-btn').textContent = '⏸';
  musicPlaying = true;
});

initMusicPlayer();

// ════════════════════════════════
//  초기 실행 — 토큰 있으면 바로 앱 화면으로
// ════════════════════════════════

if (getToken()) {
  showApp();
} else {
  showAuth();
  loadUserCount();
}
