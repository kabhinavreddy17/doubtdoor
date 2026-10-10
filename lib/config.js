// Reads settings from a file called .env (if it exists) and from the computer's environment.
// You only ever need to set AI_API_KEY. Everything else has a sensible default.
const fs = require('fs');
const path = require('path');

try {
  const text = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  text.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) {
  /* no .env file, that is fine */
}

const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const key = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || '';

module.exports = {
  port: Number(process.env.PORT) || 3000,
  ai: {
    provider, // "gemini" (default) or "anthropic"
    key,
    enabled: key.length > 10,
    model:
      process.env.AI_MODEL ||
      (provider === 'anthropic' ? 'claude-haiku-5-5' : 'gemini-3.8-flash'),
    baseUrl: process.env.AI_BASE_URL || '', // only used for testing
  },
};
