import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentCard } from './ComponentCard';
import type { GeneratedComponent } from '../types';

vi.mock('react-live', () => ({
  LiveProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LivePreview: () => <div data-testid="live-preview" />,
  LiveError: () => null,
}));

const mockComponent: GeneratedComponent = {
  id: 'test-id-123',
  prompt: '파란 버튼 만들어줘',
  code: 'render(<button style={{color:"blue"}}>Click</button>)',
  createdAt: new Date('2026-05-19T10:00:00'),
};

describe('ComponentCard', () => {
  const onRemove = vi.fn();
  const onRegenerate = vi.fn();

  beforeEach(() => {
    onRemove.mockClear();
    onRegenerate.mockClear();
  });

  const renderCard = (overrides?: Partial<ComponentCardProps>) =>
    render(
      <ComponentCard
        component={mockComponent}
        onRemove={onRemove}
        onRegenerate={onRegenerate}
        isLoading={false}
        {...overrides}
      />
    );

  it('프롬프트 텍스트를 렌더링한다', () => {
    renderCard();
    expect(screen.getByText('파란 버튼 만들어줘')).toBeInTheDocument();
  });

  it('삭제 버튼 클릭 시 onRemove에 컴포넌트 id를 전달한다', async () => {
    renderCard();
    await userEvent.click(screen.getByText('삭제'));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledWith('test-id-123');
  });

  it('재생성 버튼 클릭 시 onRegenerate에 프롬프트를 전달한다', async () => {
    renderCard();
    await userEvent.click(screen.getByText('재생성'));
    expect(onRegenerate).toHaveBeenCalledOnce();
    expect(onRegenerate).toHaveBeenCalledWith('파란 버튼 만들어줘');
  });

  it('isLoading이 true이면 재생성 버튼이 비활성화된다', () => {
    renderCard({ isLoading: true });
    expect(screen.getByText('생성 중...')).toBeDisabled();
  });

  it('기본 탭은 미리보기이고 LivePreview가 표시된다', () => {
    renderCard();
    expect(screen.getByTestId('live-preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '미리보기' })).toHaveClass('tab--active');
  });

  it('코드 탭 클릭 시 코드 뷰로 전환된다', async () => {
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: '코드' }));
    expect(screen.queryByTestId('live-preview')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '코드' })).toHaveClass('tab--active');
  });

  it('코드 탭에서 미리보기 탭으로 다시 전환된다', async () => {
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: '코드' }));
    await userEvent.click(screen.getByRole('button', { name: '미리보기' }));
    expect(screen.getByTestId('live-preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '미리보기' })).toHaveClass('tab--active');
  });

  it('기본 viewport는 desktop이고 해당 버튼이 active 상태다', () => {
    renderCard();
    expect(screen.getByLabelText('desktop 뷰')).toHaveClass('btn-viewport--active');
    expect(screen.getByLabelText('mobile 뷰')).not.toHaveClass('btn-viewport--active');
  });

  it('mobile viewport 버튼 클릭 시 active 클래스가 mobile로 이동한다', async () => {
    renderCard();
    await userEvent.click(screen.getByLabelText('mobile 뷰'));
    expect(screen.getByLabelText('mobile 뷰')).toHaveClass('btn-viewport--active');
    expect(screen.getByLabelText('desktop 뷰')).not.toHaveClass('btn-viewport--active');
  });
});

// ComponentCardProps 타입을 테스트 파일 내에서 참조하기 위한 헬퍼 타입
interface ComponentCardProps {
  component: GeneratedComponent;
  onRemove: (id: string) => void;
  onRegenerate: (prompt: string) => void;
  isLoading: boolean;
}
