import { LiveProvider, LivePreview as ReactLivePreview, LiveError } from 'react-live';

export type ViewportMode = 'mobile' | 'tablet' | 'desktop';

interface LivePreviewProps {
  code: string;
  viewportMode: ViewportMode;
  onViewportChange: (mode: ViewportMode) => void;
}

export function LivePreview({ code, viewportMode, onViewportChange }: LivePreviewProps) {
  return (
    <div className="preview-panel">
      <div className="panel-header">
        <h3>미리보기</h3>
        <div className="viewport-controls">
          {(['mobile', 'tablet', 'desktop'] as const).map((mode) => (
            <button
              key={mode}
              className={`btn-viewport ${viewportMode === mode ? 'btn-viewport--active' : ''}`}
              onClick={() => onViewportChange(mode)}
              title={mode === 'mobile' ? '모바일 (390px)' : mode === 'tablet' ? '태블릿 (768px)' : '데스크탑'}
              aria-label={`${mode} 뷰`}
            >
              <span className={`viewport-icon viewport-icon--${mode}`} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <div className="preview-content">
        <LiveProvider code={code} noInline>
          <div className={`preview-render preview-render--${viewportMode}`}>
            <ReactLivePreview />
          </div>
          <LiveError className="preview-error" />
        </LiveProvider>
      </div>
    </div>
  );
}
