import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GithubOidcConstructProps {
  readonly githubOwner: string;
  readonly githubRepo: string;
  /** GitHub ref patterns allowed to assume the role (e.g. 'refs/heads/master'). Defaults to ['refs/heads/master']. */
  readonly allowedRefs?: string[];
}

/**
 * Constructs an IAM OIDC provider for GitHub Actions and a role that allows
 * deployments from a specific GitHub repository to assume the role.
 */
export class GithubOidcConstruct extends Construct {
  public readonly roleArn: string;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: GithubOidcConstructProps) {
    super(scope, id);

    const allowedRefs = props.allowedRefs ?? ['refs/heads/master'];
    const subConditions = allowedRefs.map(
      (ref) => `repo:${props.githubOwner}/${props.githubRepo}:ref:${ref}`
    );

    // Create the OIDC provider for GitHub Actions
    // Thumbprint for token.actions.githubusercontent.com is well-known
    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
    });

    // Create the role that GitHub Actions will assume
    this.role = new iam.Role(this, 'GithubActionsRole', {
      assumedBy: new iam.FederatedPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub':
              subConditions.length === 1 ? subConditions[0] : subConditions,
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: `Role for GitHub Actions deployments from ${props.githubOwner}/${props.githubRepo}`,
    });

    this.addDeploymentPermissions();

    this.roleArn = this.role.roleArn;
  }

  /** Adds scoped inline IAM permissions required for CDK deployments. */
  private addDeploymentPermissions(): void {
    const accountId = cdk.Aws.ACCOUNT_ID;

    // CloudFormation: manage KnotesApi* and CDKToolkit stacks
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudFormationStacks',
        actions: [
          'cloudformation:CreateStack',
          'cloudformation:UpdateStack',
          'cloudformation:DeleteStack',
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackEvents',
          'cloudformation:DescribeStackResource',
          'cloudformation:DescribeStackResources',
          'cloudformation:GetTemplate',
          'cloudformation:ListStackResources',
          'cloudformation:CreateChangeSet',
          'cloudformation:DescribeChangeSet',
          'cloudformation:ExecuteChangeSet',
          'cloudformation:DeleteChangeSet',
          'cloudformation:ListChangeSets',
          'cloudformation:TagResource',
          'cloudformation:UntagResource',
        ],
        resources: [
          `arn:aws:cloudformation:*:${accountId}:stack/KnotesApi*/*`,
          `arn:aws:cloudformation:*:${accountId}:stack/CDKToolkit/*`,
        ],
      })
    );

    // CloudFormation: account-level actions required by CDK
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudFormationGlobal',
        actions: [
          'cloudformation:GetTemplateSummary',
          'cloudformation:ValidateTemplate',
          'cloudformation:ListStacks',
        ],
        resources: ['*'],
      })
    );

    // IAM: manage roles and policies scoped to stack and CDK resources
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'IamRoleManagement',
        actions: [
          'iam:CreateRole',
          'iam:DeleteRole',
          'iam:GetRole',
          'iam:UpdateRole',
          'iam:UpdateAssumeRolePolicy',
          'iam:AttachRolePolicy',
          'iam:DetachRolePolicy',
          'iam:PutRolePolicy',
          'iam:DeleteRolePolicy',
          'iam:GetRolePolicy',
          'iam:ListRolePolicies',
          'iam:ListAttachedRolePolicies',
          'iam:ListInstanceProfilesForRole',
          'iam:TagRole',
          'iam:UntagRole',
          'iam:PassRole',
        ],
        resources: [
          `arn:aws:iam::${accountId}:role/KnotesApi*`,
          `arn:aws:iam::${accountId}:role/cdk-*`,
        ],
      })
    );

    // IAM: allow AWS services to create service-linked roles
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ServiceLinkedRoles',
        actions: ['iam:CreateServiceLinkedRole'],
        resources: [`arn:aws:iam::${accountId}:role/aws-service-role/*`],
      })
    );

    // Lambda: manage functions created by the stacks
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'Lambda',
        actions: [
          'lambda:CreateFunction',
          'lambda:DeleteFunction',
          'lambda:GetFunction',
          'lambda:GetFunctionConfiguration',
          'lambda:UpdateFunctionCode',
          'lambda:UpdateFunctionConfiguration',
          'lambda:ListTags',
          'lambda:TagResource',
          'lambda:UntagResource',
          'lambda:AddPermission',
          'lambda:RemovePermission',
          'lambda:InvokeFunction',
          'lambda:GetPolicy',
          'lambda:PublishVersion',
          'lambda:PutFunctionEventInvokeConfig',
        ],
        resources: [`arn:aws:lambda:*:${accountId}:function:KnotesApi*`],
      })
    );

    // API Gateway: manage REST APIs
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ApiGateway',
        actions: [
          'apigateway:GET',
          'apigateway:POST',
          'apigateway:PUT',
          'apigateway:PATCH',
          'apigateway:DELETE',
        ],
        resources: [
          'arn:aws:apigateway:*::/restapis',
          'arn:aws:apigateway:*::/restapis/*',
          'arn:aws:apigateway:*::/tags/*',
        ],
      })
    );

    // DynamoDB: manage tables created by the stacks
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'DynamoDB',
        actions: [
          'dynamodb:CreateTable',
          'dynamodb:DeleteTable',
          'dynamodb:DescribeTable',
          'dynamodb:UpdateTable',
          'dynamodb:DescribeTimeToLive',
          'dynamodb:UpdateTimeToLive',
          'dynamodb:DescribeContinuousBackups',
          'dynamodb:UpdateContinuousBackups',
          'dynamodb:ListTagsOfResource',
          'dynamodb:TagResource',
          'dynamodb:UntagResource',
        ],
        resources: [`arn:aws:dynamodb:*:${accountId}:table/KnotesApi*`],
      })
    );

    // S3: manage app buckets and CDK staging bucket
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'S3',
        actions: [
          's3:CreateBucket',
          's3:DeleteBucket',
          's3:GetBucketPolicy',
          's3:PutBucketPolicy',
          's3:DeleteBucketPolicy',
          's3:GetBucketVersioning',
          's3:PutBucketVersioning',
          's3:GetEncryptionConfiguration',
          's3:PutEncryptionConfiguration',
          's3:GetBucketPublicAccessBlock',
          's3:PutBucketPublicAccessBlock',
          's3:GetLifecycleConfiguration',
          's3:PutLifecycleConfiguration',
          's3:GetBucketLocation',
          's3:ListBucket',
          's3:GetBucketTagging',
          's3:PutBucketTagging',
          's3:GetObject',
          's3:PutObject',
          's3:DeleteObject',
          's3:GetBucketCors',
          's3:PutBucketCors',
        ],
        resources: [
          'arn:aws:s3:::knotesapi*',
          'arn:aws:s3:::knotesapi*/*',
          'arn:aws:s3:::cdk-*',
          'arn:aws:s3:::cdk-*/*',
        ],
      })
    );

    // Cognito: manage user pools
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'Cognito',
        actions: [
          'cognito-idp:CreateUserPool',
          'cognito-idp:DeleteUserPool',
          'cognito-idp:DescribeUserPool',
          'cognito-idp:UpdateUserPool',
          'cognito-idp:CreateUserPoolDomain',
          'cognito-idp:DeleteUserPoolDomain',
          'cognito-idp:DescribeUserPoolDomain',
          'cognito-idp:CreateUserPoolClient',
          'cognito-idp:DeleteUserPoolClient',
          'cognito-idp:DescribeUserPoolClient',
          'cognito-idp:UpdateUserPoolClient',
          'cognito-idp:ListTagsForResource',
          'cognito-idp:TagResource',
          'cognito-idp:UntagResource',
        ],
        resources: [`arn:aws:cognito-idp:*:${accountId}:userpool/*`],
      })
    );

    // CloudFront: manage distributions and origin access controls
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudFront',
        actions: [
          'cloudfront:CreateDistribution',
          'cloudfront:DeleteDistribution',
          'cloudfront:GetDistribution',
          'cloudfront:GetDistributionConfig',
          'cloudfront:UpdateDistribution',
          'cloudfront:TagResource',
          'cloudfront:UntagResource',
          'cloudfront:ListTagsForResource',
          'cloudfront:CreateOriginAccessControl',
          'cloudfront:DeleteOriginAccessControl',
          'cloudfront:GetOriginAccessControl',
          'cloudfront:UpdateOriginAccessControl',
          'cloudfront:CreateInvalidation',
        ],
        resources: ['*'],
      })
    );

    // Route 53: manage DNS records
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'Route53',
        actions: [
          'route53:GetHostedZone',
          'route53:ListHostedZones',
          'route53:ListHostedZonesByName',
          'route53:ChangeResourceRecordSets',
          'route53:GetChange',
          'route53:ListResourceRecordSets',
        ],
        resources: ['*'],
      })
    );

    // ACM: manage certificates
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ACM',
        actions: [
          'acm:RequestCertificate',
          'acm:DeleteCertificate',
          'acm:DescribeCertificate',
          'acm:ListCertificates',
          'acm:ListTagsForCertificate',
          'acm:AddTagsToCertificate',
        ],
        resources: ['*'],
      })
    );

    // CloudWatch & Logs: manage alarms and log groups
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchAndLogs',
        actions: [
          'logs:CreateLogGroup',
          'logs:DeleteLogGroup',
          'logs:DescribeLogGroups',
          'logs:PutRetentionPolicy',
          'logs:DeleteRetentionPolicy',
          'logs:TagResource',
          'logs:UntagResource',
          'logs:ListTagsForResource',
          'cloudwatch:PutMetricAlarm',
          'cloudwatch:DeleteAlarms',
          'cloudwatch:DescribeAlarms',
          'cloudwatch:TagResource',
          'cloudwatch:UntagResource',
        ],
        resources: ['*'],
      })
    );

    // SNS: manage alarm notification topics
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SNS',
        actions: [
          'sns:CreateTopic',
          'sns:DeleteTopic',
          'sns:GetTopicAttributes',
          'sns:SetTopicAttributes',
          'sns:Subscribe',
          'sns:Unsubscribe',
          'sns:ListSubscriptionsByTopic',
          'sns:TagResource',
          'sns:UntagResource',
          'sns:ListTagsForResource',
        ],
        resources: [`arn:aws:sns:*:${accountId}:KnotesApi*`],
      })
    );

    // SSM: CDK context lookups
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SSM',
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [`arn:aws:ssm:*:${accountId}:parameter/cdk-bootstrap/*`],
      })
    );

    // STS: identity verification and CDK bootstrap role assumption
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'STS',
        actions: ['sts:GetCallerIdentity'],
        resources: ['*'],
      })
    );

    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'STSAssumeCdkRoles',
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${accountId}:role/cdk-*`],
      })
    );
  }
}
