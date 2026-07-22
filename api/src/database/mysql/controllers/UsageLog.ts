import { ResultSetHeader, RowDataPacket } from "mysql2";
import { MySQLController } from "../../../models/MySQLController.js";

export interface IEmbedUsageLogInsert {
  bot_id: number | null;
  userid: number | null;
  prompt: string | null;
  message: string | null;
  index_context: string | null;
  confidence: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost: number | null;
  payload: string | null;
  ip: string | null;
  other: string | null;
  timecreated: number;
}

export interface IEmbedUsageLog extends IEmbedUsageLogInsert {
  id: number;
}

export interface IEmbedUsageLogPacket extends IEmbedUsageLog, RowDataPacket {}

export interface IEmbedUsageLogFilters {
  bot_id?: number;
  userid?: number;
  timecreated_from?: number;
  timecreated_to?: number;
}

export interface IEmbedUsageLogPage {
  items: IEmbedUsageLog[];
  total: number;
}

export class UsageLog extends MySQLController {
  constructor(pool: import("mysql2").Pool) {
    super(pool);
  }

  insert(row: IEmbedUsageLogInsert): Promise<number> {
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(
        `
          INSERT INTO \`EmbedUsageLog\`
            (bot_id, userid, prompt, message, index_context, confidence,
             prompt_tokens, completion_tokens, total_tokens, cost, payload, ip, other, timecreated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          row.bot_id,
          row.userid,
          row.prompt,
          row.message,
          row.index_context,
          row.confidence,
          row.prompt_tokens,
          row.completion_tokens,
          row.total_tokens,
          row.cost,
          row.payload,
          row.ip,
          row.other,
          row.timecreated
        ],
        (err: Error | null, res?: ResultSetHeader) => {
          if (err || !res) reject(err);
          else resolve(res.insertId);
        }
      );
    });
  }

  private buildWhere(filters: IEmbedUsageLogFilters): {
    clause: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.bot_id !== undefined) {
      conditions.push("bot_id = ?");
      params.push(filters.bot_id);
    }
    if (filters.userid !== undefined) {
      conditions.push("userid = ?");
      params.push(filters.userid);
    }
    if (filters.timecreated_from !== undefined) {
      conditions.push("timecreated >= ?");
      params.push(filters.timecreated_from);
    }
    if (filters.timecreated_to !== undefined) {
      conditions.push("timecreated <= ?");
      params.push(filters.timecreated_to);
    }

    return {
      clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
      params
    };
  }

  find(
    filters: IEmbedUsageLogFilters,
    page: number,
    limit: number
  ): Promise<IEmbedUsageLogPage> {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
    const offset = (safePage - 1) * safeLimit;
    const { clause, params } = this.buildWhere(filters);

    return new Promise((resolve, reject) => {
      this.pool.query<IEmbedUsageLogPacket[]>(
        `SELECT * FROM \`EmbedUsageLog\` ${clause} ORDER BY timecreated DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, safeLimit, offset],
        (err: Error | null, rows?: IEmbedUsageLogPacket[]) => {
          if (err) {
            reject(err);
            return;
          }
          this.pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS total FROM \`EmbedUsageLog\` ${clause}`,
            params,
            (countErr: Error | null, countRows?: RowDataPacket[]) => {
              if (countErr) {
                reject(countErr);
                return;
              }
              resolve({
                items: (rows || []) as IEmbedUsageLog[],
                total: Number(countRows?.[0]?.total ?? 0)
              });
            }
          );
        }
      );
    });
  }
}
