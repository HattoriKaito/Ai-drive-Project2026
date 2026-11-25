// リアルタイムチャット（ブラウザ側）
// ・接続後に chat:join で入室し、許可された場合だけ履歴・新着を表示する
// ・投稿の行は chat:message を受け取ったときだけ追加する（送信者に二重表示しない）
// ・ユーザー名・コメントは textContent で表示する
// ・イベントリスナーはページ読み込み時に1回だけ登録する（再接続で増やさない）

(() => {
  const app = document.getElementById('chat-app');
  const USERNAME_MAX = Number(app.dataset.usernameMax) || 20;
  const COMMENT_MAX = Number(app.dataset.commentMax) || 500;
  const ACK_TIMEOUT_MS = 10_000;
  const DISPLAY_MAX = 200; // 画面に残す最大件数（入室・再入室時は最新20件に置き換える）

  const MESSAGES = {
    ROOM_FULL: '現在、チャットルームは満席です。',
    NOT_JOINED: '入室していないため送信できません。再接続をお待ちください。',
    INVALID_USERNAME: 'ユーザー名を入力してください。',
    USERNAME_TOO_LONG: `ユーザー名は${USERNAME_MAX}文字以内で入力してください。`,
    INVALID_COMMENT: 'コメントを入力してください。',
    COMMENT_TOO_LONG: `コメントは${COMMENT_MAX}文字以内で入力してください。`,
    SAVE_FAILED: '投稿を保存できませんでした。もう一度送信してください。',
    DB_UNAVAILABLE: 'データベースに接続できません。時間をおいて再試行してください。',
    JOIN_FAILED: '入室できませんでした。再試行してください。',
    ACK_TIMEOUT: '送信結果を確認できませんでした。再接続後の履歴で投稿されたか確認してから、必要なら送り直してください。',
    JOIN_TIMEOUT: '入室の応答がありませんでした。再試行してください。',
    UNKNOWN: '予期しないエラーが発生しました。',
  };

  const el = (id) => document.getElementById(id);
  const connection = el('chat-connection');
  const fullBox = el('chat-full');
  const retryButton = el('chat-retry');
  const errorText = el('chat-error');
  const emptyText = el('chat-empty');
  const list = el('chat-list');
  const room = list.parentElement;
  const form = el('chat-form');
  const usernameInput = el('chat-username');
  const commentInput = el('chat-comment');
  const sendButton = el('chat-send');
  const statusText = el('chat-status');

  const state = {
    joined: false,
    joining: false,
    sending: false,
    messages: new Map(), // 投稿ID → 投稿（IDで重複を除く）
    pending: [],         // 入室の応答待ちの間に届いた新着
  };

  const codePointLength = (text) => [...text].length;

  const isMessage = (m) =>
    m && Number.isInteger(m.id) && typeof m.username === 'string' &&
    typeof m.comment === 'string' && typeof m.createdAt === 'string';

  function setConnection(text, kind) {
    connection.textContent = text;
    connection.className = `chat-connection is-${kind}`;
  }

  function showError(code) {
    if (!code) {
      errorText.hidden = true;
      errorText.textContent = '';
      return;
    }
    errorText.textContent = MESSAGES[code] || MESSAGES.UNKNOWN;
    errorText.hidden = false;
  }

  function updateForm() {
    const enabled = state.joined && !state.sending && socket.connected;
    usernameInput.disabled = !state.joined;
    commentInput.disabled = !state.joined;
    sendButton.disabled = !enabled;
  }

  function render() {
    const sorted = [...state.messages.values()].sort((a, b) => a.id - b.id).slice(-DISPLAY_MAX);
    list.replaceChildren();
    for (const message of sorted) {
      const li = document.createElement('li');
      li.className = 'chat-item';
      li.dataset.id = String(message.id);

      const meta = document.createElement('div');
      meta.className = 'chat-meta';
      const user = document.createElement('span');
      user.className = 'chat-user';
      user.textContent = message.username;
      const time = document.createElement('time');
      time.dateTime = message.createdAt;
      const date = new Date(message.createdAt);
      time.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ja-JP');
      meta.append(user, time);

      const text = document.createElement('p');
      text.className = 'chat-text';
      text.textContent = message.comment;

      li.append(meta, text);
      list.append(li);
    }
    emptyText.hidden = !state.joined || sorted.length > 0;
    room.scrollTop = room.scrollHeight;
  }

  function addMessage(message) {
    if (!isMessage(message)) return;
    state.messages.set(message.id, message);
  }

  function clearRoom() {
    state.messages.clear();
    render();
  }

  // ------------------------------
  // Socket.IO
  // ------------------------------
  const socket = io(); // 同じサーバーの /socket.io/ に接続（自動再接続あり）

  function join() {
    if (state.joining || !socket.connected) return;
    state.joining = true;
    state.pending = [];
    fullBox.hidden = true;
    retryButton.disabled = true;
    setConnection('入室中…', 'connecting');

    socket.timeout(ACK_TIMEOUT_MS).emit('chat:join', null, (err, res) => {
      state.joining = false;
      retryButton.disabled = false;
      if (err) {
        setConnection('入室失敗', 'disconnected');
        showError('JOIN_TIMEOUT');
        fullBox.hidden = false;
        return;
      }
      if (res && res.ok && Array.isArray(res.messages)) {
        // 履歴（最新20件・古い順）と、応答待ちの間に届いた新着をIDでまとめる
        state.messages = new Map();
        res.messages.forEach(addMessage);
        state.pending.forEach(addMessage);
        state.pending = [];
        state.joined = true;
        fullBox.hidden = true;
        showError(null);
        setConnection('入室済み', 'joined');
        render();
        updateForm();
        return;
      }
      state.joined = false;
      clearRoom();
      updateForm();
      if (res && res.code === 'ROOM_FULL') {
        setConnection('満席', 'full');
        showError(null);
        fullBox.hidden = false; // 履歴・新着・投稿は使えない
      } else {
        setConnection('入室失敗', 'disconnected');
        showError(res && res.code ? res.code : 'JOIN_FAILED');
        fullBox.hidden = false;
      }
    });
  }

  socket.on('connect', () => {
    showError(null);
    join(); // 初回接続・再接続のたびに入室し、最新20件を取り直す
  });

  socket.on('disconnect', () => {
    state.joined = false;
    state.joining = false;
    setConnection('再接続中…', 'disconnected');
    updateForm(); // 切断中は送信できない
  });

  socket.on('connect_error', () => {
    setConnection('接続できません（再接続中…）', 'disconnected');
  });

  socket.on('chat:message', (message) => {
    if (state.joining) {
      state.pending.push(message); // 履歴の応答と後でまとめる
      return;
    }
    if (!state.joined) return;
    addMessage(message);
    render();
  });

  retryButton.addEventListener('click', () => {
    showError(null);
    if (socket.connected) join();
    else socket.connect();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.joined || state.sending || !socket.connected) return;

    const username = usernameInput.value.trim();
    const comment = commentInput.value.trim();
    if (codePointLength(username) === 0) return showError('INVALID_USERNAME');
    if (codePointLength(username) > USERNAME_MAX) return showError('USERNAME_TOO_LONG');
    if (codePointLength(comment) === 0) return showError('INVALID_COMMENT');
    if (codePointLength(comment) > COMMENT_MAX) return showError('COMMENT_TOO_LONG');

    state.sending = true;
    showError(null);
    statusText.textContent = '送信中…';
    updateForm();

    socket.timeout(ACK_TIMEOUT_MS).emit('chat:send', { username, comment }, (err, res) => {
      state.sending = false;
      statusText.textContent = '';
      if (err) {
        showError('ACK_TIMEOUT'); // 入力は残す。自動で再送しない
      } else if (res && res.ok) {
        commentInput.value = ''; // 成功時だけコメントを消す（行は chat:message で追加される）
        commentInput.focus();
      } else {
        showError(res && res.code ? res.code : 'UNKNOWN');
      }
      updateForm();
    });
  });
})();
