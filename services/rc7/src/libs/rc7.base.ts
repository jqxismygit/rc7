import { Service } from "moleculer";
import { Pool } from "pg";

/**
 * RC7BaseService
 * 基础服务类，提供所有 RC7 服务的公共方法和属性
 */
export class RC7BaseService extends Service {
  pool!: Pool;

  constructor(broker) {
    super(broker);
  }

  /**
   * 获取数据库 schema
   */
  async getSchema(): Promise<string> {
    const { default: config } = await import('config');
    return config.pg.schema;
  }

  /**
   * 初始化数据库连接池
   */
  async initPool() {
    const { default: config } = await import('config');
    this.pool = new Pool(config.pg);
  }

  /**
   * 关闭数据库连接池
   */
  async closePool() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
