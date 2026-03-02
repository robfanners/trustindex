-- Seed initial regulatory updates for the AI governance feed
-- These are curated updates covering EU AI Act and UK ICO guidance

INSERT INTO regulatory_updates (title, summary, source_url, jurisdictions, sector_tags, published_at) VALUES

-- EU AI Act
(
  'EU AI Act enters into force',
  'The EU AI Act officially enters into force on 1 August 2024, with provisions phasing in over the next two years. Prohibited AI practices take effect from February 2025, and high-risk AI system obligations apply from August 2026.',
  'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai',
  ARRAY['eu'],
  ARRAY[]::text[],
  '2024-08-01'
),
(
  'EU AI Act: Prohibited AI practices now enforceable',
  'As of 2 February 2025, the EU AI Act prohibitions are enforceable. Banned practices include social scoring, manipulative AI, and certain biometric systems. Organisations must audit AI systems to ensure compliance.',
  'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai',
  ARRAY['eu'],
  ARRAY[]::text[],
  '2025-02-02'
),
(
  'EU AI Act: General-purpose AI model obligations begin',
  'From 2 August 2025, providers of general-purpose AI models must comply with transparency requirements, including publishing training data summaries and respecting EU copyright law.',
  'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai',
  ARRAY['eu'],
  ARRAY[]::text[],
  '2025-08-02'
),
(
  'EU AI Act: High-risk AI system requirements deadline approaching',
  'By 2 August 2026, organisations deploying high-risk AI systems must implement conformity assessments, risk management, and human oversight. Preparation should begin now for affected systems.',
  'https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai',
  ARRAY['eu'],
  ARRAY[]::text[],
  '2026-02-01'
),

-- UK ICO and governance
(
  'UK ICO publishes updated AI governance guidance',
  'The UK Information Commissioner''s Office has updated its guidance on AI and data protection, covering fairness in AI, transparency requirements, and accountability frameworks for organisations using AI tools.',
  'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/',
  ARRAY['uk'],
  ARRAY[]::text[],
  '2025-09-15'
),
(
  'UK government announces AI regulation white paper response',
  'The UK government has published its response to the AI regulation white paper, confirming a principles-based, sector-led approach. Regulators will be expected to implement AI governance frameworks within their sectors.',
  'https://www.gov.uk/government/publications/ai-regulation-a-pro-innovation-approach',
  ARRAY['uk'],
  ARRAY[]::text[],
  '2025-11-20'
),
(
  'UK FCA issues guidance on AI use in financial services',
  'The Financial Conduct Authority has published specific guidance on responsible AI use in financial services, covering model risk management, algorithmic bias, and consumer protection requirements.',
  'https://www.fca.org.uk/',
  ARRAY['uk'],
  ARRAY['financial_services']::text[],
  '2026-01-10'
),

-- Cross-jurisdiction
(
  'OECD updates AI Principles for 2026',
  'The OECD has updated its AI Principles, adding new recommendations around foundation model governance, environmental impact assessment, and cross-border AI risk management coordination.',
  'https://oecd.ai/en/ai-principles',
  ARRAY['uk', 'eu', 'international'],
  ARRAY[]::text[],
  '2026-01-25'
),
(
  'ISO/IEC 42001:2023 AI Management System standard gaining traction',
  'The international standard for AI management systems continues to gain adoption. Organisations seeking to demonstrate AI governance maturity should consider certification, which covers risk management, impact assessment, and continuous improvement.',
  'https://www.iso.org/standard/81230.html',
  ARRAY['uk', 'eu', 'international'],
  ARRAY[]::text[],
  '2025-06-01'
);
