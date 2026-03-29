import type { Topic as TopicTypes } from "@cr7/types";
import { request } from "@/utils/request";

/** 与后端 stream 上传一致：请求体为原始图片字节，Content-Type 为具体 image/* */
export function topicImageContentType(file: File | Blob): string {
  const t = file.type?.trim() ?? "";
  if (t.startsWith("image/")) {
    return t === "image/jpg" ? "image/jpeg" : t;
  }
  if (file instanceof File) {
    const n = file.name.toLowerCase();
    if (n.endsWith(".png")) return "image/png";
    if (n.endsWith(".webp")) return "image/webp";
    if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  }
  return "image/jpeg";
}

export type TopicListQuery = {
  page?: number;
  limit?: number;
};

export async function listTopicsApi(
  params: TopicListQuery,
): Promise<TopicTypes.TopicListResult> {
  const raw = await request.get("/topics", { params });
  return raw as unknown as TopicTypes.TopicListResult;
}

export async function createTopicApi(
  data: TopicTypes.TopicDraft,
): Promise<TopicTypes.Topic> {
  const raw = await request.post("/topics", data);
  return raw as unknown as TopicTypes.Topic;
}

export async function updateTopicApi(
  tid: string,
  data: TopicTypes.TopicPatch,
): Promise<TopicTypes.Topic> {
  const raw = await request.patch(
    `/topics/${encodeURIComponent(tid)}`,
    data,
  );
  return raw as unknown as TopicTypes.Topic;
}

export async function deleteTopicApi(tid: string): Promise<void> {
  await request.delete(`/topics/${encodeURIComponent(tid)}`);
}

/**
 * 管理员上传图片：请求体为文件二进制流（非 multipart），与 services 测试 fixtures 一致。
 * 返回图片 URL（多为 `/assets/<uuid>.webp` 形式，依服务端 base_url 而定）。
 */
export async function uploadTopicImageApi(
  file: File | Blob,
): Promise<TopicTypes.UploadedImage> {
  const raw = await request.post("/assets/images", file, {
    headers: {
      "Content-Type": topicImageContentType(file),
    },
  });
  return raw as unknown as TopicTypes.UploadedImage;
}
