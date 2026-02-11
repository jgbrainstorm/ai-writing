import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GoogleGenAI } from '@google/genai';

const PORT = Number(process.env.API_PORT || 8787);
const HOST = process.env.API_HOST || '127.0.0.1';
const ENV_FILES = ['.env', '.env.local'];
let runtimeConfig = null;

loadEnvFiles();

function loadEnvFiles() {
  for (const file of ENV_FILES) {
    const fullPath = resolve(process.cwd(), file);
    if (!existsSync(fullPath)) continue;

    const content = readFileSync(fullPath, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eqIndex = line.indexOf('=');
      if (eqIndex <= 0) continue;

      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      value = value.replace(/^['"]|['"]$/g, '');

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
  }
  if (!data) return {};
  return JSON.parse(data);
}

async function chatWithAzure({ message, history, essayContent, systemPrompt, azureOverride }) {
  const endpoint =
    azureOverride?.endpoint || runtimeConfig?.azure?.endpoint || process.env.AZURE_OPENAI_ENDPOINT || '';
  const apiKey =
    azureOverride?.apiKey || runtimeConfig?.azure?.apiKey || process.env.AZURE_OPENAI_API_KEY || '';
  const deploymentName =
    azureOverride?.deploymentName ||
    runtimeConfig?.azure?.deploymentName ||
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME ||
    '';
  const apiVersion =
    azureOverride?.apiVersion ||
    runtimeConfig?.azure?.apiVersion ||
    process.env.AZURE_OPENAI_API_VERSION ||
    '2024-02-01';
  const hasPlaceholder =
    endpoint.includes('YOUR-RESOURCE') ||
    apiKey.includes('your_azure_api_key') ||
    deploymentName.includes('your_deployment');

  if (!endpoint || !apiKey || !deploymentName || hasPlaceholder) {
    throw new Error(
      'Missing Azure configuration. Enter real Azure endpoint/key/deployment in Admin Dashboard and click Confirm Configuration, or set AZURE_OPENAI_* in .env.local.'
    );
  }

  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
  const messages = [
    { role: 'system', content: `${systemPrompt}\n\nCurrent essay context: ${essayContent}` },
    ...history.map((item) => ({
      role: item.role === 'model' ? 'assistant' : 'user',
      content: item.parts?.[0]?.text ?? '',
    })),
    { role: 'user', content: message },
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      messages,
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Azure OpenAI request failed (${response.status}): ${details}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || 'No response.';
}

async function chatWithGemini({ message, essayContent, systemPrompt }) {
  const apiKey = runtimeConfig?.gemini?.apiKey || process.env.GEMINI_API_KEY || '';
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  if (!apiKey || apiKey.includes('your_gemini_api_key')) {
    throw new Error('Missing GEMINI_API_KEY for Gemini provider in .env.local.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: `${systemPrompt}\n\nCurrent essay context: "${essayContent}"`,
    },
  });

  const response = await chat.sendMessage({ message });
  return response.text || 'No response.';
}

createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: 'Invalid request URL.' });
    return;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/config') {
    try {
      const body = await readJsonBody(req);
      const provider = String(body?.provider || 'azure').toLowerCase();
      const azure = body?.azure && typeof body.azure === 'object' ? body.azure : {};
      const gemini = body?.gemini && typeof body.gemini === 'object' ? body.gemini : {};

      runtimeConfig = {
        provider,
        azure: {
          endpoint: String(azure.endpoint || ''),
          apiKey: String(azure.apiKey || ''),
          deploymentName: String(azure.deploymentName || ''),
          apiVersion: String(azure.apiVersion || ''),
        },
        gemini: {
          apiKey: String(gemini.apiKey || ''),
        },
      };

      sendJson(res, 200, { ok: true });
      return;
    } catch (error) {
      sendJson(res, 400, {
        error: 'Invalid config payload.',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    try {
      const body = await readJsonBody(req);
      const message = body.message;
      const history = Array.isArray(body.history) ? body.history : [];
      const essayContent = body.essayContent ?? '';
      const providerFromBody = typeof body.provider === 'string' ? body.provider.toLowerCase() : '';
      const azureFromBody = body?.azure && typeof body.azure === 'object' ? body.azure : null;
      const systemPrompt =
        body.systemPrompt ||
        'You are a helpful writing assistant. Assist the user with ideas, grammar, and tone for their essay.';

      if (typeof message !== 'string' || !message.trim()) {
        sendJson(res, 400, { error: 'message is required.' });
        return;
      }

      const provider = (providerFromBody || runtimeConfig?.provider || process.env.LLM_PROVIDER || 'azure').toLowerCase();
      const text =
        provider === 'gemini'
          ? await chatWithGemini({ message, essayContent, systemPrompt })
          : await chatWithAzure({
              message,
              history,
              essayContent,
              systemPrompt,
              azureOverride: azureFromBody,
            });

      sendJson(res, 200, { text });
      return;
    } catch (error) {
      console.error('Chat API error:', error);
      sendJson(res, 500, {
        error: 'Failed to get chat response.',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found.' });
}).listen(PORT, HOST, () => {
  console.log(`API server listening on http://${HOST}:${PORT}`);
});
