// Local PostgreSQL for development without Docker. Data lives in api/.pgdata (git-ignored).
//   npm run db:dev      → keeps running; stop with Ctrl+C
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';

const port = Number(process.env.DB_PORT ?? 55442);
const dir = path.resolve('.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  onLog: () => {},
  onError: (e) => console.error(e),
});

const fresh = !existsSync(path.join(dir, 'PG_VERSION'));
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('interactive');

console.log(`Postgres ready: postgresql://postgres:postgres@127.0.0.1:${port}/interactive`);

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  try { await pg.stop(); } catch { /* already stopped */ }
  process.exit(0); // always leave, even if the database was already gone
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('SIGHUP', stop); // terminal window closed
setInterval(() => {}, 1 << 30);
