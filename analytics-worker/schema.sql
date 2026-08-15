CREATE TABLE IF NOT EXISTS metrics (
    bucket INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('pageview', 'download')),
    page_path TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
    PRIMARY KEY (bucket, event_type, page_path, target)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS metrics_bucket_type_idx
    ON metrics (bucket, event_type);
