// Local development only (STORAGE_DRIVER=memory): stands in for R2's signed upload and download links.
import type { FastifyInstance } from 'fastify';
import { notFound } from '../lib/errors.js';
import type { devStorage } from '../services/storage.js';

type DevFiles = ReturnType<typeof devStorage>['files'];

export default async function devFileRoutes(app: FastifyInstance, opts: { files: DevFiles }) {
  app.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: 3_000_000 }, (_req, body, done) => done(null, body));
  app.put('/dev/files/*', { config: { rateLimit: false } }, async (request, reply) => {
    const key = (request.params as { '*': string })['*'];
    opts.files.set(key, { type: String(request.headers['content-type'] ?? 'application/octet-stream'), body: request.body as Buffer });
    return reply.status(200).send();
  });
  app.get('/dev/files/*', { config: { rateLimit: false } }, async (request, reply) => {
    const key = (request.params as { '*': string })['*'];
    const file = opts.files.get(key);
    if (!file) throw notFound('File not found');
    const name = (request.query as { name?: string }).name;
    if (name) reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    // The pages run on another port: let them play the file.
    return reply.header('Cross-Origin-Resource-Policy', 'cross-origin').type(file.type).send(file.body);
  });
}
