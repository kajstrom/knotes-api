import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DynamoConstructProps {
  readonly isProd: boolean;
}

/**
 * Constructs a DynamoDB table with PK and SK (both String), PAY_PER_REQUEST billing,
 * and grants a Lambda function minimum required permissions on the table.
 */
export class DynamoConstruct extends Construct {
  public readonly table: dynamodb.Table;
  public readonly tableName: string;
  public readonly tableArn: string;

  constructor(scope: Construct, id: string, props: DynamoConstructProps) {
    super(scope, id);

    // Create the DynamoDB table
    this.table = new dynamodb.Table(this, 'Table', {
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Export table name and ARN
    this.tableName = this.table.tableName;
    this.tableArn = this.table.tableArn;
  }
}
