alter table public.plaza_posts add column if not exists status text not null default 'published';

update public.plaza_posts
set status = 'published'
where status is null;

alter table public.plaza_posts drop constraint if exists plaza_posts_status_check;

alter table public.plaza_posts
add constraint plaza_posts_status_check
check (status in ('published', 'hidden'));

create index if not exists plaza_posts_status_created_idx
on public.plaza_posts (status, created_at desc);
