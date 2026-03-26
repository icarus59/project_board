// ════════════════════════════════
//  API 주소 설정
//  배포 후 이 값을 클라우드타입 주소로 바꾸세요
// ════════════════════════════════

const API_URL = 'http://localhost:3000';

// ════════════════════════════════
//  API 통신 함수 (서버와 대화)
// ════════════════════════════════

// R: 전체 일기 목록 가져오기
async function fetchDiaries() {
  const response = await fetch(`${API_URL}/api/diaries`);
  return await response.json();
}

// C: 일기 추가 요청
async function createDiary(title, content) {
  await fetch(`${API_URL}/api/diaries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
}

// U: 일기 수정 요청
async function updateDiary(id, newTitle, newContent) {
  await fetch(`${API_URL}/api/diaries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: newTitle, content: newContent }),
  });
}

// D: 일기 삭제 요청
async function deleteDiary(id) {
  await fetch(`${API_URL}/api/diaries/${id}`, {
    method: 'DELETE',
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
//  이벤트 처리
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
//  초기 실행
// ════════════════════════════════
renderDiaries();
