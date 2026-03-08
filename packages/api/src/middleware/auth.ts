import { FastifyReply, FastifyRequest } from 'fastify';
import * as jwt from 'jsonwebtoken';
import * as jwksRsa from 'jwks-rsa';
import { CognitoClaims } from '../types';

let jwksClient: jwksRsa.JwksClient | undefined;

function getJwksClient(): jwksRsa.JwksClient {
  if (jwksClient) return jwksClient;

  const poolId = process.env.COGNITO_POOL_ID;
  if (!poolId) {
    throw new Error('COGNITO_POOL_ID environment variable is not set');
  }

  const region = poolId.split('_')[0];
  const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${poolId}/.well-known/jwks.json`;

  jwksClient = new jwksRsa.JwksClient({ jwksUri, cache: true, rateLimit: true });
  return jwksClient;
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const kid = decoded.header.kid;

  try {
    const poolId = process.env.COGNITO_POOL_ID;
    if (!poolId) {
      throw new Error('COGNITO_POOL_ID environment variable is not set');
    }

    const clientId = process.env.COGNITO_CLIENT_ID;
    if (!clientId) {
      throw new Error('COGNITO_CLIENT_ID environment variable is not set');
    }

    const region = poolId.split('_')[0];
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;

    const client = getJwksClient();
    const signingKey = await client.getSigningKey(kid);
    const publicKey = signingKey.getPublicKey();

    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer,
      audience: clientId,
    });

    if (!payload || typeof payload === 'string') {
      throw new jwt.JsonWebTokenError('Invalid token payload');
    }

    const claims = payload as jwt.JwtPayload;

    if (claims.token_use !== 'id') {
      throw new jwt.JsonWebTokenError('Invalid token use');
    }

    request.user = claims as CognitoClaims;
  } catch (err) {
    if (
      err instanceof jwt.JsonWebTokenError ||
      err instanceof jwt.TokenExpiredError ||
      (err instanceof Error && err.name === 'SigningKeyNotFoundError')
    ) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    throw err;
  }
}
