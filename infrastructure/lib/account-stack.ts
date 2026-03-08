import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { GithubOidcConstruct } from './constructs/github-oidc.js';

export interface AccountStackProps extends cdk.StackProps {
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly allowedRefs?: string[];
}

/**
 * AccountStack defines account-level infrastructure that is shared across
 * all environment stacks (Dev, Prod, etc.). Currently includes the GitHub
 * OIDC provider and associated IAM role for CI/CD deployments.
 */
export class AccountStack extends cdk.Stack {
  public readonly githubOidcRoleArn: string;

  constructor(scope: Construct, id: string, props: AccountStackProps) {
    super(scope, id, props);

    const githubOidc = new GithubOidcConstruct(this, 'GithubOidc', {
      githubOwner: props.githubOwner,
      githubRepo: props.githubRepo,
      allowedRefs: props.allowedRefs,
    });

    this.githubOidcRoleArn = githubOidc.roleArn;
  }
}
