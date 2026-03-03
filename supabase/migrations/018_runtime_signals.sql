-- Migration 018: Runtime Signals
-- Captures runtime monitoring signals from integrations, webhooks, or manual entry

CREATE TABLE IF NOT EXISTS runtime_signals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_name     text NOT NULL,
  signal_type     text NOT NULL CHECK (signal_type IN (
    'performance', 'accuracy', 'fairness', 'safety', 'availability', 'compliance', 'custom'
  )),
  metric_name     text NOT NULL,
  metric_value    numeric NOT NULL,
  source          text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'webhook', 'integration')),
  severity        text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  context         jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_runtime_signals_org ON runtime_signals(organisation_id);
CREATE INDEX idx_runtime_signals_type ON runtime_signals(signal_type);
CREATE INDEX idx_runtime_signals_severity ON runtime_signals(severity);
CREATE INDEX idx_runtime_signals_created ON runtime_signals(created_at DESC);

-- RLS
ALTER TABLE runtime_signals ENABLE ROW LEVEL SECURITY;
