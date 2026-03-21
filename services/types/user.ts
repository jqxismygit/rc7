export type AuthMethodType = 'WECHAT_MINI' | 'PASSWORD';

export interface Role {
  id: string;
  name: string;
}

export interface Profile {
  id: string;
  name: string;
  /** 拼合格式如 "+86 12345678901"，未绑定时为 null */
  phone?: string | null;
  /** 未绑定微信时为 null */
  openid: string | null;
  auth_methods?: AuthMethodType[];
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
