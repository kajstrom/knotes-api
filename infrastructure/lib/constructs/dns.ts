import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export interface DnsConstructProps {
  /** Root domain name of the existing Route 53 hosted zone, e.g. "kstrm.com". */
  readonly hostedZoneDomainName: string;
  /** Full subdomain for which a certificate and A record will be created, e.g. "knotes-api.kstrm.com". */
  readonly subdomain: string;
}

export class DnsConstruct extends Construct {
  /** ACM certificate for the subdomain. Must be in us-east-1 for CloudFront — deploy this stack to us-east-1. */
  public readonly certificate: acm.ICertificate;
  /** ARN of the ACM certificate. */
  public readonly certificateArn: string;

  private readonly hostedZone: route53.IHostedZone;
  private readonly recordName: string;

  constructor(scope: Construct, id: string, props: DnsConstructProps) {
    super(scope, id);

    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.hostedZoneDomainName,
    });

    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: props.subdomain,
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    this.certificateArn = this.certificate.certificateArn;

    // Route 53 ARecord expects a relative record name (just the subdomain prefix).
    this.recordName = props.subdomain.endsWith(`.${props.hostedZoneDomainName}`)
      ? props.subdomain.slice(0, -(props.hostedZoneDomainName.length + 1))
      : props.subdomain;

    new cdk.CfnOutput(this, 'CertificateArn', { value: this.certificateArn });
  }

  /**
   * Adds a Route 53 A alias record pointing at the given CloudFront distribution.
   * Call this after the DistributionConstruct is created.
   */
  addAliasRecord(distribution: cloudfront.IDistribution): void {
    new route53.ARecord(this, 'AliasRecord', {
      zone: this.hostedZone,
      recordName: this.recordName,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });
  }
}
