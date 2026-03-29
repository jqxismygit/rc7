export interface Topic {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  topic_id: string;
  title: string;
  subtitle: string | null;
  content: string;
  cover_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TopicDraft {
  title: string;
  description?: string | null;
  cover_url?: string | null;
}

export type TopicPatch = Partial<
  Pick<Topic, "title" | "description" | "cover_url">
>;

export interface ArticleDraft {
  topic_id: string;
  title: string;
  subtitle?: string | null;
  content: string;
  cover_url?: string | null;
}

export type ArticlePatch = Partial<
  Pick<Article, "title" | "subtitle" | "content" | "cover_url">
>;

export interface TopicSummary extends Topic {
  article_count: number;
}

export interface TopicWithArticles extends Topic {
  articles: Article[];
}

export interface ReorderTopicArticlesRequest {
  article_ids: string[];
}

export interface ReorderTopicArticlesResult {
  topic_id: string;
  article_ids: string[];
}

export interface TopicListResult {
  topics: TopicSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface ArticleWithTopic extends Article {
  topic: Pick<Topic, "id" | "title">;
}

export interface UploadedImage {
  url: string;
}
