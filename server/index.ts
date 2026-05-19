import {
  stripCodeFences,
  ensureRenderCall,
  resolveApiKey,
  callAnthropicStream,
  callGoogleStream,
  ENV_KEYS,
  type Provider,
} from './lib';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SSE_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

const server = Bun.serve({
  port: 3002,
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return Response.json(
        {
          envKeys: {
            anthropic: !!ENV_KEYS.anthropic,
            google: !!ENV_KEYS.google,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      let prompt: string;
      let apiKey: string | undefined;
      let provider: Provider;

      try {
        const body = (await req.json()) as {
          prompt: string;
          apiKey?: string;
          provider?: Provider;
        };
        prompt = body.prompt;
        apiKey = body.apiKey;
        provider = body.provider ?? 'anthropic';
      } catch {
        return Response.json(
          { error: 'Invalid JSON body' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const resolvedKey = resolveApiKey(provider, apiKey);

      if (!resolvedKey) {
        return Response.json(
          {
            error: `API key is required. Set ${
              provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'
            } in .env or enter it manually.`,
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (!prompt) {
        return Response.json(
          { error: 'Prompt is required' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const encode = (s: string) => new TextEncoder().encode(s);
      const formatEvent = (event: string, data: unknown) =>
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const generator =
              provider === 'google'
                ? callGoogleStream(prompt, resolvedKey)
                : callAnthropicStream(prompt, resolvedKey);

            let accumulated = '';

            for await (const chunk of generator) {
              accumulated += chunk;
              controller.enqueue(encode(formatEvent('chunk', { text: chunk })));
            }

            const finalCode = ensureRenderCall(stripCodeFences(accumulated));
            controller.enqueue(encode(formatEvent('done', { code: finalCode })));
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            let userMessage = message;

            if (message.includes('503')) {
              userMessage =
                'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.';
            } else if (message.includes('429')) {
              userMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
            }

            controller.enqueue(encode(formatEvent('error', { message: userMessage })));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, { headers: SSE_HEADERS });
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS_HEADERS });
  },
});

console.log(`API server running at http://localhost:${server.port}`);
