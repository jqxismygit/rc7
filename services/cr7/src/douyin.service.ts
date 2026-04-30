import { Context, Errors, ServiceBroker } from 'moleculer';
import { CR7BaseService } from './libs/cr7.base.js';

const { MoleculerServerError } = Errors;

export default class DouyinService extends CR7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);

    this.parseServiceSchema({
      name: 'douyin',

      hooks: {
        before: {
          '*': ['checkUserRole']
        }
      },

      actions: {
        webhook: {
          rest: '/webhook',
          params: {
            event: 'string',
            content: [
              'string',
              { type: 'object', properties: { challenge: 'number' } }
            ]
          },
          handler: this.webhookEntry
        }
      }
    });
  }

  async webhookEntry(
    ctx: Context<{ event: string; content: string | { challenge: string } }>
  ) {
    const { event, content } = ctx.params;
    if (event === 'verify_webhook') {
      return content;
    }

    throw new MoleculerServerError(
      `Unsupported event type: ${event}`,
      400,
      'UNSUPPORTED_EVENT'
    );
  }
}
