(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
  const kb = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(1) + ' KB');
  const usd = (v) => '$' + (v || 0).toFixed(4);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const { AGENTS } = TLD.engine;
  // Money in the selected customer's currency (₹ for India, RM for Malaysia)
  const money = (n) => TLD.engine.fmtMoney(n, (TLD.db.customers.find((c) => c.customer_id === customerId) || {}).currency);
  const monthName = (ym) => new Date(ym + '-01T00:00:00Z').toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

  // ------------------------------------------------------------ login
  const store = {
    get() { try { return sessionStorage.getItem('gfo-user'); } catch { return null; } },
    set(v) { try { v ? sessionStorage.setItem('gfo-user', v) : sessionStorage.removeItem('gfo-user'); } catch {} },
  };
  function showApp(user) {
    const name = DEMO_LOGIN.displayName || user;
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#whoami').textContent = name;
    $('#umName').textContent = name;
    $('#umUser').textContent = user;
    $('#avatar').textContent = $('#avatarLg').textContent = name.charAt(0).toUpperCase();
  }

  // Profile menu
  const menu = $('#userMenu');
  const setMenu = (open) => {
    menu.hidden = !open;
    $('#profileBtn').setAttribute('aria-expanded', String(open));
  };
  $('#profileBtn').addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !$('#profile').contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  // SHA-256 of a string as hex. Uses Web Crypto, with a small fallback for browsers without it.
  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    const K = [], H = [];
    const isPrime = (n) => { for (let f = 2; f * f <= n; f++) if (n % f === 0) return false; return true; };
    for (let n = 2, i = 0; i < 64; n++) if (isPrime(n)) { if (i < 8) H[i] = (Math.pow(n, 1 / 2) * 2 ** 32) | 0; K[i++] = (Math.pow(n, 1 / 3) * 2 ** 32) | 0; }
    const len = bytes.length, words = new Uint32Array(((len + 9 + 63) >> 6) << 4);
    for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
    words[words.length - 1] = len * 8;
    const ror = (x, n) => (x >>> n) | (x << (32 - n));
    const w = new Uint32Array(64);
    for (let j = 0; j < words.length; j += 16) {
      for (let i = 0; i < 64; i++) w[i] = i < 16 ? words[j + i] : (ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >>> 10)) + w[i - 7] + (ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >>> 3)) + w[i - 16];
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i];
        const t2 = (ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c));
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) | 0));
    }
    return H.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = $('#user').value.trim();
    const p = $('#pass').value;
    if (u === DEMO_LOGIN.username && (await sha256Hex(p)) === DEMO_LOGIN.passwordSha256) {
      store.set(u);
      $('#loginError').hidden = true;
      showApp(u);
    } else {
      $('#loginError').hidden = false;
      $('#pass').value = '';
      $('#pass').focus();
    }
  });
  $('#logout').addEventListener('click', () => {
    store.set(null);
    location.reload();
  });
  if (store.get()) showApp(store.get());

  // ------------------------------------------------------------ customer
  let customerId = TLD.db.customers[0].customer_id;
  let running = false;

  function renderCustomers() {
    // With a single customer, skip the picker and let the account card use the full width.
    const single = TLD.db.customers.length === 1;
    $('.customer').classList.toggle('single', single);
    $('#customerPick').hidden = single;
    if (single) return;
    $('#customerPick').innerHTML = TLD.db.customers
      .map((c) => `<button class="cust-btn ${c.customer_id === customerId ? 'active' : ''}" data-id="${c.customer_id}" ${running ? 'disabled' : ''}>
        <b>${esc(c.name)} <i class="region-tag ${c.region === 'MY' ? 'my' : ''}">${esc(c.country)} · ${c.currency === 'MYR' ? 'RM' : '₹'}</i></b><span>${esc(c.persona)} · ${c.lines.length} line${c.lines.length > 1 ? 's' : ''}</span></button>`)
      .join('');
    document.querySelectorAll('.cust-btn').forEach((b) => b.addEventListener('click', () => {
      if (running) return;
      customerId = b.dataset.id;
      renderCustomers();
      renderAccount();
      resetRun();
    }));
  }

  function renderAccount() {
    const c = TLD.db.customers.find((x) => x.customer_id === customerId);
    const R = TLD.engine.results(customerId);
    const u = R.usage;
    const total = u.months.map((_, i) => u.lines.reduce((s, l) => s + l.data_gb[i], 0));
    const max = Math.max(...total);
    $('#account').innerHTML = `
      <div>
        <h2>${esc(c.name)} <i class="region-tag ${c.region === 'MY' ? 'my' : ''}">${esc(c.country)} · ${c.currency === 'MYR' ? 'RM' : '₹'}</i></h2>
        <div class="sub">${esc(c.persona)}</div>
        <div class="sub">${esc(c.customer_id)} · ${esc(c.city)}, ${esc(c.country)} · customer since ${c.customer_since.slice(0, 4)} · ${esc(c.payment_method)}</div>
        <div class="bill">
          <div><span>Average monthly bill</span><b>${money(R.savings.current.avg_monthly)}</b></div>
          <div><span>Lines</span><b>${c.lines.length}</b></div>
          <div><span>Home broadband</span><b>${c.broadband ? money(c.broadband.monthly_price) : '—'}</b></div>
        </div>
        <table class="lines-table">
          <tr><th>Line</th><th>Current plan</th><th>Device</th><th>Avg data</th></tr>
          ${u.lines.map((l) => `<tr><td>${esc(l.user)}</td><td>${esc(l.current_plan.name)}</td>
            <td><span class="${l.device_network === '5G' ? 'tag5g' : 'tag4g'}">${l.device_network}</span></td>
            <td>${l.avg_gb} GB${l.overage_months ? ` <span class="muted">(over in ${l.overage_months}/12)</span>` : ''}</td></tr>`).join('')}
        </table>
      </div>
      <div>
        <h3 style="margin-top:0">Data used per month (all lines, GB)</h3>
        <div class="usage-chart">${total.map((t, i) => `<div class="col"><span class="val">${Math.round(t)}</span><div class="bar" style="height:${(85 * t) / max}%"></div><span class="lbl">${monthName(u.months[i])}</span></div>`).join('')}</div>
        <p class="muted" style="font-size:12px;margin:8px 0 0">${u.months.length} months of daily records · ${fmt(u.lines.length * 365)} usage rows in the BSS</p>
      </div>`;
  }

  // ------------------------------------------------------------ lanes
  const lanes = {};
  function makeLane(mode) {
    const root = $(`#lane-${mode} .lane-body`);
    root.innerHTML = '';
    root.append($('#laneTpl').content.cloneNode(true));
    const el = (k) => root.querySelector(`[data-k="${k}"]`);
    el('agents').innerHTML = AGENTS.map((a) => `<li data-a="${a.id}" title="${esc(a.task)}"><span class="state"></span><span class="name">${a.name}</span><span class="bar"><i></i></span><span class="tk">0</span></li>`).join('');
    lanes[mode] = { mode, root, el, perAgent: {}, sbxRow: null, started: 0, timer: null, totals: null };
  }
  function resetRun() {
    makeLane('direct');
    makeLane('code');
    $('#verdict').hidden = true;
    $('#results').hidden = true;
    renderAgentBars();
    lastRun = null;
    renderBreakdown?.();
  }

  function log(lane, cls, tag, html, extraClass = '') {
    const box = lane.el('log');
    if (box.firstElementChild?.classList.contains('muted')) box.innerHTML = '';
    const li = document.createElement('li');
    if (extraClass) li.className = extraClass;
    li.innerHTML = tag ? `<span class="t ${cls}">${tag}</span><span class="d">${html}</span>` : `<span class="d">${html}</span>`;
    box.append(li);
    box.scrollTop = box.scrollHeight;
    return li;
  }

  function renderAgentBars() {
    const max = Math.max(1, ...Object.values(lanes).flatMap((l) => Object.values(l.perAgent).map((p) => p.input + p.output)));
    for (const lane of Object.values(lanes)) {
      for (const a of AGENTS) {
        const li = lane.el('agents').querySelector(`[data-a="${a.id}"]`);
        const p = lane.perAgent[a.id];
        const t = p ? p.input + p.output : 0;
        li.querySelector('.bar i').style.width = `${(100 * t) / max}%`;
        li.querySelector('.tk').textContent = fmt(t);
      }
    }
  }
  function renderFlow() {
    const max = Math.max(1, ...Object.values(lanes).flatMap((l) => (l.totals ? [l.totals.ctxBytes, l.totals.sbxBytes] : [0])));
    for (const lane of Object.values(lanes)) {
      const t = lane.totals || { ctxBytes: 0, sbxBytes: 0 };
      lane.el('ctx').textContent = kb(t.ctxBytes);
      lane.el('sbx').textContent = kb(t.sbxBytes);
      lane.el('ctxBar').style.width = `${(100 * t.ctxBytes) / max}%`;
      lane.el('sbxBar').style.width = `${(100 * t.sbxBytes) / max}%`;
    }
  }

  function handler(lane) {
    return (type, d) => {
      const agentName = d.agent && AGENTS.find((a) => a.id === d.agent).name;
      if (type === 'agent_start') {
        lane.perAgent[d.agent] = { input: 0, output: 0 };
        lane.el('agents').querySelector(`[data-a="${d.agent}"]`).classList.add('running');
        log(lane, '', '', `▸ ${agentName}`, 'agent-head');
        lane.sbxRow = null;
      } else if (type === 'llm') {
        lane.perAgent[d.agent].input += d.input;
        lane.perAgent[d.agent].output += d.output;
        lane.totals = d.totals;
        lane.el('total').textContent = fmt(d.totals.input + d.totals.output);
        lane.el('llm').textContent = d.totals.llm;
        lane.el('input').textContent = fmt(d.totals.input);
        lane.el('output').textContent = fmt(d.totals.output);
        lane.el('cost').textContent = usd(d.cost);
        log(lane, 'llm', `LLM #${d.n}`, `<b>${fmt(d.input)}</b> in · ${fmt(d.output)} out → ${esc(d.note)}`);
        renderAgentBars();
      } else if (type === 'tool') {
        lane.totals = d.totals;
        lane.el('tools').textContent = d.totals.tools;
        renderFlow();
        const args = Object.values(d.args || {}).map((v) => (Array.isArray(v) ? '[…]' : String(v))).join(', ');
        if (d.inSandbox) {
          lane.sbxRow ??= { li: log(lane, 'sbx', 'sandbox', ''), calls: 0, bytes: 0, names: {} };
          const r = lane.sbxRow;
          r.calls++; r.bytes += d.bytes; r.names[d.name] = (r.names[d.name] || 0) + 1;
          r.li.querySelector('.d').innerHTML = `${r.calls} MCP calls inside the sandbox (${Object.entries(r.names).map(([n, c]) => `<code>${n}</code> ×${c}`).join(', ')}) · ${kb(r.bytes)} processed · <b>never sent to the model</b>`;
        } else {
          log(lane, 'tool', 'mcp', `<code>${esc(d.name)}(${esc(args)})</code> · ${kb(d.bytes)} → <b>into context</b>`);
        }
      } else if (type === 'code') {
        const lines = d.code.split('\n').length;
        log(lane, 'code', 'script', `<details><summary>Model wrote a ${lines}-line script</summary><pre>${esc(d.code)}</pre></details>`);
      } else if (type === 'code_result') {
        log(lane, 'code', 'result', `Script returned <b>${kb(d.returnedBytes)}</b> to the model, from ${kb(d.sandboxBytes)} of tool data`);
      } else if (type === 'agent_done') {
        const li = lane.el('agents').querySelector(`[data-a="${d.agent}"]`);
        li.classList.remove('running');
        li.classList.add('done');
      }
    };
  }

  async function runLane(mode, speed) {
    const lane = lanes[mode];
    lane.el('status').textContent = 'running';
    lane.el('status').className = 'status running';
    lane.started = performance.now();
    lane.timer = setInterval(() => (lane.el('time').textContent = ((performance.now() - lane.started) / 1000 * speed).toFixed(1) + ' s'), 100);
    const summary = await TLD.engine.run(mode, customerId, handler(lane), speed);
    clearInterval(lane.timer);
    lane.el('time').textContent = (summary.ms / 1000 * speed).toFixed(1) + ' s';
    lane.el('status').textContent = 'done';
    lane.el('status').className = 'status done';
    return summary;
  }

  $('#runBtn').addEventListener('click', async () => {
    if (running) return;
    running = true;
    $('#runBtn').disabled = true;
    renderCustomers();
    resetRun();
    const speed = Number($('#speed').value) || 1;
    const [direct, code] = await Promise.all([runLane('direct', speed), runLane('code', speed)]);
    renderVerdict(direct, code, speed);
    renderResults(direct, code);
    lastRun = { direct, code };
    renderBreakdown();
    running = false;
    $('#runBtn').disabled = false;
    renderCustomers();
  });

  // ------------------------------------------------------------ results
  function renderVerdict(d, c, speed) {
    const dt = d.totals.input + d.totals.output;
    const ct = c.totals.input + c.totals.output;
    const ratio = dt / ct;
    const best = d.R.reco.best;
    const pair = (label, a, b) => `<div class="pair">${label}<b>${a} vs ${b}</b></div>`;
    $('#verdict').hidden = false;
    $('#verdict').innerHTML = `
      <div><div class="headline">Code mode used <em>${ratio.toFixed(1)}× fewer tokens</em> (−${Math.round(100 * (1 - ct / dt))}%)</div>
      <div class="agree">✓ Both modes recommend ${esc(best.name)}</div></div>
      ${pair('Tokens (direct vs code)', fmt(dt), fmt(ct))}
      ${pair('LLM calls', d.totals.llm, c.totals.llm)}
      ${pair('Tool data sent to the model', kb(d.totals.ctxBytes), kb(c.totals.ctxBytes))}
      ${pair('Est. model cost', usd(d.cost), usd(c.cost))}
      ${pair('Time', (d.ms / 1000 * speed).toFixed(1) + ' s', (c.ms / 1000 * speed).toFixed(1) + ' s')}`;
  }

  function renderResults(d, c) {
    const R = d.R;
    const { best, why, products } = R.reco;
    const cur = R.savings.current;
    $('#results').hidden = false;
    $('#reco').innerHTML = `
      <div class="kicker">Recommended for ${esc(R.usage.name)}</div>
      <h2>${esc(best.name)}</h2>
      <div class="price">About <b>${money(best.avg_monthly)}/month</b> over the next 12 months, instead of ${money(cur.avg_monthly)} today</div>
      <div class="savings">
        <div class="hl"><span>Save in 6 months</span><b>${money(best.savings_6)}</b></div>
        <div class="hl"><span>Save in 12 months</span><b>${money(best.savings_12)}</b></div>
        <div><span>Lower monthly bill</span><b>${Math.round(100 * (1 - best.avg_monthly / cur.avg_monthly))}%</b></div>
      </div>
      <ul class="why">${why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      ${products.length ? `<h3>Recommended products</h3><div class="products">${products.map((p) => `
        <div class="product"><b>${p.qty > 1 ? p.qty + ' × ' : ''}${esc(p.name)}</b>
        <span>${money(p.price)} or ${money(p.emi_per_month)}/month EMI${p.bundle_discount ? ` · ${money(p.bundle_discount)} off with the plan` : ''}</span><br>
        <span>For ${esc(p.for_lines.join(', '))}: ${esc(p.reason)}</span></div>`).join('')}</div>` : ''}
      <h3>Top 3 plans that fit the usage</h3>
      <table class="alts">
        <tr><th>Plan</th><th class="num">Avg / month</th><th class="num">6-month saving</th><th class="num">12-month saving</th></tr>
        ${R.savings.top3.map((r, i) => `<tr class="${i === 0 ? 'best' : ''}"><td>${esc(r.name)}${r.promo ? ' <span class="muted">· promo</span>' : ''}</td><td class="num">${money(r.avg_monthly)}</td><td class="num">${money(r.savings_6)}</td><td class="num">${money(r.savings_12)}</td></tr>`).join('')}
      </table>
      <p class="muted" style="font-size:12px">${R.savings.evaluated} eligible plans costed month by month, using last year's usage for the same months.</p>
      <div class="approve-row" id="approveRow">
        <button class="btn-gold" id="switchBtn">Switch to ${esc(best.name)}</button>
        <span class="muted">Governed: a person approves every plan change, and it's logged.</span>
      </div>`;
    $('#switchBtn').addEventListener('click', () => openApproval(R));

    const max = Math.max(...AGENTS.flatMap((a) => [d.perAgent[a.id], c.perAgent[a.id]].map((p) => p.input + p.output)));
    $('#agentChart').innerHTML = AGENTS.map((a) => {
      const x = d.perAgent[a.id].input + d.perAgent[a.id].output;
      const y = c.perAgent[a.id].input + c.perAgent[a.id].output;
      return `<div class="row"><span>${a.name}</span><div class="pair">
        <div class="b"><i class="d" style="width:${(85 * x) / max}%"></i><span>${fmt(x)}</span></div>
        <div class="b"><i class="c" style="width:${(85 * y) / max}%"></i><span>${fmt(y)}</span></div></div></div>`;
    }).join('');
  }

  // ------------------------------------------------------------ call-by-call breakdown
  let lastRun = null;
  let bdMode = 'direct';
  const PART_CLASS = { system: 'p-sys', tools: 'p-tools', request: 'p-req', history: 'p-hist' };
  const PART_LABEL = { system: 'system prompt', tools: 'tool definitions', request: 'request + handoffs', history: 'conversation so far' };

  function renderBreakdown() {
    const box = $('#bdTable');
    if (!lastRun) {
      box.innerHTML = '<p class="muted">Run "Find my best plan &amp; savings" to see every LLM call broken down here.</p>';
      return;
    }
    const all = [...lastRun.direct.calls, ...lastRun.code.calls];
    const max = Math.max(...all.map((c) => c.input + c.output)); // same scale for both modes
    const run = lastRun[bdMode];
    const agentName = (id) => AGENTS.find((a) => a.id === id).name;
    const w = (v) => `${(100 * v) / max}%`;
    const rows = run.calls.map((c) => {
      const tip = Object.entries(c.parts).map(([k, v]) => `${PART_LABEL[k]}: ${fmt(v)}`).join(' · ') + ` · output: ${fmt(c.output)}`;
      return `<tr>
        <td class="num">#${c.n}</td>
        <td class="agent">${agentName(c.agent)}</td>
        <td class="note">${esc(c.note)}</td>
        <td><div class="stack" title="${esc(tip)}">${Object.keys(PART_CLASS).map((k) => `<i class="${PART_CLASS[k]}" style="width:${w(c.parts[k])}"></i>`).join('')}<i class="p-out" style="width:${w(c.output)}"></i></div></td>
        <td class="num">${fmt(c.parts.history)}</td>
        <td class="num"><b>${fmt(c.input)}</b></td>
        <td class="num">${fmt(c.output)}</td>
        <td class="num">${usd(c.cost)}</td></tr>`;
    }).join('');
    const t = run.totals;
    const hist = run.calls.reduce((s, c) => s + c.parts.history, 0);
    box.innerHTML = `<div class="bd-wrap"><table class="bd-table">
      <tr><th class="num">Call</th><th>Agent</th><th>What happened</th><th>Input + output (hover for parts)</th><th class="num">Conversation part</th><th class="num">Input</th><th class="num">Output</th><th class="num">Cost</th></tr>
      ${rows}
      <tr class="sum"><td></td><td>Total</td><td>${t.llm} calls</td><td></td><td class="num">${fmt(hist)}</td><td class="num">${fmt(t.input)}</td><td class="num">${fmt(t.output)}</td><td class="num">${usd(run.cost)}</td></tr>
    </table></div>
    <p class="muted" style="font-size:12px;margin:8px 0 0">${bdMode === 'direct'
      ? `The conversation part is ${Math.round((100 * hist) / t.input)}% of all input: raw tool results being sent to the model again and again.`
      : `The conversation part is only ${Math.round((100 * hist) / t.input)}% of all input: scripts and their small return values. ${kb(t.sbxBytes)} of tool data stayed in the sandbox.`}</p>`;
  }

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    bdMode = b.dataset.mode;
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
    renderBreakdown();
  }));

  function openApproval(R) {
    const best = R.reco.best;
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <h3>Approve plan change</h3>
      <p><b>${esc(R.usage.name)}</b> moves ${R.usage.lines.length} line${R.usage.lines.length > 1 ? 's' : ''} to <b>${esc(best.name)}</b> from the next bill cycle.</p>
      <p>Expected saving: <b>${money(best.savings_12)}</b> over 12 months. No change is made until you approve.</p>
      <div class="actions"><button class="btn-ghost" data-x="cancel">Cancel</button><button class="btn-gold" data-x="ok">Approve change</button></div></div>`;
    document.body.append(bg);
    bg.addEventListener('click', (e) => {
      const x = e.target.dataset.x;
      if (e.target === bg || x === 'cancel') bg.remove();
      if (x === 'ok') {
        bg.remove();
        const who = $('#whoami').textContent;
        const when = new Date().toLocaleString();
        $('#approveRow').innerHTML = `<span class="approved">✓ Approved by ${esc(who)} at ${esc(when)}. Change scheduled for the next bill cycle.</span>`;
        $('#audit').hidden = false;
        const li = document.createElement('li');
        li.textContent = `${when} · ${who} approved plan change for ${R.usage.name} (${R.usage.customer_id}) to ${best.name} · expected 12-month saving ${money(best.savings_12)} · recommended by 5 agents`;
        $('#auditList').prepend(li);
      }
    });
  }

  renderCustomers();
  renderAccount();
  resetRun();
})();
