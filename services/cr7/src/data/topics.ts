import { Pool, PoolClient } from 'pg';
import type { Topic } from '@cr7/types';

type DBClient = Pool | PoolClient;

export type TOPIC_DATA_ERROR_CODES
  = | 'TOPIC_NOT_FOUND'
    | 'ARTICLE_NOT_FOUND'
    | 'TOPIC_ARTICLE_ORDER_INVALID';

export class TopicDataError extends Error {
  code: TOPIC_DATA_ERROR_CODES;

  constructor(message: string, code: TOPIC_DATA_ERROR_CODES) {
    super(message);
    this.name = 'TopicDataError';
    this.code = code;
  }
}

export async function createTopic(
  client: DBClient,
  schema: string,
  draft: Topic.TopicDraft,
): Promise<Topic.Topic> {
  const { rows: [result] } = await client.query(
    `INSERT INTO ${schema}.topics (title, description, cover_url)
     VALUES ($1, $2, $3)
     RETURNING id, title, description, cover_url, created_at, updated_at`,
    [
      draft.title,
      draft.description ?? null,
      draft.cover_url ?? null,
    ],
  );
  return result;
}

export async function getTopicById(
  client: DBClient,
  schema: string,
  tid: string,
): Promise<Topic.Topic> {
  const { rows } = await client.query(
    `SELECT id, title, description, cover_url, created_at, updated_at
     FROM ${schema}.topics
     WHERE id = $1`,
    [tid],
  );
  if (rows.length === 0) {
    throw new TopicDataError('Topic not found', 'TOPIC_NOT_FOUND');
  }
  return rows[0];
}

export async function updateTopic(
  client: DBClient,
  schema: string,
  tid: string,
  patch: Topic.TopicPatch,
): Promise<Topic.Topic> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if ('title' in patch) {
    fields.push(`title = $${idx++}`);
    values.push(patch.title);
  }
  if ('description' in patch) {
    fields.push(`description = $${idx++}`);
    values.push(patch.description ?? null);
  }
  if ('cover_url' in patch) {
    fields.push(`cover_url = $${idx++}`);
    values.push(patch.cover_url ?? null);
  }

  if (fields.length === 0) {
    return getTopicById(client, schema, tid);
  }

  fields.push('updated_at = NOW()');
  values.push(tid);

  const { rows } = await client.query(
    `UPDATE ${schema}.topics
     SET ${fields.join(', ')}
     WHERE id = $${idx}
     RETURNING id, title, description, cover_url, created_at, updated_at`,
    values,
  );
  if (rows.length === 0) {
    throw new TopicDataError('Topic not found', 'TOPIC_NOT_FOUND');
  }
  return rows[0];
}

export async function deleteTopic(
  client: DBClient,
  schema: string,
  tid: string,
): Promise<void> {
  const { rowCount } = await client.query(
    `DELETE FROM ${schema}.topics WHERE id = $1`,
    [tid],
  );
  if (rowCount === 0) {
    throw new TopicDataError('Topic not found', 'TOPIC_NOT_FOUND');
  }
}

export async function createArticle(
  client: DBClient,
  schema: string,
  tid: string,
  draft: Omit<Topic.ArticleDraft, 'topic_id'>,
): Promise<Topic.Article> {
  const { rows: [result] } = await client.query(
    `INSERT INTO ${schema}.topic_articles (topic_id, title, subtitle, content, cover_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, topic_id, title, subtitle, content, cover_url, sort_order, created_at, updated_at`,
    [tid, draft.title, draft.subtitle ?? null, draft.content, draft.cover_url ?? null],
  );
  return result;
}

export async function getArticleById(
  client: DBClient,
  schema: string,
  aid: string,
): Promise<Topic.Article> {
  const { rows } = await client.query(
    `SELECT id, topic_id, title, subtitle, content, cover_url, sort_order, created_at, updated_at
     FROM ${schema}.topic_articles
     WHERE id = $1`,
    [aid],
  );
  if (rows.length === 0) {
    throw new TopicDataError('Article not found', 'ARTICLE_NOT_FOUND');
  }
  return rows[0];
}

export async function updateArticle(
  client: DBClient,
  schema: string,
  aid: string,
  patch: Topic.ArticlePatch,
): Promise<Topic.Article> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if ('title' in patch) {
    fields.push(`title = $${idx++}`);
    values.push(patch.title);
  }
  if ('subtitle' in patch) {
    fields.push(`subtitle = $${idx++}`);
    values.push(patch.subtitle ?? null);
  }
  if ('content' in patch) {
    fields.push(`content = $${idx++}`);
    values.push(patch.content);
  }
  if ('cover_url' in patch) {
    fields.push(`cover_url = $${idx++}`);
    values.push(patch.cover_url ?? null);
  }

  if (fields.length === 0) {
    return getArticleById(client, schema, aid);
  }

  fields.push('updated_at = NOW()');
  values.push(aid);

  const { rows } = await client.query(
    `UPDATE ${schema}.topic_articles
     SET ${fields.join(', ')}
     WHERE id = $${idx}
     RETURNING id, topic_id, title, subtitle, content, cover_url, sort_order, created_at, updated_at`,
    values,
  );
  if (rows.length === 0) {
    throw new TopicDataError('Article not found', 'ARTICLE_NOT_FOUND');
  }
  return rows[0];
}

export async function deleteArticle(
  client: DBClient,
  schema: string,
  aid: string,
): Promise<void> {
  const { rowCount } = await client.query(
    `DELETE FROM ${schema}.topic_articles WHERE id = $1`,
    [aid],
  );
  if (rowCount === 0) {
    throw new TopicDataError('Article not found', 'ARTICLE_NOT_FOUND');
  }
}

export async function getTopics(
  client: DBClient,
  schema: string,
  page: number,
  limit: number,
): Promise<{ topics: Topic.TopicSummary[]; total: number }> {
  const offset = (page - 1) * limit;
  const { rows } = await client.query(
    `SELECT t.id, t.title, t.description, t.cover_url, t.created_at, t.updated_at,
            COUNT(a.id)::int AS article_count
     FROM ${schema}.topics t
     LEFT JOIN ${schema}.topic_articles a ON a.topic_id = t.id
     GROUP BY t.id
     ORDER BY t.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*) AS total FROM ${schema}.topics`,
  );
  return { topics: rows, total: parseInt(countRow.total, 10) };
}

export async function getTopicWithArticles(
  client: DBClient,
  schema: string,
  tid: string,
): Promise<Topic.TopicWithArticles> {
  const { rows: topicRows } = await client.query(
    `SELECT id, title, description, cover_url, created_at, updated_at
     FROM ${schema}.topics
     WHERE id = $1`,
    [tid],
  );
  if (topicRows.length === 0) {
    throw new TopicDataError('Topic not found', 'TOPIC_NOT_FOUND');
  }
  const topic = topicRows[0];

  const { rows: articleRows } = await client.query(
    `SELECT id, topic_id, title, subtitle, content, cover_url, sort_order, created_at, updated_at
     FROM ${schema}.topic_articles
     WHERE topic_id = $1
     ORDER BY sort_order ASC, created_at DESC`,
    [tid],
  );

  return { ...topic, articles: articleRows };
}

export async function getArticleWithTopic(
  client: DBClient,
  schema: string,
  aid: string,
): Promise<Topic.ArticleWithTopic> {
  const { rows } = await client.query(
    `SELECT
       a.id,
       a.topic_id,
       a.title,
       a.subtitle,
       a.content,
       a.cover_url,
       a.sort_order,
       a.created_at,
       a.updated_at,
       t.id AS topic_id_join,
       t.title AS topic_title
     FROM ${schema}.topic_articles a
     JOIN ${schema}.topics t ON t.id = a.topic_id
     WHERE a.id = $1`,
    [aid],
  );
  if (rows.length === 0) {
    throw new TopicDataError('Article not found', 'ARTICLE_NOT_FOUND');
  }
  const row = rows[0];
  return {
    id: row.id,
    topic_id: row.topic_id,
    title: row.title,
    subtitle: row.subtitle,
    content: row.content,
    cover_url: row.cover_url,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    topic: {
      id: row.topic_id_join,
      title: row.topic_title,
    },
  };
}

export async function getTopicArticleIds(
  client: DBClient,
  schema: string,
  tid: string,
): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT id
     FROM ${schema}.topic_articles
     WHERE topic_id = $1`,
    [tid],
  );
  return rows.map((row: { id: string }) => row.id);
}

export async function reorderTopicArticles(
  client: DBClient,
  schema: string,
  tid: string,
  articleIds: string[],
): Promise<void> {
  const { rowCount } = await client.query(
    `WITH order_items AS (
      SELECT
        u.article_id,
        (u.ordinality - 1)::int AS sort_order
      FROM UNNEST($2::uuid[]) WITH ORDINALITY AS u(article_id, ordinality)
    )
    UPDATE ${schema}.topic_articles AS a
    SET sort_order = order_items.sort_order,
        updated_at = NOW()
    FROM order_items
    WHERE a.id = order_items.article_id
      AND a.topic_id = $1`,
    [tid, articleIds],
  );

  if (rowCount !== articleIds.length) {
    throw new TopicDataError('Invalid article order', 'TOPIC_ARTICLE_ORDER_INVALID');
  }
}
