// One place that talks to Gemini and reports the exact token usage of every call.
// Without GEMINI_API_KEY it falls back to a scripted "simulated" model so the UI can be rehearsed;
// simulated token counts are estimates (characters / 4) and are labelled as such in the UI.
import { GoogleGenAI } from '@google/genai';
import { config, llmMode } from '../config.js';

// Function calling needs the v1beta API; the SDK defaults to v1.
const ai = llmMode === 'live' ? new GoogleGenAI({ apiKey: config.gemini.apiKey, apiVersion: 'v1beta' }) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @returns {Promise<{ content, functionCalls, text, usage: {input, cached, output, thinking, total} }>}
 */
export async function callModel({ system, contents, functionDeclarations, onRetry, simulate }) {
  if (llmMode !== 'live') return simulate({ system, contents, functionDeclarations });

  const req = {
    model: config.gemini.model,
    contents,
    config: {
      systemInstruction: system,
      temperature: 0,
      tools: [{ functionDeclarations }],
      ...(config.gemini.thinkingBudget !== undefined
        ? { thinkingConfig: { thinkingBudget: config.gemini.thinkingBudget } }
        : {}),
    },
  };

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await ai.models.generateContent(req);
      const u = res.usageMetadata || {};
      const content = res.candidates?.[0]?.content || { role: 'model', parts: [] };
      return {
        content,
        functionCalls: res.functionCalls || [],
        text: (content.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join(''),
        usage: {
          input: u.promptTokenCount || 0,
          cached: u.cachedContentTokenCount || 0,
          output: u.candidatesTokenCount || 0,
          thinking: u.thoughtsTokenCount || 0,
          total: u.totalTokenCount || 0,
        },
      };
    } catch (err) {
      const status = err?.status || err?.code;
      if ((status === 429 || status === 503 || status === 500) && attempt < 4) {
        const wait = 2000 * 2 ** attempt;
        onRetry?.({ attempt: attempt + 1, waitMs: wait, status });
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

/** Rough token estimate for simulated mode. */
export const estTokens = (v) => Math.ceil((typeof v === 'string' ? v : JSON.stringify(v)).length / 4);

/** Build a simulated response with estimated usage that grows with the context, like the real thing. */
export function simulatedResponse({ system, contents, functionDeclarations }, parts) {
  const input = estTokens(system) + estTokens(functionDeclarations) + estTokens(contents);
  const output = estTokens(parts);
  return {
    content: { role: 'model', parts },
    functionCalls: parts.filter((p) => p.functionCall).map((p) => p.functionCall),
    text: parts.map((p) => p.text || '').join(''),
    usage: { input, cached: 0, output, thinking: 0, total: input + output },
  };
}

/** Strip JSON Schema keys Gemini doesn't need. */
export function toGeminiSchema(schema) {
  const { $schema, ...rest } = schema || { type: 'object', properties: {} };
  return rest;
}
