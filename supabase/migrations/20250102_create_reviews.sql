-- ─── Таблица отзывов ───
create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 50),
  rating       smallint not null check (rating between 1 and 5),
  text         text not null check (char_length(text) between 10 and 1000),
  is_published boolean not null default false,
  source       text default 'website',
  user_agent   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index idx_reviews_published  on public.reviews (is_published, created_at desc);
create index idx_reviews_created_at on public.reviews (created_at desc);

create trigger trg_reviews_updated_at
  before update on public.reviews
  for each row execute function public.handle_updated_at();

alter table public.reviews enable row level security;

create policy "Public can read published reviews"
  on public.reviews for select
  to anon, authenticated
  using (is_published = true);

create policy "Service role full access"
  on public.reviews for all
  to service_role
  using (true)
  with check (true);