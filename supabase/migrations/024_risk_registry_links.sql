-- 024_risk_registry_links.sql

-- Link systems to vendors (many systems can use one vendor)
ALTER TABLE systems
  ADD COLUMN ai_vendor_id uuid REFERENCES ai_vendors(id) ON DELETE SET NULL,
  ADD COLUMN risk_category text DEFAULT 'unassessed'
    CHECK (risk_category IN ('minimal', 'limited', 'high', 'unacceptable', 'unassessed')),
  ADD COLUMN owner_name text,
  ADD COLUMN owner_role text,
  ADD COLUMN compliance_tags text[] DEFAULT '{}';

CREATE INDEX idx_systems_vendor ON systems(ai_vendor_id);
CREATE INDEX idx_systems_risk ON systems(risk_category);

-- Link incidents to systems (which system caused the incident)
ALTER TABLE incidents
  ADD COLUMN system_id uuid REFERENCES systems(id) ON DELETE SET NULL;

CREATE INDEX idx_incidents_system ON incidents(system_id);

-- Compliance requirements reference table
CREATE TABLE compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  description text,
  jurisdiction text NOT NULL,
  framework text NOT NULL,
  risk_categories text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Map systems to compliance requirements
CREATE TABLE system_compliance_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  status text DEFAULT 'not_assessed'
    CHECK (status IN ('not_assessed', 'compliant', 'partially_compliant', 'non_compliant', 'not_applicable')),
  notes text,
  assessed_at timestamptz,
  assessed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(system_id, requirement_id)
);

CREATE INDEX idx_system_compliance_system ON system_compliance_map(system_id);

-- Seed core EU AI Act + GDPR + ISO 42001 requirements
INSERT INTO compliance_requirements (code, title, description, jurisdiction, framework, risk_categories) VALUES
  ('EU_AI_ACT_ART6', 'High-risk AI system classification', 'Systems must be classified by risk level per Annex III', 'EU', 'EU AI Act', '{"high","unacceptable"}'),
  ('EU_AI_ACT_ART9', 'Risk management system', 'Continuous risk management throughout AI system lifecycle', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART10', 'Data governance', 'Training, validation and testing data must meet quality criteria', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART11', 'Technical documentation', 'Documentation demonstrating compliance before placement on market', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART12', 'Record-keeping', 'Automatic logging of events during operation', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART13', 'Transparency', 'Sufficient transparency for deployers to interpret output', 'EU', 'EU AI Act', '{"high","limited"}'),
  ('EU_AI_ACT_ART14', 'Human oversight', 'Designed to allow effective human oversight during use', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART15', 'Accuracy, robustness and cybersecurity', 'Appropriate levels throughout lifecycle', 'EU', 'EU AI Act', '{"high"}'),
  ('EU_AI_ACT_ART50', 'Transparency for AI-generated content', 'Users must be informed when interacting with AI', 'EU', 'EU AI Act', '{"limited","high"}'),
  ('EU_AI_ACT_ART52', 'Registration in EU database', 'High-risk systems registered before market placement', 'EU', 'EU AI Act', '{"high"}'),
  ('GDPR_ART22', 'Automated decision-making', 'Right not to be subject to solely automated decisions with legal effects', 'EU', 'GDPR', '{"high"}'),
  ('GDPR_ART35', 'Data protection impact assessment', 'DPIA required for high-risk processing', 'EU', 'GDPR', '{"high"}'),
  ('ISO42001_4', 'Context of the organisation', 'Understanding org context for AI management system', 'International', 'ISO 42001', '{"minimal","limited","high"}'),
  ('ISO42001_6', 'Planning for AI management', 'Risk assessment and objectives for AI management', 'International', 'ISO 42001', '{"minimal","limited","high"}'),
  ('ISO42001_8', 'AI system lifecycle operation', 'Operational planning and control for AI systems', 'International', 'ISO 42001', '{"minimal","limited","high"}');

-- Enable RLS
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_compliance_map ENABLE ROW LEVEL SECURITY;

-- All authenticated can read compliance requirements (reference data)
CREATE POLICY "compliance_requirements_read" ON compliance_requirements
  FOR SELECT TO authenticated USING (true);

-- System compliance map: org-scoped via systems table
CREATE POLICY "system_compliance_map_org" ON system_compliance_map
  FOR ALL TO authenticated
  USING (
    system_id IN (
      SELECT s.id FROM systems s
      JOIN profiles p ON s.owner_id = p.id
      WHERE p.organisation_id = (
        SELECT organisation_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
