import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiConstructProps {
  readonly tableName: string;
  readonly bucketName: string;
  readonly userPoolArn: string;
  readonly userPoolId: string;
  readonly appClientId: string;
}

export class ApiConstruct extends Construct {
  public readonly apiUrl: string;
  public readonly lambdaFunction: lambda.Function;
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
    });

    this.lambdaFunction = new lambda.Function(this, 'Handler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../packages/api/dist')),
      handler: 'index.lambdaHandler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.PASS_THROUGH,
      logGroup,
      environment: {
        TABLE_NAME: props.tableName,
        BUCKET_NAME: props.bucketName,
        COGNITO_POOL_ID: props.userPoolId,
        COGNITO_CLIENT_ID: props.appClientId,
      },
    });

    const userPool = cognito.UserPool.fromUserPoolArn(this, 'UserPool', props.userPoolArn);

    this.restApi = new apigateway.RestApi(this, 'Api', {
      restApiName: 'knotes-api',
      deployOptions: {
        stageName: 'api',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
    });

    const api = this.restApi;

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
    });

    const integration = new apigateway.LambdaIntegration(this.lambdaFunction);

    const proxy = api.root.addResource('{proxy+}');
    proxy.addMethod('ANY', integration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    this.apiUrl = api.url;

    new cdk.CfnOutput(this, 'ApiUrl', { value: this.apiUrl });
  }
}
