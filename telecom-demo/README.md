# Gemini Frontier Operations: Telecom plan advisor

A self-contained demo (no API keys needed): a telecom customer wants the best plan and product, and their savings over 6 and 12 months.
One button runs five agents two ways, side by side, and shows exactly how many tokens each way uses.

## Open it

- Double-click `index.html`. It needs no server, internet, Gemini key or Supabase key.
- Or, with the main app running (`npm start` in the parent folder), open http://localhost:3000/telecom/

Sign in with the demo username and password you were given. `js/config.js` stores only the username and a SHA-256 hash of the password (it explains how to set a new one). This is a simple demo gate, not real security.

## What happens when you click "Find my best plan & savings"

| Agent | Direct MCP connector | Code mode |
|---|---|---|
| Usage Analyst | Calls `get_usage_history` in half-year pages (184 days); ~1,100 lean daily rows go into the model's context and are re-sent on every later call | One script pages through the same rows in the sandbox and returns monthly totals |
| Plan Catalog | Reads the full plan catalog and promotions into context | Script filters eligible plans and returns a short list |
| Product Advisor | Reads all phones, routers and hotspots into context | Script picks products from the usage and returns them |
| Savings Calculator | The model works through every plan × 12 months in its own reply | Script costs every plan month by month and returns the top 3 |
| Recommendation | Same in both: one call that writes the answer | |

## How tokens and cost are measured

The page's neon-blue **How we measure** section (also linked from the top bar) explains this on screen, and after each run it lists every LLM call.

1. **Tokens ≈ characters ÷ 4** for every piece of text sent to or written by the model.
2. **Input per call** = system prompt + tool definitions + request and earlier agents' handoffs + conversation so far. The model has no memory, so all of it is sent on every call.
   - Direct MCP: the conversation includes every raw tool result, so it grows with each call (about 87% of all input for Deepan).
   - Code mode: tool results stay in the sandbox; only the script and its 1–3 KB return value join the conversation.
3. **Output** = what the model writes: tool-call requests, scripts, summaries, the final answer, and (direct MCP only) the Savings Calculator's own working.
4. **Cost** = input × $0.375 / 1M + output × $1.88 / 1M (Gemini 3.8 Flash, bought directly from Google, 2026 pricing).
5. **Not counted:** thinking tokens, caching discounts, retries. Time is modelled from token counts.

## How honest are the numbers?

- The BSS MCP server (`js/mcp.js`) returns realistic data: 12 months of daily usage per line, a 20-plan Malaysian catalog in RM, 16 devices and 4 promotions (`js/data.js`).
- The code-mode scripts (`js/scripts.js`) really run on that data. Their results are the recommendation and savings both lanes show.
- No model is called. Token counts are measured from exactly what each approach would send to the model, at about 4 characters per token. This demo shows 4.9× for Deepan. The ratio depends on how much raw data direct MCP has to read: the usage API returns lean daily rows (date, data, hotspot, voice, roaming) in pages of up to 184 days. With 92-day pages and fuller rows the same run measures 12.7×; with whole-year pages and lean rows it measures 3.6×.
- The model shown is Gemini 3.8 Flash. Cost uses $0.375 / $1.88 per 1M input / output tokens, set in `PRICE` in `js/engine.js` and shown on the cost card in `index.html`; change both together if prices change.

## Demo customer

| Customer | Region | Story | Best plan | Savings | Tokens: direct vs code |
|---|---|---|---|---|---|
| Deepan | Kuala Lumpur, Malaysia (RM) | 3 lines on Postpaid 48, two over their allowance every month, separate RM139 home fibre, ASEAN trips | Fibre 1G + Family 249 (about RM225/month vs RM411 today) | RM1,248 in 6 months, RM2,222 in 12 months | 63.4k vs 12.9k (4.9×), $0.0270 vs $0.0090 |

The agents pass the customer's region (`MY`) to every catalog tool, so only Malaysian plans, promotions and RM device prices are considered. The code still contains an Indian (₹) catalog; to bring other customers back, add them to `customers` in `js/data.js` and the customer picker reappears automatically.
