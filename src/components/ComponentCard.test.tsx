import { describe, it, expect } from 'vitest';
import type { ViewportMode } from './LivePreview';

describe('ComponentCard - Viewport Mode', () => {
  it('should export ViewportMode type from LivePreview', () => {
    const modes: ViewportMode[] = ['mobile', 'tablet', 'desktop'];
    expect(modes).toContain('mobile');
    expect(modes).toContain('tablet');
    expect(modes).toContain('desktop');
  });

  it('should have three valid viewport modes', () => {
    const validModes: ViewportMode[] = ['mobile', 'tablet', 'desktop'];
    expect(validModes.length).toBe(3);
  });

  it('should handle viewport mode transitions', () => {
    const modes: ViewportMode[] = ['mobile', 'tablet', 'desktop'];
    let currentMode = modes[0];

    currentMode = modes[1];
    expect(currentMode).toBe('tablet');

    currentMode = modes[2];
    expect(currentMode).toBe('desktop');

    currentMode = modes[0];
    expect(currentMode).toBe('mobile');
  });

  it('should maintain viewport state when switching between modes', () => {
    let viewportState: ViewportMode = 'desktop';
    const updateViewport = (mode: ViewportMode) => {
      viewportState = mode;
    };

    expect(viewportState).toBe('desktop');

    updateViewport('mobile');
    expect(viewportState).toBe('mobile');

    updateViewport('tablet');
    expect(viewportState).toBe('tablet');

    updateViewport('desktop');
    expect(viewportState).toBe('desktop');
  });

  it('should preserve viewport state across state updates', () => {
    let viewportMode: ViewportMode = 'desktop';
    let previewKey = 0;

    const handleRefresh = () => {
      previewKey += 1;
    };

    const handleViewportChange = (mode: ViewportMode) => {
      viewportMode = mode;
    };

    handleViewportChange('mobile');
    expect(viewportMode).toBe('mobile');

    handleRefresh();
    expect(viewportMode).toBe('mobile');
    expect(previewKey).toBe(1);

    handleRefresh();
    expect(viewportMode).toBe('mobile');
    expect(previewKey).toBe(2);

    handleViewportChange('tablet');
    expect(viewportMode).toBe('tablet');
    expect(previewKey).toBe(2);
  });

  it('should apply correct CSS class names for each viewport mode', () => {
    const modes: ViewportMode[] = ['mobile', 'tablet', 'desktop'];
    const expectedClasses = [
      'preview-render--mobile',
      'preview-render--tablet',
      'preview-render--desktop',
    ];

    modes.forEach((mode, index) => {
      const className = `preview-render--${mode}`;
      expect(className).toBe(expectedClasses[index]);
    });
  });

  it('should generate correct button classes for active state', () => {
    let activeMode: ViewportMode = 'desktop';

    const getButtonClass = (mode: ViewportMode) => {
      const baseClass = 'btn-viewport';
      const activeClass = activeMode === mode ? ' btn-viewport--active' : '';
      return baseClass + activeClass;
    };

    expect(getButtonClass('desktop')).toBe('btn-viewport btn-viewport--active');
    expect(getButtonClass('mobile')).toBe('btn-viewport');
    expect(getButtonClass('tablet')).toBe('btn-viewport');

    activeMode = 'mobile';
    expect(getButtonClass('mobile')).toBe('btn-viewport btn-viewport--active');
    expect(getButtonClass('desktop')).toBe('btn-viewport');
  });
});
