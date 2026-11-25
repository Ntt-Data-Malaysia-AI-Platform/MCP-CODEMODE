import express from 'express';
import { fileURLToPath } from 'node:url';
import { config, llmMode, dataSource } from './config.js';
import { store } from './data.js';
import { connectMcp } from './mcp-server.js';
import { runDirect } from './agents/direct.js';
import { runCodeMode } from './agents/codemode.js';
import { scenarios } from './scenarios.js';

const app = express();
app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
// Telecom demo (static, no keys needed): http://localhost:3000/telecom/
app.use('/telecom', express.static(fileURLToPath(new URL('../telecom-demo', import.meta.url))));

app.get('/api/config', (_req, res) => {
  res.json({ model: config.gemini.model, llmMode, dataSource, pricing: config.pricing, scenarios });
});

app.get('/api/runs', async (_req, res) => {
  try {
    res.json(await store.listRuns(30));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server-sent events: streams every LLM call and tool call of one run as it happens.
app.get('/api/run', async (req, res) => {
  const mode = req.query.mode === 'code' ? 'code' : 'direct';
  const prompt = String(req.query.prompt || '').slice(0, 2000);
  const scenario = String(req.query.scenario || 'custom');
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  let closed = false;
  req.on('close', () => (closed = true));
  const emit = (type, data) => {
    if (!closed) res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const mcp = await connectMcp();
  try {
    emit('start', { mode, model: config.gemini.model, llmMode, tools: mcp.tools.map((t) => t.name) });
    const run = mode === 'code' ? runCodeMode : runDirect;
    const summary = await run({ prompt, mcp, emit });
    let saved = null;
    try {
      saved = await store.saveRun({ ...summary, scenario, prompt, model: config.gemini.model, llm_mode: llmMode });
    } catch (err) {
      emit('warn', { message: `Run not saved: ${err.message}` });
    }
    emit('done', { ...summary, id: saved?.id });
  } catch (err) {
    console.error(err);
    emit('error', { message: err.message || String(err) });
  } finally {
    await mcp.close().catch(() => {});
    res.end();
  }
});

app.listen(config.port, () => {
  console.log(`Token Lens running at http://localhost:${config.port}`);
  console.log(`  model: ${config.gemini.model} (${llmMode})   data: ${dataSource}`);
  if (llmMode !== 'live') console.log('  No GEMINI_API_KEY set: running SIMULATED (estimated tokens). Add a key to .env for real numbers.');
});
