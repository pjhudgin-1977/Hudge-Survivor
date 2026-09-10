-- Grade finalized 2026 Week 1 games every 2 minutes
-- Then apply any newly recorded losses to each pool entry.

select cron.schedule(
  'grade-picks-2026-wk1-regular',
  '*/2 * * * *',
  $$
  select public.grade_picks_for_week(
    2026,
    'regular'::public.season_phase,
    1
  );

  select public.apply_losses_for_week(
    ps.pool_id,
    2026,
    'regular'::public.season_phase,
    1
  )
  from public.pool_state ps
  where ps.season_year = 2026
    and ps.week_number = 1
    and ps.week_type = 'REG';
  $$
);