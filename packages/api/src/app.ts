import Fastify, { FastifyInstance } from 'fastify';
import { authMiddleware } from './middleware';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  app.addHook('onRequest', authMiddleware);

  return app;
}

export default createApp;
