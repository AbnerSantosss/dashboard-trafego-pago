import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: false });
  app.get('/health', async () => ({ status: 'ok', service: 'api', fase: 0 }));
  return app;
}
