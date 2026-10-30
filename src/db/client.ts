import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../server/config";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

/**
 * One small pool per process. Short connect timeout: if the database is down we'd rather fail
 * fast (the ledger is best-effort, gap save says "try later") than hold requests open. A
 * server-side statement timeout cancels statements the app has stopped waiting for, so they
 * don't commit long after the response.
 */
export function createDb(url: string) {
  const client = postgres(url, {
    max: 5,
    connect_timeout: 3,
    idle_timeout: 30,
    connection: { statement_timeout: config.timeouts.dbStatementMs },
  });
  return drizzle(client, { schema });
}
