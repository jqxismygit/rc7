# Topics & Article 数据库设计

本文档定义 topics 与 articles 的数据库结构及迁移建议。

## 1. 表结构

### 1.1 topics

```sql
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_topics_title_not_blank CHECK (LENGTH(BTRIM(title)) > 0),
  CONSTRAINT chk_topics_description_not_blank CHECK (description IS NULL OR LENGTH(BTRIM(description)) > 0),
  CONSTRAINT chk_topics_cover_not_blank CHECK (cover_url IS NULL OR LENGTH(BTRIM(cover_url)) > 0)
);
```

### 1.2 topic_articles

```sql
CREATE TABLE topic_articles (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  content TEXT NOT NULL,
  cover_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_topic_articles_title_not_blank CHECK (LENGTH(BTRIM(title)) > 0),
  CONSTRAINT chk_topic_articles_subtitle_not_blank CHECK (subtitle IS NULL OR LENGTH(BTRIM(subtitle)) > 0),
  CONSTRAINT chk_topic_articles_content_not_blank CHECK (LENGTH(BTRIM(content)) > 0),
  CONSTRAINT chk_topic_articles_sort_order_non_negative CHECK (sort_order >= 0),
  CONSTRAINT chk_topic_articles_cover_not_blank CHECK (cover_url IS NULL OR LENGTH(BTRIM(cover_url)) > 0)
);
```

## 2. 索引设计

```sql
CREATE INDEX idx_topic_articles_topic_id ON topic_articles(topic_id);
CREATE INDEX idx_topic_articles_topic_id_sort_order ON topic_articles(topic_id, sort_order ASC, created_at DESC);
CREATE INDEX idx_topics_created_at ON topics(created_at DESC);
CREATE INDEX idx_topic_articles_created_at ON topic_articles(created_at DESC);
```

说明：
- `idx_topic_articles_topic_id` 支撑按话题查询文章与统计数量。
- `idx_topic_articles_topic_id_sort_order` 支撑话题详情按顺序加载文章。
- `created_at` 倒序索引支撑默认“最新优先”的列表。

## 3. 查询模型建议

- 话题列表（`GET /topics`）：直接查询 `topics` 表并分页，不 JOIN 文章，仅返回基本字段。
- 话题详情（`GET /topics/:tid`）：查询 `topics` + `LEFT JOIN topic_articles`，按 `sort_order ASC, created_at DESC` 拼装文章列表。
- 文章详情：`topic_articles JOIN topics`，返回文章及所属话题标题。
- 删除话题：依赖 `ON DELETE CASCADE` 自动清理文章。
- 图片上传：action 直接接收上传 stream，pipe 到 `sharp` 转为 webp，并将结果写入 `assets` 目录；`topics.cover_url` 与 `topic_articles.cover_url` 直接保存返回的 `${assets.base_url}/<uuid>.webp`。

## 4. 迁移建议

新增增量 migration 文件（示例名）：
- `services/cr7/db/migrations/<timestamp>_topic_articles_sort_order.sql`

建议迁移内容：
1. 为 `topic_articles` 新增 `subtitle` 列（可空）并添加非空白约束（仅在非 `NULL` 时生效）。
2. 为 `topic_articles` 新增 `sort_order` 列（默认值 `0`）。
3. 用窗口函数按 `topic_id` 分组、按 `created_at DESC` 回填 `sort_order`。
4. 新增 `sort_order >= 0` 约束。
5. 新增 `(topic_id, sort_order, created_at)` 复合索引。

回滚顺序建议：
1. 先删除新增索引。
2. 再删除新增约束。
3. 最后删除 `sort_order` 列。

## 5. 约束与一致性策略

- 通过非空 + 去空白 CHECK 约束，防止空标题/空内容入库；`description` 与 `cover_url` 允许为 `NULL`，但若传值则不能是空白字符串。
- 通过外键约束保证文章必须绑定有效话题。
- 通过 `sort_order` 字段保证话题详情可按业务顺序稳定输出。
- 计数不落冗余字段，统一通过聚合查询获得，避免写扩散。
- `cover_url` 直接存储上传接口返回的 `${assets.base_url}/<uuid>.webp` URL，不在数据库层拆分图片资源表。
