import config from 'config';
import {
  defineSteps,
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import { expect, Mock, MockInstance, vi } from 'vitest';
import { ServiceBroker } from 'moleculer';
import WechatService from '@/wechat.service.js';
import { MockServer, mockJSONServer } from './lib/server.js';
import { prepareServices } from './fixtures/services.js';

const feature = await loadFeature('tests/features/wechat.feature');

interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
}

interface PendingTokenResponse {
  resolve: (value: AccessTokenResponse) => void;
  reject: (error: unknown) => void;
}

interface WechatRequest {
  body: unknown;
  headers: Record<string, string>;
  method: string;
  path: string;
  query: Record<string, string>;
}

type WechatAccessTokenHandler = Mock<(request: WechatRequest) => Promise<AccessTokenResponse>>;


interface WechatServiceContext {
}

interface FeatureContext {
  accessTokenHandler: WechatAccessTokenHandler;
  mockServer: MockServer;
  baseUrlSpy: MockInstance;
  pendingResponses: PendingTokenResponse[];
  broker: ServiceBroker;
  accessTokenResult?: { access_token: string; expires_in: number };
}

function createDeferredResponse(): {
  promise: Promise<AccessTokenResponse>;
  deferred: PendingTokenResponse;
} {
  let resolve!: (value: AccessTokenResponse) => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<AccessTokenResponse>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    deferred: { resolve, reject },
  };
}

describeFeature(feature, ({
  Scenario,
  Background,
  BeforeEachScenario,
  AfterEachScenario,
  context: featureContext,
}: FeatureDescriibeCallbackParams<FeatureContext>) => {
  BeforeEachScenario(async () => {

  });

  AfterEachScenario(async () => {
    const {
      pendingResponses, mockServer, baseUrlSpy,
      broker,
      wechatService
    } = featureContext;

    vi.useRealTimers();

    if (broker) {
      await broker.stop();
    }

    if (pendingResponses) {
      pendingResponses.length = 0;
    }

    if (mockServer) {
      await mockServer.close();
    }

    if (baseUrlSpy) {
      baseUrlSpy.mockRestore();
    }
  });

  defineSteps(({ Then, And }) => {
    Then('微信服务端收到 access token 的请求的次数为 {int}', (_ctx, count: number) => {
      expect(featureContext.accessTokenHandler).toHaveBeenCalledTimes(count);
    });

    And('微信服务端收到 access token 的请求的次数仍然为 {int}', (_ctx, count: number) => {
      expect(featureContext.accessTokenHandler).toHaveBeenCalledTimes(count);
    });
  });

  Background(({ Given }) => {
    Given('微信服务端已准备好', async () => {
      featureContext.pendingResponses = [];

      const accessTokenHandler = vi.fn(async (request: WechatRequest) => {
        const { path, query, method } = request;
        expect(method).toBe('GET');
        expect(path).toBe('/cgi-bin/token');

        const { appid, secret } = config.wechat;
        expect(query).toEqual(expect.objectContaining({
          appid,
          secret,
          grant_type: 'client_credential',
        }));

        const { promise, deferred } = createDeferredResponse();
        featureContext.pendingResponses.push(deferred);
        return promise;
      });

      const mockServer = await mockJSONServer(accessTokenHandler);
      const baseUrlSpy = vi
        .spyOn(config.wechat, 'base_url', 'get')
        .mockReturnValue(mockServer.address);

      featureContext.accessTokenHandler = accessTokenHandler;
      featureContext.mockServer = mockServer;
      featureContext.baseUrlSpy = baseUrlSpy;
    });
  });

  Scenario('维护微信 access_token', (
    s: StepTest<{ accessTokenResult?: { access_token: string; expires_in: number } }>
  ) => {
    const { When, Then, context } = s;

    When('启动 cr7 的微信 service', async () => {
      const broker = await prepareServices(['wechat']);
      await broker.start();
      featureContext.broker = broker;
    });

    Then('微信服务端收到 access token 的请求', async () => {
      const { accessTokenHandler } = featureContext;

      await vi.waitFor(() => {
        expect(accessTokenHandler).toHaveBeenCalledTimes(1);
      });

      const request = accessTokenHandler!.mock.calls[0][0];
      const { appid, secret } = config.wechat;
      expect(request.path).toBe('/cgi-bin/token');
      expect(request.query).toEqual(expect.objectContaining({
        appid,
        secret,
        grant_type: 'client_credential',
      }));
    });

    Then('微信服务端返回 {string}，过期时间为 {int} 秒', (
      _ctx,
      accessToken: string,
      expiresIn: number,
    ) => {
      const pending = featureContext.pendingResponses.shift();
      pending?.resolve({ access_token: accessToken, expires_in: expiresIn });
    });

    Then('微信服务端再次返回 {string}，过期时间为 {int} 秒', async (
      _ctx,
      accessToken: string,
      expiresIn: number,
    ) => {
      const pending = featureContext.pendingResponses.shift();
      pending?.resolve({ access_token: accessToken, expires_in: expiresIn });

      const { broker } = featureContext;
      const wechatService = broker!.getLocalService('wechat') as WechatService & {
        tokenState?: { access_token: string; expires_in: number };
      };

      await vi.waitFor(() => {
        expect(wechatService.tokenState).toEqual(expect.objectContaining({
          access_token: accessToken,
          expires_in: expiresIn,
        }));
      });
    });

    When('从微信 service 获取 access token', async () => {
      const { broker } = featureContext;
      const result = await broker!.call('wechat.access_token');
      Object.assign(context, { accessTokenResult: result });
      featureContext.accessTokenResult = result as {
        access_token: string;
        expires_in: number;
      };
    });

    When('再次从微信 service 获取 access token', async () => {
      const { broker } = featureContext;
      const result = await broker!.call('wechat.access_token');
      Object.assign(context, { accessTokenResult: result });
      featureContext.accessTokenResult = result as {
        access_token: string;
        expires_in: number;
      };
    });

    Then('获取成功，access token 是 {string}', (_ctx, accessToken: string) => {
      expect(featureContext.accessTokenResult).toEqual(expect.objectContaining({
        access_token: accessToken,
      }));
    });

    Then('再次获取成功，access token 是 {string}', (_ctx, accessToken: string) => {
      expect(featureContext.accessTokenResult).toEqual(expect.objectContaining({
        access_token: accessToken,
      }));
    });

    When('等待 {int} 秒后', async (_ctx, seconds: number) => {
      vi.useFakeTimers();
      await vi.advanceTimersByTimeAsync(seconds * 1000 + 1);

      const { broker } = featureContext;
      const wechatService = broker!.getLocalService('wechat') as WechatService & {
        refreshToken: () => Promise<unknown>;
      };

      // In step-by-step execution, trigger refresh explicitly after time advances.
      void wechatService.refreshToken();

      await vi.waitFor(() => {
        expect(featureContext.accessTokenHandler).toHaveBeenCalledTimes(2);
      });
    });
  });
});
