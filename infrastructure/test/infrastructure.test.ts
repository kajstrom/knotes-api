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
    cloudFrontDomain: 'https://placeholder.cloudfront.net',
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
    cloudFrontDomain: 'https://placeholder.cloudfront.net',
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

describe('AuthConstruct', () => {
  const cloudFrontDomain = 'https://d1234abcd.cloudfront.net';

  function makeStack(isProd: boolean) {
    const app = new cdk.App();
    const stack = new AppStack(app, 'AuthTestStack', {
      isProd,
      domainName: 'knotes-auth-test',
      cloudFrontDomain,
    });
    return Template.fromStack(stack);
  }

  const devTemplate = makeStack(false);
  const prodTemplate = makeStack(true);

  test('creates a Cognito User Pool', () => {
    devTemplate.resourceCountIs('AWS::Cognito::UserPool', 1);
  });

  test('sets password policy correctly', () => {
    devTemplate.hasResourceProperties('AWS::Cognito::UserPool', {
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireUppercase: true,
          RequireNumbers: true,
        },
      },
    });
  });

  test('configures email sign-in', () => {
    devTemplate.hasResourceProperties('AWS::Cognito::UserPool', {
      UsernameAttributes: ['email'],
    });
  });

  test('creates a User Pool Domain', () => {
    devTemplate.resourceCountIs('AWS::Cognito::UserPoolDomain', 1);
  });

  test('creates a User Pool Client with authorization code grant and correct scopes', () => {
    devTemplate.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: ['openid', 'email', 'profile'],
    });
  });

  test('sets callback and logout URLs to cloudFrontDomain', () => {
    devTemplate.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      CallbackURLs: [cloudFrontDomain],
      LogoutURLs: [cloudFrontDomain],
    });
  });

  test('outputs UserPoolId', () => {
    const keys = Object.keys(devTemplate.toJSON().Outputs ?? {});
    expect(keys.some((k) => k.startsWith('AuthUserPoolId'))).toBe(true);
  });

  test('outputs UserPoolArn', () => {
    const keys = Object.keys(devTemplate.toJSON().Outputs ?? {});
    expect(keys.some((k) => k.startsWith('AuthUserPoolArn'))).toBe(true);
  });

  test('outputs AppClientId', () => {
    const keys = Object.keys(devTemplate.toJSON().Outputs ?? {});
    expect(keys.some((k) => k.startsWith('AuthAppClientId'))).toBe(true);
  });

  test('non-prod UserPool has DeletionPolicy Delete', () => {
    devTemplate.hasResource('AWS::Cognito::UserPool', {
      DeletionPolicy: 'Delete',
    });
  });

  test('prod UserPool has DeletionPolicy Retain', () => {
    prodTemplate.hasResource('AWS::Cognito::UserPool', {
      DeletionPolicy: 'Retain',
    });
  });
});
