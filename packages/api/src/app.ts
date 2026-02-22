import Fastify, { FastifyInstance } from 'fastify';

/**
 * Creates and configures a Fastify application instance
 * Registers all routes and middleware
 */
export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  // Register middleware here
  // Example: app.register(require('@fastify/cors'));

  // Register routes here
  // Example: app.register(require('./routes'), { prefix: '/api' });

  return app;
}

export default createApp;
