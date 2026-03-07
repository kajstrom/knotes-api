import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { AccountStack } from '../lib/account-stack.js';
import { AppStack } from '../lib/app-stack.js';

describe('KnotesApiAccount stack', () => {
  const app = new cdk.App();
  const stack = new AccountStack(app, 'KnotesApiAccount', {
    githubOwner: 'kajstrom',
    githubRepo: 'knotes-api',
  });
  const template = Template.fromStack(stack);

  test('synthesizes without error', () => {
    expect(template).toBeDefined();
  });

  test('creates IAM role for GitHub Actions', () => {
    template.resourceCountIs('AWS::IAM::Role', 2); // GithubActionsRole + Lambda custom resource role
  });

  test('exports githubOidcRoleArn', () => {
    expect(stack.githubOidcRoleArn).toBeDefined();
    expect(typeof stack.githubOidcRoleArn).toBe('string');
  });
});

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
