-- Incident Playbooks & SLA Management

CREATE TABLE incident_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  applies_to_severity text[] DEFAULT ARRAY['sev1', 'sev2', 'sev3', 'sev4'],
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT playbook_name_unique UNIQUE(organisation_id, name)
);

CREATE TABLE playbook_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id uuid NOT NULL REFERENCES incident_playbooks(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  title text NOT NULL,
  owner_role text NOT NULL,
  sla_minutes integer NOT NULL CHECK (sla_minutes > 0),
  is_required boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT playbook_step_order_unique UNIQUE(playbook_id, step_order)
);

CREATE TABLE incident_playbook_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  playbook_id uuid NOT NULL REFERENCES incident_playbooks(id) ON DELETE RESTRICT,
  status text CHECK (status IN ('pending', 'in_progress', 'completed', 'paused')),
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE
);

CREATE TABLE playbook_step_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES incident_playbook_runs(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES playbook_steps(id) ON DELETE CASCADE,
  status text CHECK (status IN ('pending', 'started', 'completed', 'skipped')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS Policies
ALTER TABLE incident_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_playbook_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_step_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY playbooks_org_read ON incident_playbooks
  FOR SELECT USING (
    organisation_id IS NULL OR
    organisation_id IN (SELECT organisation_id FROM user_orgs WHERE user_id = auth.uid())
  );

CREATE POLICY playbooks_org_write ON incident_playbooks
  FOR ALL USING (
    organisation_id IN (SELECT organisation_id FROM user_orgs WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY steps_inherit_playbook ON playbook_steps
  FOR SELECT USING (
    playbook_id IN (SELECT id FROM incident_playbooks WHERE organisation_id IS NULL OR organisation_id IN (SELECT organisation_id FROM user_orgs WHERE user_id = auth.uid()))
  );

CREATE POLICY runs_org_access ON incident_playbook_runs
  FOR SELECT USING (
    organisation_id IN (SELECT organisation_id FROM user_orgs WHERE user_id = auth.uid())
  );

CREATE POLICY runs_org_write ON incident_playbook_runs
  FOR INSERT WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM user_orgs WHERE user_id = auth.uid())
  );

CREATE POLICY executions_run_access ON playbook_step_executions
  FOR ALL USING (
    run_id IN (SELECT id FROM incident_playbook_runs WHERE organisation_id IN (SELECT organisation_id FROM user_orgs WHERE user_id = auth.uid()))
  );

-- Indexes for performance
CREATE INDEX idx_incident_playbooks_org ON incident_playbooks(organisation_id);
CREATE INDEX idx_playbook_steps_playbook ON playbook_steps(playbook_id);
CREATE INDEX idx_playbook_runs_incident ON incident_playbook_runs(incident_id);
CREATE INDEX idx_playbook_runs_org ON incident_playbook_runs(organisation_id);
CREATE INDEX idx_step_executions_run ON playbook_step_executions(run_id);
CREATE INDEX idx_step_executions_assigned ON playbook_step_executions(assigned_to);
