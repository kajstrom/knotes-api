import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { AccountStack } from '../lib/account-stack.js';
import { AppStack } from '../lib/app-stack.js';
import { ApiConstruct } from '../lib/constructs/index.js';

// Ensure a minimal dist artifact exists before any describe body runs.
// AppStack instantiates ApiConstruct which calls Code.fromAsset at construction
// time (Jest collection phase), so this must happen at module top-level.
const distPath = path.join(__dirname, '../../packages/api/dist');
fs.mkdirSync(distPath, { recursive: true });
const distIndex = path.join(distPath, 'index.js');
if (!fs.existsSync(distIndex)) {
  fs.writeFileSync(distIndex, 'exports.lambdaHandler = async () => ({});');
}

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

describe('KnotesApiProd stack', () => {
  const app = new cdk.App();
  const stack = new AppStack(app, 'KnotesApiProd', {
    isProd: true,
    domainName: 'knotes-api.kstrm.com',
    env: { account: '123456789012', region: 'us-east-1' },
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
  function makeStack(isProd: boolean) {
    const app = new cdk.App();
    const stack = new AppStack(app, 'AuthTestStack', {
      isProd,
      domainName: 'knotes-auth-test',
      env: { account: '123456789012', region: 'us-east-1' },
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

  test('creates a User Pool Client with SRP auth flow', () => {
    devTemplate.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ExplicitAuthFlows: ['ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
    });
  });

  test('configures optional MFA with TOTP only', () => {
    devTemplate.hasResourceProperties('AWS::Cognito::UserPool', {
      MfaConfiguration: 'OPTIONAL',
      EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
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
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'ApiTestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
    new ApiConstruct(stack, 'Api', {
      tableName: 'test-table',
      bucketName: 'test-bucket',
      userPoolArn: 'arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_test',
      userPoolId: 'us-east-1_testpool',
    });
    template = Template.fromStack(stack);
  });

  test('creates a Lambda function with Node.js 22.x runtime', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
    });
  });

  test('Lambda has 128 MB memory', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 128,
    });
  });

  test('Lambda has 30 second timeout', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 30,
    });
  });

  test('Lambda has X-Ray PassThrough tracing', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      TracingConfig: { Mode: 'PassThrough' },
    });
  });

  test('Lambda has correct environment variables', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          TABLE_NAME: 'test-table',
          BUCKET_NAME: 'test-bucket',
        },
      },
    });
  });

  test('Lambda has COGNITO_POOL_ID environment variable', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          COGNITO_POOL_ID: 'us-east-1_testpool',
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
      userPoolArn: 'arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_test',
      userPoolId: 'us-east-1_testpool',
    });
    expect(construct.apiUrl).toBeDefined();
    expect(construct.lambdaFunction).toBeDefined();
  });
});
