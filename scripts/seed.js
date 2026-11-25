// Load the demo data into Supabase. Run supabase/schema.sql in the SQL Editor first.
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config.js';
import { generateSeedData } from '../src/seed-data.js';

if (!config.supabase.url || !config.supabase.serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.');
  process.exit(1);
}

const sb = createClient(config.supabase.url, config.supabase.serviceRoleKey, { auth: { persistSession: false } });
const { depots, inventory, workOrders } = generateSeedData();

async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 200), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} rows`);
}

console.log('Seeding Supabase...');
await upsert('depots', depots, 'id');
await upsert('parts_inventory', inventory, 'depot_id,sku');
await upsert('work_orders', workOrders, 'id');
console.log('Done. Due dates are relative to today, so re-run this before the demo to keep the "overdue" numbers fresh.');
