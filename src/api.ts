import { invoke } from "@tauri-apps/api/core";

/** The shape every Rust command returns on failure (see src-tauri/src/db.rs). */
export type AppError = { code: string; detail: string };

export function isAppError(e: unknown): e is AppError {
  return typeof e === "object" && e !== null && "code" in e;
}

export type DbConfig = { host: string; port: number; database: string; username: string; password: string };
export type Session = { id: number; username: string; machine: string; started_at: string };
export type LedgerRow = {
  id: number;
  entry_date: string;
  account_code: string;
  account_name: string;
  description: string;
  debit: string;
  credit: string;
};
export type Stats = { rows: number; total_debit: string; total_credit: string; millis: number };

export const api = {
  connectSaved: () =>
    invoke<{ connected: boolean; config: DbConfig | null; error: AppError | null }>("connect_saved"),
  connectAndSave: (config: DbConfig) => invoke<void>("connect_and_save", { config }),
  machineName: () => invoke<string>("machine_name"),
  login: (username: string) => invoke<number>("login", { username }),
  heartbeat: (sessionId: number) => invoke<boolean>("heartbeat", { sessionId }),
  logout: (sessionId: number) => invoke<void>("logout", { sessionId }),
  listSessions: () => invoke<{ sessions: Session[]; copies: number }>("list_sessions"),
  setCopies: (copies: number) => invoke<void>("set_copies", { copies }),
  seedRows: (count: number) => invoke<Stats>("seed_rows", { count }),
  rowStats: () => invoke<Stats>("row_stats"),
  fetchRows: (offset: number, limit: number) => invoke<LedgerRow[]>("fetch_rows", { offset, limit }),
  clearRows: () => invoke<void>("clear_rows"),
  requestQuit: () => invoke<void>("request_quit"),
  printWindow: () => invoke<void>("print_window"),
};
