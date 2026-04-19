ALTER TABLE exhibit_ticket_categories
  ADD COLUMN list_price INTEGER;

WITH inferred_list_price AS (
  SELECT
    ticket_category_id,
    MIN(session_price) AS list_price
  FROM exhibit_session_inventories
  WHERE session_price IS NOT NULL
  GROUP BY ticket_category_id
)
UPDATE exhibit_ticket_categories categories
SET list_price = COALESCE(inferred.list_price, 0)
FROM inferred_list_price inferred
WHERE inferred.ticket_category_id = categories.id;

UPDATE exhibit_ticket_categories
SET list_price = 0
WHERE list_price IS NULL;

ALTER TABLE exhibit_ticket_categories
  ALTER COLUMN list_price SET NOT NULL;

ALTER TABLE exhibit_ticket_categories
  ADD CONSTRAINT chk_exhibit_ticket_categories_list_price CHECK (list_price >= 0);
