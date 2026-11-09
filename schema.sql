-- Cammio Studio Hub — Supabase schema
-- Paste this whole file into Supabase → SQL Editor → Run (once).

create extension if not exists pgcrypto;

-- ========== tables ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  name text not null default '',
  role text not null default 'pending' check (role in ('admin','editor','client','pending')),
  avatar_url text,
  title text default '',
  lang text default 'ar',
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  type text not null default 'tReels',
  drive text not null,
  ref text default '',
  notes text default '',
  count int not null default 1 check (count between 1 and 60),
  cad text not null default 'cOnce',
  first timestamptz not null,
  status text not null default 'pending' check (status in ('pending','active','archived')),
  editor uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  project uuid not null references public.projects(id) on delete cascade,
  n int not null,
  due timestamptz not null,
  stage int not null default 0 check (stage between 0 and 7),   -- editor's real stage
  pub int not null default 0 check (pub between 0 and 7),       -- stage the client sees (approved by admin)
  round int not null default 0,
  rs text check (rs in ('awaiting','notes','revising')),
  link text default '',
  pending jsonb,                                                -- update waiting for admin approval
  is_new boolean default false,
  updated_at timestamptz default now()
);

create table if not exists public.notifs (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ar text not null,
  en text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- ========== helpers ==========
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

-- new auth user -> profile (role always starts as 'pending'; admin sets it)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, name)
  values (new.id,
          lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1))),
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- only admins can change roles / usernames
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.my_role(),'') <> 'admin' and auth.uid() is not null then
    if new.role is distinct from old.role or new.username is distinct from old.username then
      raise exception 'not allowed';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- a new project creates its video rows
create or replace function public.gen_videos() returns trigger
language plpgsql security definer set search_path = public as $$
declare step int; i int;
begin
  step := case new.cad when 'cDaily' then 1 when 'c2' then 2 when 'cWeek' then 7 else 0 end;
  for i in 1..new.count loop
    insert into public.videos (project, n, due)
    values (new.id, i, new.first + make_interval(days => (i-1)*step));
  end loop;
  return new;
end $$;
drop trigger if exists gen_videos on public.projects;
create trigger gen_videos after insert on public.projects
  for each row execute function public.gen_videos();

-- who may change what on a video
create or replace function public.guard_video() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := coalesce(public.my_role(),''); p public.projects;
begin
  if auth.uid() is null or r = 'admin' then new.updated_at := now(); return new; end if;
  select * into p from public.projects where id = new.project;
  if r = 'editor' and p.editor = auth.uid() then
    if new.pub is distinct from old.pub or new.round is distinct from old.round
       or new.link is distinct from old.link or new.due is distinct from old.due then
      raise exception 'editor cannot publish';
    end if;
    if new.rs is distinct from old.rs and not (old.rs = 'notes' and new.rs = 'revising') then
      raise exception 'not allowed';
    end if;
  elsif r = 'client' and p.client = auth.uid() then
    if old.pub = 6 and old.rs = 'awaiting' and new.rs = 'notes'
       and new.stage = old.stage and new.pub = old.pub then null;               -- notes done
    elsif old.pub = 6 and old.rs = 'awaiting' and new.stage = 7 and new.pub = 7
       and new.rs is null then null;                                           -- approve final
    else raise exception 'not allowed'; end if;
    if new.round is distinct from old.round or new.link is distinct from old.link
       or new.pending is distinct from old.pending or new.due is distinct from old.due then
      raise exception 'not allowed';
    end if;
  else
    raise exception 'not allowed';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_video on public.videos;
create trigger guard_video before update on public.videos
  for each row execute function public.guard_video();

-- send a notification to every admin (clients can't see admin profiles)
create or replace function public.notify_admins(p_ar text, p_en text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifs (user_id, ar, en)
  select id, p_ar, p_en from public.profiles where role = 'admin'
    and coalesce(public.my_role(),'') in ('admin','editor','client');
$$;
grant execute on function public.notify_admins(text,text) to authenticated;

-- ========== row level security ==========
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.videos   enable row level security;
alter table public.notifs   enable row level security;

drop policy if exists p_sel on public.profiles;
create policy p_sel on public.profiles for select to authenticated using (
  id = auth.uid() or public.my_role() in ('admin','editor')
  or exists (select 1 from public.projects pr where pr.client = auth.uid() and pr.editor = profiles.id)
);
drop policy if exists p_upd on public.profiles;
create policy p_upd on public.profiles for update to authenticated
  using (id = auth.uid() or public.my_role() = 'admin');

drop policy if exists pr_sel on public.projects;
create policy pr_sel on public.projects for select to authenticated using (
  public.my_role() = 'admin' or client = auth.uid() or editor = auth.uid());
drop policy if exists pr_ins on public.projects;
create policy pr_ins on public.projects for insert to authenticated with check (
  client = auth.uid() and public.my_role() = 'client' and status = 'pending' and editor is null);
drop policy if exists pr_upd on public.projects;
create policy pr_upd on public.projects for update to authenticated using (public.my_role() = 'admin');
drop policy if exists pr_del on public.projects;
create policy pr_del on public.projects for delete to authenticated using (public.my_role() = 'admin');

drop policy if exists v_sel on public.videos;
create policy v_sel on public.videos for select to authenticated using (
  exists (select 1 from public.projects pr where pr.id = videos.project
          and (public.my_role() = 'admin' or pr.client = auth.uid() or pr.editor = auth.uid())));
drop policy if exists v_upd on public.videos;
create policy v_upd on public.videos for update to authenticated using (
  exists (select 1 from public.projects pr where pr.id = videos.project
          and (public.my_role() = 'admin' or pr.client = auth.uid() or pr.editor = auth.uid())));

drop policy if exists n_sel on public.notifs;
create policy n_sel on public.notifs for select to authenticated using (user_id = auth.uid());
drop policy if exists n_upd on public.notifs;
create policy n_upd on public.notifs for update to authenticated using (user_id = auth.uid());
drop policy if exists n_ins on public.notifs;
create policy n_ins on public.notifs for insert to authenticated
  with check (public.my_role() in ('admin','editor','client'));

-- ========== realtime ==========
do $$ begin
  begin alter publication supabase_realtime add table public.projects; exception when others then null; end;
  begin alter publication supabase_realtime add table public.videos;   exception when others then null; end;
  begin alter publication supabase_realtime add table public.notifs;   exception when others then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when others then null; end;
end $$;

-- ========== avatars storage ==========
insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
  on conflict (id) do nothing;
drop policy if exists av_read on storage.objects;
create policy av_read on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists av_write on storage.objects;
create policy av_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists av_update on storage.objects;
create policy av_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ========== make yourself admin ==========
-- 1) Authentication → Users → Add user: email  cammio@users.cammio.app , a password, tick "Auto confirm".
-- 2) Then run:
-- update public.profiles set role = 'admin', name = 'Cammio' where username = 'cammio';
