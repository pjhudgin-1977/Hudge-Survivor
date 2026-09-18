-- Keep the ESPN NFL sync aligned with the current pool week.
-- The authentication secret is stored in Supabase Vault and is never
-- committed to source control.

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'espn-sync-nfl-2026-wk1-regular',
  'espn-sync-wk1-2025',
  'espn-sync-nfl-2025-wk1-regular',
  'espn-sync-nfl-current-week'
);

select cron.schedule(
  'espn-sync-nfl-current-week',
  '*/2 * * * *',
  $job$
    select net.http_post(
      url := 'https://vnnozyyngrzbkszohquq.functions.supabase.co/espn-sync-nfl',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sync-secret',
        (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'espn_sync_secret'
        )
      ),
      body := jsonb_build_object(
        'season_year', current_week.season_year,
        'week_number', current_week.week_number,
        'phase',
          case
            when current_week.week_type = 'REG' then 'regular'
            else 'playoffs'
          end,
        'seasontype',
          case
            when current_week.week_type = 'REG' then 2
            else 3
          end
      )
    )
    from (
      select distinct
        season_year,
        week_number,
        week_type
      from public.pool_state
      where season_year is not null
        and week_number is not null
    ) as current_week;
  $job$
);
