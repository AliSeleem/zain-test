//! Runs against a real Postgres. Set ZAIN_TEST_PG=host:port:database:user:password,
//! for example `127.0.0.1:5432:zain_spike:postgres:`. Skipped when it isn't set.

use zain_spike_lib::db::{self, DbConfig};

fn config() -> Option<DbConfig> {
    let v = std::env::var("ZAIN_TEST_PG").ok()?;
    let p: Vec<&str> = v.splitn(5, ':').collect();
    Some(DbConfig {
        host: p[0].into(),
        port: p[1].parse().ok()?,
        database: p[2].into(),
        username: p[3].into(),
        password: p.get(4).copied().unwrap_or("").into(),
    })
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
async fn simultaneous_logins_never_exceed_licensed_copies() {
    let Some(cfg) = config() else { return };
    let pool = db::connect(&cfg).await.unwrap();
    sqlx::query("DELETE FROM sessions").execute(&pool).await.unwrap();
    db::set_copies(&pool, 3).await.unwrap();

    // 20 "PCs" log in at the same moment, each over its own connection.
    let mut handles = Vec::new();
    for i in 0..20 {
        let cfg = cfg.clone();
        handles.push(tokio::spawn(async move {
            let pool = db::connect(&cfg).await.unwrap();
            db::claim_session(&pool, &format!("user{i}"), &format!("pc{i}")).await
        }));
    }
    let mut ok = 0;
    let mut refused = 0;
    for h in handles {
        match h.await.unwrap() {
            Ok(_) => ok += 1,
            Err(e) if e.code == "LOG-04" => refused += 1,
            Err(e) => panic!("unexpected error {e:?}"),
        }
    }
    assert_eq!((ok, refused), (3, 17));

    let (sessions, copies) = db::list_sessions(&pool).await.unwrap();
    assert_eq!((sessions.len(), copies), (3, 3));

    // Logging out frees a seat.
    db::release_session(&pool, sessions[0].id).await.unwrap();
    assert!(db::claim_session(&pool, "late", "pc-late").await.is_ok());
    sqlx::query("DELETE FROM sessions").execute(&pool).await.unwrap();
}

#[tokio::test]
async fn seeds_and_pages_large_tables() {
    let Some(cfg) = config() else { return };
    let pool = db::connect(&cfg).await.unwrap();
    db::clear_rows(&pool).await.unwrap();

    let s = db::seed_rows(&pool, 100_000).await.unwrap();
    assert_eq!(s.rows, 100_000);
    println!("seeded 100k rows in {} ms", s.millis);

    let page = db::fetch_rows(&pool, 99_900, 200).await.unwrap();
    assert_eq!(page.len(), 100);
    assert_eq!(page[0].id, 99_901);
    assert!(page[0].account_name.chars().any(|c| ('\u{0600}'..='\u{06FF}').contains(&c)));

    let st = db::stats(&pool).await.unwrap();
    println!("totals over 100k rows in {} ms", st.millis);
    db::clear_rows(&pool).await.unwrap();
}
