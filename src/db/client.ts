import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

/**
 * One small pool per process. Short connect timeout: if the database is down we'd rather fail
 * fast (the ledger is best-effort, gap save says "try later") than hold requests open.
 */
export function createDb(url: string) {
  const client = postgres(url, { max: 5, connect_timeout: 3, idle_timeout: 30 });
  return drizzle(client, { schema });
}
