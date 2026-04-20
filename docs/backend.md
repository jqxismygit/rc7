# 项目整体说明

项目整体采用 monorepo 结构，前端和后端代码分开管理，使用 pnpm 进行包管理和构建。
后端采用 Nodejs 和 moleculer 微服务框架，前端采用 React 和 Vite 构建工具。

- ./apps 为前端项目
- ./services 为后端项目

## 后端项目目录结构

后端服务代码

```txt
./services
  /types - cr7 API 相关类型定义
  /cr7
    /config - 配置文件
    /src - 后端服务源代码
      /data - 数据库操作层
      /api.service.ts - API 服务定义
      /user.service.ts - 用户服务定义
      /cr7.service.ts -  cr7 业务逻辑实现
    /tests - 后端服务测试代码
      /features - BDD 测试场景定义
      /steps - 测试步骤定义
      /lib - 测试辅助函数
      /fixtures - 测试数据、方法、断言、mock 等
    /db - 数据库相关文件，如迁移脚本、种子数据等
      / migrations - 数据表迁移脚本
      / bootstrap.ts - 数据表初始化脚本
```

## 后端服务开发规范

- 使用 TypeScript 进行开发，所有代码都需要有类型定义，并且遵循项目的 tsconfig 配置。
- 数据库操作通过 data 层封装，服务层调用 data 提供的方法进行数据访问，避免直接操作数据库。
- 定义 Moleculer action 时，所有输入参数都必须在 `params` schema 中声明并完成校验，优先复用框架能力，避免在业务代码里重复造参数校验轮子。
- 对于 HTTP 输入参数，按需使用 schema 的 `convert` 能力完成类型转换，让格式校验与类型转换统一在 schema 层处理。
- 时间与日期处理必须统一使用 `date-fns`，禁止手写字符串拼接（如 `yyyy-MM-dd HH:mm:ss`、`yyyyMMdd`）或直接做毫秒换算。
- 日期参数应在 `params` schema 中声明为 `type: 'date'`（面向 HTTP 输入时加上 `convert: true`）；进入业务函数后只处理业务约束（例如开始日期不能晚于结束日期），不再重复做字符串格式解析校验。

### 服务层结构

- API 定义在 api.service.ts 中
- 用户相关逻辑放在 user.service.ts 中。
- 业务逻辑实现放在 cr7.service.ts 中

### 类型定义规范

- 所有数据模型类型定义统一放在 services/types 目录
- Request 类型应通过 TypeScript 工具类型基于已有类型组合得出，如 `Omit<Xxx, 'id' | 'created_at' | 'updated_at'>`
- API 文档中的 Request Body 类型说明应明确引用 services/types 中的类型来源和组合方式
- 测试代码应导入并复用 services/types 中定义的类型，避免重复定义
- 不要在 services/types 中创建 Request 类型，如 `CreateXxxRequest`、`UpdateXxxRequest` 等
- 类型字段变更要同步更新 data 层查询字段、服务层响应组装、API 文档和测试断言，避免类型定义与实际返回结构脱节

### API 文档编写规范

API 文档放在 docs/api 目录下，以 Markdown 格式编写。编写时需要注意以下几点：

**避免在文档中添加具体示例**
- 不要在 API 文档中提供完整的请求/响应示例，因为类型定义（services/types）已经清晰描述了数据结构
- 示例容易过期且难以同步，会传递错误的信息，降低文档可信度
- 使用 TypeScript 类型引用替代示例，保持单一事实来源

**只保留流程性说明，不描述实现细节**
- 说明业务流程和约束条件，如"创建订单时会自动计算总金额并设置 30 分钟过期时间"
- 不说明实现细节，如"使用 FOR UPDATE 行锁"、"通过 released_at 字段判断幂等"等
- 隐藏不必要的技术细节，让文档更聚焦于业务

**充分利用 HTTP 状态码区分错误情况**
- 不同的错误原因应该返回不同的状态码，让客户端可以准确处理
- 常见的业务错误状态码约定：
  - `400 Bad Request`：参数校验失败（如数量为 0、必填字段缺失等）
  - `401 Unauthorized`：未认证
  - `404 Not Found`：资源不存在或无权限访问
  - `409 Conflict`：资源冲突（如库存不足、重复操作等）
  - `410 Gone`：资源已过期或不可用（如 session 已过期）

**关键特性说明**
- 重点突出幂等性、权限控制、并发安全等业务关键特性
- 使用简洁的版块（如 "关键特性"）而不是冗长的技术说明章节

**保持文档简洁清晰**
- 每个接口的说明控制在 10-15 行以内
- 使用列表格式，避免长段落叙述
- 强调"是什么"和"为什么"，而不是"怎么样实现的"
- 文档描述必须与实际类型和返回结构保持一致，字段删改后要同步更新文档说明

## 命令工具 cr7

在 /services/cr7/scripts 目录下提供了一个命令行工具 cr7，用于执行一些常用的开发和维护任务，如数据库迁移、数据处理等功能。
入口命令为 `pnpm -w s cr7 <command>`，其中 `<command>` 是 cr7 工具支持的具体命令，如 `migration`、`bootstrap` 等。
一些运维相关的命令也会放在 cr7 工具中，方便运维人员使用。


## 测试

测试采用 BDD 风格，使用 @amiceli/vitest-cucumber 作为 vitest 的扩展进行测试编写和执行。

### 测试目录结构

- 测试场景定义在 services/cr7/tests/features 目录
- 测试步骤实现放在 services/cr7/tests/specs 目录（*.spec.ts）
- 测试辅助函数放在 services/cr7/tests/lib 目录
- 测试数据、API 请求、断言等放在 services/cr7/tests/fixtures 目录

### features

测试场景使用 Gherkin 语法编写，清晰描述测试的 Given、When、Then 步骤。

### 测试编写规范

#### 类型定义

- 在测试文件顶部使用类型别名提炼复杂类型，避免在步骤定义中重复声明
- 通过 `Omit` 组合方式定义 Draft 类型，例如：
  ```typescript
  type DraftExhibition = Omit<ExhibitionType, 'id' | 'created_at' | 'updated_at'>;
  ```
- 使用 `StepTest<T>` 泛型定义步骤上下文类型，确保类型安全
- 不要为整个 spec 维护一个臃肿的全局 context type，应按 Scenario 实际需要组合多个小 context type，避免无关字段在不同场景间漂移，降低步骤实现的可读性和约束力

#### 步骤实现

- 避免在多个 Scenario 中重复相同的 Given/When/Then 步骤逻辑
- 将通用的步骤实现封装到 fixtures 中作为辅助函数，供多个测试场景复用
- 抽象测试 helper 之前先检查现有 fixtures 中是否已有可复用函数；新增 helper 后，要回查并替换 spec 中重复的旧逻辑，避免项目内同时存在两套做法
- 使用直接赋值的方式来更新上下文: `context.property = value`, 这样可以出发 type check，辅助判断逻辑问题
- 初始化数据时使用 `null` 而不是空字符串，保持数据一致性

#### 测试数据

- 在 fixtures 目录中创建辅助函数生成测试数据，例如 `prepareExhibitionData()`
- 使用随机数据生成工具避免测试数据冲突，特别是在并行测试场景中
- 在 `services/cr7/tests/lib/random.ts` 中提供通用的随机数据生成函数
- fixtures 中应优先提供可复用的结构断言函数，并在请求 helper 中复用，避免在 spec 中重复展开同一类返回结构断言
- 涉及日期推导时统一使用 `date-fns` 等明确的日期函数，如 `addDays`、`subDays`，避免手动拼接日期字符串或直接做毫秒换算导致时区和边界错误

#### 路径别名

- 在 vitest.config.ts 中配置 `@/` 别名指向 `src` 目录，简化导入路径
- 在 fixtures 和测试中统一使用 `@/` 别名导入源代码模块

#### Feature 与 Spec 同步经验（vitest-cucumber）

- `spec:gen` 需要显式参数：`--feature` 和 `--spec`，仅执行 `npx @amiceli/vitest-cucumber` 会报错。
- 同一个 Scenario 内，步骤文本不能完全重复（即使是 Given 和 Then 也不行），否则会抛 `ItemAlreadyExistsError`。
- 为避免重复步骤冲突，建议区分前置与断言文案：如“库存初始为 N”与“库存为 N/库存应为 N”。
- 重复动作步骤也要区分文案：如“执行订单过期处理任务”与“再次执行订单过期处理任务”。
- 推荐流程：先统一 feature 文案，再同步 spec，最后执行单文件校验命令 `pnpm test tests/order.spec.ts`。
- 对于同一类同步断言（例如场次/票种/库存），优先通过统一 feature 步骤文案来复用 `defineSteps` 中的同一条步骤实现。
- 不要在 spec 顶层再额外抽象同类判断函数（如 `assertSyncXxx`）并与 `defineSteps` 并行维护，避免出现“两套入口、同一断言”的漂移风险。
- 若某场景文案为“场次库存价格信息”等变体，应优先收敛到已有可复用文案（如“场次同步消息中有 N 个场次”），再复用现有 `defineSteps` 断言链路。

#### BDD 测试的一些最佳实践

- 不要在 spec 中直接写 SQL 改库，否则容易绕过真实业务链路，也会让不同 spec 各自维护一套绑定逻辑。
- 外部服务如果会在启动阶段就被访问，例如 wechat access token 之类的能力，mock 应放在 spec 级别或共享 fixture 初始化阶段完成，保证服务启动和场景执行看到的是同一套 mock 环境。
- 触发副作用的步骤文案应尽量落在 `When`，`Given` 只负责准备数据。像“票种开始时间/结束时间”这类条件应放在 `Given`，真正执行“同步给携程”应放在 `When`，这样 feature 语义更清晰，spec 复用也更自然。
- 第三方请求断言优先基于 mock handler 的真实调用参数做校验，例如直接读取 `vi.fn().mock.calls` 中的请求体，再做解密和字段断言；不要额外维护一份“latest request”影子状态，否则很容易在重构后出现断言和真实请求脱节。
- 回归修复时，优先执行受影响的单文件用例确认语义收敛，再决定是否扩大验证范围。本次类似命令可直接使用 `pnpm -w s t xiecheng.spec.ts --bail 1`，先把 feature 文案、defineSteps 和断言链路在最小范围内跑通。
- 在 BDD step 实现中，优先在步骤开头用解构获取 `featureContext` 所需字段（如 `const { apiServer, userToken } = featureContext`），后续逻辑统一使用局部变量，避免在函数体内到处直接写 `featureContext.xxx`。

#### 测试代码规范

- 在 fixtures 的 `assert<Resource>` 函数中使用 `toHaveProperty(property, matcher)` 断言字段结构，语义清晰、可读性好, 示例：
  ```typescript
  expect(article).toHaveProperty('sort_order', expect.any(Number));
  expect(article).toHaveProperty('cover_url', expect.toBeOneOf([expect.any(String), null]));
  ```

### 测试执行

测试执行命令：`pnpm -w s test` （在根目录执行，-w s 表示只运行 services 目录下的测试）

- 强约束：修改 `services/cr7/src` 后执行 BDD/集成测试前，必须先构建一次 `services/cr7`，避免测试加载过期 `dist`。
- 原因：测试夹具通过 `dist/*.service.js` 启动服务；如果未重新构建，测试会运行旧实现并产生“代码已改但断言仍旧失败”的假阴性。
- 推荐命令：`pnpm -w s build && pnpm -w s test`
- 单文件回归也遵循同样顺序，例如：`pnpm -w s build && pnpm -w s test tests/mop.spec.ts`


## 数据库操作

- 数据库相关文件放在 services/cr7/db 目录
- 数据库操作通过 data 层封装，服务层调用 data 提供的方法进行数据访问，避免直接操作数据库。
- 项目采用 code first 模式，db/下创建数据库定义，然后通过迁移脚本或启动脚本进行数据库表的创建和更新.
- 表结构都定义在 pg schema 下，除非有特例不会在 public schema 下创建表。

### 数据迁移步骤：

1. 在数据库迁移前执行 bootstrap 命令：`pnpm -w s cr7 bootstrap`，此命令会初始化一些必要插件。
2. 创建新的迁移脚本，执行命令 `pnpm -w s cr7 migration create <migration-name>`，会在 services/cr7/db/migrations 目录下生成一个新的迁移脚本文件。
3. 在迁移脚本中定义数据库表的创建、修改或删除操作。
4. 执行迁移命令 `pnpm -w s cr7 migration upgrade`，会执行所有未执行过的迁移脚本，更新数据库表结构。

### 迁移文件发布规则

- 如果某个 SQL migration 文件已经存在于 release 分支，视为已发布，禁止再修改该文件内容。
- 已发布 migration 如需调整逻辑，只能新增一个新的 migration 文件来修正，不能覆盖历史 migration。
- 该规则用于保证各环境迁移历史一致，避免因修改已发布 migration 导致环境漂移或升级失败。
- 幂等性或状态机语义相关的关键字段应优先落在主资源表上，例如订单的当前退款引用、退款完成时间等，避免仅依赖关联流水表“最后一条记录”推导当前状态。

### SQL 编写规范

- 除了 public schema 下的表，其他 schema 下的表都要加上 schema 前缀，如 `my_schema.my_table`。
- SQL 语句关键字要大写，变量小写。
- 非必要不用在 sql 中标注类型，如 `SELECT id FROM my_table`，而不是 `SELECT id::int FROM my_table`。
- 不要给 select 字段起和原字段完全一样的别名，如 `SELECT id as id FROM my_table`，而是直接 `SELECT id FROM my_table`。
- 表名、字段名使用下划线分隔，如 user_profile。
- 复杂的 SQL 语句使用多行编写，并且适当缩进以提高可读性。
- 在 SQL 语句中使用参数化查询，避免直接拼接字符串，防止 SQL 注入攻击。
- 尽量用 CTE 将复杂查询拆分为多个步骤，提高可读性和可维护性。
- 不要用存储过程


### data 层方法规范

- 参数中要带上 client 和 schema，避免在服务层直接使用全局数据库连接，增加代码的可测试性和灵活性。
- 方法命名使用动词开头，清晰表达方法的功能，如 getUserById、createProduct 等。
- 压缩方法中的 db query 次数，尽量将多个相关的数据库操作合并为一个 query，减少服务层对数据库的调用次数，提高性能。
- 封装针对资源的查询方法时，不用封装 join 逻辑，数据组合放在服务层实现，保持 data 层方法的单一职责和灵活性。
- data 层查询方法对“资源不存在”应统一抛出对应 DataError，不返回 null 让上层重复判断。
- data 层不要封装无业务增益的一层转发方法，业务编排放在服务层实现。
- 只读路径优先直接使用 `Pool` 做查询，不引入不必要的事务和手动连接释放逻辑。
- 错误处理逻辑统一收敛到共享错误模块，禁止在多个模块内重复定义同类 handler。
- 不同类型的错误应在调用点路由到对应 handler，避免在 handler 之间做嵌套判断。
- 涉及唯一约束的创建逻辑应优先设计为幂等操作，避免重复调用产生重复数据。
- 需要跨表状态判断时，应在查询前把必要字段通过 `JOIN` 或 CTE 预先准备好，再在 `CASE` 中直接引用字段；不要在状态表达式里重复写相关子查询，尤其不要在列表查询里为每一行执行多次相同逻辑。
- 不要为了读取单个字段再额外封装一个 data 方法；如果该字段本就属于主资源查询的一部分，应优先复用已有主资源查询或扩展已有查询返回字段。
- 对于退款、核销这类存在多条流水记录的业务，当前状态应由主表上的显式字段或指针字段驱动，data 层查询应围绕这些字段实现，避免把“按时间倒序取最后一条流水”当作稳定业务语义。

## 常见反模式

- 反模式：在一个 spec 里维护单个超大 context type，导致不同 Scenario 共享大量无关字段，步骤依赖关系不清晰。
  推荐做法：按 Scenario 实际需要组合多个小 context type，让步骤只依赖当前场景真正使用的字段。
- 反模式：fixtures 中已经有可复用 helper，spec 里仍然继续手写一份相同逻辑，造成重复实现长期并存。
  推荐做法：抽象前先检查现有 fixtures；新增 helper 后回查并替换旧逻辑，保持项目内只有一套主实现。
- 反模式：手动用 `Date`、字符串拼接或毫秒偏移处理业务日期，而不是统一使用 `date-fns` 之类的显式日期工具。
  推荐做法：统一使用 `addDays`、`subDays` 等明确的日期函数处理业务时间边界，降低时区和边界条件错误。
- 反模式：把当前业务状态建立在“关联流水表最后一条记录”之上，而不是在主表上保存明确状态字段或当前流水指针。
  推荐做法：在主表上保存当前状态依赖的关键字段或流水指针，让当前状态查询有稳定、明确的数据来源。
- 反模式：为了读一个单字段单独封装 data 方法，结果让查询路径碎片化，主资源信息分散在多个无业务增益的方法里。
  推荐做法：优先复用已有主资源查询，或扩展主查询返回字段，只在确有独立业务语义时才新增 data 方法。
- 反模式：在 `CASE` 或 select 字段中重复写相关子查询判断状态，尤其在列表查询中对每一行重复执行相同逻辑。
  推荐做法：先通过 `JOIN` 或 CTE 预取状态判断所需字段，再在状态表达式里直接引用这些字段。
- 反模式：已发布 migration 直接改历史文件，而不是新增修正 migration，导致环境迁移历史不一致。
  推荐做法：已发布 migration 只增不改，后续调整通过新增 migration 修正，保证所有环境的迁移链一致。
- 反模式：仅修改类型或表结构中的一处，没有同步更新 data 层查询字段、服务层组装、测试断言和文档描述，最终让定义与实际返回脱节。
  推荐做法：字段变更时同步检查类型定义、查询 SQL、服务层返回、测试断言和 API 文档，保持单一事实来源一致。
