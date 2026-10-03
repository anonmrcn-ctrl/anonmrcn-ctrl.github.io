ALTER TABLE locations
ADD COLUMN street_name TEXT NOT NULL DEFAULT '';

ALTER TABLE locations
ADD COLUMN street_order INTEGER NOT NULL DEFAULT 0
CHECK (street_order >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_street_order
ON locations(street_name, street_order)
WHERE street_name <> '' AND street_order > 0;
