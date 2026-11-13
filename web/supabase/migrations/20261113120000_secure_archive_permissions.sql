-- Restrict season archiving to authenticated users.
-- The function separately verifies commissioner authorization.

REVOKE EXECUTE ON FUNCTION public.archive_pool_season(
  uuid, integer, jsonb, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.archive_pool_season(
  uuid, integer, jsonb, text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.archive_pool_season(
  uuid, integer, jsonb, text
) TO authenticated;
