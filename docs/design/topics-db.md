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
  content TEXT NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_topic_articles_title_not_blank CHECK (LENGTH(BTRIM(title)) > 0),
  CONSTRAINT chk_topic_articles_content_not_blank CHECK (LENGTH(BTRIM(content)) > 0),
  CONSTRAINT chk_topic_articles_cover_not_blank CHECK (cover_url IS NULL OR LENGTH(BTRIM(cover_url)) > 0)
);
```

## 2. 索引设计

```sql
CREATE INDEX idx_topic_articles_topic_id ON topic_articles(topic_id);
CREATE INDEX idx_topics_created_at ON topics(created_at DESC);
CREATE INDEX idx_topic_articles_created_at ON topic_articles(created_at DESC);
```

说明：
- `idx_topic_articles_topic_id` 支撑按话题查询文章与统计数量。
- `created_at` 倒序索引支撑默认“最新优先”的列表。

## 3. 查询模型建议

- 话题列表（`GET /topics`）：直接查询 `topics` 表并分页，不 JOIN 文章，仅返回基本字段。
- 话题详情（`GET /topics/:tid`）：查询 `topics` + `LEFT JOIN topic_articles`，拼装文章列表。
- 文章详情：`topic_articles JOIN topics`，返回文章及所属话题标题。
- 删除话题：依赖 `ON DELETE CASCADE` 自动清理文章。
- 图片上传：action 直接接收上传 stream，pipe 到 `sharp` 转为 webp，并将结果写入 `assets` 目录；`topics.cover_url` 与 `topic_articles.cover_url` 直接保存返回的 `/assets/<uuid>.webp`。

## 4. 迁移建议

新增 migration 文件（示例名）：
- `services/cr7/db/migrations/<timestamp>_topics_articles.sql`

建议迁移内容：
1. 创建 `topics` 表。
2. 创建 `topic_articles` 表并添加外键级联。
3. 创建索引。

回滚顺序建议：
1. 先删除 `topic_articles`。
2. 再删除 `topics`。

## 5. 约束与一致性策略

- 通过非空 + 去空白 CHECK 约束，防止空标题/空内容入库；`description` 与 `cover_url` 允许为 `NULL`，但若传值则不能是空白字符串。
- 通过外键约束保证文章必须绑定有效话题。
- 计数不落冗余字段，统一通过聚合查询获得，避免写扩散。
- `cover_url` 直接存储上传接口返回的 `/assets/<uuid>.webp` URL，不在数据库层拆分图片资源表。
