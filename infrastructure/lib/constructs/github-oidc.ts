import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GithubOidcConstructProps {
  readonly githubOwner: string;
  readonly githubRepo: string;
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
            'token.actions.githubusercontent.com:sub': `repo:${props.githubOwner}/${props.githubRepo}:*`,
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: `Role for GitHub Actions deployments from ${props.githubOwner}/${props.githubRepo}`,
    });

    // CloudFormation permissions: required to deploy/manage CDK stacks
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudFormationFullAccess')
    );

    // IAM permissions: required for CDK to create service execution roles
    // (Lambda execution roles, API Gateway service roles, etc.)
    this.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('IAMFullAccess'));

    // CloudWatch Logs: required for log group creation and management
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess')
    );

    // Service-specific permissions for the deployed resources
    this.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLambdaFullAccess'));
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayAdministrator')
    );
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess')
    );
    this.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoPowerUser')
    );
    this.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudFrontFullAccess'));
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonRoute53FullAccess')
    );

    this.roleArn = this.role.roleArn;
  }
}
