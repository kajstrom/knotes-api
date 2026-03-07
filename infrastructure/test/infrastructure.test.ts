import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { AccountStack } from '../lib/account-stack.js';
import { AppStack } from '../lib/app-stack.js';
import { ApiConstruct } from '../lib/constructs/index.js';

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

describe('ApiConstruct', () => {
  let template!: Template;

  beforeAll(() => {
    // Ensure a minimal dist artifact exists so Code.fromAsset can hash the directory.
    const distPath = path.join(__dirname, '../../packages/api/dist');
    fs.mkdirSync(distPath, { recursive: true });
    const indexJs = path.join(distPath, 'index.js');
    if (!fs.existsSync(indexJs)) {
      fs.writeFileSync(indexJs, 'exports.lambdaHandler = async () => ({});');
    }

    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'ApiTestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
    new ApiConstruct(stack, 'Api', {
      tableName: 'test-table',
      bucketName: 'test-bucket',
      cognitoClientId: 'test-client-id',
      userPoolArn: 'arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_test',
    });
    template = Template.fromStack(stack);
  });

  test('creates a Lambda function with Node.js 22.x runtime', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
    });
  });

  test('Lambda has 256 MB memory', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 256,
    });
  });

  test('Lambda has 30 second timeout', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 30,
    });
  });

  test('Lambda has X-Ray active tracing enabled', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      TracingConfig: { Mode: 'Active' },
    });
  });

  test('Lambda has correct environment variables', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          TABLE_NAME: 'test-table',
          BUCKET_NAME: 'test-bucket',
          COGNITO_CLIENT_ID: 'test-client-id',
        },
      },
    });
  });

  test('creates a REST API Gateway', () => {
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  });

  test('creates a Cognito User Pool authorizer', () => {
    template.resourceCountIs('AWS::ApiGateway::Authorizer', 1);
  });

  test('authorizer is of type COGNITO_USER_POOLS', () => {
    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'COGNITO_USER_POOLS',
    });
  });

  test('creates a /{proxy+} resource', () => {
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: '{proxy+}',
    });
  });

  test('outputs the API Gateway URL', () => {
    const keys = Object.keys(template.toJSON().Outputs ?? {});
    expect(keys.some((k) => k.startsWith('ApiApiUrl'))).toBe(true);
  });

  test('exposes apiUrl as a non-empty string', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'ApiPropTestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
    const construct = new ApiConstruct(stack, 'Api', {
      tableName: 'tbl',
      bucketName: 'bkt',
      cognitoClientId: 'cid',
      userPoolArn: 'arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_test',
    });
    expect(construct.apiUrl).toBeDefined();
    expect(construct.lambdaFunction).toBeDefined();
  });
});
