#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AccountStack } from '../lib/account-stack.js';
import { AppStack } from '../lib/app-stack.js';

const app = new cdk.App();

const devAlarmEmail = app.node.tryGetContext('devAlarmEmail') as string;
const prodAlarmEmail = app.node.tryGetContext('prodAlarmEmail') as string;

// Environment-specific stacks
new AppStack(app, 'KnotesApiDev', {
  isProd: false,
  domainName: 'knotes-api-dev.kstrm.com',
  cloudFrontDomain: 'https://placeholder.cloudfront.net',
  alarmEmail: devAlarmEmail,
});

new AppStack(app, 'KnotesApiProd', {
  isProd: true,
  domainName: 'knotes-api.kstrm.com',
  cloudFrontDomain: 'https://placeholder.cloudfront.net',
  alarmEmail: prodAlarmEmail,
});
