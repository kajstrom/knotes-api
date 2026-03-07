import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface ObservabilityConstructProps {
  readonly lambdaFunction: lambda.IFunction;
  readonly restApi: apigateway.RestApi;
  readonly alarmEmail: string;
}

export class ObservabilityConstruct extends Construct {
  public readonly alarmTopic: sns.Topic;
  public readonly lambdaErrorRateAlarm: cloudwatch.Alarm;
  public readonly apiGateway5xxAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: ObservabilityConstructProps) {
    super(scope, id);

    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'Knotes API Alarm Notifications',
    });

    this.alarmTopic.addSubscription(
      new sns_subscriptions.EmailSubscription(props.alarmEmail),
    );

    const snsAction = new cloudwatch_actions.SnsAction(this.alarmTopic);

    // Lambda error rate: IF(invocations > 0, (errors / invocations) * 100, 0)
    const lambdaErrorRateMetric = new cloudwatch.MathExpression({
      expression: 'IF(invocations > 0, (errors / invocations) * 100, 0)',
      usingMetrics: {
        errors: props.lambdaFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
        invocations: props.lambdaFunction.metricInvocations({ period: cdk.Duration.minutes(5) }),
      },
      period: cdk.Duration.minutes(5),
      label: 'Lambda Error Rate (%)',
    });

    this.lambdaErrorRateAlarm = new cloudwatch.Alarm(this, 'LambdaErrorRateAlarm', {
      metric: lambdaErrorRateMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda error rate exceeded 1% over 5 minutes',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    this.lambdaErrorRateAlarm.addAlarmAction(snsAction);
    this.lambdaErrorRateAlarm.addOkAction(snsAction);

    // API Gateway 5xx rate: IF(count > 0, (errors5xx / count) * 100, 0)
    const apiGateway5xxRateMetric = new cloudwatch.MathExpression({
      expression: 'IF(count > 0, (errors5xx / count) * 100, 0)',
      usingMetrics: {
        errors5xx: props.restApi.metricServerError({ period: cdk.Duration.minutes(5) }),
        count: props.restApi.metricCount({ period: cdk.Duration.minutes(5) }),
      },
      period: cdk.Duration.minutes(5),
      label: 'API Gateway 5xx Rate (%)',
    });

    this.apiGateway5xxAlarm = new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      metric: apiGateway5xxRateMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'API Gateway 5xx error rate exceeded 1% over 5 minutes',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    this.apiGateway5xxAlarm.addAlarmAction(snsAction);
    this.apiGateway5xxAlarm.addOkAction(snsAction);
  }
}
