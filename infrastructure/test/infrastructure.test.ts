import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { AppStack } from '../lib/app-stack.js';

describe('KnotesApiDev stack', () => {
  const app = new cdk.App();
  const stack = new AppStack(app, 'KnotesApiDev', {
    isProd: false,
    domainName: 'knotes-api-dev.kstrm.com',
  });
  const template = Template.fromStack(stack);

  test('synthesizes without error', () => {
    expect(template).toBeDefined();
  });

  test('isProd is false', () => {
    expect(stack.isProd).toBe(false);
  });

  test('domainName is set correctly', () => {
    expect(stack.domainName).toBe('knotes-api-dev.kstrm.com');
  });
});

describe('KnotesApiProd stack', () => {
  const app = new cdk.App();
  const stack = new AppStack(app, 'KnotesApiProd', {
    isProd: true,
    domainName: 'knotes-api.kstrm.com',
  });
  const template = Template.fromStack(stack);

  test('synthesizes without error', () => {
    expect(template).toBeDefined();
  });

  test('isProd is true', () => {
    expect(stack.isProd).toBe(true);
  });

  test('domainName is set correctly', () => {
    expect(stack.domainName).toBe('knotes-api.kstrm.com');
  });
});
