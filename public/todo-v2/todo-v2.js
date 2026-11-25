// ------------------------------
// TodoApiV2：V2 APIとの通信をまとめるクラス（V1のTodoApiは変更しない）
// ------------------------------
class TodoApiV2 {
  constructor(baseUrl = '/api/v2/todos') {
    this.baseUrl = baseUrl;
  }

  async request(path, options = {}) {
    const headers = options.body ? { 'Content-Type': 'application/json' } : {};
    const res = await fetch(this.baseUrl + path, { ...options, headers });

    if (res.status === 204) return null; // 本文なし

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

  // REQ-V2-01 一覧・絞り込み（filter: { completed?: boolean, priority?: string }）
  async list(filter = {}) {
    const params = new URLSearchParams();
    if (filter.completed !== undefined) params.set('completed', String(filter.completed));
    if (filter.priority !== undefined) params.set('priority', filter.priority);
    const query = params.toString();
    return this.request(query ? `?${query}` : '');
  }

  // REQ-V2-02 登録
  async create(title, priority) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify({ title, priority }),
    });
  }

  // REQ-V2-03 部分更新（changes: { isCompleted?, priority? }）
  async update(id, changes) {
    return this.request(`/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    });
  }

  // REQ-V2-04 削除
  async delete(id) {
    await this.request(`/${id}`, { method: 'DELETE' });
  }
}

// ------------------------------
// 画面の処理（TodoApiV2だけを使う）
// ------------------------------
const api = new TodoApiV2();

const PRIORITY_LABELS = { high: '高', normal: '中', low: '低' };

const form = document.getElementById('todo-form');
const titleInput = document.getElementById('todo-title');
const prioritySelect = document.getElementById('todo-priority');
const submitButton = document.getElementById('todo-submit');
const filterCompleted = document.getElementById('filter-completed');
const filterPriority = document.getElementById('filter-priority');
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

// 絞り込み欄の値をAPIの条件に変換する
function currentFilter() {
  const filter = {};
  if (filterCompleted.value !== '') filter.completed = filterCompleted.value === 'true';
  if (filterPriority.value !== '') filter.priority = filterPriority.value;
  return filter;
}

function createPrioritySelect(todo) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', '優先度を変更');
  for (const value of ['high', 'normal', 'low']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = PRIORITY_LABELS[value];
    option.selected = todo.priority === value;
    select.append(option);
  }
  select.addEventListener('change', () => changeTodo(todo.id, { priority: select.value }));
  return select;
}

function renderTodos(todos) {
  list.replaceChildren();
  emptyText.hidden = todos.length > 0;

  for (const todo of todos) {
    const item = document.createElement('li');
    item.className = 'todo-item' + (todo.isCompleted ? ' is-completed' : '');
    item.dataset.priority = todo.priority;

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.isCompleted;
    checkbox.addEventListener('change', () => changeTodo(todo.id, { isCompleted: checkbox.checked }));

    const title = document.createElement('span');
    title.className = 'todo-title';
    title.textContent = todo.title;

    label.append(checkbox, title);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '削除';
    deleteButton.addEventListener('click', () => removeTodo(todo.id, todo.title));

    item.append(label, createPrioritySelect(todo), deleteButton);
    list.append(item);
  }
}

async function loadTodos() {
  setStatus('読み込み中…');
  try {
    const todos = await api.list(currentFilter());
    renderTodos(todos);
    setStatus('');
  } catch (error) {
    setStatus('');
    showError(error);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError(null);
  submitButton.disabled = true;
  setStatus('登録中…');
  try {
    await api.create(titleInput.value, prioritySelect.value);
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

// 完了状態・優先度の部分更新
async function changeTodo(id, changes) {
  showError(null);
  setStatus('更新中…');
  try {
    await api.update(id, changes);
    await loadTodos();
  } catch (error) {
    setStatus('');
    showError(error);
    await loadTodos();
  }
}

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

filterCompleted.addEventListener('change', () => {
  showError(null);
  loadTodos();
});
filterPriority.addEventListener('change', () => {
  showError(null);
  loadTodos();
});

loadTodos();
