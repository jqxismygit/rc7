/**
 * 话题详情（公开 GET /topics/:tid，含 articles）
 */
import request from "@/utils/request.js";

/**
 * @param {string} tid
 * @returns {Promise<{ id: string; title: string; description: string | null; cover_url: string | null; articles: Array<{ id: string; topic_id: string; title: string; content: string; cover_url: string | null }>; created_at: string; updated_at: string }>}
 */
export function fetchTopicWithArticles(tid) {
  if (!tid) {
    return Promise.reject(new Error("缺少话题 ID"));
  }
  return request.get(`/topics/${encodeURIComponent(tid)}`);
}
