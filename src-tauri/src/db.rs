//! Everything that touches Postgres. The UI never sees SQL; it calls the
//! Tauri commands in lib.rs, which call these functions.

use serde::{Deserialize, Serialize};
use sqlx::postgres::{PgConnectOptions, PgPool, PgPoolOptions};
use std::time::{Duration, Instant};

/// An error the UI can show: `code` is a message code looked up in the
/// translation files, `detail` is the technical reason for the log.
#[derive(Debug, Serialize)]
pub struct AppError {
    pub code: &'static str,
    pub detail: String,
}

impl AppError {
    pub fn new(code: &'static str, detail: impl ToString) -> Self {
        Self { code, detail: detail.to_string() }
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::new("DB-ERR", e)
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    // Spike only: the real app keeps the password in the OS keychain.
    pub password: String,
}

pub async fn connect(cfg: &DbConfig) -> AppResult<PgPool> {
    let opts = PgConnectOptions::new()
        .host(&cfg.host)
        .port(cfg.port)
        .database(&cfg.database)
        .username(&cfg.username)
        .password(&cfg.password);
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(opts)
        .await
        .map_err(|e| AppError::new("DBC-02", e))?;
    migrate(&pool).await?;
    Ok(pool)
}

/// Any constant works; every PC must use the same one.
const MIGRATE_LOCK_KEY: i64 = 4241;

async fn migrate(pool: &PgPool) -> AppResult<()> {
    // The real app uses sqlx migration files; a few idempotent statements are enough here.
    // The lock stops two PCs that connect at the same moment from racing on CREATE TABLE.
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)").bind(MIGRATE_LOCK_KEY).execute(&mut *tx).await?;
    for stmt in [
        "CREATE TABLE IF NOT EXISTS license (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), copies int NOT NULL)",
        "INSERT INTO license (id, copies) VALUES (1, 3) ON CONFLICT (id) DO NOTHING",
        "CREATE TABLE IF NOT EXISTS sessions (
            id bigserial PRIMARY KEY,
            username text NOT NULL,
            machine text NOT NULL,
            started_at timestamptz NOT NULL DEFAULT now(),
            heartbeat_at timestamptz NOT NULL DEFAULT now())",
        "CREATE TABLE IF NOT EXISTS ledger_rows (
            id bigserial PRIMARY KEY,
            entry_date date NOT NULL,
            account_code text NOT NULL,
            account_name text NOT NULL,
            description text NOT NULL,
            debit numeric(18,2) NOT NULL,
            credit numeric(18,2) NOT NULL)",
    ] {
        sqlx::query(stmt).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

// ---------- Sessions (BR-LOG-03) ----------

/// A session with no heartbeat for this long counts as crashed and is freed.
const STALE_AFTER_SECS: i32 = 30;
/// Any constant works; every PC must use the same one.
const SESSION_LOCK_KEY: i64 = 4242;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Session {
    pub id: i64,
    pub username: String,
    pub machine: String,
    pub started_at: String,
}

/// Claims a seat. The advisory lock makes the count-then-insert atomic across
/// every PC, so two logins at the same moment can never both pass the limit.
pub async fn claim_session(pool: &PgPool, username: &str, machine: &str) -> AppResult<i64> {
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(SESSION_LOCK_KEY)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM sessions WHERE heartbeat_at < now() - make_interval(secs => $1)")
        .bind(STALE_AFTER_SECS)
        .execute(&mut *tx)
        .await?;
    let copies: i32 = sqlx::query_scalar("SELECT copies FROM license WHERE id = 1")
        .fetch_one(&mut *tx)
        .await?;
    let active: i64 = sqlx::query_scalar("SELECT count(*) FROM sessions")
        .fetch_one(&mut *tx)
        .await?;
    if active >= copies as i64 {
        return Err(AppError::new("LOG-04", format!("{active} of {copies} copies in use")));
    }
    let id: i64 = sqlx::query_scalar("INSERT INTO sessions (username, machine) VALUES ($1, $2) RETURNING id")
        .bind(username)
        .bind(machine)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(id)
}

pub async fn heartbeat(pool: &PgPool, id: i64) -> AppResult<bool> {
    let r = sqlx::query("UPDATE sessions SET heartbeat_at = now() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(r.rows_affected() == 1)
}

pub async fn release_session(pool: &PgPool, id: i64) -> AppResult<()> {
    sqlx::query("DELETE FROM sessions WHERE id = $1").bind(id).execute(pool).await?;
    Ok(())
}

pub async fn list_sessions(pool: &PgPool) -> AppResult<(Vec<Session>, i32)> {
    let rows = sqlx::query_as::<_, Session>(
        "SELECT id, username, machine, to_char(started_at, 'YYYY-MM-DD HH24:MI:SS') AS started_at
         FROM sessions
         WHERE heartbeat_at >= now() - make_interval(secs => $1)
         ORDER BY id",
    )
    .bind(STALE_AFTER_SECS)
    .fetch_all(pool)
    .await?;
    let copies: i32 = sqlx::query_scalar("SELECT copies FROM license WHERE id = 1").fetch_one(pool).await?;
    Ok((rows, copies))
}

pub async fn set_copies(pool: &PgPool, copies: i32) -> AppResult<()> {
    sqlx::query("UPDATE license SET copies = $1 WHERE id = 1").bind(copies).execute(pool).await?;
    Ok(())
}

// ---------- Large data ----------

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LedgerRow {
    pub id: i64,
    pub entry_date: String,
    pub account_code: String,
    pub account_name: String,
    pub description: String,
    pub debit: String,
    pub credit: String,
}

#[derive(Debug, Serialize)]
pub struct Stats {
    pub rows: i64,
    pub total_debit: String,
    pub total_credit: String,
    pub millis: u128,
}

/// Generates rows inside Postgres, so 100,000 rows take about a second.
pub async fn seed_rows(pool: &PgPool, count: i32) -> AppResult<Stats> {
    let started = Instant::now();
    sqlx::query(
        "INSERT INTO ledger_rows (entry_date, account_code, account_name, description, debit, credit)
         SELECT date '2026-01-01' + (g % 365),
                lpad(((g % 500) + 1000)::text, 6, '0'),
                (ARRAY['الصندوق','المصرف','المبيعات','المشتريات','الزبائن','الموردون','رأس المال','المصاريف العامة'])[1 + g % 8],
                'قيد رقم ' || g,
                CASE WHEN g % 2 = 0 THEN round((random() * 100000)::numeric, 2) ELSE 0 END,
                CASE WHEN g % 2 = 1 THEN round((random() * 100000)::numeric, 2) ELSE 0 END
         FROM generate_series(1, $1) AS g",
    )
    .bind(count)
    .execute(pool)
    .await?;
    let mut s = stats(pool).await?;
    s.millis = started.elapsed().as_millis();
    Ok(s)
}

/// Aggregates in the database; the UI never loads every row to total them.
pub async fn stats(pool: &PgPool) -> AppResult<Stats> {
    let started = Instant::now();
    let (rows, d, c): (i64, String, String) = sqlx::query_as(
        "SELECT count(*), coalesce(sum(debit), 0)::text, coalesce(sum(credit), 0)::text FROM ledger_rows",
    )
    .fetch_one(pool)
    .await?;
    Ok(Stats { rows, total_debit: d, total_credit: c, millis: started.elapsed().as_millis() })
}

/// One page of rows for the virtualized grid.
pub async fn fetch_rows(pool: &PgPool, offset: i64, limit: i64) -> AppResult<Vec<LedgerRow>> {
    let rows = sqlx::query_as::<_, LedgerRow>(
        "SELECT id, entry_date::text AS entry_date, account_code, account_name, description,
                debit::text AS debit, credit::text AS credit
         FROM ledger_rows ORDER BY id OFFSET $1 LIMIT $2",
    )
    .bind(offset)
    .bind(limit.min(1000))
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn clear_rows(pool: &PgPool) -> AppResult<()> {
    sqlx::query("TRUNCATE ledger_rows RESTART IDENTITY").execute(pool).await?;
    Ok(())
}
