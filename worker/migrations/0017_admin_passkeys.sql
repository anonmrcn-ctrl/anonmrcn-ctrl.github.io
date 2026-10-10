CREATE TABLE IF NOT EXISTS admin_identities (
    id TEXT PRIMARY KEY CHECK (length(id) = 36),
    display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS admin_credentials (
    credential_id TEXT PRIMARY KEY CHECK (length(credential_id) BETWEEN 1 AND 1024),
    identity_id TEXT NOT NULL,
    user_handle TEXT NOT NULL CHECK (length(user_handle) BETWEEN 1 AND 256),
    public_key_spki TEXT NOT NULL CHECK (length(public_key_spki) BETWEEN 1 AND 4096),
    sign_count INTEGER NOT NULL DEFAULT 0 CHECK (sign_count >= 0),
    transports_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(transports_json)),
    rp_id TEXT NOT NULL CHECK (length(rp_id) BETWEEN 1 AND 253),
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,
    FOREIGN KEY (identity_id) REFERENCES admin_identities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_credentials_identity
    ON admin_credentials(identity_id, created_at);

CREATE TABLE IF NOT EXISTS admin_auth_challenges (
    id TEXT PRIMARY KEY CHECK (length(id) = 36),
    purpose TEXT NOT NULL CHECK (purpose IN ('bootstrap', 'login', 'register')),
    challenge_hash TEXT NOT NULL CHECK (length(challenge_hash) = 64),
    identity_id TEXT,
    user_handle TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    FOREIGN KEY (identity_id) REFERENCES admin_identities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_auth_challenges_expiry
    ON admin_auth_challenges(expires_at, used_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
    session_hash TEXT PRIMARY KEY CHECK (length(session_hash) = 64),
    identity_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES admin_identities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry
    ON admin_sessions(expires_at);
