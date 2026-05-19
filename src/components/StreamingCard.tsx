import type { StreamingComponent } from '../types';

interface StreamingCardProps {
  component: StreamingComponent;
}

export function StreamingCard({ component }: StreamingCardProps) {
  return (
    <div className="component-card component-card--streaming">
      <div className="card-header">
        <div className="card-title-group">
          <span className="streaming-badge">생성 중...</span>
          <p className="card-prompt">{component.prompt}</p>
        </div>
      </div>
      <div className="card-content">
        <div className="code-panel">
          <div className="panel-header">
            <h3>코드</h3>
            <span className="streaming-indicator" aria-live="polite">
              <span className="streaming-dot" />
              스트리밍
            </span>
          </div>
          <pre className="code-block">
            <code>{component.rawChunks}</code>
            <span className="streaming-cursor" aria-hidden="true">▋</span>
          </pre>
        </div>
      </div>
    </div>
  );
}
