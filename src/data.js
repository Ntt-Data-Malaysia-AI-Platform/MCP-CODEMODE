// Data layer: Supabase when configured, otherwise the same seed data held in memory.
import { createClient } from '@supabase/supabase-js';
import { config, dataSource } from './config.js';
import { generateSeedData } from './seed-data.js';

const today = () => new Date().toISOString().slice(0, 10);

function isOverdue(wo, t = today()) {
  return wo.status !== 'closed' && wo.due_date < t;
}

function withDerived(wo) {
  const t = today();
  const days = Math.floor((Date.parse(t) - Date.parse(wo.due_date)) / 86400000);
  return { ...wo, is_overdue: isOverdue(wo, t), days_overdue: isOverdue(wo, t) ? days : 0 };
}

// ---------------------------------------------------------------- memory
function memoryStore() {
  const seed = generateSeedData();
  const runs = [];
  return {
    source: 'memory',
    async listWorkOrders({ region, status, overdue_only, priority, limit = 50, offset = 0 } = {}) {
      let rows = seed.workOrders;
      if (region) rows = rows.filter((w) => w.region.toLowerCase() === String(region).toLowerCase());
      if (status) rows = rows.filter((w) => w.status === status);
      if (priority) rows = rows.filter((w) => w.priority === priority);
      if (overdue_only) rows = rows.filter((w) => isOverdue(w));
      rows = [...rows].sort((a, b) => a.due_date.localeCompare(b.due_date));
      const total = rows.length;
      return { total, offset, work_orders: rows.slice(offset, offset + limit).map(withDerived) };
    },
    async getWorkOrder(id) {
      const wo = seed.workOrders.find((w) => w.id === id);
      return wo ? withDerived(wo) : null;
    },
    async getPartStock(sku, depot_id) {
      return seed.inventory.find((i) => i.sku === sku && i.depot_id === depot_id) || null;
    },
    async listDepots() {
      return seed.depots;
    },
    async saveRun(run) {
      const row = { id: `local-${runs.length + 1}`, created_at: new Date().toISOString(), ...run };
      runs.unshift(row);
      return row;
    },
    async listRuns(limit = 20) {
      return runs.slice(0, limit);
    },
  };
}

// -------------------------------------------------------------- supabase
function supabaseStore() {
  const sb = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false },
  });
  const check = ({ data, error }) => {
    if (error) throw new Error(`Supabase: ${error.message}`);
    return data;
  };
  return {
    source: 'supabase',
    client: sb,
    async listWorkOrders({ region, status, overdue_only, priority, limit = 50, offset = 0 } = {}) {
      let q = sb.from('work_orders').select('*', { count: 'exact' });
      if (region) q = q.ilike('region', region);
      if (status) q = q.eq('status', status);
      if (priority) q = q.eq('priority', priority);
      if (overdue_only) q = q.neq('status', 'closed').lt('due_date', today());
      const res = await q.order('due_date', { ascending: true }).range(offset, offset + limit - 1);
      const rows = check(res);
      return { total: res.count ?? rows.length, offset, work_orders: rows.map(withDerived) };
    },
    async getWorkOrder(id) {
      const row = check(await sb.from('work_orders').select('*').eq('id', id).maybeSingle());
      return row ? withDerived(row) : null;
    },
    async getPartStock(sku, depot_id) {
      return check(
        await sb.from('parts_inventory').select('*').eq('sku', sku).eq('depot_id', depot_id).maybeSingle(),
      );
    },
    async listDepots() {
      return check(await sb.from('depots').select('*').order('id'));
    },
    async saveRun(run) {
      return check(await sb.from('demo_runs').insert(run).select().single());
    },
    async listRuns(limit = 20) {
      return check(
        await sb
          .from('demo_runs')
          .select('id,created_at,mode,scenario,prompt,model,llm_mode,llm_calls,tool_calls,input_tokens,cached_tokens,output_tokens,thinking_tokens,total_tokens,context_bytes,sandbox_bytes,duration_ms,est_cost_usd')
          .order('created_at', { ascending: false })
          .limit(limit),
      );
    },
  };
}

export const store = dataSource === 'supabase' ? supabaseStore() : memoryStore();
