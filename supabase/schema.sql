create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('generations', 'generations', true)
on conflict (id) do update set public = excluded.public;

create table if not exists public.profiles (
  id uuid primary key,
  email text,
  display_name text,
  avatar_url text,
  credits integer not null default 100 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists credits integer not null default 100;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
update public.profiles set email = 'guest-' || id::text || '@corgi-ai.local' where email is null;
update public.profiles set display_name = '柯基新朋友' where display_name is null;
alter table public.profiles alter column email set not null;
alter table public.profiles drop constraint if exists profiles_credits_check;
alter table public.profiles add constraint profiles_credits_check check (credits >= 0);

create table if not exists public.templates (
  id text primary key,
  name text not null,
  description text not null,
  cover_url text,
  prompt text not null,
  cost integer not null check (cost > 0),
  size text not null default '1024x1024',
  is_active boolean not null default true,
  sort_order integer not null default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generations drop constraint if exists generations_template_id_fkey;
alter table public.templates alter column id type text using id::text;
alter table public.templates add column if not exists description text;
alter table public.templates add column if not exists cover_url text;
alter table public.templates add column if not exists prompt text;
alter table public.templates add column if not exists cost integer not null default 1;
alter table public.templates add column if not exists size text not null default '1024x1024';
alter table public.templates add column if not exists is_active boolean not null default true;
alter table public.templates add column if not exists sort_order integer not null default 999;
alter table public.templates add column if not exists created_at timestamptz not null default now();
alter table public.templates add column if not exists updated_at timestamptz not null default now();
update public.templates set is_active = true where is_active is null;
update public.templates set sort_order = 999 where sort_order is null;

create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value, updated_at)
values (
  'public_notice',
  '生成图片请遵守平台规则，请勿上传违规内容。作品生成或充值问题，可在个人中心联系管理员 KOLOLIDO。',
  now()
)
on conflict (key) do nothing;

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  template_id text not null,
  template_name text not null,
  prompt text not null,
  cost integer not null check (cost > 0),
  ratio text not null default '1:1',
  model text not null default 'gpt-image-2',
  ai_task_id text,
  status text not null default 'completed',
  input_image_url text,
  output_image_url text not null,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.generations add column if not exists user_id uuid;
alter table public.generations add column if not exists template_id text;
alter table public.generations add column if not exists template_name text;
alter table public.generations add column if not exists prompt text;
alter table public.generations add column if not exists cost integer not null default 1;
alter table public.generations add column if not exists ratio text not null default '1:1';
alter table public.generations add column if not exists model text not null default 'gpt-image-2';
alter table public.generations add column if not exists ai_task_id text;
alter table public.generations add column if not exists status text not null default 'completed';
alter table public.generations add column if not exists input_image_url text;
alter table public.generations add column if not exists output_image_url text;
alter table public.generations add column if not exists error_message text;
alter table public.generations add column if not exists created_at timestamptz not null default now();
alter table public.generations alter column template_id type text using template_id::text;
update public.generations set template_id = coalesce(template_id, 'legacy') where template_id is null;
update public.generations set template_name = coalesce(template_name, '旧记录') where template_name is null;
update public.generations set prompt = coalesce(prompt, '') where prompt is null;
update public.generations set output_image_url = coalesce(output_image_url, '') where output_image_url is null;
alter table public.generations alter column user_id set not null;
alter table public.generations alter column template_id set not null;
alter table public.generations alter column template_name set not null;
alter table public.generations alter column prompt set not null;
alter table public.generations alter column output_image_url set not null;
alter table public.generations drop constraint if exists generations_cost_check;
alter table public.generations add constraint generations_cost_check check (cost > 0);
alter table public.generations drop constraint if exists generations_status_check;
alter table public.generations add constraint generations_status_check check (status in ('completed', 'failed'));
alter table public.generations drop constraint if exists generations_user_id_fkey;
alter table public.generations
add constraint generations_user_id_fkey
foreign key (user_id) references public.profiles(id) on delete cascade;

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('grant', 'spend', 'refund', 'adjust')),
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  generation_id uuid references public.generations(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists generations_user_created_idx on public.generations (user_id, created_at desc);
create index if not exists credit_transactions_user_created_idx on public.credit_transactions (user_id, created_at desc);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'xunhupay',
  package_id text not null,
  amount_yuan numeric(10,2) not null,
  credits integer not null check (credits > 0),
  status text not null default 'pending',
  provider_order_id text,
  pay_url text,
  raw_notify jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_orders add column if not exists provider text not null default 'xunhupay';
alter table public.payment_orders add column if not exists package_id text not null default 'manual';
alter table public.payment_orders add column if not exists amount_yuan numeric(10,2) not null default 0;
alter table public.payment_orders add column if not exists credits integer not null default 1;
alter table public.payment_orders add column if not exists status text not null default 'pending';
alter table public.payment_orders add column if not exists provider_order_id text;
alter table public.payment_orders add column if not exists pay_url text;
alter table public.payment_orders add column if not exists raw_notify jsonb;
alter table public.payment_orders add column if not exists paid_at timestamptz;
alter table public.payment_orders add column if not exists created_at timestamptz not null default now();
alter table public.payment_orders add column if not exists updated_at timestamptz not null default now();
alter table public.payment_orders drop constraint if exists payment_orders_status_check;
alter table public.payment_orders add constraint payment_orders_status_check check (status in ('pending', 'paid', 'failed', 'closed'));

create index if not exists payment_orders_user_created_idx on public.payment_orders (user_id, created_at desc);
create index if not exists payment_orders_status_idx on public.payment_orders (status);

create table if not exists public.plaza_posts (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (generation_id)
);

alter table public.plaza_posts add column if not exists status text not null default 'published';
update public.plaza_posts set status = 'published' where status is null;
alter table public.plaza_posts drop constraint if exists plaza_posts_status_check;
alter table public.plaza_posts add constraint plaza_posts_status_check check (status in ('published', 'hidden'));

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
create index if not exists plaza_posts_status_created_idx on public.plaza_posts (status, created_at desc);
create index if not exists plaza_posts_user_created_idx on public.plaza_posts (user_id, created_at desc);
create index if not exists likes_post_idx on public.likes (post_id);
create index if not exists favorites_post_idx on public.favorites (post_id);

alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.payment_orders enable row level security;
alter table public.plaza_posts enable row level security;
alter table public.likes enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can read own generations" on public.generations;
drop policy if exists "Users can read own credit transactions" on public.credit_transactions;
drop policy if exists "Users can read own payment orders" on public.payment_orders;
drop policy if exists "Anyone can read plaza posts" on public.plaza_posts;
drop policy if exists "Users can create own plaza posts" on public.plaza_posts;
drop policy if exists "Users can read likes" on public.likes;
drop policy if exists "Users can create own likes" on public.likes;
drop policy if exists "Users can delete own likes" on public.likes;
drop policy if exists "Users can read favorites" on public.favorites;
drop policy if exists "Users can create own favorites" on public.favorites;
drop policy if exists "Users can delete own favorites" on public.favorites;

create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can read own generations" on public.generations for select using (auth.uid() = user_id);
create policy "Users can read own credit transactions" on public.credit_transactions for select using (auth.uid() = user_id);
create policy "Users can read own payment orders" on public.payment_orders for select using (auth.uid() = user_id);
create policy "Anyone can read plaza posts" on public.plaza_posts for select using (true);
create policy "Users can create own plaza posts" on public.plaza_posts for insert with check (auth.uid() = user_id);
create policy "Users can read likes" on public.likes for select using (true);
create policy "Users can create own likes" on public.likes for insert with check (auth.uid() = user_id);
create policy "Users can delete own likes" on public.likes for delete using (auth.uid() = user_id);
create policy "Users can read favorites" on public.favorites for select using (true);
create policy "Users can create own favorites" on public.favorites for insert with check (auth.uid() = user_id);
create policy "Users can delete own favorites" on public.favorites for delete using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, credits)
  values (
    new.id,
    coalesce(new.email, 'guest-' || new.id::text || '@corgi-ai.local'),
    coalesce(new.raw_user_meta_data->>'display_name', '柯基新朋友'),
    new.raw_user_meta_data->>'avatar_url',
    100
  )
  on conflict (id) do nothing;

  insert into public.credit_transactions (user_id, type, amount, balance_after, note)
  values (new.id, 'grant', 100, 100, '新用户赠送');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.spend_credits_and_create_generation(
  p_user_id uuid,
  p_template_id text,
  p_template_name text,
  p_prompt text,
  p_cost integer,
  p_input_image_url text,
  p_output_image_url text,
  p_ratio text default '1:1',
  p_model text default 'gpt-image-2',
  p_ai_task_id text default null
)
returns table (id uuid, credits_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_credits integer;
  created_generation_id uuid;
begin
  update public.profiles
  set credits = credits - p_cost,
      updated_at = now()
  where profiles.id = p_user_id
    and credits >= p_cost
  returning credits into next_credits;

  if next_credits is null then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.generations (
    user_id,
    template_id,
    template_name,
    prompt,
    cost,
    ratio,
    model,
    ai_task_id,
    status,
    input_image_url,
    output_image_url
  )
  values (
    p_user_id,
    p_template_id,
    p_template_name,
    p_prompt,
    p_cost,
    p_ratio,
    p_model,
    p_ai_task_id,
    'completed',
    p_input_image_url,
    p_output_image_url
  )
  returning generations.id into created_generation_id;

  insert into public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    generation_id,
    note
  )
  values (
    p_user_id,
    'spend',
    -p_cost,
    next_credits,
    created_generation_id,
    '图片生成：' || p_template_name
  );

  return query select created_generation_id, next_credits;
end;
$$;

grant execute on function public.spend_credits_and_create_generation(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text
) to service_role;

insert into public.templates (id, name, description, cover_url, prompt, cost, size, is_active, sort_order, updated_at)
values
  ('2d672f5b-cd1d-4a52-90e0-7cb1227119cc', '治愈插画', '温暖治愈风格', null, '将照片转换成温暖、柔和、治愈系插画风格，保留人物和宠物特征，画面干净友好，色彩柔和。', 30, '1024x1024', true, 10, now()),
  ('8b2c63cc-e51b-4cc5-a479-ecff6a81c5b8', 'Color Walk冰箱贴', '立体冰箱贴风格', null, '将图片主体转换为Color Walk风格立体冰箱贴，Q版可爱，柔和光影，立体质感，干净背景。', 25, '1024x1024', true, 20, now()),
  ('90cfc826-8959-46bd-afe7-b42c2fb69aa5', '手绘Plog', '生活记录插画', null, '将照片转换成温暖治愈的手绘Plog风格插画，柔和色调，生活感，适合小红书分享。', 35, '1024x1024', true, 30, now()),
  ('9df618c4-3977-4967-90e1-c2587ef10f37', '丑萌涂鸦插画', '爆款手绘风', null, '将照片转换成丑萌涂鸦插画风格，保留人物主体特征，白色背景，线条随意，童趣可爱，适合头像和社交媒体分享。', 35, '1024x1024', true, 40, now()),
  ('c7b28892-74de-49e5-bf31-bd1398c552f8', 'City Pop插画', '日系复古插画', null, '将照片转换为日系City Pop插画风格，鲜艳色彩，复古都市氛围，霓虹灯元素。', 25, '1024x1024', true, 50, now()),
  ('e405d0c7-091d-4516-b821-7567c84029cc', '波普风格插画', '个性头像', null, '将照片转换成波普艺术风格插画，鲜艳配色，大胆图形设计，适合个性头像。', 35, '1024x1024', true, 60, now()),
  ('custom-image', '自定义生成', '输入自己的风格需求', null, '根据用户自定义要求生成图片，保留参考图主体的关键特征，画面健康、日常、友好。', 30, '1024x1024', true, 70, now())
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  cover_url = excluded.cover_url,
  prompt = excluded.prompt,
  cost = excluded.cost,
  size = excluded.size,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();
