
import { Context, Errors, ServiceBroker, ServiceSchema } from 'moleculer';
import type { Exhibition, Order } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import { sendFapiaoKpjRequest } from './fapiao.js';

const { MoleculerClientError } = Errors;

interface UserMeta {
  uid: string;
}

interface ApplyFapiaoRequest {
  oid: string;
  invoice_title: string;
  tax_no?: string;
  buyer_name: string;
}


export class FapiaoService extends RC7BaseService {
	constructor(broker: ServiceBroker) {
		super(broker);
	}

	actions_fapiao: ServiceSchema['actions'] = {
		'order.applyFapiao': {
			rest: 'POST /:oid/invoice',
			params: {
				oid: 'string',
				invoice_title: 'string',
				tax_no: {
					type: 'string',
					optional: true,
				},
			},
			handler: this.applyFapiao,
		},
	};

	async applyFapiao(
		ctx: Context<ApplyFapiaoRequest, { user: UserMeta }>,
	) {
		const { oid, invoice_title, tax_no = '' } = ctx.params;
		const { uid } = ctx.meta.user;

		const order = await ctx.call(
			'cr7.order.get',
			{ oid },
			{ meta: { user: { uid } } },
		) as Order.OrderWithItems;

		if (order.status !== 'PAID') {
			throw new MoleculerClientError('Order status invalid', 409, 'ORDER_STATUS_INVALID');
		}

		if (order.items.length === 0) {
			throw new MoleculerClientError('Invalid order items', 400, 'INVALID_ARGUMENT');
		}

		const ticketCategories = await ctx.call(
			'cr7.exhibition.getTicketCategories',
			{ eid: order.exhibit_id },
			{ meta: { user: { uid } } },
		) as Exhibition.TicketCategory[];

		const nameByTicketCategoryId = new Map(
			ticketCategories.map(category => [category.id, category.name]),
		);

		await sendFapiaoKpjRequest({
			oid,
			invoice_title,
			tax_no,
			total_amount: order.total_amount,
			items: order.items.map(item => ({
				ticket_name: nameByTicketCategoryId.get(item.ticket_category_id) ?? item.ticket_category_id,
				quantity: item.quantity,
				unit_price: item.unit_price,
				subtotal: item.subtotal,
			})),
		});

		return { success: true };
	}
}