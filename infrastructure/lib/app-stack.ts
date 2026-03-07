import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

// TODO: import LambdaApi construct from './constructs/lambda-api'
// TODO: import Database construct from './constructs/database'
// TODO: import Storage construct from './constructs/storage'
// TODO: import Dns construct from './constructs/dns'

export interface AppStackProps extends cdk.StackProps {
  readonly isProd: boolean;
  readonly domainName: string;
}

export class AppStack extends cdk.Stack {
  public readonly isProd: boolean;
  public readonly domainName: string;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.isProd = props.isProd;
    this.domainName = props.domainName;

    // TODO: compose Storage construct
    // TODO: compose Database construct
    // TODO: compose LambdaApi construct
    // TODO: compose Dns construct
  }
}
