import { Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import {
  AuthConstruct,
  StorageConstruct,
  ApiConstruct,
  DynamoConstruct,
  DistributionConstruct,
  DnsConstruct,
} from './constructs/index.js';

export interface AppStackProps extends StackProps {
  readonly isProd: boolean;
  readonly domainName: string;
}

export class AppStack extends Stack {
  public readonly isProd: boolean;
  public readonly domainName: string;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.isProd = props.isProd;
    this.domainName = props.domainName;

    const auth = new AuthConstruct(this, 'Auth', {
      isProd: props.isProd,
    });

    const storage = new StorageConstruct(this, 'Storage', {
      isProd: props.isProd,
    });

    // Create DynamoDB table first so its name can be passed directly to the API construct
    // without a Lazy reference (avoids a circular dependency).
    const dynamo = new DynamoConstruct(this, 'Dynamo', {
      isProd: props.isProd,
    });

    const api = new ApiConstruct(this, 'Api', {
      tableName: dynamo.tableName,
      bucketName: storage.bucket.bucketName,
      userPoolArn: auth.userPoolArn,
      userPoolId: auth.userPoolId,
    });

    // Grant the Lambda function minimum required permissions on DynamoDB and S3.
    dynamo.table.grant(
      api.lambdaFunction,
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:Query',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem'
    );
    storage.bucket.grantReadWrite(api.lambdaFunction);

    // Derive the root hosted-zone domain from the full subdomain.
    // Assumes a 2-part TLD (e.g. "kstrm.com" from "knotes-api.kstrm.com").
    // For ccTLDs with 3-part roots (e.g. "co.uk"), this would need adjustment.
    const domainParts = props.domainName.split('.');
    const hostedZoneDomainName = domainParts.slice(-2).join('.');

    // Create the certificate and hosted-zone lookup before the distribution so the
    // certificate can be attached to CloudFront.
    const dns = new DnsConstruct(this, 'Dns', {
      hostedZoneDomainName,
      subdomain: props.domainName,
    });

    const dist = new DistributionConstruct(this, 'Distribution', {
      restApi: api.restApi,
      bucket: storage.bucket,
      certificate: dns.certificate,
      domainNames: [props.domainName],
    });

    // Wire the Route 53 A record to the distribution now that both are available.
    dns.addAliasRecord(dist.distribution);
  }
}
