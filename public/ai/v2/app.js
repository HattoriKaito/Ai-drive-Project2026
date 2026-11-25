// AI対話アプリ V2（ブラウザ側）
// ・通信相手は自分のExpress（/api/ai/v2）だけ。APIキーはここにはない
// ・文字列はすべて textContent で表示する
// ・自動再送はしない。失敗時は入力を残して操作可能に戻す

const API = '/api/ai/v2/conversations';
const TITLE_MAX = 50;
const PROMPT_MAX = 2000;
const DISPLAY_LIMIT = 20;
const BROWSER_TIMEOUT_MS = 45_000;

const MESSAGES = {
  DEMO_DISABLED: '現在AI機能は停止中です。',
  INVALID_TITLE: '会話名を入力してください。',
  TITLE_TOO_LONG: '会話名は50文字以内で入力してください。',
  INVALID_PROMPT: '質問を入力してください。',
  PROMPT_TOO_LONG: '質問は2000文字以内で入力してください。',
  INVALID_ID: '会話IDが正しくありません。一覧から会話を選び直してください。',
  CONVERSATION_NOT_FOUND: '指定された会話が見つかりません。一覧から会話を選び直してください。',
  PAYLOAD_TOO_LARGE: '送信データが大きすぎます。',
  INVALID_JSON: '送信データの形式が正しくありません。',
  UNSUPPORTED_MEDIA_TYPE: '送信データの形式が正しくありません。',
  AI_UNAVAILABLE: 'AIから回答を取得できませんでした。時間をおいて再度送信してください。',
  AI_TIMEOUT: 'AIの応答が時間内に返りませんでした。時間をおいて再度送信してください。',
  AI_NOT_CONFIGURED: 'AI機能の設定が完了していません。',
  SAVE_FAILED: '回答を保存できませんでした。もう一度送信してください。',
  DB_UNAVAILABLE: 'データベースに接続できません。時間をおいて再度お試しください。',
  NETWORK_ERROR: '通信できませんでした。接続を確認してから再度お試しください。',
  BROWSER_TIMEOUT: '応答が時間内に返りませんでした。時間をおいて再度お試しください。',
  BAD_RESPONSE: 'サーバーから予期しない応答がありました。時間をおいて再度お試しください。',
};

const el = (id) => document.getElementById(id);
const errorText = el('v2-error');
const statusText = el('v2-status');
const newForm = el('v2-new-form');
const newTitle = el('v2-new-title');
const newSubmit = el('v2-new-submit');
const convEmpty = el('v2-conv-empty');
const convList = el('v2-conv-list');
const currentTitle = el('v2-current-title');
const turnsEmpty = el('v2-turns-empty');
const turnList = el('v2-turn-list');
const askForm = el('v2-ask-form');
const promptInput = el('v2-prompt');
const askSubmit = el('v2-ask-submit');
const counter = el('v2-counter');

const state = {
  conversations: [],
  currentId: null,
  turns: [],
  busy: false,
  demoDisabled: false,
  loadToken: 0, // 会話を素早く切り替えたとき、古い応答で別の会話の履歴を表示しないための番号
};

// ------------------------------
// 通信
// ------------------------------
class ApiFailure extends Error {
  constructor(code, status, requestId) {
    super(code);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BROWSER_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    throw new ApiFailure(error?.name === 'AbortError' ? 'BROWSER_TIMEOUT' : 'NETWORK_ERROR', 0);
  } finally {
    clearTimeout(timer);
  }
  let body = null;
  if ((res.headers.get('Content-Type') || '').includes('application/json')) {
    try { body = await res.json(); } catch { body = null; }
  }
  if (!res.ok) {
    const code = body?.error?.code;
    throw new ApiFailure(typeof code === 'string' ? code : 'BAD_RESPONSE', res.status, body?.error?.requestId);
  }
  if (!body || body.success !== true) throw new ApiFailure('BAD_RESPONSE', res.status);
  return body;
}

const postJson = (url, data) =>
  requestJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

const isConversation = (c) => c && Number.isInteger(c.id) && typeof c.title === 'string' && typeof c.createdAt === 'string';
const isTurn = (t) =>
  t && Number.isInteger(t.id) && Number.isInteger(t.conversationId) &&
  typeof t.prompt === 'string' && typeof t.response === 'string' && typeof t.createdAt === 'string';

// ------------------------------
// 表示
// ------------------------------
const codePointLength = (text) => [...text].length;

function toFailure(error) {
  return error instanceof ApiFailure ? error : new ApiFailure('BAD_RESPONSE', 0);
}

function showError(failure) {
  if (!failure) {
    errorText.hidden = true;
    errorText.textContent = '';
    return;
  }
  if (failure.code === 'DEMO_DISABLED') state.demoDisabled = true;
  const message = MESSAGES[failure.code] || MESSAGES.BAD_RESPONSE;
  errorText.textContent = failure.requestId ? `${message}（問い合わせID：${failure.requestId}）` : message;
  errorText.hidden = false;
}

function setStatus(message) {
  statusText.textContent = message;
}

function setBusy(on) {
  state.busy = on;
  const locked = on || state.demoDisabled;
  newTitle.disabled = locked;
  newSubmit.disabled = locked;
  for (const button of convList.querySelectorAll('button')) button.disabled = locked;
  const noConversation = state.currentId === null;
  promptInput.disabled = locked || noConversation;
  askSubmit.disabled = locked || noConversation;
  document.body.setAttribute('aria-busy', String(on));
}

function updateCounter() {
  const length = codePointLength(promptInput.value.trim());
  counter.textContent = `${length} / ${PROMPT_MAX}`;
  counter.classList.toggle('is-over', length > PROMPT_MAX);
}

function renderConversations() {
  convList.replaceChildren();
  convEmpty.hidden = state.conversations.length > 0;
  for (const conversation of state.conversations) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = conversation.title;
    button.setAttribute('aria-current', String(conversation.id === state.currentId));
    button.addEventListener('click', () => selectConversation(conversation.id));
    li.append(button);
    convList.append(li);
  }
}

function renderTurns() {
  turnList.replaceChildren();
  const current = state.conversations.find((c) => c.id === state.currentId);
  currentTitle.textContent = current ? current.title : '会話を選択してください';
  turnsEmpty.hidden = state.currentId === null || state.turns.length > 0;

  for (const turn of state.turns) {
    const li = document.createElement('li');
    li.className = 'v2-turn';
    const q = document.createElement('div');
    q.className = 'v2-label';
    q.textContent = 'あなた';
    const prompt = document.createElement('p');
    prompt.className = 'v2-prompt';
    prompt.textContent = turn.prompt;
    const a = document.createElement('div');
    a.className = 'v2-label';
    a.textContent = 'AI';
    const response = document.createElement('div');
    response.className = 'v2-response';
    response.textContent = turn.response;
    const time = document.createElement('time');
    time.className = 'v2-time';
    time.dateTime = turn.createdAt;
    const date = new Date(turn.createdAt);
    time.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ja-JP');
    li.append(q, prompt, a, response, time);
    turnList.append(li);
  }
}

// 選択中の会話IDをURLのハッシュ（#c=ID）に保存し、再読み込み後に開き直す
function readHashId() {
  const match = /^#c=([1-9][0-9]*)$/.exec(location.hash);
  return match ? Number(match[1]) : null;
}

function writeHashId(id) {
  history.replaceState(null, '', id === null ? location.pathname : `${location.pathname}#c=${id}`);
}

// ------------------------------
// 操作
// ------------------------------
async function loadConversations() {
  const body = await requestJson(API);
  if (!Array.isArray(body.items) || !body.items.every(isConversation)) throw new ApiFailure('BAD_RESPONSE', 200);
  state.conversations = body.items;
}

// 会話を選び、その会話の履歴（最新20往復）を取り直す
async function selectConversation(id) {
  if (state.busy || state.demoDisabled) return;
  const token = ++state.loadToken;
  state.currentId = id;
  state.turns = []; // 前の会話の履歴を先に消す
  writeHashId(id);
  renderConversations();
  renderTurns();
  showError(null);
  setBusy(true);
  setStatus('履歴を読み込み中…');
  try {
    const body = await requestJson(`${API}/${id}/turns`);
    if (!Array.isArray(body.items) || !body.items.every((t) => isTurn(t) && t.conversationId === id)) {
      throw new ApiFailure('BAD_RESPONSE', 200);
    }
    if (token !== state.loadToken) return; // 別の会話に切り替わっていたら表示しない
    state.turns = body.items.slice(-DISPLAY_LIMIT);
    renderTurns();
    setStatus('');
  } catch (error) {
    if (token !== state.loadToken) return;
    const failure = toFailure(error);
    if (failure.code === 'CONVERSATION_NOT_FOUND' || failure.code === 'INVALID_ID') {
      state.currentId = null;
      writeHashId(null);
      renderConversations();
      renderTurns();
    }
    turnsEmpty.hidden = true; // 取得失敗を0件と区別する
    setStatus('');
    showError(failure);
  } finally {
    if (token === state.loadToken) setBusy(false);
  }
}

newForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.busy || state.demoDisabled) return;
  const title = newTitle.value.trim();
  const length = codePointLength(title);
  if (length === 0) return showError(new ApiFailure('INVALID_TITLE', 0));
  if (length > TITLE_MAX) return showError(new ApiFailure('TITLE_TOO_LONG', 0));

  showError(null);
  setBusy(true);
  setStatus('会話を作成中…');
  let created = null;
  try {
    const body = await postJson(API, { title });
    if (!isConversation(body.item)) throw new ApiFailure('BAD_RESPONSE', 201);
    created = body.item;
    state.conversations = [created, ...state.conversations.filter((c) => c.id !== created.id)];
    newTitle.value = '';
    setStatus('');
  } catch (error) {
    setStatus('');
    showError(toFailure(error)); // 会話名は残す
  } finally {
    setBusy(false);
  }
  if (created) await selectConversation(created.id);
});

askForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.busy || state.demoDisabled || state.currentId === null) return;
  const prompt = promptInput.value.trim();
  const length = codePointLength(prompt);
  if (length === 0) return showError(new ApiFailure('INVALID_PROMPT', 0));
  if (length > PROMPT_MAX) return showError(new ApiFailure('PROMPT_TOO_LONG', 0));

  const conversationId = state.currentId;
  showError(null);
  setBusy(true);
  setStatus('AIが回答を作成中…');
  try {
    const body = await postJson(`${API}/${conversationId}/turns`, { prompt });
    if (!isTurn(body.item) || body.item.conversationId !== conversationId) throw new ApiFailure('BAD_RESPONSE', 201);
    if (state.currentId === conversationId) {
      state.turns = [...state.turns, body.item].slice(-DISPLAY_LIMIT);
      renderTurns();
    }
    promptInput.value = ''; // 成功したときだけ質問を消す
    setStatus('回答を保存しました。');
  } catch (error) {
    setStatus('');
    showError(toFailure(error)); // 質問は残す。自動再送はしない
  } finally {
    setBusy(false);
    updateCounter();
    if (!state.demoDisabled) promptInput.focus();
  }
});

promptInput.addEventListener('input', updateCounter);

// 初期表示：会話一覧を取得し、ハッシュの会話があれば開き直す
async function init() {
  updateCounter();
  setBusy(true);
  setStatus('会話を読み込み中…');
  try {
    await loadConversations();
    renderConversations();
    renderTurns();
    setStatus('');
  } catch (error) {
    convEmpty.hidden = true;
    setStatus('');
    showError(toFailure(error));
  } finally {
    setBusy(false);
  }
  const hashId = readHashId();
  if (hashId !== null && !state.demoDisabled) {
    if (state.conversations.some((c) => c.id === hashId)) {
      await selectConversation(hashId);
    } else {
      writeHashId(null);
      showError(new ApiFailure('CONVERSATION_NOT_FOUND', 404));
    }
  }
}

init();
