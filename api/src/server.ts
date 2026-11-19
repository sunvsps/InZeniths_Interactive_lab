import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { startJobs } from './services/jobs.js';

const env = loadEnv();
const app = await buildApp({ env });
const stopJobs = env.JOBS_ENABLED ? startJobs(app) : () => {};

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  stopJobs();
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
