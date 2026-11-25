-- Token Lens demo schema. Paste into Supabase -> SQL Editor and run once,
-- then run `npm run seed` to load the demo data.

create table if not exists depots (
  id          text primary key,
  name        text not null,
  region      text not null,
  address     text
);

create table if not exists parts_inventory (
  depot_id       text not null references depots(id) on delete cascade,
  sku            text not null,
  part_name      text not null,
  qty_on_hand    int  not null default 0,
  reorder_level  int  not null default 2,
  bin_location   text,
  last_counted   date,
  primary key (depot_id, sku)
);

create table if not exists work_orders (
  id              text primary key,
  title           text not null,
  description     text,
  region          text not null,
  depot_id        text references depots(id),
  customer        text,
  site_address    text,
  site_contact    text,
  asset_id        text,
  asset_model     text,
  priority        text not null check (priority in ('low','medium','high','critical')),
  status          text not null check (status in ('open','in_progress','closed')),
  assigned_tech   text,
  due_date        date not null,
  created_at      timestamptz not null default now(),
  required_parts  jsonb not null default '[]'::jsonb,
  notes           text
);

create index if not exists work_orders_region_status_idx on work_orders (region, status, due_date);

-- One row per demo run, so you can compare runs over time.
create table if not exists demo_runs (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  mode             text not null check (mode in ('direct','code')),
  scenario         text,
  prompt           text not null,
  model            text,
  llm_mode         text,              -- 'live' or 'simulated'
  llm_calls        int,
  tool_calls       int,
  input_tokens     int,
  cached_tokens    int,
  output_tokens    int,
  thinking_tokens  int,
  total_tokens     int,
  context_bytes    int,               -- tool-result bytes that went into the model's context
  sandbox_bytes    int,               -- tool-result bytes that stayed in the sandbox
  duration_ms      int,
  est_cost_usd     numeric(12,6),
  answer           text,
  steps            jsonb
);

-- Lock everything down: only the server (service role key) can read or write.
alter table depots          enable row level security;
alter table parts_inventory enable row level security;
alter table work_orders     enable row level security;
alter table demo_runs       enable row level security;

-- New Supabase projects may not expose new tables to the Data API automatically.
-- Grant access to the server's role only (anon / authenticated get nothing).
grant usage on schema public to service_role;
grant select, insert, update, delete on depots, parts_inventory, work_orders, demo_runs to service_role;
