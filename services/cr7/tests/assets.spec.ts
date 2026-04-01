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
import { uploadImage, uploadVideo } from './fixtures/assets.js';
import { services_fixtures } from './fixtures/services.js';
import { prepareAdminToken } from './fixtures/user.js';
import { FixturesResult, useFixtures } from './lib/fixtures.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const schema = 'test_assets';
const services = ['api', 'cr7', 'user'];
const feature = await loadFeature('tests/features/assets.feature');




interface FeatureContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
  adminToken: string;
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
  });

  type ImageScenarioContext = {
    uploadedImage: { url: string };
    uploadFileName: string;
  };
  Scenario('管理员可以上传图片', (s: StepTest<ImageScenarioContext>) => {
    const { When, And, Then, context } = s;

    When('管理员上传图片', async () => {
      const { apiServer } = featureContext.fixtures.values;
      const filePath = path.resolve(__dirname, './fixtures/assets', context.uploadFileName ?? 'test_image.jpg');
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

  type VideoScenarioContext = {
    filePath: string;
    uploadedVideo: { url: string };
    uploadVideoFileName: string;
  };
  Scenario('管理员可以上传视频', (s: StepTest<VideoScenarioContext>) => {
    const { Given, When, And, Then, context } = s;

    Given('已准备视频文件 {string}', async (_ctx, fileName: string) => {
      context.filePath = path.resolve(__dirname, './fixtures/assets', fileName);
    });

    When('视频上传成功', async () => {
      const { fixtures, adminToken } = featureContext;
      const { apiServer } = fixtures.values;
      const { filePath } = context;
      context.uploadedVideo = await uploadVideo(apiServer, adminToken, filePath);
    });

    Then('视频 URL 的前缀是配置中的 assets.base_url', () => {
      expect(context.uploadedVideo?.url?.startsWith(`${config.assets.base_url}/`)).toBe(true);
    });

    And('视频 URL 的后缀是 {string}', async (_ctx, suffix: string) => {
      expect(context.uploadedVideo?.url?.endsWith(suffix)).toBe(true);

      const uploadedUrl = new URL(context.uploadedVideo!.url);
      const filePath = path.resolve(config.assets.path, path.basename(uploadedUrl.pathname));
      await fs.unlink(filePath).catch(() => undefined);
    });
  });
});