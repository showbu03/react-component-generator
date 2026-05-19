# AGENTS.md — React Component Generator

## Operational Commands

패키지 매니저는 **bun만 사용**한다. npm, yarn, pnpm은 절대 사용하지 않는다.

```bash
bun install                 # 의존성 설치
bun run dev                 # 프론트(Vite:5173) + 백엔드(Bun:3002) 동시 실행
bun run server              # 백엔드만 실행 (파일 변경 감지 포함)
bun run build               # TypeScript 컴파일 + Vite 번들
bun run lint                # ESLint 검사
bun run preview             # 프로덕션 빌드 미리보기
```

포트 충돌 시: 프론트 5173, 백엔드 3002 — 두 포트 모두 필요하다.

## Project Context

자연어 프롬프트를 입력하면 AI(Claude Haiku / Gemini 2.5-flash)가 React 컴포넌트를 생성하고 react-live로 즉시 미리보기하는 웹 애플리케이션.

Tech Stack: React 19, TypeScript, Vite, Bun, react-live, Anthropic API, Google Generative AI API

## Golden Rules

### Immutable (절대 불변 규칙)

- API 키를 코드에 하드코딩하지 않는다. `.env` 파일 또는 런타임 사용자 입력만 허용한다.
- 생성된 React 컴포넌트 코드에 TypeScript 문법을 포함하지 않는다 — react-live는 TypeScript를 파싱할 수 없다.
- 생성된 컴포넌트 코드에 import 문을 포함하지 않는다 — React는 전역 스코프에 이미 존재한다.
- 백엔드 응답에 항상 CORS 헤더(`CORS_HEADERS`)를 포함한다.

### Do's

- 생성 코드는 항상 `render(<ComponentName />)` 호출로 끝낸다 (`ensureRenderCall`이 자동 처리하지만 AI 프롬프트에서도 명시한다).
- 컴포넌트 스타일은 인라인 스타일만 사용한다 (`style={{}}`).
- React hooks는 `React.useState`, `React.useEffect` 형식으로 사용한다 (import 없이).
- 컴포넌트 ID는 `{timestamp}-{random}` 패턴으로 생성한다.

### Don'ts

- 생성 코드에 CSS import, CSS 모듈, Tailwind 클래스를 포함하지 않는다.
- `react-live` 예외를 직접 catch하지 않는다 — `LivePreview` 컴포넌트가 `errorBoundary`로 처리한다.
- 서버에 상태(state)를 저장하지 않는다 — Bun 서버는 stateless여야 한다.
- `process.env`를 프론트엔드 코드에서 직접 읽지 않는다 — `/api/config` 엔드포인트를 통해 읽는다.

## Standards & References

### Git 컨벤션

```
<type>: <한국어 설명>

type: feat | fix | refactor | docs | chore | style
```

### 코딩 규칙

- 프론트엔드: TypeScript strict 모드, React hooks 린트 규칙 준수
- 백엔드: Bun 네이티브 API 우선 사용 (`Bun.serve`, `Bun.file` 등)
- 에러 메시지는 한국어로 작성한다 (사용자 노출 메시지)

### Maintenance Policy

코드와 이 파일의 규칙 사이에 괴리가 발생하면 즉시 업데이트를 제안한다.

## Context Map

- **[프론트엔드 컴포넌트 / UI 작업](./src/AGENTS.md)** — src/ 내 React 컴포넌트, hooks, 타입 수정 시.
- **[백엔드 API 서버 작업](./server/AGENTS.md)** — AI 호출 로직, 코드 후처리, 엔드포인트 수정 시.
