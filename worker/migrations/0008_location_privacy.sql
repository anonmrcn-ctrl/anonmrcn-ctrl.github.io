ALTER TABLE locations
ADD COLUMN privacy_safe INTEGER NOT NULL DEFAULT 0
CHECK (privacy_safe IN (0, 1));

ALTER TABLE locations
ADD COLUMN location_consent_at INTEGER;

UPDATE locations
SET is_visible = 0
WHERE location_consent_at IS NULL;

DELETE FROM contact_messages
WHERE created_at < (unixepoch('now') * 1000) - (30 * 24 * 60 * 60 * 1000);
