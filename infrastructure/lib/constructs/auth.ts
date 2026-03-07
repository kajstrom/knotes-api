import * as cognito from 'aws-cdk-lib/aws-cognito';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface AuthConstructProps {
  readonly isProd: boolean;
  readonly domainPrefix: string;
  readonly cloudFrontDomain: string;
}

export class AuthConstruct extends Construct {
  public readonly userPoolId: string;
  public readonly userPoolArn: string;
  public readonly appClientId: string;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    const userPool = new cognito.UserPool(this, 'UserPool', {
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigits: true,
        requireLowercase: false,
        requireSymbols: false,
      },
      selfSignUpEnabled: true,
      removalPolicy: props.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool,
      cognitoDomain: { domainPrefix: props.domainPrefix },
    });

    const appClient = new cognito.UserPoolClient(this, 'AppClient', {
      userPool,
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [props.cloudFrontDomain],
        logoutUrls: [props.cloudFrontDomain],
      },
    });

    this.userPoolId = userPool.userPoolId;
    this.userPoolArn = userPool.userPoolArn;
    this.appClientId = appClient.userPoolClientId;

    new CfnOutput(this, 'UserPoolId', { value: this.userPoolId });
    new CfnOutput(this, 'UserPoolArn', { value: this.userPoolArn });
    new CfnOutput(this, 'AppClientId', { value: this.appClientId });
  }
}
