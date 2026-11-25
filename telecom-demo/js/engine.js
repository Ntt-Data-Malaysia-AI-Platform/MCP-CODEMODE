// Runs the five agents in either mode and streams every LLM call and tool call.
// Token counts are measured from what each mode sends to the model (characters ÷ 4),
// using the real tool payloads from the BSS MCP server.
(function (g) {
  const TLD = (g.TLD = g.TLD || {});

  const PRICE = { inPerM: 0.375, outPerM: 1.88 }; // USD per 1M tokens, Gemini 3.8 Flash direct from Google (2026); also shown in index.html
  const tok = (chars) => Math.ceil(chars / 4);
  // Money in the customer's currency: ₹ (India) or RM (Malaysia).
  const fmtMoney = (n, cur = 'INR') => (cur === 'MYR' ? 'RM' + Math.round(n).toLocaleString('en-MY') : '₹' + Math.round(n).toLocaleString('en-IN'));

  const AGENTS = [
    { id: 'usage', name: 'Usage Analyst', task: 'Works out real usage per line over the last 12 months' },
    { id: 'catalog', name: 'Plan Catalog', task: 'Finds plans and promotions this customer is eligible for' },
    { id: 'product', name: 'Product Advisor', task: 'Matches devices and products to the usage' },
    { id: 'savings', name: 'Savings Calculator', task: 'Costs every eligible plan over the next 6 and 12 months' },
    { id: 'reco', name: 'Recommendation', task: 'Picks the best plan and product and explains why' },
  ];

  const SYSTEM = {
    usage: 'You are the Usage Analyst agent for Aurora Telecom. Using the BSS tools, analyse the last 12 months of usage for every line on the account: monthly data including hotspot, roaming days, and months over the current allowance. Report per line with monthly figures.',
    catalog: 'You are the Plan Catalog agent. Find every currently available plan the customer is eligible for, given their segment and number of lines, and the promotions that apply. Exclude add-ons, broadband-only and new-customer-only offers.',
    product: 'You are the Product Advisor agent. Recommend devices or products only where the usage shows a clear need (for example 4G phones on heavy-data lines, heavy hotspot use, frequent roaming). Include price, EMI and bundle discounts.',
    savings: 'You are the Savings Calculator agent. For every eligible plan, project the next 12 months using last year\'s same-month usage: base price, extra lines, overage, hotspot packs, roaming beyond included days, home broadband, and promotions. Compare with the current plans and report 6- and 12-month savings. Only keep plans that fit the usage.',
    reco: 'You are the Recommendation agent. Pick the best plan and product for the customer from the other agents\' findings and explain why in plain language, with 6- and 12-month savings.',
  };

  const EXECUTE_CODE = JSON.stringify({
    name: 'execute_code',
    description: 'Run JavaScript in a sandbox with the BSS API functions. The code is a function body; only its return value comes back to you.',
    parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
  });

  function apiDocs() {
    return TLD.mcp.tools
      .map((t) => `/** ${t.description} */\nfunction ${t.name}(args: ${JSON.stringify(t.inputSchema.properties || {})}): object;`)
      .join('\n');
  }

  // ------------------------------------------------------------ canonical results (shared by both lanes)
  const cache = {};
  function results(customerId) {
    if (cache[customerId]) return cache[customerId];
    const usage = TLD.runScript('usage', { customer_id: customerId });
    const shortlist = TLD.runScript('catalog', { usage });
    const products = TLD.runScript('product', { usage });
    const savings = TLD.runScript('savings', { usage, shortlist });
    return (cache[customerId] = { usage, shortlist, products, savings, reco: recommend(usage, products, savings) });
  }

  function recommend(usage, products, savings) {
    const fmtINR = (n) => fmtMoney(n, usage.currency);
    const best = savings.top3[0];
    const why = [];
    const overLines = usage.lines.filter((l) => l.overage_months >= 4);
    if (overLines.length) why.push(`${overLines.map((l) => l.user.split(' ')[0]).join(' and ')} went over their data allowance in ${Math.max(...overLines.map((l) => l.overage_months))} of the last 12 months, which added overage charges.`);
    const total = usage.months.map((_, i) => usage.lines.reduce((s, l) => s + l.data_gb[i], 0));
    if (usage.lines.length > 1) why.push(`The ${usage.lines.length} lines used ${Math.round(Math.min(...total))}–${Math.round(Math.max(...total))} GB a month in total, so one shared pool fits better than separate allowances.`);
    if (usage.broadband && best.fibre) why.push(`It replaces the separate ${fmtINR(usage.broadband.monthly_price)}/month home broadband with ${best.fibre} fibre in the same bill.`);
    const roam = usage.lines.reduce((s, l) => s + l.roam_days.reduce((a, b) => a + b, 0), 0);
    if (roam > 10) why.push(`${roam} roaming days a year are mostly covered by the plan's included roaming instead of ${fmtINR(usage.lines[0].current_plan.roaming_pack_price)} weekly roaming packs.`);
    if (best.promo) why.push(`Promotion applied: ${best.promo}.`);
    return { best, why, products };
  }

  // ------------------------------------------------------------ handoff text between agents (same in both lanes)
  function handoff(agent, R) {
    const u = R.usage;
    const fmtINR = (n) => fmtMoney(n, u.currency);
    if (agent === 'usage') {
      return `Usage ${u.months[0]} to ${u.months.at(-1)} for ${u.name} (${u.region}, ${u.segment}, ${u.lines.length} lines${u.broadband ? `, home broadband ${u.broadband.plan} ${fmtINR(u.broadband.monthly_price)}` : ''}):\n` +
        u.lines.map((l) => `- ${l.user} on ${l.current_plan.name} (${l.current_plan.data_gb_per_line} GB, ${l.device_network} phone): avg ${l.avg_gb} GB, peak ${l.peak_gb} GB, over allowance ${l.overage_months}/12 months. Data GB by month ${JSON.stringify(l.data_gb)}; hotspot ${JSON.stringify(l.hotspot_gb)}; roaming days ${JSON.stringify(l.roam_days)}`).join('\n');
    }
    if (agent === 'catalog') {
      const plans = TLD.db.plans;
      return `Eligible plans (${R.shortlist.length}):\n` + R.shortlist.map((s) => {
        const p = plans.find((x) => x.id === s.id);
        return `- ${p.id} ${p.name}: ${fmtINR(p.monthly_price)}/month, ${p.lines_included} line(s) incl., extra line ${fmtINR(p.extra_line_price)}; ${p.features.join('; ')}; overage ${fmtINR(p.overage_per_gb)}/GB${s.promo ? `; promo: ${s.promo}` : ''}`;
      }).join('\n');
    }
    if (agent === 'product') {
      return R.products.length
        ? 'Recommended products:\n' + R.products.map((p) => `- ${p.qty} x ${p.name} (${fmtINR(p.price)}, EMI ${fmtINR(p.emi_per_month)}/month, ${fmtINR(p.bundle_discount)} off with a plan) for ${p.for_lines.join(', ')}: ${p.reason}`).join('\n')
        : 'No product needed.';
    }
    if (agent === 'savings') {
      const s = R.savings;
      return `Current plans cost ${fmtINR(s.current.avg_monthly)}/month on average (${fmtINR(s.current.cost_6)} over 6 months, ${fmtINR(s.current.cost_12)} over 12). Evaluated ${s.evaluated} plans; best that fit the usage:\n` +
        s.top3.map((r, i) => `${i + 1}. ${r.name}: avg ${fmtINR(r.avg_monthly)}/month, save ${fmtINR(r.savings_6)} in 6 months and ${fmtINR(r.savings_12)} in 12 months${r.promo ? ` (${r.promo})` : ''}`).join('\n');
    }
    const { best, why, products } = R.reco;
    return `Best plan: ${best.name} at about ${fmtINR(best.avg_monthly)}/month, instead of ${fmtINR(R.savings.current.avg_monthly)} today.\n` +
      `You save ${fmtINR(best.savings_6)} over 6 months and ${fmtINR(best.savings_12)} over 12 months.\n` +
      why.map((w) => `- ${w}`).join('\n') +
      (products.length ? `\nRecommended products: ${products.map((p) => `${p.qty} x ${p.name}`).join(', ')}.` : '');
  }

  function promptFor(agent, R, customerId) {
    const ask = `Customer ${customerId} wants the best plan and product, and their savings over 6 and 12 months.`;
    const prev = { usage: [], catalog: ['usage'], product: ['usage'], savings: ['usage', 'catalog'], reco: ['usage', 'catalog', 'product', 'savings'] }[agent];
    return [ask, ...prev.map((a) => handoff(a, R))].join('\n\n');
  }

  // ------------------------------------------------------------ the run
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run(mode, customerId, emit, speed = 1) {
    const R = results(customerId);
    const wait = (ms) => sleep(ms / speed);
    const totals = { input: 0, output: 0, llm: 0, tools: 0, ctxBytes: 0, sbxBytes: 0 };
    const perAgent = {};
    const calls = []; // every LLM call with what its input was made of
    const started = performance.now();

    // ctx = { system, tools, request, history } in characters: everything sent to the model on this call.
    const llm = async (agent, ctx, outChars, note) => {
      const parts = { system: tok(ctx.system), tools: tok(ctx.tools), request: tok(ctx.request), history: tok(ctx.history) };
      const input = parts.system + parts.tools + parts.request + parts.history;
      const output = tok(outChars);
      await wait(450 + input * 0.04 + output * 4); // rough model latency: reading input + writing output
      totals.input += input; totals.output += output; totals.llm++;
      perAgent[agent].input += input; perAgent[agent].output += output; perAgent[agent].llm++;
      const callCost = (input * PRICE.inPerM + output * PRICE.outPerM) / 1e6;
      calls.push({ n: totals.llm, agent, note, parts, input, output, cost: callCost });
      emit('llm', { agent, n: totals.llm, input, output, parts, note, totals: { ...totals }, cost: cost(totals) });
    };
    const tool = async (agent, name, args, text, inSandbox) => {
      totals.tools++;
      perAgent[agent].tools++;
      if (inSandbox) totals.sbxBytes += text.length; else totals.ctxBytes += text.length;
      emit('tool', { agent, name, args, bytes: text.length, inSandbox, totals: { ...totals } });
      await wait(inSandbox ? 30 : 160);
    };

    for (const a of AGENTS) {
      perAgent[a.id] = { input: 0, output: 0, llm: 0, tools: 0 };
      emit('agent_start', { agent: a.id });
      const prompt = promptFor(a.id, R, customerId);

      if (a.id === 'reco') {
        await llm('reco', { system: SYSTEM.reco.length, tools: 0, request: prompt.length, history: 0 }, handoff('reco', R).length, 'final answer');
      } else if (mode === 'direct') {
        await runDirectAgent(a.id, prompt, R, customerId, llm, tool);
      } else {
        await runCodeAgent(a.id, prompt, R, customerId, llm, tool, emit, wait);
      }
      emit('agent_done', { agent: a.id, ...perAgent[a.id], text: handoff(a.id, R) });
    }

    const ms = performance.now() - started;
    const summary = { mode, totals, perAgent, calls, cost: cost(totals), ms, R };
    emit('done', summary);
    return summary;
  }

  function cost(t) {
    return (t.input * PRICE.inPerM + t.output * PRICE.outPerM) / 1e6;
  }

  // Direct MCP: the agent calls each tool itself; every result is appended to its context and re-sent.
  async function runDirectAgent(agent, prompt, R, customerId, llm, tool) {
    const ctx = { system: SYSTEM[agent].length, tools: JSON.stringify(TLD.mcp.tools).length, request: prompt.length, history: 0 };
    const callTools = async (calls, note) => {
      const callJson = JSON.stringify(calls.map(([name, args]) => ({ functionCall: { name, args } })));
      await llm(agent, ctx, callJson.length, note);
      ctx.history += callJson.length;
      for (const [name, args] of calls) {
        const text = TLD.mcp.call(name, args);
        await tool(agent, name, args, text, false);
        ctx.history += text.length + 60; // the full tool result (plus its functionResponse wrapper) stays in the conversation
      }
    };
    const answer = async (outChars) => { await llm(agent, ctx, outChars, 'hands off to the next agent'); };

    if (agent === 'usage') {
      await callTools([['get_customer_profile', { customer_id: customerId }]], 'calls get_customer_profile');
      const lines = R.usage.lines.map((l) => l.line_id);
      let cursors = lines.map(() => TLD.db.histStart);
      while (cursors.some(Boolean)) {
        const batch = lines.map((id, i) => cursors[i] && ['get_usage_history', { line_id: id, from: cursors[i], to: TLD.db.histEnd }]).filter(Boolean);
        await callTools(batch, `calls get_usage_history ×${batch.length}`);
        cursors = cursors.map((c, i) => c && JSON.parse(TLD.mcp.call('get_usage_history', { line_id: lines[i], from: c, to: TLD.db.histEnd })).next_from);
      }
      return answer(handoff('usage', R).length);
    }
    if (agent === 'catalog') {
      const segs = { family: ['family', 'combo'], consumer: ['consumer', 'combo'], business: ['business'] }[R.usage.segment];
      const region = R.usage.region;
      await callTools(segs.map((s) => ['list_plans', { region, segment: s }]), `calls list_plans ×${segs.length}`);
      await callTools([['list_promotions', { region }]], 'calls list_promotions');
      return answer(handoff('catalog', R).length);
    }
    if (agent === 'product') {
      const region = R.usage.region;
      await callTools([['list_devices', { region, category: 'phone' }], ['list_devices', { region, category: 'router' }], ['list_devices', { region, category: 'hotspot' }]], 'calls list_devices ×3');
      return answer(handoff('product', R).length);
    }
    if (agent === 'savings') {
      // No tool can do the maths, so the model works through every plan × 12 months in its own reply.
      const working = (R.savings.evaluated + 1) * 12 * 28 + R.usage.lines.length * 12 * 20;
      return answer(working + handoff('savings', R).length);
    }
  }

  // Code mode: the agent writes one script; tools run inside the sandbox; only the result comes back.
  async function runCodeAgent(agent, prompt, R, customerId, llm, tool, emit, wait) {
    const ctx = { system: SYSTEM[agent].length, tools: apiDocs().length + EXECUTE_CODE.length, request: prompt.length, history: 0 };
    const code = TLD.scripts[agent];
    await llm(agent, ctx, code.length + 40, 'writes a script');
    emit('code', { agent, code });
    ctx.history += code.length + 40;

    const t0 = performance.now();
    const calls = [];
    const input = agent === 'usage' ? { customer_id: customerId } : agent === 'savings' ? { usage: R.usage, shortlist: R.shortlist } : { usage: R.usage };
    const out = TLD.runScript(agent, input, (name, args, bytes) => calls.push([name, args, bytes]));
    for (const [name, args, bytes] of calls) await tool(agent, name, args, 'x'.repeat(bytes), true);
    const result = JSON.stringify(out);
    emit('code_result', { agent, calls: calls.length, sandboxBytes: calls.reduce((s, c) => s + c[2], 0), returnedBytes: result.length, ms: Math.round(performance.now() - t0), preview: result.slice(0, 400) });
    ctx.history += result.length + 60; // only the script's return value enters the conversation
    await llm(agent, ctx, handoff(agent, R).length, 'hands off to the next agent');
  }

  TLD.engine = { AGENTS, run, results, handoff, fmtMoney, PRICE };
})(typeof window !== 'undefined' ? window : globalThis);
