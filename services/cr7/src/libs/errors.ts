import MoleculerWeb from "moleculer-web";
import Moleculer from "moleculer";
import { UserDataError } from "../data/user.js";
import { OrderDataError } from "../data/order.js";
import { PaymentDataError } from "../data/payment.js";
import { RedeemDataError } from "../data/redeem.js";
import { ExhibitionDataError } from "../data/exhibition.js";
import { XiechengDataError } from '../data/xiecheng.js';
import { TopicDataError } from '../data/topics.js';

const { NotFoundError } = MoleculerWeb.Errors;
const { MoleculerClientError } = Moleculer.Errors;


export function handleUserError(error: unknown): never {
  if ((error instanceof UserDataError) === false) {
    throw error;
  }

  if (error.code === 'USER_NOT_FOUND') {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }

  if (error.code === 'ROLE_NOT_FOUND') {
    throw new MoleculerClientError('角色不存在', 404, 'ROLE_NOT_FOUND');
  }

  if (error.code === 'ROLE_ALREADY_EXISTS') {
    throw new MoleculerClientError('角色已存在', 409, 'ROLE_ALREADY_EXISTS');
  }

  if (error.code === 'BUILTIN_ROLE_CANNOT_DELETE') {
    throw new MoleculerClientError('内置角色不能删除', 400, 'BUILTIN_ROLE_CANNOT_DELETE');
  }

  if (error.code === 'PHONE_ALREADY_EXISTS') {
    throw new MoleculerClientError('手机号已存在', 409, 'PHONE_ALREADY_EXISTS');
  }

  if (error.code === 'INVALID_PHONE_OR_PASSWORD') {
    throw new MoleculerClientError('手机号或密码错误', 401, 'INVALID_PHONE_OR_PASSWORD');
  }

  if (error.code === 'USER_PASSWORD_NOT_FOUND') {
    throw new MoleculerClientError('未绑定密码认证方式', 404, 'USER_PASSWORD_NOT_FOUND');
  }

  if (error.code === 'PASSWORD_MISMATCH') {
    throw new MoleculerClientError('当前密码错误', 401, 'PASSWORD_MISMATCH');
  }

  throw new MoleculerClientError('Unknown user error', 500, 'UNKNOWN_USER_ERROR');
}

export function handleOrderError(error: unknown): never {
  if ((error instanceof OrderDataError) === false) {
    throw error;
  }

  if (error.code === 'INVENTORY_NOT_ENOUGH') {
    throw new MoleculerClientError('库存不足', 409, 'INVENTORY_NOT_ENOUGH');
  }

  if (error.code === 'SESSION_EXPIRED') {
    throw new MoleculerClientError('场次已过期', 410, 'SESSION_EXPIRED');
  }

  if (
    error.code === 'INVALID_ARGUMENT'
    || error.code === 'SESSION_NOT_FOUND'
    || error.code === 'TICKET_CATEGORY_NOT_FOUND'
  ) {
    throw new MoleculerClientError('参数不合法', 400, error.code);
  }

  if (error.code === 'ORDER_NOT_FOUND') {
    throw new MoleculerClientError('订单不存在或无权限', 404, 'ORDER_NOT_FOUND');
  }

  if (error.code === 'ORDER_STATUS_INVALID') {
    throw new MoleculerClientError('订单状态不允许取消', 400, 'ORDER_STATUS_INVALID');
  }

  if (error.code === 'ORDER_CANNOT_BE_HIDDEN') {
    throw new MoleculerClientError('订单状态不允许隐藏', 400, 'ORDER_CANNOT_BE_HIDDEN');
  }

  throw new MoleculerClientError('未知订单错误', 500, 'UNKNOWN_ORDER_ERROR');
}

export function handlePaymentDataError(error: unknown): never {
  if ((error instanceof PaymentDataError) === false) {
    throw error;
  }

  if (error.code === 'ORDER_NOT_FOUND') {
    throw new MoleculerClientError('订单不存在或无权限', 404, 'ORDER_NOT_FOUND');
  }

  if (error.code === 'ORDER_STATUS_INVALID') {
    throw new MoleculerClientError('订单状态不允许支付', 400, 'ORDER_STATUS_INVALID');
  }

  if (error.code === 'ORDER_EXPIRED') {
    throw new MoleculerClientError('订单已过期', 410, 'ORDER_EXPIRED');
  }

  if (error.code === 'USER_NO_OPENID') {
    throw new MoleculerClientError('用户未绑定微信账号', 409, 'USER_NO_OPENID');
  }

  if (error.code === 'ORDER_ALREADY_REDEEMED') {
    throw new MoleculerClientError('订单已核销，无法退款', 409, 'ORDER_ALREADY_REDEEMED');
  }

  if (error.code === 'ORDER_NOT_REFUNDABLE') {
    throw new MoleculerClientError('订单不允许退款', 409, 'ORDER_NOT_REFUNDABLE');
  }

  if (error.code === 'ORDER_CONTAINS_NON_REFUNDABLE_ITEMS') {
    throw new MoleculerClientError('订单中包含不允许退款的票种', 409, 'ORDER_CONTAINS_NON_REFUNDABLE_ITEMS');
  }

  if (error.code === 'ORDER_REFUND_DEADLINE_PASSED') {
    throw new MoleculerClientError('订单不允许退款，已过退票截止时间', 409, 'ORDER_REFUND_DEADLINE_PASSED');
  }

  if (error.code === 'REFUND_ALREADY_REQUESTED') {
    throw new MoleculerClientError('退款已受理', 409, 'REFUND_ALREADY_REQUESTED');
  }

  if (error.code === 'REFUND_PROCESSING') {
    throw new MoleculerClientError('退款处理中', 409, 'REFUND_PROCESSING');
  }

  if (error.code === 'ORDER_ALREADY_REFUNDED') {
    throw new MoleculerClientError('订单已退款', 409, 'ORDER_ALREADY_REFUNDED');
  }

  if (error.code === 'REFUND_RECORD_NOT_FOUND') {
    throw new MoleculerClientError('退款记录不存在', 404, 'REFUND_RECORD_NOT_FOUND');
  }

  throw new MoleculerClientError('支付服务错误', 500, 'PAYMENT_ERROR');
}

export function handleRedeemError(error: unknown): never {
  if ((error instanceof RedeemDataError) === false) {
    throw error;
  }

  if (error.code === 'REDEMPTION_NOT_FOUND') {
    throw new MoleculerClientError('资源不存在', 404, error.code);
  }

  if (error.code === 'ORDER_NOT_REDEEMABLE') {
    throw new MoleculerClientError('订单未支付或无核销码', 410, error.code);
  }

  if (
    error.code === 'REDEMPTION_ALREADY_REDEEMED'
    || error.code === 'REDEMPTION_EXPIRED'
  ) {
    throw new MoleculerClientError('核销码不可用', 409, error.code);
  }

  if (error.code === 'ORDER_REFUND_IN_PROGRESS') {
    throw new MoleculerClientError('订单退款中，无法核销', 409, error.code);
  }

  throw new MoleculerClientError('核销服务错误', 500, 'REDEEM_ERROR');
}

export function handleExhibitionError(error: unknown): never {
  if ((error instanceof ExhibitionDataError) === false) {
    throw error;
  }

  if (error.code === 'EXHIBITION_NOT_FOUND') {
    throw new MoleculerClientError('展会不存在', 404, 'EXHIBITION_NOT_FOUND');
  }

  if (error.code === 'TICKET_CATEGORY_NOT_FOUND') {
    throw new MoleculerClientError('票种不存在或不属于该展会', 404, 'TICKET_CATEGORY_NOT_FOUND');
  }

  if (error.code === 'SESSION_NOT_FOUND') {
    throw new MoleculerClientError('场次不存在', 404, 'SESSION_NOT_FOUND');
  }

  throw new MoleculerClientError('展览服务错误', 500, 'EXHIBITION_ERROR');
}

export function handleXiechengError(error: unknown): never {
  if ((error instanceof XiechengDataError) === false) {
    throw error;
  }

  if (error.code === 'TICKET_CATEGORY_NOT_FOUND') {
    throw new MoleculerClientError('票种不存在或不属于该展会', 404, 'TICKET_CATEGORY_NOT_FOUND');
  }

  if (error.code === 'TICKET_CATEGORY_NOT_BOUND') {
    throw new MoleculerClientError('票种未绑定携程编号', 409, 'TICKET_CATEGORY_NOT_BOUND');
  }

  if (error.code === 'SESSION_DATE_OUT_OF_RANGE') {
    throw new MoleculerClientError('同步的场次时间不在展会时间范围内', 400, 'SESSION_DATE_OUT_OF_RANGE');
  }

  if (error.code === 'SESSION_END_TOO_FAR') {
    throw new MoleculerClientError('同步结束时间不能超过今天后 210 天', 400, 'SESSION_END_TOO_FAR');
  }

  if (error.code === 'SYNC_QUANTITY_EXCEEDS_REMAINING') {
    throw new MoleculerClientError('同步的库存数量超过实际剩余库存', 400, 'SYNC_QUANTITY_EXCEEDS_REMAINING');
  }

  if (error.code === 'INVALID_DATE_RANGE') {
    throw new MoleculerClientError('场次时间范围不合法', 400, 'INVALID_DATE_RANGE');
  }

  throw new MoleculerClientError('携程同步服务错误', 500, 'XIECHENG_ERROR');
}

export function handleTopicError(error: unknown): never {
  if ((error instanceof TopicDataError) === false) {
    throw error;
  }

  if (error.code === 'TOPIC_NOT_FOUND') {
    throw new MoleculerClientError('话题不存在', 404, 'TOPIC_NOT_FOUND');
  }

  if (error.code === 'ARTICLE_NOT_FOUND') {
    throw new MoleculerClientError('文章不存在', 404, 'ARTICLE_NOT_FOUND');
  }

  if (error.code === 'TOPIC_ARTICLE_ORDER_INVALID') {
    throw new MoleculerClientError('文章顺序参数不合法', 400, 'TOPIC_ARTICLE_ORDER_INVALID');
  }

  throw new MoleculerClientError('话题服务错误', 500, 'TOPIC_ERROR');
}