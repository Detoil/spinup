-- 005_security_fixes.sql
-- Security hardening from the code review. Closes privilege-escalation and
-- cross-tenant (IDOR) holes in RLS. Safe to run on an existing database:
-- every statement is idempotent (drop-if-exists / create-or-replace).

-- ============================================================
-- FIX 1 (CRITICAL) — prevent platform_role self-escalation
-- ------------------------------------------------------------
-- "Users can update own profile" (001) has no WITH CHECK constraining which
-- columns change, so any authenticated user could run
--   update profiles set platform_role = 'admin' where id = auth.uid()
-- straight from the browser anon client and become a platform admin.
--
-- A blanket column REVOKE would also block the admin panel (admins act through
-- the same `authenticated` role), so we gate the change with a trigger that
-- only lets an existing admin — or trusted server-side service-role code —
-- change platform_role.
-- ============================================================

create or replace function public.prevent_platform_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.platform_role is distinct from old.platform_role then
    if not (public.is_admin() or auth.role() = 'service_role') then
      raise exception 'Not authorized to change platform_role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_platform_role_change();

-- ============================================================
-- FIX 2 (CRITICAL) — stop "join any team as entrepreneur"
-- ------------------------------------------------------------
-- 002's team_members INSERT policy allowed ANY authenticated user to insert
-- themselves into ANY team as entrepreneur (the first WITH CHECK clause was
-- meant only to bootstrap team creation). All legitimate join/create flows go
-- through the service-role admin client, so the self-insert clause is only
-- needed to bootstrap the very first member of a brand-new team.
-- ============================================================

drop policy if exists "Entrepreneurs can add team members" on public.team_members;

create policy "Entrepreneurs can add team members"
  on public.team_members for insert
  to authenticated
  with check (
    public.is_team_entrepreneur(team_id)
    or public.is_admin()
    or (
      -- bootstrap: self-add as entrepreneur ONLY into a team with no members yet
      auth.uid() = user_id
      and role = 'entrepreneur'
      and not exists (
        select 1 from public.team_members tm where tm.team_id = team_members.team_id
      )
    )
  );

-- ============================================================
-- FIX 3 (HIGH) — stop "add yourself to any company (as owner)"
-- ------------------------------------------------------------
-- 003's jb_company_members INSERT policy let any user insert themselves into
-- any company with is_owner unrestricted. Same fix as #2: only allow the
-- bootstrap self-insert into a company that has no members yet.
-- ============================================================

drop policy if exists "Users can add themselves during creation" on public.jb_company_members;

create policy "Users can add themselves during creation"
  on public.jb_company_members for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and not exists (
        select 1 from public.jb_company_members m
        where m.company_id = jb_company_members.company_id
      )
    )
  );

-- ============================================================
-- FIX 4 (MEDIUM) — scope the `exports` storage bucket to the owning team
-- ------------------------------------------------------------
-- 001's storage policies scoped only to `auth.role() = 'authenticated'`, so any
-- logged-in user could read/write any object in the bucket. Export objects are
-- stored at `exports/<teamId>/<file>`, so gate on the team folder segment.
-- ============================================================

drop policy if exists "Team members can read their exports" on storage.objects;
create policy "Team members can read their exports"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'exports'
    and (
      public.is_admin()
      or (storage.foldername(name))[2] in (
        select team_id::text from public.team_members where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Authenticated users can upload exports" on storage.objects;
drop policy if exists "Team members can upload exports" on storage.objects;
create policy "Team members can upload exports"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'exports'
    and (
      public.is_admin()
      or (storage.foldername(name))[2] in (
        select team_id::text from public.team_members where user_id = auth.uid()
      )
    )
  );
