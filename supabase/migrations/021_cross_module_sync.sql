-- ==========================================================================
-- Migration 021: Cross-Module Sync Wiring
-- ==========================================================================
-- Phase B of Verisum unification.
-- Adds:
--   A) source_signal_id FK on escalations (trace signal → escalation)
--   B) Auto-escalate trigger on critical signals
--   C) source_escalation_id + source_signal_id FKs on incidents
-- ==========================================================================

-- --------------------------------------------------------------------------
-- A) Add source_signal_id to escalations
-- --------------------------------------------------------------------------

ALTER TABLE escalations
  ADD COLUMN IF NOT EXISTS source_signal_id uuid REFERENCES runtime_signals(id);

CREATE INDEX IF NOT EXISTS idx_escalations_source_signal
  ON escalations(source_signal_id) WHERE source_signal_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- B) Auto-escalate on critical runtime signal
-- --------------------------------------------------------------------------
-- Follows the exact pattern from migration 010 (tg_auto_escalate_on_drift).
-- Fires AFTER INSERT on runtime_signals.
-- Only creates escalation when severity = 'critical'.
-- Deduplicates: skips if an unresolved escalation already exists for this signal.

CREATE OR REPLACE FUNCTION tg_auto_escalate_on_signal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only fire on critical severity
  IF NEW.severity <> 'critical' THEN
    RETURN NULL;
  END IF;

  -- Deduplicate: skip if unresolved escalation already exists for this signal
  IF EXISTS (
    SELECT 1 FROM escalations
    WHERE source_signal_id = NEW.id AND resolved = false
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO escalations (
    organisation_id, source_signal_id, reason, severity
  ) VALUES (
    NEW.organisation_id,
    NEW.id,
    'Critical runtime signal: ' || NEW.metric_name
      || ' (' || NEW.signal_type || ') = ' || NEW.metric_value
      || ' on system "' || COALESCE(NEW.system_name, 'unknown') || '"',
    'critical'
  );

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_runtime_signals_auto_escalate
  AFTER INSERT ON runtime_signals
  FOR EACH ROW
  EXECUTE FUNCTION tg_auto_escalate_on_signal();

-- --------------------------------------------------------------------------
-- C) Add source_escalation_id and source_signal_id to incidents
-- --------------------------------------------------------------------------
-- Enables tracing: which escalation / signal led to this incident?
-- Both nullable — existing rows unaffected.

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS source_escalation_id uuid REFERENCES escalations(id);

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS source_signal_id uuid REFERENCES runtime_signals(id);

CREATE INDEX IF NOT EXISTS idx_incidents_source_escalation
  ON incidents(source_escalation_id) WHERE source_escalation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_source_signal
  ON incidents(source_signal_id) WHERE source_signal_id IS NOT NULL;
