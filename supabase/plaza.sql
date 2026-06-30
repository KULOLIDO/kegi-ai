create table if not exists public.plaza_posts (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (generation_id)
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.plaza_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.plaza_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists plaza_posts_created_idx on public.plaza_posts (created_at desc);
create index if not exists plaza_posts_user_created_idx on public.plaza_posts (user_id, created_at desc);
create index if not exists likes_post_idx on public.likes (post_id);
create index if not exists favorites_post_idx on public.favorites (post_id);

alter table public.plaza_posts enable row level security;
alter table public.likes enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "Anyone can read plaza posts" on public.plaza_posts;
drop policy if exists "Users can create own plaza posts" on public.plaza_posts;
drop policy if exists "Users can read likes" on public.likes;
drop policy if exists "Users can create own likes" on public.likes;
drop policy if exists "Users can delete own likes" on public.likes;
drop policy if exists "Users can read favorites" on public.favorites;
drop policy if exists "Users can create own favorites" on public.favorites;
drop policy if exists "Users can delete own favorites" on public.favorites;

create policy "Anyone can read plaza posts" on public.plaza_posts
for select using (true);

create policy "Users can create own plaza posts" on public.plaza_posts
for insert with check (auth.uid() = user_id);

create policy "Users can read likes" on public.likes
for select using (true);

create policy "Users can create own likes" on public.likes
for insert with check (auth.uid() = user_id);

create policy "Users can delete own likes" on public.likes
for delete using (auth.uid() = user_id);

create policy "Users can read favorites" on public.favorites
for select using (true);

create policy "Users can create own favorites" on public.favorites
for insert with check (auth.uid() = user_id);

create policy "Users can delete own favorites" on public.favorites
for delete using (auth.uid() = user_id);
