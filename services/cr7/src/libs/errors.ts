import MoleculerWeb from "moleculer-web";
import Moleculer from "moleculer";
import { UserDataError } from "../data/user.js";
import { OrderDataError } from "../data/order.js";
import { PaymentDataError } from "../data/payment.js";
import { RedeemDataError } from "../data/redeem.js";

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

  if (error.code === 'USER_NO_OPENID') {
    throw new MoleculerClientError('用户未绑定微信账号', 409, 'USER_NO_OPENID');
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

  throw new MoleculerClientError('核销服务错误', 500, 'REDEEM_ERROR');
}