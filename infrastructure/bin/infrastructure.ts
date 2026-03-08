#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AccountStack } from '../lib/account-stack.js';
import { AppStack } from '../lib/app-stack.js';

const app = new cdk.App();

// Account-level stack (OIDC provider for GitHub Actions CI/CD)
new AccountStack(app, 'KnotesApiAccount', {
  githubOwner: 'kajstrom',
  githubRepo: 'knotes-api',
});

new AppStack(app, 'KnotesApiProd', {
  isProd: true,
  domainName: 'knotes-api.kstrm.com',
});
