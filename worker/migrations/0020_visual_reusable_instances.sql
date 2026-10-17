-- Collegamenti espliciti tra sezioni riutilizzabili e copie sincronizzate.
CREATE TABLE IF NOT EXISTS visual_reusable_instances (
    id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 96),
    section_id TEXT NOT NULL,
    page_id TEXT NOT NULL,
    node_id TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (section_id) REFERENCES visual_reusable_sections(id) ON DELETE RESTRICT,
    FOREIGN KEY (page_id) REFERENCES site_pages(id) ON DELETE RESTRICT,
    FOREIGN KEY (node_id) REFERENCES visual_nodes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_visual_reusable_instances_section
    ON visual_reusable_instances(section_id, page_id, node_id);
