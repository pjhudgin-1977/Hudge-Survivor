-- Replace hard-coded Week 1 grading jobs with one dynamic grader
-- that follows each pool's current season/week automatically.

create or replace function public.grade_current_pool_weeks()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  w record;
  p record;
  v_phase public.season_phase;
begin
  -- Grade each distinct current season/week represented in pool_state.
  for w in
    select distinct
      ps.season_year,
      ps.week_number,
      ps.week_type
    from public.pool_state ps
    where ps.season_year is not null
      and ps.week_number is not null
  loop
    v_phase :=
      (
        case
          when w.week_type = 'REG' then 'regular'
          else 'playoffs'
        end
      )::public.season_phase;

    -- Grade only picks whose games have become final.
    perform public.grade_picks_for_week(
      w.season_year,
      v_phase,
      w.week_number
    );

    -- Apply newly graded losses separately to every pool
    -- currently on that season/week.
    for p in
      select ps.pool_id
      from public.pool_state ps
      where ps.season_year = w.season_year
        and ps.week_number = w.week_number
        and ps.week_type = w.week_type
    loop
      perform public.apply_losses_for_week(
        p.pool_id,
        w.season_year,
        v_phase,
        w.week_number
      );
    end loop;
  end loop;
end;
$function$;


-- Remove the old hard-coded grading jobs.
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'grade-picks-2025-wk1-regular',
  'grade-picks-2026-wk1-regular',
  'grade-current-pool-weeks'
);


-- Run dynamic grading every 2 minutes.
select cron.schedule(
  'grade-current-pool-weeks',
  '*/2 * * * *',
  $$select public.grade_current_pool_weeks();$$
);