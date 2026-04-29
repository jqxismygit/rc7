import Moleculer from 'moleculer';
import { Context, ServiceSchema } from 'moleculer';
import type { Topic } from '@cr7/types';
import { CR7BaseService } from './cr7.base.js';
import {
  createArticle,
  createTopic,
  deleteArticle,
  deleteTopic,
  getArticleWithTopic,
  getTopicArticleIds,
  getTopicById,
  getTopicWithArticles,
  getTopics,
  reorderTopicArticles,
  updateArticle,
  updateTopic,
} from '../data/topics.js';
import { handleTopicError } from './errors.js';

const { MoleculerClientError } = Moleculer.Errors;

function normalizeNullableText(value?: string | null): string | null | undefined {
  const text = value?.trim() ?? '';
  return text.length === 0 ? null : text;
}

function validateArticleIds(articleIds: string[]) {
  if (articleIds.length === 0) {
    throw new MoleculerClientError('文章顺序参数不合法', 400, 'TOPIC_ARTICLE_ORDER_INVALID');
  }

  const uniqueIds = new Set(articleIds);
  if (uniqueIds.size !== articleIds.length) {
    throw new MoleculerClientError('文章顺序参数不合法', 400, 'TOPIC_ARTICLE_ORDER_INVALID');
  }
}

export class TopicService extends CR7BaseService {
  actions_topics: ServiceSchema['actions'] = {
    'topics.create': {
      rest: 'POST /',
      roles: ['admin'],
      params: {
        title: { type: 'string', trim: true, min: 1 },
        description: { type: 'string', trim: true, optional: true, nullable: true, empty: false },
        cover_url: { type: 'url', optional: true, nullable: true },
      },
      handler: this.createTopic,
    },

    'topics.update': {
      rest: 'PATCH /:tid',
      roles: ['admin'],
      params: {
        tid: 'string',
        title: { type: 'string', trim: true, min: 1, optional: true },
        description: { type: 'string', trim: true, optional: true, nullable: true, empty: false },
        cover_url: { type: 'url', optional: true, nullable: true },
      },
      handler: this.updateTopic,
    },

    'topics.delete': {
      rest: 'DELETE /:tid',
      roles: ['admin'],
      params: {
        tid: 'string',
      },
      handler: this.deleteTopic,
    },

    'topics.createArticle': {
      rest: 'POST /:tid/articles',
      roles: ['admin'],
      params: {
        tid: 'string',
        title: { type: 'string', trim: true, min: 1 },
        subtitle: { type: 'string', trim: true, optional: true, nullable: true, empty: false },
        content: { type: 'string', trim: true, min: 1 },
        cover_url: { type: 'url', optional: true, nullable: true },
      },
      handler: this.createArticle,
    },

    'topics.updateArticle': {
      rest: 'PATCH /:aid',
      roles: ['admin'],
      params: {
        aid: 'string',
        title: { type: 'string', trim: true, min: 1, optional: true },
        subtitle: { type: 'string', trim: true, optional: true, nullable: true, empty: false },
        content: { type: 'string', trim: true, min: 1, optional: true },
        cover_url: { type: 'url', optional: true, nullable: true },
      },
      handler: this.updateArticle,
    },

    'topics.reorderArticles': {
      rest: 'PATCH /:tid/articles/order',
      roles: ['admin'],
      params: {
        tid: 'string',
        article_ids: { type: 'array', items: 'string', min: 1 },
      },
      handler: this.reorderArticles,
    },

    'topics.deleteArticle': {
      rest: 'DELETE /:aid',
      roles: ['admin'],
      params: {
        aid: 'string',
      },
      handler: this.deleteArticle,
    },

    'topics.getArticle': {
      rest: 'GET /:aid',
      params: {
        aid: 'string',
      },
      handler: this.getArticle,
    },

    'topics.list': {
      rest: 'GET /',
      params: {
        page: {
          type: 'number',
          integer: true,
          positive: true,
          optional: true,
          default: 1,
          convert: true,
        },
        limit: {
          type: 'number',
          integer: true,
          positive: true,
          optional: true,
          default: 20,
          convert: true,
        },
      },
      handler: this.listTopics,
    },

    'topics.get': {
      rest: 'GET /:tid',
      params: {
        tid: 'string',
      },
      handler: this.getTopic,
    },
  };

  async createTopic(ctx: Context<Topic.TopicDraft>) {
    const schema = await this.getSchema();
    const draft = {
      title: ctx.params.title,
      description: normalizeNullableText(ctx.params.description),
      cover_url: normalizeNullableText(ctx.params.cover_url),
    };

    return createTopic(this.pool, schema, draft).catch(handleTopicError);
  }

  async updateTopic(ctx: Context<{ tid: string } & Topic.TopicPatch>) {
    const { tid, title, description, cover_url } = ctx.params;
    const schema = await this.getSchema();

    const patch: Topic.TopicPatch = {};
    if (title !== undefined) {
      patch.title = title;
    }
    if (description !== undefined) {
      patch.description = normalizeNullableText(description);
    }
    if (cover_url !== undefined) {
      patch.cover_url = normalizeNullableText(cover_url);
    }

    return updateTopic(this.pool, schema, tid, patch).catch(handleTopicError);
  }

  async deleteTopic(ctx: Context<{ tid: string }, { $statusCode?: number }>) {
    const { tid } = ctx.params;
    const schema = await this.getSchema();
    await deleteTopic(this.pool, schema, tid).catch(handleTopicError);
    ctx.meta.$statusCode = 204;
    return null;
  }

  async createArticle(
    ctx: Context<{ tid: string; title: string; subtitle?: string | null; content: string; cover_url?: string | null }>
  ) {
    const { tid, title, subtitle, content, cover_url } = ctx.params;
    const schema = await this.getSchema();

    await getTopicById(this.pool, schema, tid).catch(handleTopicError);
    return createArticle(this.pool, schema, tid, {
      title,
      subtitle: normalizeNullableText(subtitle),
      content,
      cover_url: normalizeNullableText(cover_url),
    }).catch(handleTopicError);
  }

  async updateArticle(ctx: Context<{ aid: string } & Topic.ArticlePatch>) {
    const { aid, title, subtitle, content, cover_url } = ctx.params;
    const schema = await this.getSchema();

    const patch: Topic.ArticlePatch = {};
    if (title !== undefined) {
      patch.title = title;
    }
    if (subtitle !== undefined) {
      patch.subtitle = normalizeNullableText(subtitle);
    }
    if (content !== undefined) {
      patch.content = content;
    }
    if (cover_url !== undefined) {
      patch.cover_url = normalizeNullableText(cover_url);
    }

    return updateArticle(this.pool, schema, aid, patch).catch(handleTopicError);
  }

  async reorderArticles(ctx: Context<{ tid: string; article_ids: string[] }>) {
    const { tid, article_ids: articleIds } = ctx.params;
    const schema = await this.getSchema();

    validateArticleIds(articleIds);
    await getTopicById(this.pool, schema, tid).catch(handleTopicError);

    const existingIds = await getTopicArticleIds(this.pool, schema, tid);
    if (existingIds.length !== articleIds.length) {
      throw new MoleculerClientError('文章顺序参数不合法', 400, 'TOPIC_ARTICLE_ORDER_INVALID');
    }

    const existingSet = new Set(existingIds);
    if (articleIds.every(id => existingSet.has(id)) === false) {
      throw new MoleculerClientError('文章顺序参数不合法', 400, 'TOPIC_ARTICLE_ORDER_INVALID');
    }

    await reorderTopicArticles(this.pool, schema, tid, articleIds).catch(handleTopicError);
    return {
      topic_id: tid,
      article_ids: articleIds,
    } satisfies Topic.ReorderTopicArticlesResult;
  }

  async deleteArticle(ctx: Context<{ aid: string }, { $statusCode?: number }>) {
    const { aid } = ctx.params;
    const schema = await this.getSchema();
    await deleteArticle(this.pool, schema, aid).catch(handleTopicError);
    ctx.meta.$statusCode = 204;
    return null;
  }

  async getArticle(ctx: Context<{ aid: string }>) {
    const { aid } = ctx.params;
    const schema = await this.getSchema();
    return getArticleWithTopic(this.pool, schema, aid).catch(handleTopicError);
  }

  async listTopics(ctx: Context<{ page?: number; limit?: number }>) {
    const { page = 1, limit = 20 } = ctx.params;
    const schema = await this.getSchema();
    const result = await getTopics(this.pool, schema, page, limit);

    return {
      topics: result.topics,
      total: result.total,
      page,
      limit,
    } satisfies Topic.TopicListResult;
  }

  async getTopic(ctx: Context<{ tid: string }>) {
    const { tid } = ctx.params;
    const schema = await this.getSchema();
    return getTopicWithArticles(this.pool, schema, tid).catch(handleTopicError);
  }
}
