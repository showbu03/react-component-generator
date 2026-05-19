import { useCallback, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { GeneratedComponent, Provider, StreamingComponent } from '../types';

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  isLoading: boolean;
  error: string | null;
  streamingComponent: StreamingComponent | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const STORAGE_KEY = 'rcg:components';

  const dateReviver = (_key: string, value: unknown) => {
    if (_key === 'createdAt' && typeof value === 'string') return new Date(value);
    return value;
  };

  const [components, setComponents] = useLocalStorage<GeneratedComponent[]>(
    STORAGE_KEY,
    [],
    { reviver: dateReviver }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingComponent, setStreamingComponent] = useState<StreamingComponent | null>(null);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setStreamingComponent({ id, prompt, rawChunks: '' });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate component');
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            try {
              const parsed = JSON.parse(raw);

              if (currentEvent === 'chunk') {
                setStreamingComponent((prev) =>
                  prev ? { ...prev, rawChunks: prev.rawChunks + parsed.text } : prev
                );
              } else if (currentEvent === 'done') {
                const newComponent: GeneratedComponent = {
                  id,
                  prompt,
                  code: parsed.code,
                  createdAt: new Date(),
                };
                setComponents((prev) => [newComponent, ...prev]);
                setStreamingComponent(null);
              } else if (currentEvent === 'error') {
                throw new Error(parsed.message);
              }
            } catch (e) {
              if (e instanceof Error) throw e;
            }
            currentEvent = '';
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setStreamingComponent(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, []);

  return { components, isLoading, error, streamingComponent, generate, removeComponent, clearAll };
}
