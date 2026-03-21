import MoleculerWeb from "moleculer-web";
import Moleculer from "moleculer";
import { UserDataError } from "../data/user.js";

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