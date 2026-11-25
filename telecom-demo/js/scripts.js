// The scripts each agent writes in code mode. They really run against the BSS MCP tools,
// and their results are the single source of truth for both lanes' numbers.
(function (g) {
  const TLD = (g.TLD = g.TLD || {});

  const scripts = {
    usage: `const profile = get_customer_profile({ customer_id: input.customer_id });
const { from, to } = profile.usage_history_available;
let months = [];
const lines = profile.lines.map((line) => {
  const byMonth = {};
  for (let cursor = from; cursor; ) {
    const page = get_usage_history({ line_id: line.line_id, from: cursor, to });
    for (const r of page.records) {
      const m = (byMonth[r.date.slice(0, 7)] ??= { data: 0, hotspot: 0, roam: 0 });
      m.data += (r.data_mb + r.hotspot_mb) / 1024;
      m.hotspot += r.hotspot_mb / 1024;
      if (r.roaming) m.roam++;
    }
    cursor = page.next_from;
  }
  months = Object.keys(byMonth).sort();
  const data = months.map((k) => Math.round(byMonth[k].data));
  const allowance = line.current_plan.data_gb_per_line;
  return {
    line_id: line.line_id, user: line.user, device_network: line.device.network,
    current_plan: line.current_plan,
    data_gb: data,
    hotspot_gb: months.map((k) => Math.round(byMonth[k].hotspot)),
    roam_days: months.map((k) => byMonth[k].roam),
    avg_gb: Math.round(data.reduce((a, b) => a + b, 0) / data.length),
    peak_gb: Math.max(...data),
    overage_months: data.filter((d) => d > allowance).length,
  };
});
return { customer_id: profile.customer_id, name: profile.name, segment: profile.segment,
  region: profile.region, currency: profile.currency, broadband: profile.broadband, months, lines };`,

    catalog: `const u = input.usage;
const n = u.lines.length;
const segments = { family: ["family", "combo"], consumer: ["consumer", "combo"], business: ["business"] }[u.segment];
const plans = segments.flatMap((segment) => list_plans({ region: u.region, segment }))
  .filter((p) => !["addon", "broadband"].includes(p.type) && p.max_lines >= n);
const promos = list_promotions({ region: u.region, plan_ids: plans.map((p) => p.id) })
  .filter((pr) => !pr.new_customers_only);
return plans.map((p) => {
  const promo = promos.find((pr) => pr.plan_ids.includes(p.id));
  return { id: p.id, name: p.name, monthly_price: p.monthly_price, promo: promo ? promo.description : null };
});`,

    product: `const u = input.usage;
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const picks = [];
const old4G = u.lines.filter((l) => l.device_network === "4G");
if (old4G.length) {
  const phones = list_devices({ region: u.region, category: "phone" }).filter((d) => d.network === "5G" && d.in_stock);
  const wanted = u.segment === "business" ? "Rugged" : old4G.some((l) => l.avg_gb > 35) ? "Mid-range Phone 128" : "Budget";
  const phone = phones.find((d) => d.name.includes(wanted));
  picks.push({ id: phone.id, name: phone.name, price: phone.price, emi_per_month: phone.emi_per_month,
    bundle_discount: phone.bundle_discount, qty: old4G.length, for_lines: old4G.map((l) => l.user),
    reason: old4G.length + " line(s) still on 4G phones" });
}
const hotspotHeavy = u.lines.some((l) => avg(l.hotspot_gb) > 15);
if (u.broadband || hotspotHeavy) {
  const router = list_devices({ region: u.region, category: "router" }).find((d) => d.id === "DV-RT-5G");
  const why = [];
  if (hotspotHeavy) why.push("heavy hotspot use (" + Math.round(Math.max(...u.lines.map((l) => avg(l.hotspot_gb)))) + " GB/month)");
  if (u.broadband) why.push("a separate home broadband bill that can move into a fibre bundle");
  picks.push({ id: router.id, name: router.name, price: router.price, emi_per_month: router.emi_per_month,
    bundle_discount: router.bundle_discount, qty: 1, for_lines: ["Home"],
    reason: why.join(" and ").replace(/^./, (c) => c.toUpperCase()) });
}
const roamDays = u.lines.reduce((s, l) => s + l.roam_days.reduce((a, b) => a + b, 0), 0);
if (u.segment === "business" && roamDays > 20) {
  const fleet = list_devices({ region: u.region, category: "hotspot" }).find((d) => d.id === "DV-HS-FLEET");
  picks.push({ id: fleet.id, name: fleet.name, price: fleet.price, emi_per_month: fleet.emi_per_month,
    bundle_discount: fleet.bundle_discount, qty: 1, for_lines: ["Fleet"], reason: roamDays + " roaming days a year on cross-border routes" });
}
return picks;`,

    savings: `const u = input.usage;
const n = u.lines.length;
const ids = input.shortlist.map((p) => p.id);
const plans = list_plans({ region: u.region }).filter((p) => ids.includes(p.id));
const promos = list_promotions({ region: u.region, plan_ids: ids });
const bb = u.broadband ? u.broadband.monthly_price : 0;
// Next 12 months follow the same pattern as the same calendar months last year.
const future = Array.from({ length: 12 }, (_, i) => (i + 1) % 12);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const packs = (days, p) => Math.ceil(days / p.roaming_pack_days) * p.roaming_pack_price;

function currentCost(h) {
  let cost = bb;
  for (const l of u.lines) {
    const p = l.current_plan;
    cost += p.monthly_price + Math.max(0, l.data_gb[h] - p.data_gb_per_line) * p.overage_per_gb;
    if (l.roam_days[h]) cost += packs(l.roam_days[h], p);
  }
  return cost;
}

function planCosts(p) {
  const promo = promos.find((pr) => pr.plan_ids.includes(p.id) && !pr.new_customers_only);
  let roamLeft = p.roaming_days_per_year * (p.lines_included === 1 && p.max_lines > 1 ? n : 1);
  let overMonths = 0;
  const costs = future.map((h, i) => {
    let cost = p.monthly_price + Math.max(0, n - p.lines_included) * p.extra_line_price;
    const data = u.lines.map((l) => l.data_gb[h]);
    let over = 0;
    if (!p.unlimited) over = p.data_shared ? Math.max(0, sum(data) - p.shared_gb) : sum(data.map((d) => Math.max(0, d - p.data_gb_per_line)));
    if (over > 0) overMonths++;
    cost += over * p.overage_per_gb;
    const hotspot = sum(u.lines.map((l) => l.hotspot_gb[h]));
    if (hotspot > p.hotspot_gb) cost += p.hotspot_pack_price; // hotspot booster pack
    for (const l of u.lines) {
      const days = l.roam_days[h];
      const covered = Math.min(days, roamLeft);
      roamLeft -= covered;
      if (days > covered) cost += packs(days - covered, p);
    }
    if (!p.fibre_mbps) cost += bb;
    if (promo && i < promo.months) cost -= promo.type === "percent" ? Math.round(p.monthly_price * promo.value / 100) : promo.value;
    return cost;
  });
  return { costs, overMonths, promo: promo ? promo.description : null };
}

const now = future.map(currentCost);
const cur6 = sum(now.slice(0, 6)), cur12 = sum(now);
const ranked = plans.map((p) => {
  const r = planCosts(p);
  const c6 = sum(r.costs.slice(0, 6)), c12 = sum(r.costs);
  return { id: p.id, name: p.name, list_price: p.monthly_price, avg_monthly: Math.round(c12 / 12),
    cost_6: c6, cost_12: c12, savings_6: cur6 - c6, savings_12: cur12 - c12,
    fits_usage: r.overMonths <= 1, overage_months: r.overMonths, promo: r.promo,
    fibre: p.fibre_mbps ? (p.fibre_mbps >= 1000 ? "1 Gbps" : p.fibre_mbps + " Mbps") : null };
}).filter((r) => r.fits_usage).sort((a, b) => b.savings_12 - a.savings_12);
return { evaluated: plans.length, current: { avg_monthly: Math.round(cur12 / 12), cost_6: cur6, cost_12: cur12 },
  top3: ranked.slice(0, 3) };`,
  };

  const API = ['get_customer_profile', 'get_usage_history', 'list_plans', 'list_promotions', 'list_devices'];

  /** Run one agent's script. onToolCall(name, args, bytes) fires for every MCP call made inside. */
  function runScript(agent, input, onToolCall) {
    const api = {};
    for (const name of API) {
      api[name] = (args) => {
        const text = TLD.mcp.call(name, args);
        onToolCall && onToolCall(name, args, text.length);
        return JSON.parse(text);
      };
    }
    const fn = new Function(...API, 'input', `"use strict";\n${scripts[agent]}`);
    return fn(...API.map((n) => api[n]), input);
  }

  TLD.scripts = scripts;
  TLD.runScript = runScript;
})(typeof window !== 'undefined' ? window : globalThis);
