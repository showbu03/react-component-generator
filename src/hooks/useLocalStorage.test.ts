import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useLocalStorage } from './useLocalStorage';

// vitest.setup.ts가 beforeEach에서 localStorage.clear()를 호출하므로
// 각 테스트는 빈 스토어에서 시작한다.

describe('useLocalStorage', () => {
  it('초기값이 없으면 initialValue를 반환한다', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('initial');
  });

  it('저장된 값이 있으면 localStorage에서 읽어온다', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('stored-value');
  });

  it('값을 변경하면 localStorage에 저장된다', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
  });

  it('함수형 업데이트로 이전 값을 참조해 변경할 수 있다', () => {
    const { result } = renderHook(() => useLocalStorage<number[]>('test-key', [1, 2]));

    act(() => {
      result.current[1]((prev) => [...prev, 3]);
    });

    expect(result.current[0]).toEqual([1, 2, 3]);
    expect(JSON.parse(localStorage.getItem('test-key')!)).toEqual([1, 2, 3]);
  });

  it('JSON 파싱 오류 시 initialValue로 폴백한다', () => {
    localStorage.setItem('test-key', 'invalid-json-{]');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'));
    expect(result.current[0]).toBe('fallback');

    consoleErrorSpy.mockRestore();
  });

  it('QuotaExceededError 시 state는 유지되고 에러를 기록한다', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    act(() => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');
    expect(consoleErrorSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('reviver 함수가 있으면 역직렬화 시 적용된다', () => {
    const testData = { date: '2026-05-19T00:00:00Z' };
    localStorage.setItem('test-key', JSON.stringify(testData));

    const reviver = (_key: string, value: unknown) => {
      if (_key === 'date' && typeof value === 'string') return new Date(value);
      return value;
    };

    const { result } = renderHook(() =>
      useLocalStorage<{ date: Date | string }>('test-key', { date: 'default' }, { reviver })
    );

    expect(result.current[0].date instanceof Date).toBe(true);
  });

  it('복수 키를 각각 독립적으로 관리한다', () => {
    const { result: result1 } = renderHook(() => useLocalStorage('key1', 'value1'));
    const { result: result2 } = renderHook(() => useLocalStorage('key2', 'value2'));

    act(() => {
      result1.current[1]('updated1');
    });

    expect(result1.current[0]).toBe('updated1');
    expect(result2.current[0]).toBe('value2');
    expect(localStorage.getItem('key1')).toBe(JSON.stringify('updated1'));
    expect(localStorage.getItem('key2')).toBe(JSON.stringify('value2'));
  });

  it('배열 값을 직렬화/역직렬화한다', () => {
    const initialArray = [{ id: '1', name: 'test' }];
    const { result } = renderHook(() => useLocalStorage('test-key', initialArray));

    act(() => {
      result.current[1]([...result.current[0], { id: '2', name: 'test2' }]);
    });

    const stored = JSON.parse(localStorage.getItem('test-key') || '[]');
    expect(stored).toHaveLength(2);
    expect(stored[0].name).toBe('test');
  });
});
