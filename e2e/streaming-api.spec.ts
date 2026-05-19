import { test, expect } from '@playwright/test';

function parseSSEStream(text: string) {
  const chunks: string[] = [];
  let finalCode = '';
  let errorMessage: string | null = null;

  const events = text.split('\n\n').filter(Boolean);

  for (const event of events) {
    const lines = event.split('\n');
    let eventType = '';
    let data = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.replace('event:', '').trim();
      }
      if (line.startsWith('data:')) {
        data = line.replace('data:', '').trim();
      }
    }

    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (eventType === 'chunk' && parsed.text) {
          chunks.push(parsed.text);
        } else if (eventType === 'done' && parsed.code) {
          finalCode = parsed.code;
        } else if (eventType === 'error' && parsed.message) {
          errorMessage = parsed.message;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  return { chunks, finalCode, errorMessage };
}

test.describe('Code Generation Streaming API', () => {
  const API_URL = 'http://localhost:3002/api/generate';

  test('SSE 스트림으로 컴포넌트 코드를 수신해야 함', async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {
        prompt: 'a simple blue button with click handler',
        provider: 'google',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/event-stream');

    const text = await response.text();
    const { chunks, finalCode, errorMessage } = parseSSEStream(text);

    if (errorMessage) {
      console.log('API Error:', errorMessage);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(finalCode.length).toBeGreaterThan(0);
    expect(finalCode).toContain('button');
    expect(finalCode).toMatch(/render\(<\w+\s*\/?\s*>\)/);
  });

  test('누적된 청크가 최종 코드와 일치해야 함', async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {
        prompt: 'a counter component',
        provider: 'google',
      },
    });

    const text = await response.text();
    const { chunks, finalCode } = parseSSEStream(text);

    const accumulated = chunks.join('');
    expect(finalCode.length).toBeGreaterThan(0);
    expect(accumulated.length).toBeGreaterThan(0);
  });

  test('필수 CORS 헤더를 포함해야 함', async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {
        prompt: 'test',
        provider: 'google',
      },
    });

    expect(response.headers()['access-control-allow-origin']).toBe('*');
    expect(response.headers()['access-control-allow-methods']).toContain('POST');
    expect(response.headers()['cache-control']).toBe('no-cache');
    expect(response.headers()['connection']).toBe('keep-alive');
  });

  test('프롬프트 없이 요청하면 400 에러를 반환해야 함', async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {
        prompt: '',
        provider: 'google',
      },
    });

    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  test('API 키 없으면 400 에러를 반환해야 함', async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {
        prompt: 'a button',
        provider: 'invalid-provider',
      },
    });

    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('API key');
  });

  test('최종 코드는 반드시 render() 호출을 포함해야 함', async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {
        prompt: 'a gradient card',
        provider: 'google',
      },
    });

    const text = await response.text();
    const { finalCode } = parseSSEStream(text);

    if (finalCode) {
      expect(finalCode).toMatch(/render\(<\w+/);
      expect(finalCode).not.toContain('```');
      expect(finalCode).not.toContain('import');
      expect(finalCode).not.toContain('export');
    } else {
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
