-- Call logs table to track all outbound calls
CREATE TABLE IF NOT EXISTS call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_sid TEXT UNIQUE NOT NULL,
  caller_phone_number TEXT NOT NULL,
  recipient_phone_number TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  call_purpose TEXT NOT NULL,
  status TEXT NOT NULL,
  outcome_type TEXT,
  outcome_details TEXT, -- JSON string
  duration_seconds INTEGER,
  transcript TEXT,
  cost REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_call_logs_call_sid ON call_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller_phone ON call_logs(caller_phone_number);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_purpose ON call_logs(call_purpose);

-- Analytics view for call success rates
CREATE VIEW IF NOT EXISTS call_analytics AS
SELECT 
  call_purpose,
  COUNT(*) as total_calls,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_calls,
  SUM(CASE WHEN outcome_type = 'reservation_confirmed' OR outcome_type = 'message_delivered' OR outcome_type = 'conversation_completed' THEN 1 ELSE 0 END) as successful_calls,
  AVG(duration_seconds) as avg_duration,
  SUM(cost) as total_cost
FROM call_logs
GROUP BY call_purpose;
