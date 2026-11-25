import { pool } from '../../../db';

// APIで返すTODO（JSONのキーはcamelCase）
export type Todo = {
  id: number;
  title: string;
  isCompleted: boolean;
  createdAt: string;
};

// DBの行（列名はsnake_case）
type TodoRow = {
  id: number;
  title: string;
  is_completed: boolean;
  created_at: Date;
};

const COLUMNS = 'id, title, is_completed, created_at';

// DBの行をAPI用の形に変換する
function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    isCompleted: row.is_completed,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// REQ-01 一覧（id昇順）
export async function listTodos(): Promise<Todo[]> {
  const result = await pool.query<TodoRow>(
    `SELECT ${COLUMNS} FROM todo_tasks ORDER BY id`
  );
  return result.rows.map(toTodo);
}

// REQ-02 登録
export async function createTodo(title: string): Promise<Todo> {
  const result = await pool.query<TodoRow>(
    `INSERT INTO todo_tasks (title) VALUES ($1) RETURNING ${COLUMNS}`,
    [title]
  );
  return toTodo(result.rows[0]);
}

// REQ-03 完了状態の部分更新（対象がなければnull）
export async function updateTodoCompleted(
  id: number,
  isCompleted: boolean
): Promise<Todo | null> {
  const result = await pool.query<TodoRow>(
    `UPDATE todo_tasks SET is_completed = $1 WHERE id = $2 RETURNING ${COLUMNS}`,
    [isCompleted, id]
  );
  return result.rows.length > 0 ? toTodo(result.rows[0]) : null;
}

// REQ-04 削除（削除できたらtrue）
export async function deleteTodo(id: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM todo_tasks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
