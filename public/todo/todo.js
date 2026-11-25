// ------------------------------
// TodoApi：APIとの通信をまとめるクラス
// ------------------------------
class TodoApi {
  constructor(baseUrl = '/api/v1/todos') {
    this.baseUrl = baseUrl;
  }

  // 共通の通信処理。失敗時はcodeとmessageを持つErrorを投げる
  async request(path, options = {}) {
    const headers = options.body ? { 'Content-Type': 'application/json' } : {};
    const res = await fetch(this.baseUrl + path, { ...options, headers });

    // 204は本文がないためJSONとして解析しない
    if (res.status === 204) return null;

    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      const error = new Error(body?.message ?? `通信に失敗しました（${res.status}）`);
      error.status = res.status;
      error.code = body?.code ?? 'UNKNOWN_ERROR';
      error.details = body?.details ?? [];
      throw error;
    }
    return body?.data;
  }

  // REQ-01 一覧（配列を返す）
  async list() {
    return this.request('');
  }

  // REQ-02 登録（登録したTODOを返す）
  async create(title) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  // REQ-03 完了状態の部分更新（更新したTODOを返す）
  async update(id, isCompleted) {
    return this.request(`/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted }),
    });
  }

  // REQ-04 削除（値を返さない）
  async delete(id) {
    await this.request(`/${id}`, { method: 'DELETE' });
  }
}

// ------------------------------
// 画面の処理（fetchやURLは書かず、TodoApiだけを使う）
// ------------------------------
const api = new TodoApi();

const form = document.getElementById('todo-form');
const titleInput = document.getElementById('todo-title');
const submitButton = document.getElementById('todo-submit');
const statusText = document.getElementById('todo-status');
const errorText = document.getElementById('todo-error');
const emptyText = document.getElementById('todo-empty');
const list = document.getElementById('todo-list');

function setStatus(message) {
  statusText.textContent = message;
}

function showError(error) {
  errorText.textContent = error ? error.message : '';
  errorText.hidden = !error;
}

// 一覧を描画する（タイトルはtextContentで表示）
function renderTodos(todos) {
  list.replaceChildren();
  emptyText.hidden = todos.length > 0;

  for (const todo of todos) {
    const item = document.createElement('li');
    item.className = 'todo-item' + (todo.isCompleted ? ' is-completed' : '');

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.isCompleted;
    checkbox.addEventListener('change', () => toggleTodo(todo.id, checkbox.checked));

    const title = document.createElement('span');
    title.className = 'todo-title';
    title.textContent = todo.title;

    label.append(checkbox, title);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '削除';
    deleteButton.addEventListener('click', () => removeTodo(todo.id, todo.title));

    item.append(label, deleteButton);
    list.append(item);
  }
}

// 一覧を取得して表示し直す
async function loadTodos() {
  setStatus('読み込み中…');
  try {
    const todos = await api.list();
    renderTodos(todos);
    setStatus('');
  } catch (error) {
    setStatus('');
    showError(error);
  }
}

// 登録
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError(null);
  submitButton.disabled = true;
  setStatus('登録中…');
  try {
    await api.create(titleInput.value);
    titleInput.value = '';
    await loadTodos();
  } catch (error) {
    setStatus('');
    showError(error);
  } finally {
    submitButton.disabled = false;
    titleInput.focus();
  }
});

// 完了状態の切り替え
async function toggleTodo(id, isCompleted) {
  showError(null);
  setStatus('更新中…');
  try {
    await api.update(id, isCompleted);
    await loadTodos();
  } catch (error) {
    setStatus('');
    showError(error);
    await loadTodos(); // 画面とDBの状態をそろえる
  }
}

// 削除（確認ダイアログでOKのときだけ）
async function removeTodo(id, title) {
  if (!confirm(`「${title}」を削除しますか？`)) return;
  showError(null);
  setStatus('削除中…');
  try {
    await api.delete(id);
    await loadTodos();
  } catch (error) {
    setStatus('');
    showError(error);
    await loadTodos();
  }
}

loadTodos();
