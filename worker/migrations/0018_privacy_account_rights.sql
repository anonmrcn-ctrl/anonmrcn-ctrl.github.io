ALTER TABLE locations ADD COLUMN deleted_at INTEGER;

DROP INDEX IF EXISTS idx_locations_street_order;

CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_street_order
ON locations(street_name, street_order)
WHERE street_name <> '' AND street_order > 0 AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_locations_active
ON locations(deleted_at, id);
