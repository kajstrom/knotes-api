import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface StorageConstructProps {
  readonly isProd: boolean;
}

/**
 * Creates an S3 bucket with versioning, SSE-S3 encryption, and all public access
 * blocked. A CloudFront Origin Access Control (OAC) is provisioned for the bucket.
 * In production the bucket and its objects are retained on stack deletion;
 * outside production both are destroyed automatically.
 */
export class StorageConstruct extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly bucketArn: string;
  public readonly oacId: string;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, 'Bucket', {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: props.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.isProd,
    });

    this.bucketArn = this.bucket.bucketArn;

    const oac = new cloudfront.CfnOriginAccessControl(this, 'OAC', {
      originAccessControlConfig: {
        name: `${this.bucket.bucketName}-oac`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    this.oacId = oac.attrId;
  }
}
