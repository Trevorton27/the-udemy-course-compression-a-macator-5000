import Anthropic from '@anthropic-ai/sdk';

export const HAIKU_MODEL = process.env['AI_PASS1_MODEL'] ?? 'claude-haiku-4-5-20251001';
export const SONNET_MODEL = process.env['AI_PASS2_MODEL'] ?? 'claude-sonnet-4-6';

let _client: Anthropic | null = null;

export function getAiClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey || apiKey === 'sk-ant-your-key-here') {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add your key to the .env file and restart the server.',
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}
