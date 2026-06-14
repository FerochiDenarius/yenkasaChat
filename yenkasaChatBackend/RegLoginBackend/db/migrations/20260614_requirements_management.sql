CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS project_requirements (
  requirement_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  client_email TEXT,
  requirement_name TEXT NOT NULL,
  requirement_description TEXT,
  category TEXT NOT NULL CHECK (category IN ('Functional', 'Frontend / UI', 'Backend / API', 'Database', 'Infrastructure', 'Security', 'Integrations')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Approved', 'Assigned', 'In Development', 'Testing', 'Client Review', 'Completed', 'Rejected')),
  assigned_user_id TEXT,
  assigned_developer TEXT,
  assigned_role TEXT,
  reporter TEXT,
  reporter_email TEXT,
  source_type TEXT NOT NULL DEFAULT 'Manual',
  source_reference_id TEXT,
  source_key TEXT,
  original_request_text TEXT,
  price_listing_item_ref TEXT,
  estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  additional_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  actual_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  remaining_hours NUMERIC(8,2) GENERATED ALWAYS AS (GREATEST(estimated_hours - actual_hours, 0)) STORED,
  due_date DATE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_requirements_project ON project_requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_project_requirements_client ON project_requirements(client_email);
CREATE INDEX IF NOT EXISTS idx_project_requirements_status ON project_requirements(status);
CREATE INDEX IF NOT EXISTS idx_project_requirements_category ON project_requirements(category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_requirements_source_unique
  ON project_requirements(project_id, source_reference_id, source_key)
  WHERE source_reference_id IS NOT NULL AND source_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS project_requirement_dependencies (
  requirement_id TEXT NOT NULL REFERENCES project_requirements(requirement_id) ON DELETE CASCADE,
  depends_on_requirement_id TEXT NOT NULL REFERENCES project_requirements(requirement_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requirement_id, depends_on_requirement_id)
);

CREATE TABLE IF NOT EXISTS project_requirement_attachments (
  attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id TEXT NOT NULL REFERENCES project_requirements(requirement_id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'gcs',
  bucket TEXT,
  object_key TEXT,
  url TEXT NOT NULL,
  uploaded_by TEXT,
  uploaded_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_requirement_comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id TEXT NOT NULL REFERENCES project_requirements(requirement_id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_email TEXT,
  author_name TEXT,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_requirement_change_requests (
  change_request_id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES project_requirements(requirement_id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cost_impact NUMERIC(12,2) NOT NULL DEFAULT 0,
  time_impact NUMERIC(8,2) NOT NULL DEFAULT 0,
  additional_days_required INTEGER NOT NULL DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'Pending' CHECK (approval_status IN ('Pending', 'Approved', 'Rejected')),
  requested_by TEXT,
  requested_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_requirement_activity_history (
  activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id TEXT NOT NULL REFERENCES project_requirements(requirement_id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_email TEXT,
  actor_role TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
