import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

export interface DynamoItem {
  PK: string;
  SK: string;
  [key: string]: unknown;
}

const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

function getTableName(): string {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error('TABLE_NAME environment variable is not set');
  }
  return tableName;
}

export async function getItem(pk: string, sk: string): Promise<DynamoItem | undefined> {
  const { Item } = await docClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: { PK: pk, SK: sk },
    })
  );
  return Item as DynamoItem | undefined;
}

export async function putItem(item: DynamoItem): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: item,
    })
  );
}

export async function queryByPk(pk: string, skPrefix?: string): Promise<DynamoItem[]> {
  const keyCondition = skPrefix ? 'PK = :pk AND begins_with(SK, :skPrefix)' : 'PK = :pk';

  const expressionValues: Record<string, string> = { ':pk': pk };
  if (skPrefix) {
    expressionValues[':skPrefix'] = skPrefix;
  }

  const { Items = [] } = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
    })
  );
  return Items as DynamoItem[];
}

export async function updateItem(
  pk: string,
  sk: string,
  updates: Record<string, unknown>
): Promise<DynamoItem | undefined> {
  const entries = Object.entries(updates);

  if (entries.length === 0) {
    throw new Error('updateItem called with no update fields');
  }

  const expressionParts = entries.map((_, i) => `#attr${i} = :val${i}`);
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    expressionAttributeNames[`#attr${i}`] = key;
    expressionAttributeValues[`:val${i}`] = value;
  }

  const { Attributes } = await docClient.send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: { PK: pk, SK: sk },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );
  return Attributes as DynamoItem | undefined;
}

export async function deleteItem(pk: string, sk: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: getTableName(),
      Key: { PK: pk, SK: sk },
    })
  );
}
