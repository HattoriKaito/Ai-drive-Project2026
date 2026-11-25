// AI質問アプリ（ブラウザ側）
// ・通信相手は自分のExpress（/api/ai）だけ。APIキーはここにはない
// ・質問・回答・エラーは textContent で表示し、HTMLとして解釈させない
// ・自動再送はしない（再送は利用者が送信ボタンを押したときだけ）

const PROMPT_MAX_LENGTH = 2000;   // Unicodeコードポイント数
const HISTORY_LIMIT = 20;
const BROWSER_TIMEOUT_MS = 45_000; // ブラウザ側の待機 45秒

// サーバーの固定コードに対応する案内（応答の文面ではなく、画面側の固定文を表示する）
const MESSAGES = {
  DEMO_DISABLED: '現在AI機能は停止中です。',
  INVALID_PROMPT: '質問を入力してください。',
  PROMPT_TOO_LONG: '質問は2000文字以内で入力してください。',
  PAYLOAD_TOO_LARGE: '質問が長すぎます。短くして送信してください。',
  INVALID_JSON: '送信データの形式が正しくありません。',
  UNSUPPORTED_MEDIA_TYPE: '送信データの形式が正しくありません。',
  AI_UNAVAILABLE: 'AIから回答を取得できませんでした。時間をおいて再度送信してください。',
  AI_TIMEOUT: 'AIの応答が時間内に返りませんでした。時間をおいて再度送信してください。',
  AI_NOT_CONFIGURED: 'AI機能の設定が完了していません。',
  SAVE_FAILED: '回答を保存できませんでした。もう一度送信してください。',
  DB_UNAVAILABLE: 'データベースに接続できません。時間をおいて再度お試しください。',
  HISTORY_FAILED: '履歴を取得できませんでした。',
  NETWORK_ERROR: '通信できませんでした。接続を確認してから再度送信してください。',
  BROWSER_TIMEOUT: '応答が時間内に返りませんでした。時間をおいて再度送信してください。',
  BAD_RESPONSE: 'サーバーから予期しない応答がありました。時間をおいて再度お試しください。',
};

const form = document.getElementById('ai-form');
const promptInput = document.getElementById('ai-prompt');
const submitButton = document.getElementById('ai-submit');
const counter = document.getElementById('ai-counter');
const statusText = document.getElementById('ai-status');
const errorText = document.getElementById('ai-error');
const emptyText = document.getElementById('ai-empty');
const list = document.getElementById('ai-list');

let busy = false;
let demoDisabled = false;
let items = [];

// ------------------------------
// 通信（共通）
// ------------------------------
class ApiFailure extends Error {
  constructor(code, status, requestId) {
    super(code);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

// fetchは400や500では例外にならないため res.ok も判定する。HTMLや不正JSONも失敗として扱う
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
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const code = body?.error?.code;
    throw new ApiFailure(typeof code === 'string' ? code : 'BAD_RESPONSE', res.status, body?.error?.requestId);
  }
  if (!body || body.success !== true) {
    throw new ApiFailure('BAD_RESPONSE', res.status);
  }
  return body;
}

// 1件の形を確認する
function isValidItem(item) {
  return (
    item &&
    Number.isInteger(item.id) &&
    typeof item.prompt === 'string' &&
    typeof item.response === 'string' &&
    typeof item.createdAt === 'string'
  );
}

// ------------------------------
// 画面の状態
// ------------------------------
function setBusy(on) {
  busy = on;
  form.setAttribute('aria-busy', String(on));
  const locked = on || demoDisabled;
  promptInput.disabled = locked;
  submitButton.disabled = locked;
}

function setStatus(message) {
  statusText.textContent = message;
}

function showError(failure) {
  if (!failure) {
    errorText.hidden = true;
    errorText.textContent = '';
    return;
  }
  const message = MESSAGES[failure.code] || MESSAGES.BAD_RESPONSE;
  errorText.textContent = failure.requestId ? `${message}（問い合わせID：${failure.requestId}）` : message;
  errorText.hidden = false;
}

function codePointLength(text) {
  return [...text].length;
}

function updateCounter() {
  const length = codePointLength(promptInput.value.trim());
  counter.textContent = `${length} / ${PROMPT_MAX_LENGTH}`;
  counter.classList.toggle('is-over', length > PROMPT_MAX_LENGTH);
}

function formatTime(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ja-JP');
}

// 履歴を描画する（textContentだけを使う）
function renderHistory() {
  list.replaceChildren();
  emptyText.hidden = items.length > 0;

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'ai-item';

    const promptLabel = document.createElement('div');
    promptLabel.className = 'ai-item-label';
    promptLabel.textContent = '質問';

    const prompt = document.createElement('p');
    prompt.className = 'ai-item-prompt';
    prompt.textContent = item.prompt;

    const responseLabel = document.createElement('div');
    responseLabel.className = 'ai-item-label';
    responseLabel.textContent = 'AIの回答';

    const response = document.createElement('div');
    response.className = 'ai-item-response';
    response.textContent = item.response;

    const time = document.createElement('time');
    time.className = 'ai-item-time';
    time.dateTime = item.createdAt;
    time.textContent = formatTime(item.createdAt);

    li.append(promptLabel, prompt, responseLabel, response, time);
    list.append(li);
  }
}

function handleDemoDisabled(failure) {
  if (failure?.code === 'DEMO_DISABLED') {
    demoDisabled = true;
    setStatus('');
  }
}

// ------------------------------
// TASK-05 初期履歴の取得
// ------------------------------
async function loadHistory() {
  setBusy(true);
  showError(null);
  setStatus('履歴を読み込み中…');
  try {
    const body = await requestJson('/api/ai/history');
    if (!Array.isArray(body.items) || !body.items.every(isValidItem)) {
      throw new ApiFailure('BAD_RESPONSE', 200);
    }
    items = body.items.slice(0, HISTORY_LIMIT);
    renderHistory(); // 0件は正常として「履歴がありません」を表示
    setStatus('');
  } catch (error) {
    // 取得失敗は0件表示と区別する（0件表示は出さない）
    const failure = error instanceof ApiFailure ? error : new ApiFailure('BAD_RESPONSE', 0);
    emptyText.hidden = true;
    setStatus('');
    handleDemoDisabled(failure);
    showError(failure);
  } finally {
    setBusy(false);
  }
}

// ------------------------------
// TASK-06 質問の送信
// ------------------------------
form.addEventListener('submit', async (event) => {
  event.preventDefault(); // 通常のフォーム送信（画面遷移）を止める
  if (busy || demoDisabled) return; // 待機中の重複送信を防ぐ

  const prompt = promptInput.value.trim();
  const length = codePointLength(prompt);
  if (length === 0) {
    showError(new ApiFailure('INVALID_PROMPT', 0));
    return;
  }
  if (length > PROMPT_MAX_LENGTH) {
    showError(new ApiFailure('PROMPT_TOO_LONG', 0));
    return;
  }

  setBusy(true);
  showError(null);
  setStatus('AIが回答を作成中…');
  try {
    const body = await requestJson('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!isValidItem(body.item)) {
      throw new ApiFailure('BAD_RESPONSE', 201);
    }
    // 保存された結果を先頭に追加し、最大20件にする
    items = [body.item, ...items.filter((item) => item.id !== body.item.id)].slice(0, HISTORY_LIMIT);
    renderHistory();
    promptInput.value = ''; // 成功したときだけ質問を消す
    setStatus('回答を保存しました。');
  } catch (error) {
    // 失敗時は質問を残し、固定の案内を表示する（自動再送はしない）
    const failure = error instanceof ApiFailure ? error : new ApiFailure('BAD_RESPONSE', 0);
    setStatus('');
    handleDemoDisabled(failure);
    showError(failure);
  } finally {
    setBusy(false); // 成功・失敗どちらでも操作可能に戻す
    updateCounter();
    if (!demoDisabled) promptInput.focus();
  }
});

promptInput.addEventListener('input', updateCounter);

updateCounter();
loadHistory();
