CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_topics_title_not_blank CHECK (LENGTH(BTRIM(title)) > 0),
  CONSTRAINT chk_topics_description_not_blank CHECK (description IS NULL OR LENGTH(BTRIM(description)) > 0),
  CONSTRAINT chk_topics_cover_not_blank CHECK (cover_url IS NULL OR LENGTH(BTRIM(cover_url)) > 0)
);

CREATE TABLE topic_articles (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_topic_articles_title_not_blank CHECK (LENGTH(BTRIM(title)) > 0),
  CONSTRAINT chk_topic_articles_content_not_blank CHECK (LENGTH(BTRIM(content)) > 0),
  CONSTRAINT chk_topic_articles_cover_not_blank CHECK (cover_url IS NULL OR LENGTH(BTRIM(cover_url)) > 0)
);

CREATE INDEX idx_topic_articles_topic_id ON topic_articles(topic_id);
CREATE INDEX idx_topics_created_at ON topics(created_at DESC);
CREATE INDEX idx_topic_articles_created_at ON topic_articles(created_at DESC);
