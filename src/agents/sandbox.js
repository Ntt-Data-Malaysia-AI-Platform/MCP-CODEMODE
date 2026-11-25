// Runs model-written JavaScript inside a QuickJS WebAssembly sandbox.
// The code has no network, no filesystem and no Node APIs: the only thing it can reach
// is the MCP tools we hand it, plus console.log.
import { newAsyncContext, shouldInterruptAfterDeadline } from 'quickjs-emscripten';

/**
 * @param {string} code      Body of a function; must `return` the answer.
 * @param {string[]} toolNames
 * @param {(name: string, args: object) => Promise<{text: string, isError: boolean}>} callTool
 * @param {{ timeoutMs: number }} opts
 */
export async function runInSandbox(code, toolNames, callTool, { timeoutMs }) {
  const ctx = await newAsyncContext();
  const logs = [];
  try {
    ctx.runtime.setMemoryLimit(64 * 1024 * 1024);
    ctx.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + timeoutMs));

    // __call(name, jsonArgs) -> jsonResult. Looks synchronous to the guest code.
    const callHandle = ctx.newAsyncifiedFunction('__call', async (nameH, argsH) => {
      const name = ctx.getString(nameH);
      const args = JSON.parse(ctx.getString(argsH) || '{}');
      const { text, isError } = await callTool(name, args);
      if (isError) return { error: ctx.newError(text) };
      return ctx.newString(text);
    });
    ctx.setProp(ctx.global, '__call', callHandle);
    callHandle.dispose();

    const logHandle = ctx.newFunction('log', (...args) => {
      logs.push(args.map((a) => { const v = ctx.dump(a); return typeof v === 'string' ? v : JSON.stringify(v); }).join(' '));
    });
    const consoleObj = ctx.newObject();
    ctx.setProp(consoleObj, 'log', logHandle);
    ctx.setProp(ctx.global, 'console', consoleObj);
    logHandle.dispose();
    consoleObj.dispose();

    const prelude = toolNames
      .map((n) => `function ${n}(args) { return JSON.parse(__call(${JSON.stringify(n)}, JSON.stringify(args || {}))); }`)
      .join('\n');
    const wrapped = `${prelude}\nJSON.stringify((function () {\n${code}\n})());`;

    const result = await ctx.evalCodeAsync(wrapped, 'agent.js');
    if (result.error) {
      const err = ctx.dump(result.error);
      result.error.dispose();
      const message = typeof err === 'object' && err ? `${err.name || 'Error'}: ${err.message}` : String(err);
      return { ok: false, error: message, logs };
    }
    const out = ctx.dump(result.value);
    result.value.dispose();
    return { ok: true, value: out === undefined ? 'undefined' : out, logs };
  } finally {
    ctx.dispose();
  }
}
