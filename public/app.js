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
  document.getElementById('welcome-text').textContent   = getUsername();
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
  const img      = document.getElementById('slide-img');
  const noMsg    = document.getElementById('no-photo-msg');
  const counter  = document.getElementById('slide-counter');
  const exifInfo = document.getElementById('photo-exif-info');

  if (photos.length === 0) {
    img.style.display   = 'none';
    noMsg.style.display = 'block';
    counter.textContent = '';
    if (exifInfo) exifInfo.innerHTML = '';
  } else {
    const photo         = photos[current];
    img.src             = photo.url;
    img.style.display   = 'block';
    noMsg.style.display = 'none';
    counter.textContent = `${current + 1} / ${photos.length}`;
    if (exifInfo) exifInfo.innerHTML = buildExifHtml(photo);
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

// EXIF 메타정보 읽기 (압축 전 원본 파일에서 호출)
async function readExifData(file) {
  try {
    if (typeof exifr === 'undefined') return {};
    const data = await exifr.parse(file, { gps: true, exif: true });
    if (!data) return {};
    const result = {};
    if (data.DateTimeOriginal instanceof Date) {
      const d = data.DateTimeOriginal;
      result.exif_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      result.exif_lat = data.latitude.toFixed(5);
      result.exif_lon = data.longitude.toFixed(5);
    }
    return result;
  } catch (e) {
    return {};
  }
}

// EXIF 정보를 HTML 문자열로 변환
function buildExifHtml(photo) {
  const dateText = photo.exif_date
    ? `📅 ${photo.exif_date}`
    : '📅 촬영 날짜: 정보 없음';
  let locationText = '📍 위치: 정보 없음';
  if (photo.exif_lat && photo.exif_lon) {
    const mapsUrl = `https://maps.google.com/?q=${photo.exif_lat},${photo.exif_lon}`;
    locationText = `📍 <a href="${mapsUrl}" target="_blank" rel="noopener">${photo.exif_lat}, ${photo.exif_lon}</a>`;
  }
  return `<span>${dateText}</span><span>${locationText}</span>`;
}

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

    const exif       = await readExifData(files[i]);  // 압축 전 원본에서 EXIF 추출
    const compressed = await compressImage(files[i]);
    const formData   = new FormData();
    formData.append('image', compressed);
    if (exif.exif_date) formData.append('exif_date', exif.exif_date);
    if (exif.exif_lat)  formData.append('exif_lat',  exif.exif_lat);
    if (exif.exif_lon)  formData.append('exif_lon',  exif.exif_lon);

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
    document.getElementById('tab-diary').style.display    = tab === 'diary'     ? 'block' : 'none';
    document.getElementById('tab-family').style.display   = tab === 'family'    ? 'block' : 'none';
    document.getElementById('tab-calendar').style.display = tab === 'calendar'  ? 'block' : 'none';

    if (tab === 'family') {
      loadFamilyPhotos();
      renderFamilyPosts();
    }
    if (tab === 'diary') {
      loadPhotos();
      renderDiaries();
    }
    if (tab === 'calendar') {
      loadCalendarEvents();
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

  document.getElementById('family-modal-date').textContent = photo.date;

  const exifEl = document.getElementById('family-modal-exif');
  if (exifEl) exifEl.innerHTML = buildExifHtml(photo);

  document.getElementById('family-modal-desc-input').value = photo.description || '';
  document.getElementById('family-modal').style.display    = 'flex';
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
    familyFiles.push({ file, exif: {} });
  } else {
    const exif       = await readExifData(file);  // 압축 전 원본에서 EXIF 추출
    const compressed = await compressImage(file);
    familyFiles.push({ file: compressed, exif });
  }
  renderFamilyQueue();
  document.getElementById('family-upload-form').style.display = 'block';
}

function renderFamilyQueue() {
  const queue = document.getElementById('family-queue');
  queue.innerHTML = '';
  familyFiles.forEach(function (entry, idx) {
    const file = entry.file;
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
    const { file, exif } = familyFiles[i];
    const formData = new FormData();
    formData.append('image', file);
    formData.append('description', description);
    if (exif.exif_date) formData.append('exif_date', exif.exif_date);
    if (exif.exif_lat)  formData.append('exif_lat',  exif.exif_lat);
    if (exif.exif_lon)  formData.append('exif_lon',  exif.exif_lon);
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

async function renderComments(postId, listEl) {
  const res      = await fetch(`${API_URL}/api/family-posts/${postId}/comments`, { headers: authHeaders() });
  const comments = await res.json();

  if (comments.length === 0) {
    listEl.innerHTML = '<p class="comment-empty">아직 댓글이 없어요. 첫 댓글을 남겨보세요!</p>';
    return;
  }

  listEl.innerHTML = comments.map(function (c) {
    const deleteBtnHtml = c.author === getUsername()
      ? `<button class="comment-delete-btn" data-id="${c.id}">삭제</button>`
      : '';
    return `
      <div class="comment-item">
        <div class="comment-header">
          <span class="comment-author">${c.author}</span>
          <span class="comment-date">${c.date}</span>
          ${deleteBtnHtml}
        </div>
        <p class="comment-content">${c.content}</p>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.comment-delete-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const commentId = Number(this.dataset.id);
      await fetch(`${API_URL}/api/family-posts/${postId}/comments/${commentId}`, {
        method:  'DELETE',
        headers: authHeaders(),
      });
      await renderComments(postId, listEl);
    });
  });
}

async function toggleFamilyDetail(tr) {
  const next   = tr.nextElementSibling;
  const isOpen = next && next.classList.contains('detail-row');

  document.querySelectorAll('.detail-row').forEach(function (r) { r.remove(); });
  document.querySelectorAll('tr.row-active').forEach(function (r) { r.classList.remove('row-active'); });

  if (!isOpen) {
    const postId   = Number(tr.dataset.id);
    const detailTr = document.createElement('tr');
    detailTr.classList.add('detail-row');
    detailTr.innerHTML = `
      <td colspan="4">
        <div class="detail-content">
          <h3>${tr.dataset.title}</h3>
          <p>${tr.dataset.content}</p>
          <small>${tr.dataset.date}</small>
          <div class="comment-section">
            <p class="comment-section-title">댓글</p>
            <div class="comment-list"></div>
            <div class="comment-form">
              <input type="text" class="comment-input" placeholder="댓글을 입력하세요" />
              <button class="comment-submit-btn">등록</button>
            </div>
          </div>
        </div>
      </td>
    `;

    tr.insertAdjacentElement('afterend', detailTr);
    tr.classList.add('row-active');

    const listEl    = detailTr.querySelector('.comment-list');
    const input     = detailTr.querySelector('.comment-input');
    const submitBtn = detailTr.querySelector('.comment-submit-btn');

    await renderComments(postId, listEl);

    async function submitComment() {
      const content = input.value.trim();
      if (!content) return;
      input.disabled    = true;
      submitBtn.disabled = true;
      await fetch(`${API_URL}/api/family-posts/${postId}/comments`, {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ content }),
      });
      input.value        = '';
      input.disabled     = false;
      submitBtn.disabled = false;
      await renderComments(postId, listEl);
    }

    submitBtn.addEventListener('click', submitComment);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submitComment();
    });
  }
}

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
    await toggleFamilyDetail(btn.closest('tr'));
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
//  캘린더
// ════════════════════════════════

let calYear               = new Date().getFullYear();
let calMonth              = new Date().getMonth() + 1;
let calEvents             = [];
let calSelectedDate       = null;
let calEditingId          = null;
let calSelectedFile       = null;
let calFileRemoved        = false;
let calOriginalFileUrl    = null;
let calRecurrenceGroupId  = null;

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

async function loadCalendarEvents() {
  const res  = await fetch(`${API_URL}/api/calendar?year=${calYear}&month=${calMonth}`, {
    headers: authHeaders(),
  });
  calEvents = await res.json();
  renderCalendar();
  if (calSelectedDate) showDayPanel(calSelectedDate);
}

function renderCalendar() {
  document.getElementById('cal-month-title').textContent = `${calYear}년 ${calMonth}월`;

  const grid        = document.getElementById('cal-grid');
  grid.innerHTML    = '';

  const firstDay    = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const today       = new Date();
  const todayStr    = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const eventMap = {};
  calEvents.forEach(function (ev) {
    const d = ev.event_date.slice(0, 10);
    if (!eventMap[d]) eventMap[d] = [];
    eventMap[d].push(ev);
  });

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-cell cal-empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dow     = (firstDay + d - 1) % 7;
    const cell    = document.createElement('div');
    cell.className = 'cal-cell';
    if (dateStr === todayStr)       cell.classList.add('cal-today');
    if (dateStr === calSelectedDate) cell.classList.add('cal-selected');

    const numSpan = document.createElement('span');
    numSpan.className   = 'cal-day-num';
    numSpan.textContent = d;
    if (dow === 0) numSpan.classList.add('cal-num-sun');
    if (dow === 6) numSpan.classList.add('cal-num-sat');
    cell.appendChild(numSpan);

    const evList = eventMap[dateStr];
    if (evList && evList.length > 0) {
      const dotsWrap = document.createElement('div');
      dotsWrap.className = 'cal-dots';
      const shown = Math.min(evList.length, 3);
      for (let i = 0; i < shown; i++) {
        const dot = document.createElement('span');
        dot.className = 'cal-dot';
        dotsWrap.appendChild(dot);
      }
      if (evList.length > 3) {
        const more = document.createElement('span');
        more.className   = 'cal-dot-more';
        more.textContent = `+${evList.length - 3}`;
        dotsWrap.appendChild(more);
      }
      cell.appendChild(dotsWrap);

      // 첫 이벤트 제목 미리보기 (데스크탑)
      const label = document.createElement('div');
      label.className   = 'cal-event-chip';
      label.textContent = (evList[0].recurrence !== 'none' ? '↺ ' : '') + evList[0].title;
      cell.appendChild(label);
      if (evList.length > 1) {
        const more = document.createElement('div');
        more.className   = 'cal-event-chip-more';
        more.textContent = `+${evList.length - 1}`;
        cell.appendChild(more);
      }
    }

    cell.dataset.date = dateStr;
    cell.addEventListener('click', function () {
      calSelectedDate = this.dataset.date;
      renderCalendar();
      showDayPanel(calSelectedDate);
    });

    grid.appendChild(cell);
  }
}

function showDayPanel(dateStr) {
  const panel = document.getElementById('cal-day-panel');
  const title = document.getElementById('cal-day-title');
  const list  = document.getElementById('cal-event-list');

  const date = new Date(dateStr + 'T00:00:00');
  title.textContent = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${DAY_NAMES[date.getDay()]})`;
  panel.style.display = 'block';

  const dayEvents = calEvents.filter(ev => ev.event_date.slice(0, 10) === dateStr);
  list.innerHTML = '';

  if (dayEvents.length === 0) {
    list.innerHTML = '<p class="cal-no-event">일정이 없어요. 추가해보세요!</p>';
    return;
  }

  dayEvents.forEach(function (ev) {
    const item = document.createElement('div');
    item.className = 'cal-event-item';

    let fileHtml = '';
    if (ev.file_url) {
      if (ev.file_type === 'image') {
        fileHtml = `<a href="${ev.file_url}" target="_blank" rel="noopener"><img src="${ev.file_url}" class="cal-event-thumb" /></a>`;
      } else {
        fileHtml = `<a href="${ev.file_url}" target="_blank" rel="noopener" class="cal-pdf-link">📄 ${ev.file_name}</a>`;
      }
    }

    const recurBadge = ev.recurrence && ev.recurrence !== 'none'
      ? `<span class="cal-recur-badge">${RECUR_LABEL[ev.recurrence]}</span>` : '';

    item.innerHTML = `
      <div class="cal-event-main">
        <div class="cal-event-info">
          <strong class="cal-event-title-text">${ev.title}${recurBadge}</strong>
          ${ev.description ? `<p class="cal-event-desc-text">${ev.description}</p>` : ''}
          ${fileHtml}
        </div>
        <button class="cal-event-edit-btn edit-btn" data-id="${ev.id}">수정</button>
      </div>
    `;

    item.querySelector('.cal-event-edit-btn').addEventListener('click', function () {
      openCalEventModal(ev);
    });

    list.appendChild(item);
  });
}

const RECUR_LABEL = { weekly: '매주', monthly: '매월', yearly: '매년' };

function openCalEventModal(ev = null) {
  calEditingId          = ev ? ev.id : null;
  calSelectedFile       = null;
  calFileRemoved        = false;
  calOriginalFileUrl    = ev ? ev.file_url : null;
  calRecurrenceGroupId  = ev ? (ev.recurrence_group_id || null) : null;

  const titleInput     = document.getElementById('cal-event-title');
  const dateInput      = document.getElementById('cal-event-date');
  const descInput      = document.getElementById('cal-event-desc');
  const fileInput      = document.getElementById('cal-event-file');
  const deleteBtn      = document.getElementById('cal-modal-delete-btn');
  const preview        = document.getElementById('cal-file-preview');
  const heading        = document.getElementById('cal-modal-heading');
  const recurrenceRow  = document.getElementById('cal-recurrence-row');
  const recurrenceSel  = document.getElementById('cal-event-recurrence');

  fileInput.value   = '';
  preview.innerHTML = '';

  if (ev) {
    heading.textContent     = '일정 수정';
    titleInput.value        = ev.title;
    dateInput.value         = ev.event_date.slice(0, 10);
    descInput.value         = ev.description || '';
    deleteBtn.style.display = 'inline-block';
    // 수정 시 반복 설정 변경 불가 — 현재 값 표시만
    recurrenceRow.style.display = ev.recurrence && ev.recurrence !== 'none' ? 'flex' : 'none';
    recurrenceSel.value         = ev.recurrence || 'none';
    recurrenceSel.disabled      = true;

    if (ev.file_url) {
      if (ev.file_type === 'image') {
        preview.innerHTML = `<img src="${ev.file_url}" class="cal-file-preview-img" /><button type="button" class="cal-remove-file">✕ 파일 제거</button>`;
      } else {
        preview.innerHTML = `<a href="${ev.file_url}" target="_blank" class="cal-pdf-link">📄 ${ev.file_name}</a><button type="button" class="cal-remove-file">✕ 파일 제거</button>`;
      }
      preview.querySelector('.cal-remove-file').addEventListener('click', function () {
        calFileRemoved     = true;
        calSelectedFile    = null;
        calOriginalFileUrl = null;
        preview.innerHTML  = '';
      });
    }
  } else {
    heading.textContent         = '일정 추가';
    titleInput.value            = '';
    dateInput.value             = calSelectedDate || '';
    descInput.value             = '';
    deleteBtn.style.display     = 'none';
    recurrenceRow.style.display = 'flex';
    recurrenceSel.value         = 'none';
    recurrenceSel.disabled      = false;
  }

  document.getElementById('cal-event-modal').style.display = 'flex';
  titleInput.focus();
}

// 파일 선택 미리보기
document.getElementById('cal-event-file').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  calSelectedFile  = file;
  calFileRemoved   = false;

  const preview = document.getElementById('cal-file-preview');
  if (file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" class="cal-file-preview-img" /><span class="cal-file-name-text">${file.name}</span>`;
  } else {
    preview.innerHTML = `<span class="cal-pdf-link">📄 ${file.name}</span>`;
  }
});

// 일정 저장
document.getElementById('cal-modal-save-btn').addEventListener('click', async function () {
  const title   = document.getElementById('cal-event-title').value.trim();
  const dateVal = document.getElementById('cal-event-date').value;
  const desc    = document.getElementById('cal-event-desc').value.trim();
  const recSel  = document.getElementById('cal-event-recurrence');

  if (!title || !dateVal) {
    alert('제목과 날짜를 입력해주세요.');
    return;
  }

  const formData = new FormData();
  formData.append('title',      title);
  formData.append('event_date', dateVal);
  if (desc) formData.append('description', desc);

  if (!calEditingId) {
    formData.append('recurrence', recSel.value);
  }

  if (calSelectedFile) {
    formData.append('file', calSelectedFile);
  } else if (calEditingId && calFileRemoved) {
    formData.append('remove_file', '1');
  }

  let scope = 'single';
  if (calEditingId && calRecurrenceGroupId) {
    const all = confirm('반복 일정을 모두 수정할까요?\n확인: 전체 수정 / 취소: 이 일정만 수정');
    scope = all ? 'all' : 'single';
  }
  if (calEditingId) formData.append('scope', scope);

  const url    = calEditingId ? `${API_URL}/api/calendar/${calEditingId}` : `${API_URL}/api/calendar`;
  const method = calEditingId ? 'PUT' : 'POST';

  await fetch(url, {
    method,
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body:    formData,
  });

  document.getElementById('cal-event-modal').style.display = 'none';
  await loadCalendarEvents();
});

// 일정 삭제
document.getElementById('cal-modal-delete-btn').addEventListener('click', async function () {
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;

  let scope = 'single';
  if (calRecurrenceGroupId) {
    const all = confirm('반복 일정을 모두 삭제할까요?\n확인: 전체 삭제 / 취소: 이 일정만 삭제');
    scope = all ? 'all' : 'single';
  }

  await fetch(`${API_URL}/api/calendar/${calEditingId}?scope=${scope}`, {
    method:  'DELETE',
    headers: authHeaders(),
  });
  document.getElementById('cal-event-modal').style.display = 'none';
  await loadCalendarEvents();
});

// 모달 닫기
document.getElementById('cal-modal-close').addEventListener('click', function () {
  document.getElementById('cal-event-modal').style.display = 'none';
});
document.getElementById('cal-event-modal').addEventListener('click', function (e) {
  if (e.target === this) this.style.display = 'none';
});
document.getElementById('cal-modal-cancel-btn').addEventListener('click', function () {
  document.getElementById('cal-event-modal').style.display = 'none';
});

// 날짜 패널의 "일정 추가" 버튼
document.getElementById('cal-add-event-btn').addEventListener('click', function () {
  openCalEventModal(null);
});

// 이전/다음 달 버튼
document.getElementById('cal-prev-month').addEventListener('click', function () {
  calMonth--;
  if (calMonth < 1) { calMonth = 12; calYear--; }
  calSelectedDate = null;
  document.getElementById('cal-day-panel').style.display = 'none';
  loadCalendarEvents();
});

document.getElementById('cal-next-month').addEventListener('click', function () {
  calMonth++;
  if (calMonth > 12) { calMonth = 1; calYear++; }
  calSelectedDate = null;
  document.getElementById('cal-day-panel').style.display = 'none';
  loadCalendarEvents();
});

// ════════════════════════════════
//  배경음악 플레이어 (셔플 + 첫 인터랙션 자동재생)
// ════════════════════════════════

const bgAudio         = new Audio();
bgAudio.volume        = 0.2;
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
