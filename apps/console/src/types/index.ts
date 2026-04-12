export type PermissionType =
  | "exhibition_view"
  | "exhibition_create"
  | "exhibition_edit"
  | "exhibition_delete"
  | "banner_manage"
  | "news_manage"
  | "brand_cooperation_manage"
  | "privacy_policy_manage";

export type PermissionItem = {
  group: string;
  name: string;
  title: string;
};
