import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import { markExpired, markPaid } from '../services/fulfil.js';

export default async function paymentRoutes(app: FastifyInstance) {
  // The provider's signature is checked against the exact bytes it sent, so keep the body raw in this scope only.
  await app.register(async (hook) => {
    hook.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
    hook.post('/payments/webhook', { config: { rateLimit: false } }, async (request, reply) => {
      let event;
      try {
        event = app.payments.parseWebhook(request.body as Buffer, request.headers['stripe-signature'] as string | undefined);
      } catch (e) {
        request.log.warn({ err: (e as Error).message }, 'webhook rejected');
        throw badRequest('BAD_SIGNATURE', 'Webhook signature check failed');
      }
      if (event.type === 'paid') await markPaid(app, event, event.email);
      else if (event.type === 'expired') await markExpired(app, event);
      return reply.send({ received: true });
    });
  });

  // Local only: stands in for the provider's checkout page.
  if (app.payments.name === 'fake') {
    app
      .withTypeProvider<ZodTypeProvider>()
      .get('/dev/pay/:paymentId', { schema: { params: z.object({ paymentId: z.string() }), querystring: z.object({ next: z.string().optional() }) } }, async (request, reply) => {
        const { paymentId } = request.params;
        const payment = await app.prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment) throw notFound('Payment not found');
        await markPaid(app, { paymentId, providerRef: `fake_${paymentId}` }, null);
        const next = request.query.next;
        return next?.startsWith(app.env.SANTA_APP_URL) ? reply.redirect(next) : reply.send({ paid: true });
      });
  }
}
