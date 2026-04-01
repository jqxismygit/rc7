/**
 * 文章详情（公开 GET /articles/:aid）
 */
import request from "@/utils/request.js";

/**
 * @param {string} aid
 * @returns {Promise<{ id: string; topic_id: string; title: string; content: string; cover_url: string | null; created_at: string; updated_at: string; topic: { id: string; title: string } }>}
 */
export function fetchArticleById(aid) {
  if (!aid) {
    return Promise.reject(new Error("缺少文章 ID"));
  }
  return request.get(`/articles/${encodeURIComponent(aid)}`);
}
