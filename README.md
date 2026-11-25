# MCP-CODEMODE

Two demos that compare how many tokens an AI agent uses when it calls MCP tools directly versus when it writes code that calls them ("code mode").

| Folder | What it is | Needs |
|---|---|---|
| [`telecom-demo/`](telecom-demo/README.md) | **Gemini Frontier Operations · Telecom**: an NTT DATA–styled demo. Five agents find the best plan, product and 6/12-month savings for a Malaysian customer (RM), running Direct MCP and Code mode side by side, with a call-by-call token breakdown. | Nothing. Open `telecom-demo/index.html`, or run `npm start` and open http://localhost:3000/telecom/ |
| this README | **Token Lens**: the same comparison against live Gemini and Supabase, on a field-service dataset. | A Gemini API key, optional Supabase |

---

# Token Lens: MCP vs Code Mode

A live demo that asks Gemini the same question two ways and shows exactly how many tokens each one uses.

- **Direct MCP**: every MCP tool is a Gemini function. The model calls the tools one by one. Every result goes into the conversation, and the whole conversation is sent again on every call.
- **Code mode**: the model gets one tool, `execute_code`, plus a typed API generated from the **same MCP server**. It writes one script, the script calls the MCP tools inside a QuickJS sandbox, and only the script's small result goes back to the model.

Token numbers come from Gemini's own `usageMetadata` on every call (input, output, thinking and cached tokens). Nothing is estimated in live mode.

```
Browser (public/)  ──SSE──▶  Node server (src/server.js)
                                  │
                ┌─────────────────┴──────────────────┐
         Direct MCP agent                      Code mode agent
     (Gemini function calling)       (Gemini + execute_code → QuickJS sandbox)
                └─────────────────┬──────────────────┘
                          MCP client ⇄ MCP server (src/mcp-server.js)
                                  │
                              Supabase  (work_orders, parts_inventory, depots, demo_runs)
```

## Run it

1. Install the dependencies:
   ```powershell
   npm install
   ```
2. Copy `.env.example` to `.env` and fill it in:
   - `GEMINI_API_KEY`: from Google AI Studio. Without it the app runs **simulated** (estimated tokens, for rehearsal only).
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: from Supabase, Project Settings → API. Without them the app uses the same demo data in memory.
3. Set up Supabase (once): open the SQL Editor, run `supabase/schema.sql`, then load the data:
   ```powershell
   npm run seed
   ```
4. Start the app and open http://localhost:3000:
   ```powershell
   npm start
   ```

Check the whole pipeline from the terminal without the UI:
```powershell
npm test
```
To try another scenario, pass its id (`fix-today`, `backlog` or `lookup`), for example `node scripts/smoke-test.js backlog`.

## The three scenarios

| Scenario | What it shows |
|---|---|
| **Fix-today list** | A multi-step join: overdue orders × parts stock. Direct MCP re-sends a ~17 KB order list on every call; code mode keeps it in the sandbox. |
| **Regional backlog** | Aggregation over hundreds of rows. Direct MCP has to read all of them; code mode counts them in code. |
| **Single lookup** | One tool call. The honest counter-example: code mode pays a fixed cost for its API docs, so it ties or loses. |

You can also type any question into the prompt box.

## What to point at during the demo

- **Tokens per LLM call**: in direct MCP the bars grow with every call, because the context keeps getting longer. Both lanes use the same scale.
- **Where the tool data went**: direct MCP sends every tool result into the model's context. In code mode it stays in the sandbox.
- **Timeline**: code mode shows the script the model wrote, then many tool calls marked "stays in sandbox", then only a few hundred bytes going back.
- **Run history**: every run is saved to the Supabase `demo_runs` table, so you can compare runs (or models) afterwards.

## Notes

- **Model**: set by `GEMINI_MODEL` (default `gemini-2.5-flash`). Set `GEMINI_THINKING_BUDGET=0` to switch off thinking on 2.5 models for a cleaner comparison; thinking tokens are shown separately either way.
- **Prices**: `PRICE_*` in `.env` are only used for the cost estimate. Check them against current Gemini pricing.
- **Free tier**: direct MCP makes many calls, so it can hit rate limits. The server retries with backoff and shows the retries in the timeline. Use "Direct MCP only" / "Code mode only" to run the modes one at a time.
- **Sandbox**: model-written code runs in QuickJS (WebAssembly) with a 64 MB memory limit and a 20 s timeout. It has no network, filesystem or Node access, only the MCP tools and `console.log`.
- **Using the MCP server elsewhere**: `npm run mcp:stdio` serves the same field-service tools over stdio for Gemini CLI, Claude or any other MCP client.
- **Security**: the Supabase service role key stays on the server. Row level security is on for every table and there are no public policies, so the browser can't read the database directly.
- **Corporate networks**: the npm scripts run Node with `--use-system-ca`, so it trusts the Windows certificate store. Without it, a network that inspects HTTPS makes calls to Supabase and Gemini fail with `fetch failed`.
- **Fresh data**: due dates are relative to the day you seed, so re-run `npm run seed` shortly before the event to keep the "overdue" numbers realistic.
