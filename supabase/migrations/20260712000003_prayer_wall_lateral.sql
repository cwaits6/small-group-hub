-- prayer_wall ran two correlated subqueries per request (a COUNT and an
-- EXISTS over prayer_responses), so every wall load scanned responses
-- twice per row — each pass re-evaluating prayer_responses RLS. Merge
-- them into one lateral aggregate and hoist auth.uid() into InitPlans.
-- Column list, names and types are unchanged.

create or replace view public.prayer_wall with (security_invoker = true) as
select
  r.id,
  r.body,
  r.category,
  r.is_anonymous,
  r.visible_to_warriors,
  r.is_answered,
  r.created_at,
  (r.author_id = (select auth.uid())) as mine,
  case
    when r.is_anonymous and r.author_id <> (select auth.uid()) then null::text
    else p.first_name
  end as first_name,
  case
    when r.is_anonymous and r.author_id <> (select auth.uid()) then null::text
    else p.last_name
  end as last_name,
  case
    when r.is_anonymous and r.author_id <> (select auth.uid()) then null::text
    else p.preferred_name
  end as preferred_name,
  case
    when r.is_anonymous and r.author_id <> (select auth.uid()) then null::text
    else p.avatar_url
  end as avatar_url,
  coalesce(pc.praying_count, 0) as praying_count,
  coalesce(pc.i_am_praying, false) as i_am_praying
from public.prayer_requests r
left join public.profiles p on p.id = r.author_id
left join lateral (
  select
    count(*)::integer as praying_count,
    bool_or(pr.profile_id = (select auth.uid())) as i_am_praying
  from public.prayer_responses pr
  where pr.request_id = r.id
) pc on true;
