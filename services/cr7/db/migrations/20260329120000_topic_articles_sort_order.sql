ALTER TABLE topic_articles
ADD COLUMN subtitle VARCHAR(255),
ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE topic_articles
ADD CONSTRAINT chk_topic_articles_subtitle_not_blank
CHECK (subtitle IS NULL OR LENGTH(BTRIM(subtitle)) > 0);

WITH ordered_articles AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY topic_id
      ORDER BY created_at DESC, id DESC
    ) - 1 AS new_sort_order
  FROM topic_articles
)
UPDATE topic_articles AS a
SET sort_order = ordered_articles.new_sort_order
FROM ordered_articles
WHERE ordered_articles.id = a.id;

ALTER TABLE topic_articles
ADD CONSTRAINT chk_topic_articles_sort_order_non_negative
CHECK (sort_order >= 0);

CREATE INDEX idx_topic_articles_topic_id_sort_order
ON topic_articles(topic_id, sort_order ASC, created_at DESC);
