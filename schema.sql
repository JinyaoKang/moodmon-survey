CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  answers TEXT NOT NULL,
  duration_sec INTEGER DEFAULT 0,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_responses_created ON responses(created_at);
