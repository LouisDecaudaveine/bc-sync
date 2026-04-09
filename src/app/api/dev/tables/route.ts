import { getDb } from "@/lib/db";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface TableInfo {
  name: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

/** GET — return all tables with their rows and column metadata. */
export async function GET() {
  const db = getDb();
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
    .all() as TableInfo[];

  const result: Record<
    string,
    { columns: ColumnInfo[]; rows: Record<string, unknown>[] }
  > = {};

  for (const { name } of tables) {
    const columns = db.prepare(`PRAGMA table_info('${name}')`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }>;
    const rows = db.prepare(`SELECT * FROM "${name}"`).all() as Record<
      string,
      unknown
    >[];
    result[name] = {
      columns: columns.map((c) => ({
        name: c.name,
        type: c.type,
        notnull: c.notnull,
        pk: c.pk,
      })),
      rows,
    };
  }

  return Response.json(result);
}

/** PATCH — update a single cell.
 *  Body: { table, rowId: { column: value, ... }, updates: { column: value, ... } }
 */
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as {
    table: string;
    rowId: Record<string, unknown>;
    updates: Record<string, unknown>;
  };

  const { table, rowId, updates } = body;

  // Validate table name exists
  const db = getDb();
  const tableExists = db
    .prepare(
      `SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?`,
    )
    .get(table);
  if (!tableExists) {
    return Response.json({ error: `Table "${table}" not found` }, { status: 404 });
  }

  // Validate columns exist
  const columns = db.prepare(`PRAGMA table_info('${table}')`).all() as Array<{
    name: string;
  }>;
  const validColumns = new Set(columns.map((c) => c.name));
  for (const col of [...Object.keys(updates), ...Object.keys(rowId)]) {
    if (!validColumns.has(col)) {
      return Response.json(
        { error: `Column "${col}" not found in table "${table}"` },
        { status: 400 },
      );
    }
  }

  const setClauses = Object.keys(updates)
    .map((col) => `"${col}" = @upd_${col}`)
    .join(", ");
  const whereClauses = Object.keys(rowId)
    .map((col) => `"${col}" = @whr_${col}`)
    .join(" AND ");

  const params: Record<string, unknown> = {};
  for (const [col, val] of Object.entries(updates)) params[`upd_${col}`] = val;
  for (const [col, val] of Object.entries(rowId)) params[`whr_${col}`] = val;

  const stmt = db.prepare(
    `UPDATE "${table}" SET ${setClauses} WHERE ${whereClauses}`,
  );
  const info = stmt.run(params);

  return Response.json({ ok: true, changes: info.changes });
}
