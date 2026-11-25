// Mode 2: code mode. The model gets ONE tool, execute_code, plus a typed API reference generated
// from the same MCP server. It writes a script; the script calls the MCP tools inside a sandbox,
// and only the script's small return value goes back into the model's context.
import { config } from '../config.js';
import { callModel, simulatedResponse } from './llm.js';
import { createTracker } from './tracker.js';
import { codeModeSystem } from './prompts.js';
import { runInSandbox } from './sandbox.js';

const EXECUTE_CODE = {
  name: 'execute_code',
  description:
    'Run JavaScript in a sandbox that has the field-service API functions. The code is a function body and must end with `return <value>`. Returns { result, logs } or { error, logs }.',
  parametersJsonSchema: {
    type: 'object',
    properties: { code: { type: 'string', description: 'JavaScript function body' } },
    required: ['code'],
  },
};

export async function runCodeMode({ prompt, mcp, emit }) {
  const tracker = createTracker('code', emit);
  const system = codeModeSystem(mcp.tools);
  const toolNames = mcp.tools.map((t) => t.name);
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];

  for (let step = 1; step <= config.limits.codeMaxSteps; step++) {
    const res = await callModel({
      system,
      contents,
      functionDeclarations: [EXECUTE_CODE],
      onRetry: (r) => emit('retry', r),
      simulate: simulateCode,
    });
    contents.push(res.content);
    tracker.llm(res.usage, {
      functionCalls: res.functionCalls.map((c) => c.name),
      contextMessages: contents.length,
    });

    if (!res.functionCalls.length) return tracker.summary(res.text);

    const responses = [];
    for (const call of res.functionCalls) {
      let response;
      if (call.name !== 'execute_code') {
        response = { error: `Unknown tool ${call.name}. Only execute_code is available.` };
      } else {
        const code = String(call.args?.code || '');
        emit('code', { code });
        const started = Date.now();
        const run = await runInSandbox(
          code,
          toolNames,
          async (name, args) => {
            const out = await mcp.call(name, args);
            tracker.tool({ name, args, bytes: Buffer.byteLength(out.text), isError: out.isError, inSandbox: true });
            return out;
          },
          { timeoutMs: config.limits.sandboxTimeoutMs },
        );
        response = run.ok ? { result: truncate(run.value) } : { error: hint(run.error) };
        if (run.logs.length) response.logs = truncate(run.logs.join('\n'), 2000);
        emit('code_result', {
          ok: run.ok,
          ms: Date.now() - started,
          returnedBytes: Buffer.byteLength(JSON.stringify(response)),
          preview: truncate(run.ok ? run.value : run.error, 400),
        });
      }
      responses.push({
        functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response },
      });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return tracker.summary(`Stopped after ${config.limits.codeMaxSteps} model calls without a final answer.`);
}

function truncate(s, max = config.limits.codeResultMaxChars) {
  s = String(s);
  return s.length > max ? `${s.slice(0, max)}... [truncated ${s.length - max} chars: return less data]` : s;
}

function hint(error) {
  if (/interrupted/i.test(error)) return 'Timed out: the code ran too long.';
  if (/await|async|expecting ';'/i.test(error)) return `${error}. Note: the API functions are synchronous, do not use await/async.`;
  return error;
}

// ---- simulated model (no API key) ----
const SIM_CODE = `const { work_orders } = list_work_orders({ region: "North", overdue_only: true, limit: 100 });
const stock = {};
const qty = (sku) => (stock[sku] ??= get_part_stock({ sku, depot_id: "D-NORTH" }).qty_on_hand);
const fixable = work_orders
  .filter((wo) => wo.required_parts.every((p) => qty(p.sku) >= p.qty))
  .map((wo) => ({ id: wo.id, priority: wo.priority, days_overdue: wo.days_overdue, parts: wo.required_parts.map((p) => p.sku) }));
return { overdue: work_orders.length, fixable };`;

function simulateCode(req) {
  const modelTurns = req.contents.filter((c) => c.role === 'model').length;
  if (modelTurns === 0) {
    return simulatedResponse(req, [{ functionCall: { name: 'execute_code', args: { code: SIM_CODE } } }]);
  }
  return simulatedResponse(req, [{ text: 'SIMULATED ANSWER: the script checked every overdue North work order against D-NORTH stock inside the sandbox. Add GEMINI_API_KEY to .env for a real answer and real token counts.' }]);
}
