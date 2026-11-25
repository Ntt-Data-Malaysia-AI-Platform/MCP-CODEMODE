const $ = (s, el = document) => el.querySelector(s);
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const bytes = (b) => (b >= 1024 * 1024 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b || 0} B`);
const money = (v) => `$${(v || 0) < 0.01 ? (v || 0).toFixed(5) : (v || 0).toFixed(4)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let cfg = { scenarios: [] };
let scenarioId = null;
const lanes = {};
const results = {};

// ------------------------------------------------------------ lanes
function createLane(mode) {
  const root = $(`#lane-${mode} .lane-body`);
  const lane = {
    mode,
    root,
    el: (k) => root.querySelector(`[data-k="${k}"]`),
    calls: [],
    ctxBytes: 0,
    sbxBytes: 0,
    started: 0,
    timer: null,
    source: null,
  };
  lanes[mode] = lane;
  reset(lane);
  return lane;
}

function reset(lane) {
  lane.root.innerHTML = '';
  lane.root.append($('#laneTemplate').content.cloneNode(true));
  lane.calls = [];
  lane.ctxBytes = 0;
  lane.sbxBytes = 0;
}

function setStatus(lane, text, cls) {
  const s = lane.el('status');
  s.textContent = text;
  s.className = `status ${cls || ''}`;
}

function addEvent(lane, tag, cls, html, extra = '') {
  const li = document.createElement('li');
  li.innerHTML = `<span class="tag ${cls}">${tag}</span><div class="detail">${html}${extra}</div>`;
  const tl = lane.el('timeline');
  tl.append(li);
  tl.scrollTop = tl.scrollHeight;
}

function renderBars() {
  const max = Math.max(1, ...Object.values(lanes).flatMap((l) => l.calls.map((c) => c.input + c.output + c.thinking)));
  for (const lane of Object.values(lanes)) {
    const box = lane.el('bars');
    if (!lane.calls.length) continue;
    box.innerHTML =
      lane.calls
        .map((c) => {
          const w = (v) => `${(100 * v) / max}%`;
          return `<div class="bar-row"><span class="n">#${c.n}</span>
            <div class="bar-track" title="input ${fmt(c.input)} · output ${fmt(c.output)} · thinking ${fmt(c.thinking)}">
              <i class="in" style="width:${w(c.input)}"></i><i class="out" style="width:${w(c.output)}"></i><i class="think" style="width:${w(c.thinking)}"></i>
            </div><span class="v">${fmt(c.input + c.output + c.thinking)}</span></div>`;
        })
        .join('') +
      `<div class="legend"><span><i style="background:var(--${lane.mode === 'direct' ? 'direct' : 'code'})"></i>input</span><span><i style="background:var(--ink);opacity:.55"></i>output</span><span><i style="background:var(--muted);opacity:.45"></i>thinking</span></div>`;
  }
}

function renderFlow() {
  const max = Math.max(1, ...Object.values(lanes).flatMap((l) => [l.ctxBytes, l.sbxBytes]));
  for (const lane of Object.values(lanes)) {
    lane.el('ctxBytes').textContent = bytes(lane.ctxBytes);
    lane.el('sbxBytes').textContent = bytes(lane.sbxBytes);
    lane.el('ctxBar').style.width = `${(100 * lane.ctxBytes) / max}%`;
    lane.el('sbxBar').style.width = `${(100 * lane.sbxBytes) / max}%`;
  }
}

function setTotals(lane, t, cost) {
  lane.el('total').textContent = fmt(t.total);
  lane.el('input').textContent = fmt(t.input);
  lane.el('output').textContent = fmt(t.output);
  lane.el('thinking').textContent = fmt(t.thinking);
  lane.el('cached').textContent = fmt(t.cached);
  lane.el('cost').textContent = money(cost);
}

// Tiny markdown: paragraphs, bullet lists, **bold**, `code`.
function md(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  let html = '';
  let inList = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    const item = line.match(/^([-*•]|\d+\.)\s+(.*)$/);
    if (item) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(item[2])}</li>`;
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    if (line) html += `<p>${inline(line.replace(/^#+\s*/, ''))}</p>`;
  }
  return html + (inList ? '</ul>' : '');
}

// ------------------------------------------------------------ running
function run(mode, prompt) {
  return new Promise((resolve) => {
    const lane = lanes[mode];
    lane.source?.close();
    reset(lane);
    delete results[mode];
    renderBars();
    renderFlow();
    setStatus(lane, 'running', 'running');
    lane.started = Date.now();
    clearInterval(lane.timer);
    lane.timer = setInterval(() => (lane.el('time').textContent = `${((Date.now() - lane.started) / 1000).toFixed(1)} s`), 100);

    const qs = new URLSearchParams({ mode, prompt, scenario: scenarioId || 'custom' });
    const es = new EventSource(`/api/run?${qs}`);
    lane.source = es;
    const on = (type, fn) => es.addEventListener(type, (e) => fn(JSON.parse(e.data)));

    on('start', (d) => {
      addEvent(lane, 'start', 'llm', mode === 'direct'
        ? `Model gets <b>${d.tools.length} MCP tools</b> as function declarations: <code>${d.tools.join(', ')}</code>`
        : `Model gets <b>1 tool</b> (<code>execute_code</code>) plus a typed API for the ${d.tools.length} MCP tools`);
    });
    on('llm_call', (d) => {
      lane.calls.push(d);
      lane.el('llm').textContent = d.n;
      setTotals(lane, d.totals, d.cost);
      renderBars();
      const next = d.functionCalls.length ? `→ calls <code>${[...new Set(d.functionCalls)].join(', ')}</code>${d.functionCalls.length > 1 ? ` ×${d.functionCalls.length}` : ''}` : '→ <b>final answer</b>';
      addEvent(lane, `llm #${d.n}`, 'llm', `<b>${fmt(d.input)}</b> in · ${fmt(d.output)} out${d.thinking ? ` · ${fmt(d.thinking)} thinking` : ''}${d.cached ? ` · ${fmt(d.cached)} cached` : ''} ${next}`);
    });
    on('tool_call', (d) => {
      lane.el('tools').textContent = d.n;
      lane.ctxBytes = d.contextBytes;
      lane.sbxBytes = d.sandboxBytes;
      renderFlow();
      const args = esc(JSON.stringify(d.args || {}));
      const where = d.inSandbox ? 'stays in sandbox' : '<b>added to context</b>';
      addEvent(lane, d.inSandbox ? 'sandbox' : 'mcp tool', d.isError ? 'err' : d.inSandbox ? 'sbx' : 'tool', `<code>${esc(d.name)}(${args})</code> · ${bytes(d.bytes)} ${where}`);
    });
    on('code', (d) => addEvent(lane, 'code', 'code', 'Model wrote a script:', `<pre>${esc(d.code)}</pre>`));
    on('code_result', (d) => addEvent(lane, d.ok ? 'result' : 'error', d.ok ? 'code' : 'err',
      `${d.ok ? 'Script finished' : 'Script failed'} in ${d.ms} ms · only <b>${bytes(d.returnedBytes)}</b> sent back to the model`, `<pre>${esc(d.preview)}</pre>`));
    on('retry', (d) => addEvent(lane, 'retry', 'err', `Gemini returned ${d.status}; retrying in ${(d.waitMs / 1000).toFixed(0)} s (attempt ${d.attempt})`));
    on('warn', (d) => addEvent(lane, 'note', 'err', esc(d.message)));

    const finish = (ok) => {
      clearInterval(lane.timer);
      es.close();
      setStatus(lane, ok ? 'done' : 'error', ok ? 'done' : 'error');
      resolve();
    };
    on('done', (d) => {
      results[mode] = d;
      lane.el('time').textContent = `${(d.duration_ms / 1000).toFixed(1)} s`;
      lane.el('answer').innerHTML = md(d.answer);
      finish(true);
      renderVerdict();
      loadHistory();
    });
    es.addEventListener('error', (e) => {
      if (e.data) addEvent(lane, 'error', 'err', esc(JSON.parse(e.data).message));
      else if (!results[mode]) addEvent(lane, 'error', 'err', 'Connection to the server was lost.');
      lane.el('answer').innerHTML = '<p class="muted">No answer: the run failed.</p>';
      finish(false);
    });
  });
}

function renderVerdict() {
  const box = $('#verdict');
  const d = results.direct;
  const c = results.code;
  if (!d || !c) { box.hidden = true; return; }
  box.hidden = false;
  const ratio = d.total_tokens / Math.max(1, c.total_tokens);
  const headline = ratio >= 1.15
    ? `Code mode used <em>${ratio.toFixed(1)}× fewer tokens</em> (−${Math.round(100 * (1 - 1 / ratio))}%)`
    : ratio <= 0.87
      ? `Direct MCP used <em>${(1 / ratio).toFixed(1)}× fewer tokens</em> on this one`
      : 'About the same: code mode only pays off when there is data to process';
  const pair = (label, a, b) => `<div class="pair">${label}<br><b>${a}</b> vs <b>${b}</b></div>`;
  box.innerHTML = `<div class="headline">${headline}</div>
    ${pair('Total tokens (direct vs code)', fmt(d.total_tokens), fmt(c.total_tokens))}
    ${pair('LLM calls', d.llm_calls, c.llm_calls)}
    ${pair('Tool data in context', bytes(d.context_bytes), bytes(c.context_bytes))}
    ${pair('Est. cost', money(d.est_cost_usd), money(c.est_cost_usd))}
    ${pair('Time', `${(d.duration_ms / 1000).toFixed(1)} s`, `${(c.duration_ms / 1000).toFixed(1)} s`)}`;
}

function setRunning(on) {
  for (const id of ['runBoth', 'runDirect', 'runCode']) $(`#${id}`).disabled = on;
}

async function start(modes) {
  const prompt = $('#prompt').value.trim();
  if (!prompt) return;
  setRunning(true);
  $('#verdict').hidden = true;
  for (const m of modes) delete results[m];
  await Promise.all(modes.map((m) => run(m, prompt)));
  setRunning(false);
}

// ------------------------------------------------------------ history
async function loadHistory() {
  const table = $('#historyTable');
  try {
    const runs = await (await fetch('/api/runs')).json();
    if (runs.error) throw new Error(runs.error);
    if (!runs.length) { table.innerHTML = '<tr><td class="muted">No runs yet.</td></tr>'; return; }
    table.innerHTML = `<tr><th>When</th><th>Mode</th><th>Scenario</th><th>LLM</th><th class="num">LLM calls</th><th class="num">Tool calls</th><th class="num">Input</th><th class="num">Output</th><th class="num">Thinking</th><th class="num">Total</th><th class="num">Est. cost</th><th class="num">Time</th></tr>` +
      runs.map((r) => `<tr>
        <td>${new Date(r.created_at).toLocaleTimeString()}</td>
        <td><span class="pill ${r.mode}">${r.mode === 'code' ? 'code mode' : 'direct MCP'}</span></td>
        <td>${esc(r.scenario)}</td><td>${esc(r.llm_mode)}</td>
        <td class="num">${r.llm_calls}</td><td class="num">${r.tool_calls}</td>
        <td class="num">${fmt(r.input_tokens)}</td><td class="num">${fmt(r.output_tokens)}</td><td class="num">${fmt(r.thinking_tokens)}</td>
        <td class="num"><b>${fmt(r.total_tokens)}</b></td><td class="num">${money(Number(r.est_cost_usd))}</td>
        <td class="num">${((r.duration_ms || 0) / 1000).toFixed(1)} s</td></tr>`).join('');
  } catch (err) {
    table.innerHTML = `<tr><td class="muted">Could not load history: ${esc(err.message)}</td></tr>`;
  }
}

// ------------------------------------------------------------ init
function selectScenario(id) {
  scenarioId = id;
  const s = cfg.scenarios.find((x) => x.id === id);
  document.querySelectorAll('.scenario').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  if (s) {
    $('#prompt').value = s.prompt;
    $('#expect').textContent = `What to expect: ${s.expect}`;
  }
}

async function init() {
  createLane('direct');
  createLane('code');
  cfg = await (await fetch('/api/config')).json();

  const live = cfg.llmMode === 'live';
  $('#badges').innerHTML = `
    <span class="badge ${live ? 'live' : 'sim'}"><b>${live ? 'Live' : 'Simulated'}</b> · ${esc(cfg.model)}</span>
    <span class="badge">Data: <b>${cfg.dataSource === 'supabase' ? 'Supabase' : 'in-memory'}</b></span>
    <span class="badge">$${cfg.pricing.inputPerM} / $${cfg.pricing.outputPerM} per 1M in/out</span>`;
  $('#simBanner').hidden = live;
  $('#historySource').textContent = cfg.dataSource === 'supabase' ? 'saved in Supabase (demo_runs)' : 'kept in memory until the server restarts';

  $('#scenarios').innerHTML = cfg.scenarios
    .map((s) => `<button class="scenario" data-id="${s.id}"><b>${esc(s.title)}</b><span>${esc(s.tag)}</span></button>`)
    .join('');
  document.querySelectorAll('.scenario').forEach((b) => b.addEventListener('click', () => selectScenario(b.dataset.id)));
  $('#prompt').addEventListener('input', () => { scenarioId = 'custom'; document.querySelectorAll('.scenario').forEach((b) => b.classList.remove('active')); $('#expect').textContent = ''; });
  selectScenario(cfg.scenarios[0]?.id);

  $('#runBoth').addEventListener('click', () => start(['direct', 'code']));
  $('#runDirect').addEventListener('click', () => start(['direct']));
  $('#runCode').addEventListener('click', () => start(['code']));
  $('#refreshHistory').addEventListener('click', loadHistory);
  loadHistory();
}

init();
