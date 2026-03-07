#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AppStack } from '../lib/app-stack.js';

const app = new cdk.App();

new AppStack(app, 'KnotesApiDev', {
  isProd: false,
  domainName: 'knotes-api-dev.kstrm.com',
});

new AppStack(app, 'KnotesApiProd', {
  isProd: true,
  domainName: 'knotes-api.kstrm.com',
});
