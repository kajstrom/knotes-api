import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export interface DnsConstructProps {
  /** Root domain name of the existing Route 53 hosted zone, e.g. "kstrm.com". */
  readonly hostedZoneDomainName: string;
  /** Full subdomain to alias to the distribution, e.g. "api.kstrm.com". */
  readonly subdomain: string;
  /** CloudFront distribution the A record will alias to. */
  readonly distribution: cloudfront.IDistribution;
}

export class DnsConstruct extends Construct {
  /** ARN of the ACM certificate provisioned in us-east-1. */
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: DnsConstructProps) {
    super(scope, id);

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.hostedZoneDomainName,
    });

    // DnsValidatedCertificate provisions the certificate in us-east-1 via a
    // Lambda-backed custom resource, which is required for CloudFront distributions.
    const certificate = new acm.DnsValidatedCertificate(this, 'Certificate', {
      domainName: props.subdomain,
      hostedZone,
      region: 'us-east-1',
    });

    this.certificateArn = certificate.certificateArn;

    // Route 53 ARecord expects a relative record name (just the subdomain prefix).
    const recordName = props.subdomain.endsWith(`.${props.hostedZoneDomainName}`)
      ? props.subdomain.slice(0, -(props.hostedZoneDomainName.length + 1))
      : props.subdomain;

    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(props.distribution)
      ),
    });

    new cdk.CfnOutput(this, 'CertificateArn', { value: this.certificateArn });
  }
}
