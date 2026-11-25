import { randomUUID } from 'crypto';
import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import {
  DEFAULT_ROOM_ID,
  acquireSeat,
  releaseSeat,
  touchSeats,
  insertMessage,
  selectLatestMessages,
  selectMessagesAfter,
  selectMaxMessageId,
  type ChatMessage,
} from './chatModel';
import { validatePost, type ChatErrorCode } from './chatValidation';

const SOCKET_ROOM = `chat:${DEFAULT_ROOM_ID}`;
const SEAT_TOUCH_INTERVAL_MS = 20_000; // 席の更新（回収まで60秒）
const SYNC_INTERVAL_MS = 2_000;        // 複数台向けのDB同期

type Ack = (response: Record<string, unknown>) => void;

// ログは段階とエラーの種類だけ（投稿内容・接続文字列は出さない）
function logError(stage: string, error: unknown): void {
  const err = error as { name?: unknown; code?: unknown };
  console.error('[chat]', JSON.stringify({
    stage,
    name: typeof err?.name === 'string' ? err.name : undefined,
    code: typeof err?.code === 'string' ? err.code : undefined,
  }));
}

function isDbUnavailable(error: unknown): boolean {
  const err = error as { code?: unknown; message?: unknown };
  const code = typeof err?.code === 'string' ? err.code : '';
  const message = typeof err?.message === 'string' ? err.message : '';
  return code.startsWith('08') || ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', '57P01', '57P03'].includes(code)
    || /timeout|Connection terminated/i.test(message);
}

function reply(ack: unknown, response: Record<string, unknown>): void {
  if (typeof ack === 'function') (ack as Ack)(response);
}

function fail(ack: unknown, code: ChatErrorCode): void {
  reply(ack, { ok: false, code });
}

// HTTPサーバーにSocket.IOを組み込み、チャットのイベント処理を登録する
export function initChat(httpServer: HttpServer): Server {
  const io = new Server(httpServer);
  const instanceId = randomUUID();          // このサーバー（プロセス）の識別子
  const seats = new Map<string, string>();  // socket.id → seat_id（このサーバーで参加中の接続）
  const joining = new Set<string>();        // 入室処理中の socket.id（二重入室の防止）
  const emittedIds = new Set<number>();     // このサーバーが配信済みの投稿ID
  let lastSyncedId: number | null = null;   // DB同期で確認済みの最大ID

  const rememberEmitted = (id: number): void => {
    emittedIds.add(id);
    if (emittedIds.size > 1000) {
      const oldest = emittedIds.values().next().value;
      if (oldest !== undefined) emittedIds.delete(oldest);
    }
  };

  const broadcast = (message: ChatMessage): void => {
    rememberEmitted(message.id);
    io.to(SOCKET_ROOM).emit('chat:message', message);
  };

  // 起動時点の最大IDから同期を始める（古い投稿を新着として配信しない）
  selectMaxMessageId(DEFAULT_ROOM_ID)
    .then((maxId) => { if (lastSyncedId === null) lastSyncedId = maxId; })
    .catch((error) => logError('sync-init', error));

  io.on('connection', (socket: Socket) => {
    // 入室（席の確保 → ルームに所属 → 最新20件を返す）
    socket.on('chat:join', async (_payload: unknown, ack: unknown) => {
      if (seats.has(socket.id)) {
        // 参加済みの接続は席を増やさず履歴だけ返す
        try {
          reply(ack, { ok: true, messages: await selectLatestMessages(DEFAULT_ROOM_ID) });
        } catch (error) {
          logError('join-history', error);
          fail(ack, 'DB_UNAVAILABLE');
        }
        return;
      }
      if (joining.has(socket.id)) return fail(ack, 'JOIN_FAILED');
      joining.add(socket.id);

      const seatId = randomUUID();
      try {
        const result = await acquireSeat({ roomId: DEFAULT_ROOM_ID, seatId, instanceId });
        if (!result.acquired) return fail(ack, 'ROOM_FULL'); // ルームには入れない
        if (!socket.connected) {
          await releaseSeat(seatId); // 入室処理中に切断された
          return;
        }
        seats.set(socket.id, seatId);
        await socket.join(SOCKET_ROOM);
        try {
          const messages = await selectLatestMessages(DEFAULT_ROOM_ID);
          reply(ack, { ok: true, messages });
        } catch (error) {
          // 履歴を返せない場合は参加を取り消す
          logError('join-history', error);
          await socket.leave(SOCKET_ROOM);
          seats.delete(socket.id);
          await releaseSeat(seatId).catch((e) => logError('release', e));
          fail(ack, 'DB_UNAVAILABLE');
        }
      } catch (error) {
        logError('join', error);
        fail(ack, isDbUnavailable(error) ? 'DB_UNAVAILABLE' : 'JOIN_FAILED');
      } finally {
        joining.delete(socket.id);
      }
    });

    // 投稿（参加確認 → 検証 → 保存 → 同じルームへ配信）
    socket.on('chat:send', async (payload: unknown, ack: unknown) => {
      if (!seats.has(socket.id)) return fail(ack, 'NOT_JOINED');
      const checked = validatePost(payload);
      if (!checked.ok) return fail(ack, checked.code);
      try {
        const message = await insertMessage(DEFAULT_ROOM_ID, checked.username, checked.comment);
        broadcast(message); // 保存に成功した投稿だけを配信
        reply(ack, { ok: true, id: message.id });
      } catch (error) {
        logError('send', error);
        fail(ack, 'SAVE_FAILED'); // 配信しない
      }
    });

    // 切断で席を解放
    socket.on('disconnect', async () => {
      const seatId = seats.get(socket.id);
      if (!seatId) return;
      seats.delete(socket.id);
      try {
        await releaseSeat(seatId);
      } catch (error) {
        logError('release', error); // 解放に失敗しても60秒後に回収される
      }
    });
  });

  // 席の最終確認時刻を定期的に更新
  setInterval(() => {
    touchSeats([...seats.values()]).catch((error) => logError('touch', error));
  }, SEAT_TOUCH_INTERVAL_MS).unref();

  // 複数台の同期：他のサーバーで保存された新着をDBから取得して配信
  let syncing = false;
  setInterval(async () => {
    if (syncing || seats.size === 0) return;
    syncing = true;
    try {
      if (lastSyncedId === null) {
        lastSyncedId = await selectMaxMessageId(DEFAULT_ROOM_ID);
        return;
      }
      const messages = await selectMessagesAfter(DEFAULT_ROOM_ID, lastSyncedId);
      for (const message of messages) {
        lastSyncedId = Math.max(lastSyncedId, message.id);
        if (!emittedIds.has(message.id)) broadcast(message);
      }
    } catch (error) {
      logError('sync', error);
    } finally {
      syncing = false;
    }
  }, SYNC_INTERVAL_MS).unref();

  return io;
}
