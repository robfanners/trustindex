-- Migration 020: Add RLS policies for runtime_signals
-- Fixes: signals could not be inserted/read by authenticated users via API

-- Policy: users can read signals belonging to their organisation
CREATE POLICY "runtime_signals_select_own_org" ON runtime_signals
  FOR SELECT TO authenticated
  USING (organisation_id IN (
    SELECT p.organisation_id FROM profiles p WHERE p.id = auth.uid()
  ));

-- Policy: users can insert signals for their organisation
CREATE POLICY "runtime_signals_insert_own_org" ON runtime_signals
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id IN (
    SELECT p.organisation_id FROM profiles p WHERE p.id = auth.uid()
  ));
