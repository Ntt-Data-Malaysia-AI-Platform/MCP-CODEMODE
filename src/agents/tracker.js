// Collects every LLM call and tool call of one run and streams them to the UI.
import { estimateCost } from '../config.js';

export function createTracker(mode, emit) {
  const t = {
    mode,
    started: Date.now(),
    llmCalls: [],
    toolCalls: 0,
    contextBytes: 0, // tool output that was sent into the model's context
    sandboxBytes: 0, // tool output that stayed inside the sandbox
    totals: { input: 0, cached: 0, output: 0, thinking: 0, total: 0 },

    llm(usage, extra = {}) {
      for (const k of Object.keys(t.totals)) t.totals[k] += usage[k] || 0;
      const call = { n: t.llmCalls.length + 1, ...usage, ...extra };
      t.llmCalls.push(call);
      emit('llm_call', { ...call, totals: { ...t.totals }, cost: estimateCost(t.totals) });
    },
    tool({ name, args, bytes, isError, inSandbox }) {
      t.toolCalls++;
      if (inSandbox) t.sandboxBytes += bytes;
      else t.contextBytes += bytes;
      emit('tool_call', { n: t.toolCalls, name, args, bytes, isError, inSandbox, contextBytes: t.contextBytes, sandboxBytes: t.sandboxBytes });
    },
    summary(answer) {
      return {
        mode,
        llm_calls: t.llmCalls.length,
        tool_calls: t.toolCalls,
        input_tokens: t.totals.input,
        cached_tokens: t.totals.cached,
        output_tokens: t.totals.output,
        thinking_tokens: t.totals.thinking,
        total_tokens: t.totals.total,
        context_bytes: t.contextBytes,
        sandbox_bytes: t.sandboxBytes,
        duration_ms: Date.now() - t.started,
        est_cost_usd: Number(estimateCost(t.totals).toFixed(6)),
        answer,
        steps: t.llmCalls,
      };
    },
  };
  return t;
}
