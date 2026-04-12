export type AuthMethodType = 'DAMAI' | 'WECHAT_MINI' | 'PASSWORD';

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface Profile {
  id: string;
  name: string;
  /** 未设置头像时为 null */
  avatar: string | null;
  /** 用户扩展资料，默认空对象 */
  profile: Record<string, unknown>;
  /** 未绑定大麦时为 null */
  damai_user_id?: string | null;
  /** 拼合格式如 "+86 12345678901"，未绑定时为 null */
  phone?: string | null;
  /** 未绑定微信时为 null */
  openid: string | null;
  auth_methods?: AuthMethodType[];
  /** 用户的角色列表（仅在列表查询中返回） */
  roles?: Role[];
  created_at: string;
  updated_at: string;
}

export interface PhoneBinding {
  uid: string;
  country_code: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface UserListResult {
  users: Profile[];
  total: number;
  page: number;
  limit: number;
}

export interface UserRolesResult {
  roles: Role[];
  permissions: string[];
  isAdmin: boolean;
}
