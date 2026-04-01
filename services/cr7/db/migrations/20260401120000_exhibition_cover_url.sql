ALTER TABLE exhibitions
  ADD COLUMN cover_url TEXT;

ALTER TABLE exhibitions
  ADD CONSTRAINT chk_exhibitions_cover_not_blank
  CHECK (cover_url IS NULL OR LENGTH(BTRIM(cover_url)) > 0);
