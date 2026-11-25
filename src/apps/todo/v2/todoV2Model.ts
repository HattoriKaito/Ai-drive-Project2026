import { pool } from '../../../../db';

export const PRIORITIES = ['low', 'normal', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

// APIで返すV2のTODO（JSONのキーはcamelCase）
export type TodoV2 = {
  id: number;
  title: string;
  isCompleted: boolean;
  priority: Priority;
  createdAt: string;
};

type TodoV2Row = {
  id: number;
  title: string;
  is_completed: boolean;
  priority: Priority;
  created_at: Date;
};

export type TodoV2Filter = { completed?: boolean; priority?: Priority };
export type TodoV2Changes = { isCompleted?: boolean; priority?: Priority };

const COLUMNS = 'id, title, is_completed, priority, created_at';

function toTodoV2(row: TodoV2Row): TodoV2 {
  return {
    id: row.id,
    title: row.title,
    isCompleted: row.is_completed,
    priority: row.priority,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// REQ-V2-01 一覧・絞り込み（条件の有無でWHEREを組み立て、値はプレースホルダで渡す）
export async function listTodosV2(filter: TodoV2Filter): Promise<TodoV2[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filter.completed !== undefined) {
    values.push(filter.completed);
    conditions.push(`is_completed = $${values.length}`);
  }
  if (filter.priority !== undefined) {
    values.push(filter.priority);
    conditions.push(`priority = $${values.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query<TodoV2Row>(
    `SELECT ${COLUMNS} FROM v2_todo_tasks ${where} ORDER BY id`,
    values
  );
  return result.rows.map(toTodoV2);
}

// REQ-V2-02 登録
export async function createTodoV2(title: string, priority: Priority): Promise<TodoV2> {
  const result = await pool.query<TodoV2Row>(
    `INSERT INTO v2_todo_tasks (title, priority) VALUES ($1, $2) RETURNING ${COLUMNS}`,
    [title, priority]
  );
  return toTodoV2(result.rows[0]);
}

// REQ-V2-03 部分更新（送られた項目だけSETする。対象がなければnull）
export async function updateTodoV2(id: number, changes: TodoV2Changes): Promise<TodoV2 | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (changes.isCompleted !== undefined) {
    values.push(changes.isCompleted);
    sets.push(`is_completed = $${values.length}`);
  }
  if (changes.priority !== undefined) {
    values.push(changes.priority);
    sets.push(`priority = $${values.length}`);
  }
  values.push(id);
  const result = await pool.query<TodoV2Row>(
    `UPDATE v2_todo_tasks SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${COLUMNS}`,
    values
  );
  return result.rows.length > 0 ? toTodoV2(result.rows[0]) : null;
}

// REQ-V2-04 削除
export async function deleteTodoV2(id: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM v2_todo_tasks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
