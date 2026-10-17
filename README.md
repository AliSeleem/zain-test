# Zain Soft: stack test (spike)

A throwaway app that proves the agreed stack (tech-stack.md) before the real 01S-18 work starts. It is not the Phase 1 app. The real app will start as a clean repo that reuses the patterns from here.

| Tab | What it shows | BRD |
|---|---|---|
| Connection screen | Tries the saved connection first and asks only if it's missing or fails | BR-DBC-01 |
| Language & direction | Live switch between Arabic RTL and English LTR without losing typed text. Number style 0123 or ٠١٢٣ | BR-HOME-04, Q56 |
| Sessions | Login claims a seat atomically against the licensed copies. Prints LOG-04 when full. Heartbeat, and a crashed session is freed after 30 s | BR-LOG-03 |
| Large data | Adds 100k or 1M ledger rows inside Postgres. Totals in SQL. A virtualized grid that fetches 200 rows at a time | full BRD §6.1 |
| Windows & printing | A separate Tauri window. Quit is refused while it's open (HOME-02). An Arabic invoice prints through the system print dialog | BR-HOME-01, 05 |

## Download a build

Every push to `main` builds the Windows and macOS installers on GitHub Actions (`.github/workflows/release.yml`) and attaches them to a pre-release on the repo's **Releases** page.
- **Windows:** run `Zain Spike_<version>_x64-setup.exe`.
- **macOS:** open the `.dmg`. The app isn't signed yet, so the first time, right-click the app → Open.

You still need a Postgres database to connect to. See step 5 below.

## Run it on Windows (from source)

You need these once:
1. **Rust:** `rustup` (stable). Check with `rustc -V`.
2. **Visual Studio Build Tools** with "Desktop development with C++". Tauri needs the MSVC linker.
3. **Node 20+** and **pnpm** (`npm i -g pnpm`).
4. **WebView2:** already installed on Windows 10 and 11.
5. **PostgreSQL 16+.** Any of these works:
   - Install it from postgresql.org.
   - Run it in Docker: `docker run -d --name zain-pg -e POSTGRES_PASSWORD=zain -p 5432:5432 postgres:16`
   - Use a free Neon database.

   Then create the database: `createdb -U postgres zain_spike`, or run `CREATE DATABASE zain_spike;` in psql.

Then, from this folder:

```bash
pnpm install
pnpm tauri dev          # opens the app with hot reload
```

On the first start, the app asks for the connection, for example `127.0.0.1 / 5432 / zain_spike / postgres / <password>`. It saves it in `%APPDATA%\com.zainsoft.spike\db.json` and won't ask again unless it fails.

To build the installer and see the real size:

```bash
pnpm tauri build        # src-tauri/target/release/bundle/nsis/*.exe and msi/*.msi
```

## The two-PC test

On the **main PC** (the one running Postgres):
1. In `postgresql.conf`, set `listen_addresses = '*'`.
2. In `pg_hba.conf`, add `host all all 192.168.0.0/16 scram-sha-256`. Use your own LAN range.
3. Restart Postgres, then allow port 5432 in Windows Firewall.

On the **second PC**:
1. Install the built `.exe`.
2. Connect with the main PC's IP.
3. Go to the Sessions tab and set licensed copies to 1.
4. Log in on one PC, then try to log in on the other. You should get LOG-04.
5. Log out on the first PC. The second PC can now log in.

## Run the database tests

```bash
cd src-tauri
# host:port:database:user:password
ZAIN_TEST_PG="127.0.0.1:5432:zain_spike:postgres:zain" cargo test --test db_test -- --nocapture
```

In PowerShell, set the variable first: `$env:ZAIN_TEST_PG="127.0.0.1:5432:zain_spike:postgres:zain"`.

The tests check that 20 simultaneous logins against 3 copies give exactly 3 sessions, and that 100k rows can be seeded and paged.

## Spike shortcuts the real app won't take

- **DB password:** saved in plain JSON. The real app keeps it in the OS keychain.
- **License count:** a plain number in the database. The real app adds the Ed25519 signature.
- **Migrations:** inline SQL instead of sqlx migration files. There's only one database, not a registry plus one per company.
- **Components:** hand-written components in shadcn style instead of the shadcn CLI.
- **Fonts:** system fonts. The real app bundles its fonts.
- **Printing:** the webview's print dialog instead of Typst PDF.
