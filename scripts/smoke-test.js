// Runs both modes end to end on the first scenario and prints the token totals.
// Uses Gemini if GEMINI_API_KEY is set, otherwise the simulated model.
import { connectMcp } from '../src/mcp-server.js';
import { runDirect } from '../src/agents/direct.js';
import { runCodeMode } from '../src/agents/codemode.js';
import { scenarios } from '../src/scenarios.js';
import { llmMode, dataSource } from '../src/config.js';

const scenario = scenarios.find((s) => s.id === (process.argv[2] || 'fix-today')) || scenarios[0];
console.log(`LLM: ${llmMode}, data: ${dataSource}, scenario: ${scenario.id}\n`);

const results = {};
for (const [mode, run] of [['direct', runDirect], ['code', runCodeMode]]) {
  const mcp = await connectMcp();
  const emit = (type, d) => {
    if (type === 'llm_call') console.log(`  [${mode}] LLM #${d.n}: in ${d.input}, out ${d.output}, think ${d.thinking} -> calls ${d.functionCalls.join(',') || '(answer)'}`);
    if (type === 'code_result') console.log(`  [${mode}] sandbox ${d.ok ? 'ok' : 'ERROR'} in ${d.ms} ms, ${d.returnedBytes} B back to model: ${d.preview.slice(0, 120)}`);
    if (type === 'retry') console.log(`  [${mode}] rate limited, retry ${d.attempt} in ${d.waitMs} ms`);
  };
  results[mode] = await run({ prompt: scenario.prompt, mcp, emit });
  await mcp.close();
  const r = results[mode];
  console.log(`=> ${mode}: ${r.total_tokens} tokens, ${r.llm_calls} LLM calls, ${r.tool_calls} tool calls, context ${r.context_bytes} B, sandbox ${r.sandbox_bytes} B\n   answer: ${r.answer.slice(0, 200)}\n`);
}
const ratio = results.direct.total_tokens / Math.max(1, results.code.total_tokens);
console.log(`Direct MCP used ${ratio.toFixed(1)}x the tokens of code mode.`);
