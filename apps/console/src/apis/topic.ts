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

export async function getTopicDetailApi(
  tid: string,
): Promise<TopicTypes.TopicWithArticles> {
  const raw = await request.get(`/topics/${encodeURIComponent(tid)}`);
  return raw as unknown as TopicTypes.TopicWithArticles;
}

/** POST /topics/:tid/articles 的请求体（不含 topic_id） */
export type ArticleCreateBody = Omit<TopicTypes.ArticleDraft, "topic_id">;

export async function createArticleApi(
  tid: string,
  data: ArticleCreateBody,
): Promise<TopicTypes.Article> {
  const raw = await request.post(
    `/topics/${encodeURIComponent(tid)}/articles`,
    data,
  );
  return raw as unknown as TopicTypes.Article;
}

export async function updateArticleApi(
  aid: string,
  data: TopicTypes.ArticlePatch,
): Promise<TopicTypes.Article> {
  const raw = await request.patch(
    `/articles/${encodeURIComponent(aid)}`,
    data,
  );
  return raw as unknown as TopicTypes.Article;
}

export async function deleteArticleApi(aid: string): Promise<void> {
  await request.delete(`/articles/${encodeURIComponent(aid)}`);
}

export async function reorderTopicArticlesApi(
  tid: string,
  data: TopicTypes.ReorderTopicArticlesRequest,
): Promise<TopicTypes.ReorderTopicArticlesResult> {
  const raw = await request.patch(
    `/topics/${encodeURIComponent(tid)}/articles/order`,
    data,
  );
  return raw as unknown as TopicTypes.ReorderTopicArticlesResult;
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
