import path from 'node:path';
import fs from 'node:fs/promises';
import { URL } from 'node:url';
import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import sharp from 'sharp';
import { expect, vi } from 'vitest';
import type { Topic } from '@cr7/types';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { services_fixtures } from './fixtures/services.js';
import { prepareAdminToken, registerUser } from './fixtures/user.js';
import {
  assertArticle,
  assertTopic,
  createArticle,
  createTopic,
  deleteArticle,
  deleteTopic,
  getArticle,
  getTopic,
  listTopics,
  reorderTopicArticles,
  updateArticle,
  updateTopic,
  uploadImage,
} from './fixtures/topics.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const schema = 'test_topics';
const services = ['api', 'cr7', 'user'];
const feature = await loadFeature('tests/features/topics.feature');

type TopicScenarioContext = {
  topic?: Topic.Topic;
  article?: Topic.Article;
  articleWithTopic?: Topic.ArticleWithTopic;
  topicWithArticles?: Topic.TopicWithArticles;
  topicList?: Topic.TopicListResult;
  uploadedImage?: Topic.UploadedImage;
  uploadFileName?: string;
};

interface FeatureContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
  adminToken: string;
  userToken: string;
}

async function ensureTopic(
  featureContext: FeatureContext,
  title: string,
  description: string | null = null,
  coverUrl: string | null = null,
): Promise<Topic.Topic> {
  const { apiServer } = featureContext.fixtures.values;
  return createTopic(apiServer, featureContext.adminToken, {
    title,
    description,
    cover_url: coverUrl,
  });
}

async function ensureArticle(
  featureContext: FeatureContext,
  topic: Topic.Topic,
  title: string,
  content: string,
  coverUrl: string | null = null,
  subtitle: string | null = null,
): Promise<Topic.Article> {
  const { apiServer } = featureContext.fixtures.values;
  return createArticle(apiServer, featureContext.adminToken, topic.id, {
    title,
    subtitle,
    content,
    cover_url: coverUrl,
  });
}

describeFeature(feature, ({
  BeforeAllScenarios,
  AfterAllScenarios,
  Background,
  Scenario,
  context: featureContext,
}: FeatureDescriibeCallbackParams<FeatureContext>) => {
  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    const fixtures = await useFixtures(
      { ...services_fixtures, schema, services },
      ['apiServer'],
    );
    Object.assign(featureContext, { fixtures });
  });

  AfterAllScenarios(async () => {
    await featureContext.fixtures.close();
  });

  Background(({ Given }) => {
    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = featureContext.fixtures.values;
      featureContext.adminToken = await prepareAdminToken(apiServer, schema);
    });

    Given('用户 {string} 已注册并登录', async (_ctx, name: string) => {
      const { apiServer } = featureContext.fixtures.values;
      featureContext.userToken = await registerUser(apiServer, name);
      expect(featureContext.userToken).toBeTruthy();
    });
  });

  Scenario('管理员创建一个新的话题', (s: StepTest<TopicScenarioContext>) => {
    const { When, And, Then, context } = s;

    When('管理员创建话题，标题为 {string}', async (_ctx, title: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.topic = await createTopic(apiServer, featureContext.adminToken, { title });
    });

    And('描述为 {string}', async (_ctx, description: string) => {
      const { apiServer } = featureContext.fixtures.values;
      expect(context.topic).toBeTruthy();
      context.topic = await updateTopic(apiServer, featureContext.adminToken, context.topic!.id, {
        description,
      });
    });

    And('封面图片为 {string}', async (_ctx, coverUrl: string) => {
      const { apiServer } = featureContext.fixtures.values;
      expect(context.topic).toBeTruthy();
      context.topic = await updateTopic(apiServer, featureContext.adminToken, context.topic!.id, {
        cover_url: coverUrl,
      });
    });

    Then('话题创建成功', () => {
      expect(context.topic).toBeTruthy();
      assertTopic(context.topic!);
    });

    And('话题的标题为 {string}', (_ctx, title: string) => {
      expect(context.topic?.title).toBe(title);
    });

    And('话题描述应为 {string}', (_ctx, description: string) => {
      expect(context.topic?.description).toBe(description);
    });

    And('话题封面图片应为 {string}', (_ctx, coverUrl: string) => {
      expect(context.topic?.cover_url).toBe(coverUrl);
    });
  });

  Scenario('管理员修改话题信息', (s: StepTest<TopicScenarioContext>) => {
    const { Given, When, And, Then, context } = s;

    Given('话题 {string} 已创建', async (_ctx, title: string) => {
      context.topic = await ensureTopic(featureContext, title);
    });

    When('管理员修改话题的描述为 {string}', async (_ctx, description: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.topic = await updateTopic(apiServer, featureContext.adminToken, context.topic!.id, {
        description,
      });
    });

    And('话题封面图片为 {string}', async (_ctx, coverUrl: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.topic = await updateTopic(apiServer, featureContext.adminToken, context.topic!.id, {
        cover_url: coverUrl,
      });
    });

    Then('话题修改成功', () => {
      expect(context.topic).toBeTruthy();
      assertTopic(context.topic!);
    });

    And('话题描述应为 {string}', (_ctx, description: string) => {
      expect(context.topic?.description).toBe(description);
    });

    And('话题封面图片应为 {string}', (_ctx, coverUrl: string) => {
      expect(context.topic?.cover_url).toBe(coverUrl);
    });
  });

  Scenario('管理员在话题下发布文章', (s: StepTest<TopicScenarioContext>) => {
    const { Given, When, And, Then, context } = s;

    Given('话题 {string} 已创建', async (_ctx, title: string) => {
      context.topic = await ensureTopic(featureContext, title);
    });

    When('文章 {string} 添加在话题 {string} 下', async (_ctx, articleTitle: string, _topicTitle: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.article = await createArticle(apiServer, featureContext.adminToken, context.topic!.id, {
        title: articleTitle,
        content: '待更新',
      });
    });

    And('文章副标题为 {string}', async (_ctx, subtitle: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.article = await updateArticle(apiServer, featureContext.adminToken, context.article!.id, {
        subtitle,
      });
    });

    And('文章内容为 {string}', async (_ctx, content: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.article = await updateArticle(apiServer, featureContext.adminToken, context.article!.id, {
        content,
      });
    });

    And('文章的封面图片为 {string}', async (_ctx, coverUrl: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.article = await updateArticle(apiServer, featureContext.adminToken, context.article!.id, {
        cover_url: coverUrl,
      });
    });

    Then('文章发布成功', () => {
      expect(context.article).toBeTruthy();
      assertArticle(context.article!);
    });

    When('用户查看文章详情', async () => {
      const { apiServer } = featureContext.fixtures.values;
      context.articleWithTopic = await getArticle(apiServer, context.article!.id, featureContext.userToken);
    });

    Then('文章的标题应为 {string}', (_ctx, title: string) => {
      expect(context.articleWithTopic?.title).toBe(title);
    });

    And('文章的内容应为 {string}', (_ctx, content: string) => {
      expect(context.articleWithTopic?.content).toBe(content);
    });

    And('文章的封面图片应为 {string}', (_ctx, coverUrl: string) => {
      expect(context.articleWithTopic?.cover_url).toBe(coverUrl);
    });

    And('文章属于话题 {string}', (_ctx, topicTitle: string) => {
      expect(context.articleWithTopic?.topic.title).toBe(topicTitle);
    });
  });

  Scenario('管理员修改文章内容', (s: StepTest<TopicScenarioContext>) => {
    const { Given, When, And, Then, context } = s;

    Given('文章 {string} 已发布在话题 {string} 下', async (_ctx, articleTitle: string, topicTitle: string) => {
      context.topic = await ensureTopic(featureContext, topicTitle);
      context.article = await ensureArticle(
        featureContext,
        context.topic,
        articleTitle,
        '初始内容',
      );
    });

    When('管理员修改文章的内容为 {string}', async (_ctx, content: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.article = await updateArticle(apiServer, featureContext.adminToken, context.article!.id, {
        content,
      });
    });

    And('修改文章的封面图片为 {string}', async (_ctx, coverUrl: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.article = await updateArticle(apiServer, featureContext.adminToken, context.article!.id, {
        cover_url: coverUrl,
      });
    });

    Then('文章修改成功', () => {
      expect(context.article).toBeTruthy();
      assertArticle(context.article!);
    });

    And('文章的内容应为 {string}', (_ctx, content: string) => {
      expect(context.article?.content).toBe(content);
    });

    And('文章的封面图片应为 {string}', (_ctx, coverUrl: string) => {
      expect(context.article?.cover_url).toBe(coverUrl);
    });
  });

  Scenario('用户查看 topics 列表', (s: StepTest<TopicScenarioContext>) => {
    const { Given, And, Then, When, context } = s;

    Given('话题 {string} 已创建', async (_ctx, title: string) => {
      context.topic = await ensureTopic(featureContext, title);
    });

    And('话题描述为 {string}', async (_ctx, description: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.topic = await updateTopic(apiServer, featureContext.adminToken, context.topic!.id, {
        description,
      });
    });

    And('话题封面图片为 {string}', async (_ctx, coverUrl: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.topic = await updateTopic(apiServer, featureContext.adminToken, context.topic!.id, {
        cover_url: coverUrl,
      });
    });

    Given('文章 {string} 添加在话题 {string} 下', async (_ctx, articleTitle: string, _topicTitle: string) => {
      context.article = await ensureArticle(featureContext, context.topic!, articleTitle, '待更新内容');
    });

    Then('文章发布成功', () => {
      expect(context.article).toBeTruthy();
    });

    When('用户查看话题列表', async () => {
      const { apiServer } = featureContext.fixtures.values;
      context.topicList = await listTopics(apiServer, undefined, undefined, featureContext.userToken);
    });

    Then('可以看到话题 {string}', (_ctx, title: string) => {
      expect(context.topicList?.topics.some(item => item.title === title)).toBe(true);
    });

    And('话题描述应为 {string}', (_ctx, description: string) => {
      const topic = context.topicList?.topics.find(item => item.id === context.topic?.id);
      expect(topic?.description).toBe(description);
    });

    And('话题封面图片应为 {string}', (_ctx, coverUrl: string) => {
      const topic = context.topicList?.topics.find(item => item.id === context.topic?.id);
      expect(topic?.cover_url).toBe(coverUrl);
    });

    And('话题下有 {int} 篇文章', (_ctx, count: number) => {
      const topic = context.topicList?.topics.find(item => item.id === context.topic?.id);
      expect(topic?.article_count).toBe(count);
    });
  });

  Scenario('用户查看话题详情', (s: StepTest<TopicScenarioContext>) => {
    const { Given, And, Then, When, context } = s;

    Given('话题 {string} 已创建', async (_ctx, title: string) => {
      context.topic = await ensureTopic(featureContext, title);
    });

    And('话题的描述为 {string}', async (_ctx, description: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.topic = await updateTopic(apiServer, featureContext.adminToken, context.topic!.id, {
        description,
      });
    });

    And('话题的封面图片为 {string}', async (_ctx, coverUrl: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.topic = await updateTopic(apiServer, featureContext.adminToken, context.topic!.id, {
        cover_url: coverUrl,
      });
    });

    Given('文章 {string} 添加在话题 {string} 下', async (_ctx, articleTitle: string, _topicTitle: string) => {
      context.article = await ensureArticle(featureContext, context.topic!, articleTitle, '待更新内容');
    });

    And('文章内容为 {string}', async (_ctx, content: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.article = await updateArticle(apiServer, featureContext.adminToken, context.article!.id, {
        content,
      });
    });

    And('文章的封面图片为 {string}', async (_ctx, coverUrl: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.article = await updateArticle(apiServer, featureContext.adminToken, context.article!.id, {
        cover_url: coverUrl,
      });
    });

    Then('文章发布成功', () => {
      expect(context.article).toBeTruthy();
    });

    When('用户查看话题 {string} 的详情', async (_ctx, _title: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.topicWithArticles = await getTopic(apiServer, context.topic!.id, featureContext.userToken);
    });

    Then('话题的标题为 {string}', (_ctx, title: string) => {
      expect(context.topicWithArticles?.title).toBe(title);
    });

    And('话题描述应为 {string}', (_ctx, description: string) => {
      expect(context.topicWithArticles?.description).toBe(description);
    });

    And('话题封面图片应为 {string}', (_ctx, coverUrl: string) => {
      expect(context.topicWithArticles?.cover_url).toBe(coverUrl);
    });

    And('话题下有 {int} 篇文章', (_ctx, count: number) => {
      expect(context.topicWithArticles?.articles.length).toBe(count);
    });

    And('文章标题为 {string}', (_ctx, articleTitle: string) => {
      expect(context.topicWithArticles?.articles[0]?.title).toBe(articleTitle);
    });

    And('文章内容应为 {string}', (_ctx, content: string) => {
      expect(context.topicWithArticles?.articles[0]?.content).toBe(content);
    });

    And('文章封面图片应为 {string}', (_ctx, coverUrl: string) => {
      expect(context.topicWithArticles?.articles[0]?.cover_url).toBe(coverUrl);
    });
  });

  Scenario('管理员调整话题文章顺序', (s: StepTest<TopicScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('话题 {string} 已创建', async (_ctx, title: string) => {
      context.topic = await ensureTopic(featureContext, title);
    });

    Given('文章 {string} 添加在话题 {string} 下', async (_ctx, articleTitle: string, _topicTitle: string) => {
      context.article = await ensureArticle(featureContext, context.topic!, articleTitle, '默认内容');
    });

    Given('文章 {string} 继续添加在话题 {string} 下', async (_ctx, articleTitle: string, _topicTitle: string) => {
      context.article = await ensureArticle(featureContext, context.topic!, articleTitle, '默认内容');
    });

    When('用户查看话题 {string} 的详情', async () => {
      const { apiServer } = featureContext.fixtures.values;
      context.topicWithArticles = await getTopic(apiServer, context.topic!.id, featureContext.userToken);
    });

    Then('话题下有 {int} 篇文章', (_ctx, count: number) => {
      expect(context.topicWithArticles?.articles.length).toBe(count);
    });

    And('文章顺序为 {string}, {string}', (_ctx, firstTitle: string, secondTitle: string) => {
      expect(context.topicWithArticles?.articles[0]?.title).toBe(firstTitle);
      expect(context.topicWithArticles?.articles[1]?.title).toBe(secondTitle);
    });

    Then('更新后文章顺序为 {string}, {string}', (_ctx, firstTitle: string, secondTitle: string) => {
      expect(context.topicWithArticles?.articles[0]?.title).toBe(firstTitle);
      expect(context.topicWithArticles?.articles[1]?.title).toBe(secondTitle);
    });

    When('指定文章顺序为 {string}, {string}', async (_ctx, firstTitle: string, secondTitle: string) => {
      const { apiServer } = featureContext.fixtures.values;
      expect(context.topicWithArticles?.articles).toBeTruthy();
      const articles = context.topicWithArticles!.articles;
      const first = articles.find((item) => item.title === firstTitle);
      const second = articles.find((item) => item.title === secondTitle);
      expect(first).toBeTruthy();
      expect(second).toBeTruthy();

      await reorderTopicArticles(apiServer, featureContext.adminToken, context.topic!.id, [
        first!.id,
        second!.id,
      ]);

      context.topicWithArticles = await getTopic(apiServer, context.topic!.id, featureContext.userToken);
    });
  });

  Scenario('管理员删除文章', (s: StepTest<TopicScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('文章 {string} 已发布在话题 {string} 下', async (_ctx, articleTitle: string, topicTitle: string) => {
      context.topic = await ensureTopic(featureContext, topicTitle);
      context.article = await ensureArticle(
        featureContext,
        context.topic,
        articleTitle,
        '初始内容',
      );
    });

    When('管理员删除文章 {string}', async (_ctx, _title: string) => {
      const { apiServer } = featureContext.fixtures.values;
      await deleteArticle(apiServer, featureContext.adminToken, context.article!.id);
    });

    Then('文章删除成功', () => {
      expect(true).toBe(true);
    });

    And('文章 {string} 不存在', async () => {
      const { apiServer } = featureContext.fixtures.values;
      await expect(getArticle(apiServer, context.article!.id, featureContext.userToken)).rejects.toBeTruthy();
    });
  });

  Scenario('管理员删除话题', (s: StepTest<TopicScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('话题 {string} 已创建', async (_ctx, title: string) => {
      context.topic = await ensureTopic(featureContext, title);
    });

    When('管理员删除话题 {string}', async (_ctx, _title: string) => {
      const { apiServer } = featureContext.fixtures.values;
      await deleteTopic(apiServer, featureContext.adminToken, context.topic!.id);
    });

    Then('话题删除成功', () => {
      expect(true).toBe(true);
    });

    And('话题 {string} 不存在', async () => {
      const { apiServer } = featureContext.fixtures.values;
      await expect(getTopic(apiServer, context.topic!.id, featureContext.userToken)).rejects.toBeTruthy();
    });
  });

  Scenario('管理员可以上传图片', (s: StepTest<TopicScenarioContext>) => {
    const { When, And, Then, context } = s;

    When('管理员上传图片', async () => {
      const { apiServer } = featureContext.fixtures.values;
      const filePath = path.resolve(__dirname, './fixtures', context.uploadFileName ?? 'test_image.jpg');
      context.uploadedImage = await uploadImage(apiServer, featureContext.adminToken, filePath);
    });

    And('图片文件名为 {string}', (_ctx, fileName: string) => {
      context.uploadFileName = fileName;
    });

    Then('图片上传成功', () => {
      expect(context.uploadedImage).toBeTruthy();
      expect(context.uploadedImage?.url).toEqual(expect.any(String));
    });

    And('图片 URL 的前缀是配置中的 assets.base_url', () => {
      expect(context.uploadedImage?.url?.startsWith(`${config.assets.base_url}/`)).toBe(true);
    });

    And('图片被转换成了 webp 格式', async () => {
      const uploadedUrl = new URL(context.uploadedImage!.url);
      const filePath = path.resolve(config.assets.path, path.basename(uploadedUrl.pathname));
      const metadata = await sharp(filePath).metadata();

      expect(metadata.format).toBe('webp');
    });

    And('图片 URL 的后缀是 {string}', async (_ctx, suffix: string) => {
      expect(context.uploadedImage?.url?.endsWith(suffix)).toBe(true);

      const uploadedUrl = new URL(context.uploadedImage!.url);
      const filePath = path.resolve(config.assets.path, path.basename(uploadedUrl.pathname));
      await fs.unlink(filePath).catch(() => undefined);
    });
  });
});
