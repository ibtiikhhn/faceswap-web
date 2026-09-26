/** Local development only. Production uses standard PostgreSQL. */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { mkdir } from 'node:fs/promises';

if (process.env.APP_ENV === 'production') throw new Error('The embedded database is for local development only.');
await mkdir('.data', { recursive: true });
const db = await PGlite.create({ dataDir: '.data/postgres', extensions: { pgcrypto } });
const server = new PGLiteSocketServer({ db, port: Number(process.env.DEV_DB_PORT ?? 5433), host: '127.0.0.1', maxConnections: 50 });
await server.start();
console.log('Local development database listening on 127.0.0.1:5433.');
console.log('DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres');
async function stop() { await server.stop(); await db.close(); process.exit(0); }
process.once('SIGINT', stop);process.once('SIGTERM', stop);
