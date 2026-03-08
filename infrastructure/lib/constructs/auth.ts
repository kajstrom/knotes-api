import * as cognito from 'aws-cdk-lib/aws-cognito';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface AuthConstructProps {
  readonly isProd: boolean;
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
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false },
      removalPolicy: props.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    const appClient = new cognito.UserPoolClient(this, 'AppClient', {
      userPool,
      generateSecret: false,
      authFlows: { userSrp: true },
    });

    this.userPoolId = userPool.userPoolId;
    this.userPoolArn = userPool.userPoolArn;
    this.appClientId = appClient.userPoolClientId;

    new CfnOutput(this, 'UserPoolId', { value: this.userPoolId });
    new CfnOutput(this, 'UserPoolArn', { value: this.userPoolArn });
    new CfnOutput(this, 'AppClientId', { value: this.appClientId });
  }
}
