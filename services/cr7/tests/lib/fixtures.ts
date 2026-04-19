type FixtureValues<T extends Record<string, unknown>, R extends (keyof T)> = {
  [K in R]: T[K] extends (context: infer _C, use: (value: infer V) => Promise<void>) => Promise<void>
    ? V
    : T[K];
};

export type FixturesResult<T extends Record<string, unknown>, R extends (keyof T)> = {
  values: FixtureValues<T, R>;
  close: () => Promise<void>;
};

/**
 *
 * @description A helper function to use fixtures in tests.
 * 解析 fixture_tree，获取 resources 中指定的资源，在调用指定资源之前构造好它的依赖，并在调用完成后销毁它的依赖。
 *
 */
export async function useFixtures<
  T extends Record<string, unknown>,
  R extends (keyof T)
>(
  fixture_tree: T,
  resources: R[]
): Promise<FixturesResult<T, R>> {
  const values: FixtureValues<T, R> = {} as FixtureValues<T, R>;
  const initialized = new Set<string>();
  const resourceCleanups: Array<{
    resolve: () => void;
    promise: Promise<void>;
  }> = [];

  async function initResource(name: string): Promise<void> {
    if (initialized.has(name)) {
      return;
    }

    const resource = fixture_tree[name];

    // 如果是普通值，直接存储
    if (typeof resource !== 'function') {
      values[name] = resource;
      initialized.add(name);
      return;
    }

    // 分析函数依赖（从解构参数中提取）
    const funcStr = resource.toString();
    const paramMatch = funcStr.match(/^async\s*\(\s*\{\s*([^}]*)\s*\}/);

    let deps: string[] = [];
    if (paramMatch) {
      deps = paramMatch[1]
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);
    }

    // 递归初始化依赖
    for (const dep of deps) {
      await initResource(dep);
    }

    // 构造 context
    const context: Record<string, unknown> = {};
    for (const dep of deps) {
      context[dep] = values[dep];
    }

    // 创建控制 promise
    let resolveValue: () => void;
    const valuePromise = new Promise<void>((resolve) => {
      resolveValue = resolve;
    });

    let resolveCleanup: () => void;
    const cleanupPromise = new Promise<void>((resolve) => {
      resolveCleanup = resolve;
    });

    // use 函数：设置值并等待清理信号
    const use = async (value: unknown) => {
      values[name] = value;
      resolveValue!();
      await cleanupPromise;
    };

    // 启动资源初始化
    const resourcePromise = resource(context, use);

    // 等待值被设置
    await valuePromise;

    // 保存清理函数
    resourceCleanups.push({
      resolve: resolveCleanup!,
      promise: resourcePromise
    });

    initialized.add(name);
  }

  // 初始化所有请求的资源
  for (const resource of resources) {
    await initResource(resource as string);
  }

  // 清理函数：按相反顺序清理资源
  const close = async () => {
    // 按相反顺序触发清理
    for (const cleanup of [...resourceCleanups].reverse()) {
      cleanup.resolve();
    }
    // 等待所有清理完成
    await Promise.all(resourceCleanups.map(c => c.promise));
  };

  return { values, close };
}
