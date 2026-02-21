# ESLint 和 Git Hooks 配置说明

## 概述

该项目为 `services/rc7` 配置了以下工具：
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **lint-staged**: 只检查 staged 文件
- **Husky**: Git hooks 管理
- **TypeScript**: 类型检查

## 可用的命令

在 `services/rc7` 目录下运行：

```bash
# 代码检查
pnpm lint

# 自动修复代码问题
pnpm lint:fix

# 类型检查
pnpm type-check

# 代码格式化
pnpm format

# 构建
pnpm build

# 开发模式
pnpm dev
```

## Git Hooks 配置

### Pre-commit Hook

在 commit 之前会自动执行以下检查：

1. **lint-staged**: 对 staged 文件运行 ESLint 和 Prettier
2. **type-check**: 运行 TypeScript 类型检查

如果任何检查失败，commit 将被阻止。

### 配置文件位置

- `.husky/pre-commit` - Pre-commit hook 脚本
- `.lintstagedrc` - lint-staged 配置
- `eslint.config.js` - ESLint 规则配置
- `.prettierrc` - Prettier 代码格式化规则
- `tsconfig.json` - TypeScript 配置

## ESLint 规则

### 主要规则

- ✅ 推荐的 ESLint 规则
- ✅ TypeScript ESLint 推荐规则
- ⚠️ 函数需要显式返回类型
- ❌ 不允许未使用的变量（`_` 前缀除外）
- ⚠️ 不建议使用 `any` 类型
- ⚠️ 不建议使用 `console.log`（仅允许 `warn` 和 `error`）

### 忽略的目录

- `dist/`
- `node_modules/`
- `coverage/`

## Prettier 规则

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always"
}
```

## 使用流程

### 1. 开发时

```bash
# 修改代码
# 自动修复格式和 lint 问题
pnpm lint:fix

# 运行类型检查
pnpm type-check
```

### 2. 提交时

```bash
git add .
git commit -m "your commit message"
```

提交前会自动：
- 运行 lint-staged（对 staged 文件进行 ESLint 和格式化）
- 运行 TypeScript 类型检查
- 如果检查失败，commit 被阻止

### 3. 强制提交（跳过检查）

```bash
git commit -m "message" --no-verify
```

> ⚠️ 不建议使用 `--no-verify`，因为这会跳过所有检查

## 故障排查

### 问题：ESLint 找不到 TypeScript 配置

**解决**：确保 `tsconfig.json` 存在且配置正确

### 问题：Pre-commit hook 没有执行

**解决**：
```bash
cd /home/ghost/projects/rc7
git config core.hooksPath services/rc7/.husky
chmod +x services/rc7/.husky/pre-commit
```

### 问题：某文件无法通过 lint

**解决**：
```bash
cd services/rc7
pnpm lint:fix  # 自动修复
```

## IDE 集成

### VSCode

安装以下扩展：
- ESLint
- Prettier - Code formatter

在 `.vscode/settings.json` 中配置：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit"
    }
  }
}
```

## 更新规则

修改 ESLint 规则：编辑 `eslint.config.js`

修改 Prettier 规则：编辑 `.prettierrc`

修改 lint-staged 配置：编辑 `.lintstagedrc`

修改后新的 commit 会应用新规则。
