import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface DistributionConstructProps {
  readonly restApi: apigateway.RestApiBase;
  readonly bucket: s3.IBucket;
  /** ARN of an AWS WAF v2 WebACL (must reside in us-east-1). */
  readonly webAclId?: string;
  /** ACM certificate for the custom domain (must reside in us-east-1). */
  readonly certificate?: acm.ICertificate;
  /** Custom domain names to associate with the distribution. */
  readonly domainNames?: string[];
}

export class DistributionConstruct extends Construct {
  public readonly distributionDomainName: string;
  public readonly distributionId: string;

  constructor(scope: Construct, id: string, props: DistributionConstructProps) {
    super(scope, id);

    const apiOrigin = new origins.RestApiOrigin(props.restApi);
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(props.bucket);

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: apiOrigin,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      additionalBehaviors: {
        '/uploads/*': {
          origin: s3Origin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      webAclId: props.webAclId,
      certificate: props.certificate,
      domainNames: props.domainNames,
    });

    this.distributionDomainName = distribution.distributionDomainName;
    this.distributionId = distribution.distributionId;

    new cdk.CfnOutput(this, 'DistributionDomainName', { value: this.distributionDomainName });
    new cdk.CfnOutput(this, 'DistributionId', { value: this.distributionId });
  }
}
