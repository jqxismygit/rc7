import { Pool, PoolClient } from 'pg';
import { releaseExpiredOrders } from '../data/order.js';

export const command = 'expire-orders';
export const describe = '处理已过期订单并释放库存';

export const builder = {
  batchSize: {
    alias: 'batch-size',
    type: 'number',
    default: 100,
    describe: '单次事务处理的订单数量上限'
  }
};

export async function expireOrders(
  client: PoolClient,
  args: {
    schema: string;
    batchSize?: number;
    verbose?: boolean;
  }
) {
  const {
    schema,
    batchSize = 100,
    verbose = false,
  } = args;

  let totalProcessed = 0;

  while (true) {
    await client.query('BEGIN');

    try {
      const processed = await releaseExpiredOrders(client, schema, new Date(), batchSize);
      await client.query('COMMIT');

      totalProcessed += processed;

      if (verbose) {
        console.log(`Processed expired orders batch: ${processed}`);
      }

      if (processed < batchSize) {
        break;
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  console.log(`Processed expired orders total: ${totalProcessed}`);
}

export async function handler(argv?: {
  batchSize?: number;
  verbose?: boolean;
}) {

  const { default: config } = await import('config');
  const pool = new Pool(config.pg);
  const client = await pool.connect();

  try {
    await expireOrders(client, argv as {
      schema: string;
      batchSize?: number;
      verbose?: boolean;
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}