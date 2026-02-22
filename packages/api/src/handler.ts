import awsLambdaFastify from '@fastify/aws-lambda';
import { createApp } from './app';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';

let handler: (event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyResultV2>;

/**
 * AWS Lambda handler for Fastify application
 * Initializes the app once and reuses it for subsequent invocations
 */
export const lambdaHandler = async (
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  if (!handler) {
    const app = await createApp();
    handler = awsLambdaFastify(app);
  }

  return handler(event, context);
};

export default lambdaHandler;
