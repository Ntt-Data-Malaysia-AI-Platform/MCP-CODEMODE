import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  port: num(process.env.PORT, 3000),
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    thinkingBudget:
      process.env.GEMINI_THINKING_BUDGET === undefined || process.env.GEMINI_THINKING_BUDGET === ''
        ? undefined
        : Number(process.env.GEMINI_THINKING_BUDGET),
  },
  pricing: {
    inputPerM: num(process.env.PRICE_INPUT_PER_M, 0.3),
    cachedInputPerM: num(process.env.PRICE_CACHED_INPUT_PER_M, 0.03),
    outputPerM: num(process.env.PRICE_OUTPUT_PER_M, 2.5),
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  limits: {
    directMaxSteps: 40,
    codeMaxSteps: 6,
    sandboxTimeoutMs: 20000,
    codeResultMaxChars: 6000,
  },
};

export const llmMode = config.gemini.apiKey ? 'live' : 'simulated';
export const dataSource = config.supabase.url && config.supabase.serviceRoleKey ? 'supabase' : 'memory';

export function estimateCost({ input = 0, cached = 0, output = 0, thinking = 0 }) {
  const p = config.pricing;
  const fresh = Math.max(0, input - cached);
  return (fresh * p.inputPerM + cached * p.cachedInputPerM + (output + thinking) * p.outputPerM) / 1e6;
}
