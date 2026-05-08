-- =============================================
-- LANDING APPLICATIONS TABLE
-- Stores BeRight landing page funding applications
-- =============================================

CREATE TABLE IF NOT EXISTS landing_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  handle TEXT,
  venues TEXT[] NOT NULL DEFAULT '{}',
  resolved_predictions INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'forecaster',
  source TEXT NOT NULL DEFAULT 'landing_apply_form',
  status TEXT NOT NULL DEFAULT 'new',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT landing_applications_email_unique UNIQUE (email),
  CONSTRAINT landing_applications_predictions_check CHECK (
    resolved_predictions >= 0 AND resolved_predictions <= 2000
  ),
  CONSTRAINT landing_applications_role_check CHECK (
    role IN ('forecaster', 'lp', 'watching')
  ),
  CONSTRAINT landing_applications_status_check CHECK (
    status IN ('new', 'reviewing', 'accepted', 'rejected', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS idx_landing_applications_email
  ON landing_applications(email);

CREATE INDEX IF NOT EXISTS idx_landing_applications_created
  ON landing_applications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_applications_status
  ON landing_applications(status);

CREATE INDEX IF NOT EXISTS idx_landing_applications_role
  ON landing_applications(role);

CREATE INDEX IF NOT EXISTS idx_landing_applications_venues
  ON landing_applications USING GIN (venues);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS landing_applications_updated_at ON landing_applications;
CREATE TRIGGER landing_applications_updated_at
  BEFORE UPDATE ON landing_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE landing_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public landing application submissions"
  ON landing_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access to landing applications"
  ON landing_applications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE landing_applications IS 'Funding applications submitted from the BeRight landing page';

CREATE OR REPLACE FUNCTION public.get_public_landing_waitlist_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count INTEGER;
  recent_week_count INTEGER;
  forecaster_count INTEGER;
  lp_count INTEGER;
  watching_count INTEGER;
  recent_rows JSONB;
BEGIN
  SELECT COUNT(*) INTO total_count
  FROM public.landing_applications;

  SELECT COUNT(*) INTO recent_week_count
  FROM public.landing_applications
  WHERE created_at >= NOW() - INTERVAL '7 days';

  SELECT COUNT(*) INTO forecaster_count
  FROM public.landing_applications
  WHERE role = 'forecaster';

  SELECT COUNT(*) INTO lp_count
  FROM public.landing_applications
  WHERE role = 'lp';

  SELECT COUNT(*) INTO watching_count
  FROM public.landing_applications
  WHERE role = 'watching';

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'handle', handle,
        'venues', venues,
        'role', role,
        'created_at', created_at
      )
      ORDER BY created_at DESC
    ),
    '[]'::jsonb
  )
  INTO recent_rows
  FROM (
    SELECT id, name, handle, venues, role, created_at
    FROM public.landing_applications
    ORDER BY created_at DESC
    LIMIT 8
  ) recent;

  RETURN jsonb_build_object(
    'total', total_count,
    'recentWeek', recent_week_count,
    'roles', jsonb_build_object(
      'forecaster', forecaster_count,
      'lp', lp_count,
      'watching', watching_count
    ),
    'recent', recent_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_landing_waitlist_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_landing_waitlist_stats() TO anon, authenticated, service_role;
