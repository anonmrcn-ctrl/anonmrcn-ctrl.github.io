-- Ogni nuova location resta nascosta finché l'utente non sceglie di mostrarla.
-- Il trigger non modifica le preferenze delle location già esistenti.

CREATE TRIGGER IF NOT EXISTS locations_private_by_default
AFTER INSERT ON locations
FOR EACH ROW
WHEN NEW.is_visible <> 0
BEGIN
    UPDATE locations
    SET is_visible = 0
    WHERE id = NEW.id;
END;
