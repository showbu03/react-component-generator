# AGENTS.md — Frontend (src/)

## Module Context

React 19 + TypeScript + Vite 기반 프론트엔드. `react-live`를 통한 런타임 컴포넌트 렌더링이 핵심이며, AI 생성 코드의 미리보기와 표시를 담당한다.

## Tech Stack & Constraints

- React 19 (`react`, `react-dom`)
- `react-live` v4: `LiveProvider`, `LivePreview`, `LiveError`, `LiveEditor` 사용
- TypeScript strict 모드 (`tsconfig.app.json` 참고)
- Vite 프록시: `/api/*` → `http://localhost:3002`로 자동 전달 (직접 포트 지정 불필요)

## Implementation Patterns

### 컴포넌트 구조

```
src/
  App.tsx                        # 최상위 레이아웃, 설정 패널 관리
  components/
    PromptInput.tsx              # 프롬프트 입력 폼
    ComponentCard.tsx            # 생성 결과 카드 (LivePreview + CodeView 포함)
    LivePreview.tsx              # react-live 래퍼
    CodeView.tsx                 # 코드 표시 (구문 강조)
  hooks/
    useComponentGenerator.ts    # 컴포넌트 상태 + API 호출 관리
  types/
    index.ts                    # Provider, GeneratedComponent 타입 정의
```

### 상태 관리

전역 상태 라이브러리 없음. `useComponentGenerator` 훅이 컴포넌트 배열, 로딩, 에러 상태를 단일 관리한다.

```ts
// GeneratedComponent 구조 (types/index.ts 참고)
{ id: string, prompt: string, code: string, createdAt: Date }
```

### react-live 사용 패턴

```tsx
<LiveProvider code={code} noInline={true}>
  <LivePreview />
  <LiveError />
</LiveProvider>
```

`noInline={true}` 필수 — 생성 코드가 `render()` 명시 호출 방식을 사용하기 때문.

## Local Golden Rules

### Do's

- `useComponentGenerator` 훅을 통해서만 컴포넌트 생성 API를 호출한다.
- 컴포넌트 ID는 `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` 패턴을 유지한다.
- API 키는 컴포넌트 state로만 보관한다 (localStorage나 전역 변수에 저장하지 않는다).
- `/api/config` 엔드포인트로 서버 측 API 키 유무를 확인한 후 UI를 조건부로 표시한다.

### Don'ts

- `LiveProvider`의 `code` prop에 TypeScript 문법이 포함된 코드를 넣지 않는다 — 파싱 오류 발생.
- `noInline` prop을 제거하지 않는다 — `render()` 호출 방식이 깨진다.
- 새 컴포넌트를 배열 끝에 추가하지 않는다 — 항상 앞에 추가한다 (`[newComponent, ...prev]`).
- Vite 프록시가 있으므로 fetch URL에 `http://localhost:3002`를 직접 쓰지 않는다.

## Testing Strategy

현재 자동화 테스트 없음. 기능 검증은 수동으로 진행:

1. `bun run dev` 실행 후 `http://localhost:5173` 접속
2. 프롬프트 입력 → 미리보기 렌더링 확인
3. `LiveError` 영역에 에러 표시 여부 확인
4. 린트: `bun run lint`
