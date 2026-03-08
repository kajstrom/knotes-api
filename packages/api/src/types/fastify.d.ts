import 'fastify';

export interface CognitoClaims {
  sub: string;
  email?: string;
  'cognito:username'?: string;
  token_use: string;
  iss: string;
  exp: number;
  iat: number;
  [key: string]: unknown;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: CognitoClaims;
  }
}
