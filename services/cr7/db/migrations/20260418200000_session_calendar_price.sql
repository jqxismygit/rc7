ALTER TABLE exhibit_session_inventories
  ADD COLUMN session_price INTEGER;

INSERT INTO exhibit_session_inventories (
  session_id,
  ticket_category_id,
  quantity,
  reserved_quantity,
  session_price,
  created_at,
  updated_at
)
SELECT
  sessions.id,
  categories.id,
  0,
  0,
  categories.price,
  NOW(),
  NOW()
FROM exhibit_ticket_categories categories
JOIN exhibit_sessions sessions
  ON sessions.session_id = categories.eid
ON CONFLICT (session_id, ticket_category_id)
DO NOTHING;

UPDATE exhibit_session_inventories inventories
SET session_price = categories.price
FROM exhibit_ticket_categories categories
WHERE inventories.ticket_category_id = categories.id;

ALTER TABLE exhibit_ticket_categories
  DROP COLUMN price;