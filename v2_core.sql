-- ===== v2 core: deliveries, events, client money =====
create or replace function public.video_project(vid uuid) returns uuid language sql stable security definer set search_path to 'public'
as $$ select project from public.videos where id = vid $$;
create or replace function public.is_project_editor(pid uuid) returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from public.projects where id = pid and editor = auth.uid()) $$;
grant execute on function public.video_project(uuid), public.is_project_editor(uuid) to authenticated;

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  video uuid not null references public.videos(id) on delete cascade,
  round int not null default 1,
  link text not null,
  note text not null default '',
  author uuid references public.profiles(id) on delete set null default auth.uid(),
  status text not null default 'pending' check (status in ('pending','approved','held','superseded')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists deliveries_video on public.deliveries(video, created_at desc);
alter table public.deliveries enable row level security;
drop policy if exists deliv_sel on public.deliveries;
create policy deliv_sel on public.deliveries for select to authenticated using (
  public.my_role() = 'admin' or public.is_project_editor(public.video_project(video))
  or (status = 'approved' and public.is_project_client(public.video_project(video))));
drop policy if exists deliv_ins on public.deliveries;
create policy deliv_ins on public.deliveries for insert to authenticated with check (
  public.my_role() = 'admin' or (public.my_role() = 'editor' and public.is_project_editor(public.video_project(video)) and status = 'pending' and author = auth.uid()));
drop policy if exists deliv_upd on public.deliveries;
create policy deliv_upd on public.deliveries for update to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create or replace function public.stamp_delivery() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform set_config('app.sys', '1', true);
  update public.videos set delivered_at = coalesce(delivered_at, new.created_at),
    delivered_by = coalesce(delivered_by, new.author) where id = new.video;
  perform set_config('app.sys', '', true);
  return new;
end $$;
drop trigger if exists stamp_delivery on public.deliveries;
create trigger stamp_delivery after insert on public.deliveries for each row execute function public.stamp_delivery();

create or replace function public.guard_video() returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare r text := coalesce(public.my_role(),''); p public.projects;
begin
  if auth.uid() is null or r = 'admin' or coalesce(current_setting('app.sys', true), '') = '1' then
    new.updated_at := now(); return new;
  end if;
  select * into p from public.projects where id = new.project;
  if new.price is distinct from old.price or new.delivered_at is distinct from old.delivered_at
     or new.delivered_by is distinct from old.delivered_by then raise exception 'not allowed'; end if;
  if r = 'editor' and p.editor = auth.uid() then
    if new.pub is distinct from old.pub or new.round is distinct from old.round
       or new.link is distinct from old.link or new.due is distinct from old.due then raise exception 'editor cannot publish'; end if;
    if new.rs is distinct from old.rs and not (old.rs = 'notes' and new.rs = 'revising') then raise exception 'not allowed'; end if;
    if new.pending is not null and coalesce(new.pending->>'type','') <> 'stage' then raise exception 'not allowed'; end if;
  elsif r = 'client' and public.is_project_client(p.id) then
    if old.pub = 6 and old.rs = 'awaiting' and new.rs = 'notes' and new.stage = old.stage and new.pub = old.pub then null;
    elsif old.pub = 6 and old.rs = 'awaiting' and new.stage = 7 and new.pub = 7 and new.rs is null then null;
    else raise exception 'not allowed'; end if;
    if new.round is distinct from old.round or new.link is distinct from old.link
       or new.pending is distinct from old.pending or new.due is distinct from old.due
       or new.is_new is distinct from old.is_new then raise exception 'not allowed'; end if;
  else raise exception 'not allowed'; end if;
  new.updated_at := now(); return new;
end $function$;

create table if not exists public.events (
  id bigserial primary key,
  kind text not null,
  project uuid references public.projects(id) on delete cascade,
  video uuid references public.videos(id) on delete cascade,
  task uuid references public.tasks(id) on delete cascade,
  actor uuid references public.profiles(id) on delete set null,
  actor_role text,
  params jsonb not null default '{}',
  visibility text not null default 'internal',
  created_at timestamptz not null default now()
);
create index if not exists events_time on public.events(created_at desc);
create index if not exists events_video on public.events(video);
alter table public.events enable row level security;
drop policy if exists ev_sel on public.events;
create policy ev_sel on public.events for select to authenticated using (
  public.my_role() = 'admin' or actor = auth.uid()
  or (public.my_role() = 'editor' and (public.is_project_editor(project) or exists (select 1 from public.tasks t where t.id = task and t.editor = auth.uid())))
  or (visibility = 'client' and public.is_project_client(project)));

alter table public.notifs add column if not exists event_id bigint references public.events(id) on delete cascade;
create index if not exists notifs_user_time on public.notifs(user_id, created_at desc);

create or replace function public.log_event(p_kind text, p_project uuid default null, p_video uuid default null, p_task uuid default null, p_params jsonb default '{}')
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid(); r text := public.my_role(); pid uuid := p_project; ed uuid; tk public.tasks;
  vis text := 'internal'; eid bigint; ref text; rcpt uuid[] := '{}'; admins uuid[]; clients uuid[] := '{}';
  to_admins bool := false; to_editor bool := false; to_clients bool := false;
begin
  if me is null or r is null or r = 'pending' then raise exception 'not allowed'; end if;
  if p_video is not null then select project into pid from public.videos where id = p_video; if pid is null then raise exception 'no video'; end if; end if;
  if p_task is not null then select * into tk from public.tasks where id = p_task; if tk.id is null then raise exception 'no task'; end if; ed := tk.editor; end if;
  if pid is not null then
    select editor into ed from public.projects where id = pid;
    select coalesce(array_agg(distinct c), '{}') into clients from (
      select client c from public.projects where id = pid union select client from public.project_members where project = pid) s where c is not null;
  end if;
  select coalesce(array_agg(id), '{}') into admins from public.profiles where role = 'admin';

  -- authority
  if p_kind in ('stage_ok','stage_hold','draft_ok','draft_hold','assigned','project_new','member_added','task_new','task_ping','admin_note') and r <> 'admin' then raise exception 'not allowed'; end if;
  if p_kind in ('stage_req','draft_sent','revising','notes_all_done','checkin') and r not in ('admin','editor') then raise exception 'not allowed'; end if;
  if p_kind in ('task_stage','task_delivered') and not (r = 'admin' or (r = 'editor' and tk.editor = me)) then raise exception 'not allowed'; end if;
  if p_kind in ('review_notes','client_approved','request_new') and r not in ('admin','client') then raise exception 'not allowed'; end if;
  if r = 'editor' and pid is not null and ed is distinct from me then raise exception 'not allowed'; end if;
  if r = 'client' and (pid is null or not public.is_project_client(pid)) then raise exception 'not allowed'; end if;

  case p_kind
    when 'stage_req','draft_sent','task_stage','task_delivered','checkin' then to_admins := true;
    when 'stage_hold','draft_hold','task_new','task_ping','admin_note' then to_editor := true;
    when 'stage_ok','draft_ok','assigned','project_new' then to_editor := true; to_clients := true; vis := 'client';
    when 'notes_added','review_notes','client_approved' then to_editor := true; to_admins := true; to_clients := true; vis := 'client';
    when 'notes_all_done','revising' then to_admins := true; to_clients := true; vis := 'client';
    when 'request_new' then to_admins := true; vis := 'client';
    when 'ask_status' then if r = 'client' then to_editor := true; to_admins := true; to_clients := true; vis := 'client'; else to_editor := true; end if;
    when 'member_added' then vis := 'client'; if (p_params->>'user') is not null then rcpt := array[(p_params->>'user')::uuid]; end if;
    else raise exception 'unknown kind';
  end case;

  insert into public.events(kind, project, video, task, actor, actor_role, params, visibility)
    values (p_kind, pid, p_video, p_task, me, r, coalesce(p_params, '{}'), vis) returning id into eid;

  if to_admins then rcpt := rcpt || admins; end if;
  if to_editor and ed is not null then rcpt := rcpt || ed; end if;
  if to_clients then rcpt := rcpt || clients; end if;
  ref := case when p_video is not null then 'v:' || p_video when p_task is not null then 't:' || p_task when pid is not null then 'p:' || pid else null end;
  insert into public.notifs(user_id, event_id, ar, en, ref)
    select distinct u, eid, '', '', ref from unnest(rcpt) u where u is not null and u <> me;
  return eid;
end $$;
revoke all on function public.log_event(text, uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.log_event(text, uuid, uuid, uuid, jsonb) to authenticated;

create table if not exists public.client_accounts (
  client uuid primary key references public.profiles(id) on delete cascade,
  price numeric, paid numeric
);
alter table public.client_accounts enable row level security;
drop policy if exists ca_admin on public.client_accounts;
create policy ca_admin on public.client_accounts for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
insert into public.client_accounts(client, price, paid)
  select id, client_price, client_paid from public.profiles where client_price is not null or client_paid is not null
  on conflict (client) do nothing;
update public.profiles set client_price = null, client_paid = null where client_price is not null or client_paid is not null;

-- migrate drafts into deliveries
insert into public.deliveries(video, round, link, author, status, created_at, decided_at)
  select v.id, v.round, v.link, coalesce(v.delivered_by, p.editor), 'approved', coalesce(v.delivered_at, v.updated_at, now()), coalesce(v.updated_at, now())
  from public.videos v join public.projects p on p.id = v.project
  where coalesce(v.link,'') <> '' and v.round > 0 and not exists (select 1 from public.deliveries d where d.video = v.id);
insert into public.deliveries(video, round, link, note, author, status, created_at)
  select v.id, coalesce((v.pending->>'round')::int, v.round + 1), v.pending->>'link', coalesce(v.pending->>'note',''), coalesce(v.delivered_by, p.editor), 'pending', coalesce(v.updated_at, now())
  from public.videos v join public.projects p on p.id = v.project
  where v.pending->>'type' = 'draft' and coalesce(v.pending->>'link','') <> '';
update public.videos set pending = null where pending->>'type' = 'draft';

do $$ begin
  begin alter publication supabase_realtime add table public.deliveries; exception when others then null; end;
  begin alter publication supabase_realtime add table public.events; exception when others then null; end;
  begin alter publication supabase_realtime add table public.client_accounts; exception when others then null; end;
end $$;
