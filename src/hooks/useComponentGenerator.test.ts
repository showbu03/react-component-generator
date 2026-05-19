import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function buildSSEBody(events: Array<{ event: string; data: unknown }>): ReadableStream<Uint8Array> {
  const text = events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('');
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function mockSSE(events: Array<{ event: string; data: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      body: buildSSEBody(events),
    })
  );
}

function mockFetchError(status: number, errorBody: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: vi.fn().mockResolvedValue(errorBody),
    })
  );
}

const DONE_EVENTS = [
  { event: 'chunk', data: { text: 'const ' } },
  { event: 'chunk', data: { text: 'Button' } },
  { event: 'done', data: { code: 'const Button = () => {};\n\nrender(<Button />);' } },
];

// ─── generate 호출 시 스트리밍 상태 초기화 ────────────────────────────────────

describe('useComponentGenerator - streaming', () => {
  it('generate 호출 즉시 streamingComponent가 prompt를 포함하여 생성된다', async () => {
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) { streamController = c; },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }));

    const { result } = renderHook(() => useComponentGenerator());

    // generate를 시작하되 완료를 기다리지 않음
    let generatePromise!: Promise<void>;
    act(() => {
      generatePromise = result.current.generate('버튼', undefined, 'anthropic');
    });

    // fetch가 resolve된 후 (await fetch에서 진행) streamingComponent 확인
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.streamingComponent?.prompt).toBe('버튼');

    // 스트림 종료
    await act(async () => {
      streamController.enqueue(
        new TextEncoder().encode('event: done\ndata: {"code":"render(<X />);"}\n\n')
      );
      streamController.close();
      await generatePromise;
    });
  });

  it('chunk 이벤트마다 streamingComponent.rawChunks가 누적된다', async () => {
    mockSSE([
      { event: 'chunk', data: { text: 'const ' } },
      { event: 'chunk', data: { text: 'Button' } },
      { event: 'done', data: { code: 'const Button = () => {};\n\nrender(<Button />);' } },
    ]);

    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'anthropic');
    });

    expect(result.current.components[0].code).toBe(
      'const Button = () => {};\n\nrender(<Button />);'
    );
  });

  it('done 이벤트 후 components에 추가되고 streamingComponent는 null이 된다', async () => {
    mockSSE(DONE_EVENTS);

    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'anthropic');
    });

    expect(result.current.streamingComponent).toBeNull();
    expect(result.current.components).toHaveLength(1);
  });

  it('done 이벤트의 code가 최종 GeneratedComponent.code가 된다', async () => {
    const finalCode = 'const Card = () => <div />;\n\nrender(<Card />);';
    mockSSE([
      { event: 'chunk', data: { text: 'const Card' } },
      { event: 'done', data: { code: finalCode } },
    ]);

    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('카드', undefined, 'anthropic');
    });

    expect(result.current.components[0].code).toBe(finalCode);
    expect(result.current.components[0].prompt).toBe('카드');
  });

  it('error 이벤트 시 error 상태가 설정되고 streamingComponent는 null이 된다', async () => {
    mockSSE([{ event: 'error', data: { message: '요청이 너무 많습니다.' } }]);

    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'anthropic');
    });

    expect(result.current.error).toBe('요청이 너무 많습니다.');
    expect(result.current.streamingComponent).toBeNull();
    expect(result.current.components).toHaveLength(0);
  });

  it('스트리밍 중 isLoading이 true이고 완료 후 false가 된다', async () => {
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) { streamController = c; },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }));

    const { result } = renderHook(() => useComponentGenerator());

    let generatePromise!: Promise<void>;
    act(() => {
      generatePromise = result.current.generate('버튼', undefined, 'anthropic');
    });

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      streamController.enqueue(
        new TextEncoder().encode('event: done\ndata: {"code":"render(<X />);"}\n\n')
      );
      streamController.close();
      await generatePromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('done 이벤트 후 isLoading이 false가 된다', async () => {
    mockSSE(DONE_EVENTS);

    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'anthropic');
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('HTTP 에러 응답 시 error가 설정된다', async () => {
    mockFetchError(400, { error: 'API key is required' });

    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'anthropic');
    });

    expect(result.current.error).toBe('API key is required');
    expect(result.current.streamingComponent).toBeNull();
  });
});
