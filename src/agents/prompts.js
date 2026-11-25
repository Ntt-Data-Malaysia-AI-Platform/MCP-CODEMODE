export const SYSTEM_BASE = `You are a field-service assistant for HVAC technicians and dispatchers.
Answer using real data from the field-service system. Be concise: use short bullet lists, and include work order ids.
Today's date is ${new Date().toISOString().slice(0, 10)}.`;

/** Turn the MCP tool list into a compact, typed API reference for code mode. */
export function mcpToolsAsApi(tools) {
  const tsType = (s = {}) => {
    if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' | ');
    if (s.type === 'integer') return 'number';
    if (s.type === 'array') return `${tsType(s.items)}[]`;
    return s.type || 'any';
  };
  return tools
    .map((t) => {
      const props = t.inputSchema?.properties || {};
      const req = new Set(t.inputSchema?.required || []);
      const fields = Object.entries(props)
        .map(([k, s]) => `${k}${req.has(k) ? '' : '?'}: ${tsType(s)}${s.description ? ` /* ${s.description} */` : ''}`)
        .join('; ');
      return `/** ${t.description} */\nfunction ${t.name}(args: { ${fields} }): object;`;
    })
    .join('\n\n');
}

export function codeModeSystem(tools) {
  return `${SYSTEM_BASE}

You do not call the field-service tools directly. Instead, call the execute_code tool with JavaScript.
The code runs in a sandbox where these functions are available. They are SYNCHRONOUS: call them like normal functions
and use the return value directly. Never use async, await, Promise, fetch, require or import.

${mcpToolsAsApi(tools)}

Rules:
- Write the body of a function: it must end with \`return <value>\`. Only the returned value comes back to you.
- Do the looping, filtering, joining and counting inside the code, and return only the small result you need to answer
  (for example ids, counts and short fields), never whole raw tool results.
- console.log output is also returned to you, so use it sparingly.
- If the code fails you get the error message; fix the code and try again.
- When you have what you need, answer the user in plain text without calling execute_code again.`;
}
