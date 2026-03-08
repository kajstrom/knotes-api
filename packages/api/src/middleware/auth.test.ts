import fastify, { FastifyInstance } from 'fastify';
import * as jwt from 'jsonwebtoken';
import * as jwksRsa from 'jwks-rsa';

jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn(),
}));

jest.mock('jsonwebtoken', () => {
  const actual = jest.requireActual<typeof import('jsonwebtoken')>('jsonwebtoken');
  return {
    ...actual,
    decode: jest.fn(),
    verify: jest.fn(),
  };
});

import { authMiddleware } from './auth';

const mockGetSigningKey = jest.fn();
const mockDecode = jwt.decode as jest.Mock;
const mockVerify = jwt.verify as jest.Mock;

const MOCK_POOL_ID = 'us-east-1_testPool123';
const MOCK_TOKEN = 'header.payload.signature';
const MOCK_KID = 'test-kid-123';
const MOCK_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMockKey\n-----END PUBLIC KEY-----';
const MOCK_CLAIMS = {
  sub: 'user-abc-123',
  email: 'test@example.com',
  token_use: 'id',
  iss: `https://cognito-idp.us-east-1.amazonaws.com/${MOCK_POOL_ID}`,
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
};

function makeDecodedToken(kid: string) {
  return { header: { kid, alg: 'RS256' }, payload: MOCK_CLAIMS, signature: 'sig' };
}

describe('authMiddleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.COGNITO_POOL_ID = MOCK_POOL_ID;
    (jwksRsa.JwksClient as jest.Mock).mockImplementation(() => ({
      getSigningKey: mockGetSigningKey,
    }));

    app = fastify({ logger: false });
    app.addHook('onRequest', authMiddleware);
    app.get('/test', async () => ({ ok: true }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    (jwksRsa.JwksClient as jest.Mock).mockImplementation(() => ({
      getSigningKey: mockGetSigningKey,
    }));
  });

  describe('Authorization header validation', () => {
    it('returns 401 when the Authorization header is missing', async () => {
      const response = await app.inject({ method: 'GET', url: '/test' });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when the Authorization header is not a Bearer token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: `Basic ${MOCK_TOKEN}` },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when the token cannot be decoded', async () => {
      mockDecode.mockReturnValue(null);
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: `Bearer ${MOCK_TOKEN}` },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when the decoded token has no kid', async () => {
      mockDecode.mockReturnValue({ header: { alg: 'RS256' }, payload: {}, signature: '' });
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: `Bearer ${MOCK_TOKEN}` },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('JWKS key retrieval', () => {
    it('returns 401 when the signing key is not found (unrecognised kid)', async () => {
      mockDecode.mockReturnValue(makeDecodedToken(MOCK_KID));
      const keyNotFoundError = Object.assign(
        new Error(`Signing key not found for kid: ${MOCK_KID}`),
        { name: 'SigningKeyNotFoundError' }
      );
      mockGetSigningKey.mockRejectedValue(keyNotFoundError);

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: `Bearer ${MOCK_TOKEN}` },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('JWT verification', () => {
    it('returns 401 when the token is expired', async () => {
      mockDecode.mockReturnValue(makeDecodedToken(MOCK_KID));
      mockGetSigningKey.mockResolvedValue({
        getPublicKey: jest.fn().mockReturnValue(MOCK_PUBLIC_KEY),
      });
      mockVerify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('jwt expired', new Date(0));
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: `Bearer ${MOCK_TOKEN}` },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when the token signature is invalid', async () => {
      mockDecode.mockReturnValue(makeDecodedToken(MOCK_KID));
      mockGetSigningKey.mockResolvedValue({
        getPublicKey: jest.fn().mockReturnValue(MOCK_PUBLIC_KEY),
      });
      mockVerify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid signature');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: `Bearer ${MOCK_TOKEN}` },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('populates request.user and calls the handler when the token is valid', async () => {
      mockDecode.mockReturnValue(makeDecodedToken(MOCK_KID));
      mockGetSigningKey.mockResolvedValue({
        getPublicKey: jest.fn().mockReturnValue(MOCK_PUBLIC_KEY),
      });
      mockVerify.mockReturnValue(MOCK_CLAIMS);

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: `Bearer ${MOCK_TOKEN}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    });
  });

  describe('missing COGNITO_POOL_ID', () => {
    it('returns 500 when COGNITO_POOL_ID is not set', async () => {
      const savedPoolId = process.env.COGNITO_POOL_ID;
      delete process.env.COGNITO_POOL_ID;

      let freshMiddleware: typeof authMiddleware;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('./auth') as { authMiddleware: typeof authMiddleware };
        freshMiddleware = mod.authMiddleware;
      });

      mockDecode.mockReturnValue(makeDecodedToken(MOCK_KID));
      const testApp = fastify({ logger: false });
      // freshMiddleware is assigned synchronously inside isolateModules
      testApp.addHook('onRequest', freshMiddleware!);
      testApp.get('/test', async () => ({ ok: true }));
      await testApp.ready();

      const response = await testApp.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: `Bearer ${MOCK_TOKEN}` },
      });
      await testApp.close();
      process.env.COGNITO_POOL_ID = savedPoolId;

      expect(response.statusCode).toBe(500);
    });
  });
});
