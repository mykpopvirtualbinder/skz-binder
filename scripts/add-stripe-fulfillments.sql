-- Idempotencia para webhook Stripe (evita doble acreditación si Stripe reenvía el evento).
create table if not exists public.stripe_fulfillments (
  session_id text primary key,
  user_id uuid not null,
  product_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists stripe_fulfillments_user_id_idx on public.stripe_fulfillments (user_id);

alter table public.stripe_fulfillments enable row level security;
