-- =============================================
-- PUBLIC LANDING WAITLIST STATS
-- Returns public-safe waitlist data without exposing email addresses.
-- =============================================

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
