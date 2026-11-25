// "Telecom BSS" MCP server: the tool list both modes see, and what each tool returns.
(function (g) {
  const TLD = (g.TLD = g.TLD || {});
  const db = () => TLD.db;
  const PAGE_DAYS = 184; // max days of usage records per get_usage_history call (half a year)

  const tools = [
    {
      name: 'get_customer_profile',
      description: 'Get a customer account: region (IN or MY), currency, segment, lines (with current plan and device), home broadband and contract details.',
      inputSchema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: ['customer_id'] },
    },
    {
      name: 'get_usage_history',
      description: 'Daily usage records for one line between two dates (max 184 days per call). Each record: date, data_mb, hotspot_mb, voice_min, roaming, roaming_country. Returns { line_id, from, to, records, next_from }.',
      inputSchema: { type: 'object', properties: { line_id: { type: 'string' }, from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['line_id', 'from', 'to'] },
    },
    {
      name: 'list_plans',
      description: 'List tariff plans for a region with full details: monthly price in the local currency (₹ for IN, RM for MY), lines, data allowances, fair use, hotspot, roaming, fibre speed, OTT, contract and terms.',
      inputSchema: { type: 'object', properties: { region: { type: 'string', enum: ['IN', 'MY'] }, segment: { type: 'string', enum: ['consumer', 'family', 'combo', 'business'] }, include_unavailable: { type: 'boolean' } } },
    },
    {
      name: 'list_promotions',
      description: 'Current promotions: which plans they apply to, discount type (percent or flat amount in local currency), value and number of months.',
      inputSchema: { type: 'object', properties: { region: { type: 'string', enum: ['IN', 'MY'] }, plan_ids: { type: 'array', items: { type: 'string' } } } },
    },
    {
      name: 'list_devices',
      description: 'Devices and products for a region (phones, routers, hotspots, OTT packs) with price in local currency, EMI, specs and bundle discounts per plan type.',
      inputSchema: { type: 'object', properties: { region: { type: 'string', enum: ['IN', 'MY'] }, category: { type: 'string', enum: ['phone', 'router', 'hotspot', 'ott', 'wearable', 'tablet'] } } },
    },
  ];

  const impl = {
    get_customer_profile({ customer_id }) {
      const c = db().customers.find((x) => x.customer_id === customer_id);
      if (!c) throw new Error(`Customer ${customer_id} not found`);
      const { lines, ...rest } = c;
      return {
        ...rest,
        lines: lines.map(({ target, ...l }) => ({ ...l, status: 'Active', esim: l.device.network === '5G', current_plan: planBrief(l.current_plan_id) })),
        usage_history_available: { from: db().histStart, to: db().histEnd },
      };
    },
    get_usage_history({ line_id, from, to }) {
      const all = db().usage[line_id];
      if (!all) throw new Error(`Line ${line_id} not found`);
      const maxTo = new Date(Date.parse(from) + (PAGE_DAYS - 1) * 86400000).toISOString().slice(0, 10);
      const end = to < maxTo ? to : maxTo;
      const records = all.filter((r) => r.date >= from && r.date <= end);
      const next = end < to ? new Date(Date.parse(end) + 86400000).toISOString().slice(0, 10) : null;
      return { line_id, from, to: end, records, next_from: next };
    },
    list_plans({ region, segment, include_unavailable } = {}) {
      return db().plans.filter((p) => (include_unavailable || p.available) && (!region || p.region === region) && (!segment || p.segment === segment));
    },
    list_promotions({ region, plan_ids } = {}) {
      return db().promotions.filter((pr) => (!region || pr.region === region) && (!plan_ids || pr.plan_ids.some((id) => plan_ids.includes(id))));
    },
    list_devices({ region, category } = {}) {
      return db().devices.filter((d) => (!region || d.region === region) && (!category || d.category === category));
    },
  };

  function planBrief(id) {
    const p = db().plans.find((x) => x.id === id);
    return p && { id: p.id, name: p.name, monthly_price: p.monthly_price, data_gb_per_line: p.data_gb_per_line, overage_per_gb: p.overage_per_gb, hotspot_gb: p.hotspot_gb, roaming_pack_price: p.roaming_pack_price, roaming_pack_days: p.roaming_pack_days };
  }

  /** Call a tool. Returns the JSON text an MCP server would send back. */
  function call(name, args) {
    if (!impl[name]) throw new Error(`Unknown tool ${name}`);
    return JSON.stringify(impl[name](args || {}));
  }

  TLD.mcp = { tools, call };
})(typeof window !== 'undefined' ? window : globalThis);
