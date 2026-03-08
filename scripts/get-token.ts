#!/usr/bin/env tsx
/**
 * Fetches a Cognito IdToken for a given user via SRP authentication.
 * Prints the raw JWT to stdout — pipe it into curl or copy into Postman/Bruno.
 *
 * Required env vars:
 *   COGNITO_USER_POOL_ID   e.g. us-east-1_xxxxxxxxx
 *   COGNITO_CLIENT_ID      App client ID from CDK output AuthAppClientId
 *   COGNITO_USERNAME       User email address
 *   COGNITO_PASSWORD       User password
 *
 * Usage:
 *   COGNITO_USER_POOL_ID=... COGNITO_CLIENT_ID=... \
 *   COGNITO_USERNAME=... COGNITO_PASSWORD=... \
 *   npx tsx scripts/get-token.ts
 *
 *   # Use the token directly in curl:
 *   TOKEN=$(COGNITO_USER_POOL_ID=... ... npx tsx scripts/get-token.ts)
 *   curl -H "Authorization: Bearer $TOKEN" https://knotes-api.kstrm.com/api/...
 */

import * as readline from 'readline';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  IAuthenticationCallback,
} from 'amazon-cognito-identity-js';

const { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_USERNAME, COGNITO_PASSWORD } = process.env;

if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID || !COGNITO_USERNAME || !COGNITO_PASSWORD) {
  console.error(
    'Missing required env vars: COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_USERNAME, COGNITO_PASSWORD'
  );
  process.exit(1);
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const pool = new CognitoUserPool({
  UserPoolId: COGNITO_USER_POOL_ID,
  ClientId: COGNITO_CLIENT_ID,
});

const user = new CognitoUser({ Username: COGNITO_USERNAME, Pool: pool });

const authDetails = new AuthenticationDetails({
  Username: COGNITO_USERNAME,
  Password: COGNITO_PASSWORD,
});

const callbacks: IAuthenticationCallback = {
  onSuccess(session) {
    console.log(session.getIdToken().getJwtToken());
  },

  onFailure(err: Error) {
    console.error(err.message ?? err);
    process.exit(1);
  },

  newPasswordRequired() {
    console.error('New password required. Reset it in the AWS Console first.');
    process.exit(1);
  },

  async totpRequired(_secretCode: string, _challengeName: string) {
    const code = await prompt('TOTP code: ');
    user.sendMFACode(code, callbacks, 'SOFTWARE_TOKEN_MFA');
  },
};

user.authenticateUser(authDetails, callbacks);
