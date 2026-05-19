import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  stripCodeFences,
  ensureRenderCall,
  resolveApiKey,
  callAnthropicStream,
  callGoogleStream,
} from './lib';

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── stripCodeFences ───────────────────────────────────────────────────────────

describe('stripCodeFences', () => {
  it('```jsx 펜스를 제거한다', () => {
    const input = '```jsx\nconst A = () => <div />\n```';
    expect(stripCodeFences(input)).toBe('const A = () => <div />');
  });

  it('```tsx 펜스를 제거한다', () => {
    const input = '```tsx\nconst A = () => <div />\n```';
    expect(stripCodeFences(input)).toBe('const A = () => <div />');
  });

  it('```javascript 펜스를 제거한다', () => {
    const input = '```javascript\nconst x = 1;\n```';
    expect(stripCodeFences(input)).toBe('const x = 1;');
  });

  it('펜스 없는 코드는 그대로 반환한다', () => {
    const code = 'const A = () => <div />';
    expect(stripCodeFences(code)).toBe(code);
  });

  it('앞뒤 공백을 trim한다', () => {
    const input = '  \nconst A = 1;\n  ';
    expect(stripCodeFences(input)).toBe('const A = 1;');
  });
});

// ─── ensureRenderCall ──────────────────────────────────────────────────────────

describe('ensureRenderCall', () => {
  it('render() 호출이 이미 있으면 코드를 그대로 반환한다', () => {
    const code = 'function Button() { return <button />; }\nrender(<Button />);';
    expect(ensureRenderCall(code)).toBe(code);
  });

  it('render() 호출이 없으면 render(<ComponentName />)를 추가한다', () => {
    const code = 'function Button() { return <button />; }';
    const result = ensureRenderCall(code);
    expect(result).toContain('render(<Button />);');
  });

  it('const 컴포넌트에서도 이름을 감지한다', () => {
    const code = 'const MyCard = () => <div />;';
    const result = ensureRenderCall(code);
    expect(result).toContain('render(<MyCard />);');
  });

  it('컴포넌트명이 없으면 코드를 그대로 반환한다', () => {
    const code = 'const x = 42;';
    expect(ensureRenderCall(code)).toBe(code);
  });
});

// ─── resolveApiKey ────────────────────────────────────────────────────────────

describe('resolveApiKey', () => {
  it('clientKey가 있으면 clientKey를 반환한다', () => {
    expect(resolveApiKey('anthropic', 'client-key', { anthropic: 'env-key', google: undefined })).toBe('client-key');
  });

  it('clientKey가 없고 envKeys에 키가 있으면 envKey를 반환한다', () => {
    expect(resolveApiKey('anthropic', undefined, { anthropic: 'env-key', google: undefined })).toBe('env-key');
  });

  it('둘 다 없으면 null을 반환한다', () => {
    expect(resolveApiKey('anthropic', undefined, { anthropic: undefined, google: undefined })).toBeNull();
  });

  it('google provider의 envKey를 반환한다', () => {
    expect(resolveApiKey('google', undefined, { anthropic: undefined, google: 'google-key' })).toBe('google-key');
  });
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeReadableStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function mockFetch(ok: boolean, body: string | ReadableStream<Uint8Array>, status = 200) {
  const bodyStream = typeof body === 'string' ? makeReadableStream(body) : body;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      body: bodyStream,
    })
  );
}

function buildAnthropicSSE(chunks: string[]): string {
  const lines = chunks.map(
    (text) =>
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text },
      })}\n\n`
  );
  lines.push('event: message_stop\ndata: {"type":"message_stop"}\n\n');
  return lines.join('');
}

function buildGoogleSSE(chunks: string[]): string {
  return chunks
    .map(
      (text) =>
        `data: ${JSON.stringify({
          candidates: [{ content: { parts: [{ text }] } }],
        })}\n\n`
    )
    .join('');
}

// ─── callAnthropicStream ───────────────────────────────────────────────────────

describe('callAnthropicStream', () => {
  it('Anthropic SSE에서 text_delta 청크를 yield한다', async () => {
    mockFetch(true, buildAnthropicSSE(['const ', 'Button', ' = () => {};']));

    const chunks: string[] = [];
    for await (const chunk of callAnthropicStream('버튼', 'test-key')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['const ', 'Button', ' = () => {};']);
  });

  it('message_stop 이벤트에서 generator를 종료한다', async () => {
    mockFetch(true, buildAnthropicSSE(['hello']));

    const chunks: string[] = [];
    for await (const chunk of callAnthropicStream('test', 'key')) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
  });

  it('HTTP 에러 응답 시 에러를 throw한다', async () => {
    mockFetch(false, '', 429);

    await expect(async () => {
      for await (const chunk of callAnthropicStream('test', 'key')) {
        void chunk;
      }
    }).rejects.toThrow('Claude API error: 429');
  });

  it('패킷 경계를 넘는 SSE 라인을 올바르게 처리한다', async () => {
    // 두 청크로 나뉘어 오는 경우 시뮬레이션
    const part1 = 'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","tex';
    const part2 = 't":"hello"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n';

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(part1));
        controller.enqueue(new TextEncoder().encode(part2));
        controller.close();
      },
    });
    mockFetch(true, stream);

    const chunks: string[] = [];
    for await (const chunk of callAnthropicStream('test', 'key')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['hello']);
  });
});

// ─── callGoogleStream ──────────────────────────────────────────────────────────

describe('callGoogleStream', () => {
  it('Google SSE에서 텍스트 청크를 yield한다', async () => {
    mockFetch(true, buildGoogleSSE(['const ', 'Card']));

    const chunks: string[] = [];
    for await (const chunk of callGoogleStream('카드', 'test-key')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['const ', 'Card']);
  });

  it('MAX_TOKENS finishReason 시 에러를 throw한다', async () => {
    const body = `data: ${JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'partial' }] }, finishReason: 'MAX_TOKENS' }],
    })}\n\n`;
    mockFetch(true, body);

    await expect(async () => {
      for await (const chunk of callGoogleStream('test', 'key')) {
        void chunk;
      }
    }).rejects.toThrow('잘렸습니다');
  });

  it('HTTP 에러 응답 시 에러를 throw한다', async () => {
    mockFetch(false, '', 503);

    await expect(async () => {
      for await (const chunk of callGoogleStream('test', 'key')) {
        void chunk;
      }
    }).rejects.toThrow('Gemini API error: 503');
  });
});
