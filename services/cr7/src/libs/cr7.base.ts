import { User } from "@cr7/types";
import { Service, Errors, ServiceBroker, Context } from "moleculer";
import { Pool } from "pg";

const { MoleculerClientError } = Errors;

/**
 * RC7BaseService
 * 基础服务类，提供所有 RC7 服务的公共方法和属性
 */
export class RC7BaseService extends Service {
  pool!: Pool;

  constructor(broker: ServiceBroker) {
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

  /**
   * 检查当前用户是否满足 action 所需角色
   */
  async checkUserRole(
    ctx: Context<unknown, { user?: { uid?: string }; roles?: Array<string> }>
  ) {
    const requiredRoles: string[] = ctx.action?.roles || [];
    if ((ctx.meta.user ?? null) === null) {
      return;
    }

    const resolvedRoles = ctx.meta.roles
      ?? (await ctx.call<User.UserRolesResult>('user.roles')).roles.map(role => role.name);
    ctx.meta.roles = resolvedRoles;
    const roleSet = new Set(resolvedRoles.map(role => role.toLowerCase()));

    if (requiredRoles.length === 0) {
      return;
    }

    const satisfy = requiredRoles.some(role => roleSet.has(role));
    if (satisfy === false) {
      throw new MoleculerClientError('Insufficient permissions', 403, 'FORBIDDEN_ACCESS');
    }
  }
}
