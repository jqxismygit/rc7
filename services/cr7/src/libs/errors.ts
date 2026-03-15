import MoleculerWeb from "moleculer-web";
import Moleculer from "moleculer";
import { UserDataError } from "../data/user.js";

const { NotFoundError } = MoleculerWeb.Errors;
const { MoleculerClientError } = Moleculer.Errors;


export function handleUserError(error: unknown) {
  if ((error instanceof UserDataError) === false) {
    throw error;
  }

  if (error.code === 'USER_NOT_FOUND') {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }

  throw new MoleculerClientError('Unknown user error', 500, 'UNKNOWN_USER_ERROR');
}