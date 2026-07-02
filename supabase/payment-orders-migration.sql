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
alter table public.payment_orders
add constraint payment_orders_status_check
check (status in ('pending', 'paid', 'failed', 'closed'));

create index if not exists payment_orders_user_created_idx
on public.payment_orders (user_id, created_at desc);

create index if not exists payment_orders_status_idx
on public.payment_orders (status);

alter table public.payment_orders enable row level security;

drop policy if exists "Users can read own payment orders" on public.payment_orders;

create policy "Users can read own payment orders"
on public.payment_orders
for select
using (auth.uid() = user_id);
