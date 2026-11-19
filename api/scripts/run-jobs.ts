// Runs the clean-up and reminder jobs once (e.g. by hand, or from a Railway cron service with JOBS_ENABLED=false on the API).
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { runJobs } from '../src/services/jobs.js';

const app = await buildApp({ env: loadEnv() });
console.log(await runJobs(app));
await app.close();
