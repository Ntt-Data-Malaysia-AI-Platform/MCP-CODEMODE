// Mode 1: classic MCP tool calling. Every MCP tool is a Gemini function declaration;
// the model calls one (or a few in parallel), the full result goes back into the conversation,
// and the whole conversation is re-sent on the next call.
import { config } from '../config.js';
import { callModel, simulatedResponse, toGeminiSchema } from './llm.js';
import { createTracker } from './tracker.js';
import { SYSTEM_BASE } from './prompts.js';

export async function runDirect({ prompt, mcp, emit }) {
  const tracker = createTracker('direct', emit);
  const functionDeclarations = mcp.tools.map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: toGeminiSchema(t.inputSchema),
  }));
  const system = `${SYSTEM_BASE}\nUse the available tools to look up the data you need.`;
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];

  for (let step = 1; step <= config.limits.directMaxSteps; step++) {
    const res = await callModel({
      system,
      contents,
      functionDeclarations,
      onRetry: (r) => emit('retry', r),
      simulate: simulateDirect,
    });
    contents.push(res.content);
    tracker.llm(res.usage, {
      functionCalls: res.functionCalls.map((c) => c.name),
      contextMessages: contents.length,
    });

    if (!res.functionCalls.length) return tracker.summary(res.text);

    const responses = [];
    for (const call of res.functionCalls) {
      const { text, isError } = await mcp.call(call.name, call.args || {});
      tracker.tool({ name: call.name, args: call.args, bytes: Buffer.byteLength(text), isError, inSandbox: false });
      let output;
      try { output = JSON.parse(text); } catch { output = text; }
      responses.push({
        functionResponse: {
          ...(call.id ? { id: call.id } : {}),
          name: call.name,
          response: isError ? { error: text } : { output },
        },
      });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return tracker.summary(`Stopped after ${config.limits.directMaxSteps} model calls without a final answer.`);
}

// ---- simulated model (no API key): a plausible tool-calling sequence ----
function simulateDirect(req) {
  const { contents } = req;
  const modelParts = contents.filter((c) => c.role === 'model').flatMap((c) => c.parts);
  if (!modelParts.length) {
    return simulatedResponse(req, [
      { functionCall: { name: 'list_work_orders', args: { region: 'North', overdue_only: true } } },
    ]);
  }
  // contents: [user prompt, model list call, tool result, ...]
  const orders = contents[2]?.parts?.[0]?.functionResponse?.response?.output?.work_orders || [];
  const skus = [...new Set(orders.flatMap((w) => w.required_parts.map((p) => p.sku)))];
  const checked = modelParts.filter((p) => p.functionCall?.name === 'get_part_stock').length;
  const next = skus.slice(checked, checked + 6); // like a real model: a few parallel calls per turn
  if (next.length) {
    return simulatedResponse(req, next.map((sku) => ({ functionCall: { name: 'get_part_stock', args: { sku, depot_id: 'D-NORTH' } } })));
  }
  return simulatedResponse(req, [{ text: 'SIMULATED ANSWER: checked every overdue North work order against D-NORTH stock. Add GEMINI_API_KEY to .env for a real answer and real token counts.' }]);
}
