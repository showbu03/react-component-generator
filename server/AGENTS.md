# AGENTS.md — Backend (server/)

## Module Context

Bun 네이티브 HTTP 서버. AI API(Anthropic, Google)를 호출하고 생성된 코드를 react-live 호환 형식으로 후처리하여 프론트엔드에 반환한다.

## Tech Stack & Constraints

- Bun 런타임 (`Bun.serve`) — Node.js HTTP 모듈 사용 금지
- 외부 HTTP 클라이언트 없음 — Bun 내장 `fetch` 사용
- AI 엔드포인트: Anthropic `claude-haiku-4-5-20251001`, Google `gemini-2.5-flash`
- 환경변수: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` (`.env` 파일 또는 OS 환경변수)

## Implementation Patterns

### 코드 후처리 파이프라인

AI 응답은 반드시 이 순서로 처리한다:

```ts
const code = ensureRenderCall(stripCodeFences(rawText));
```

1. `stripCodeFences(text)` — 마크다운 코드 펜스(```jsx 등) 제거
2. `ensureRenderCall(code)` — `render(<ComponentName />)` 호출이 없으면 자동 추가

이 두 함수를 건너뛰거나 순서를 바꾸지 않는다.

### API 키 해석 우선순위

```ts
resolveApiKey(provider, clientKey)
// 반환 순위: clientKey(사용자 입력) > ENV_KEYS[provider](.env) > null
```

키가 null이면 400 응답을 반환한다 — 키 없이 AI API를 호출하지 않는다.

### 엔드포인트 목록

| Method | Path | 역할 |
|--------|------|------|
| GET | `/api/config` | 서버에 API 키 설정 여부 반환 |
| POST | `/api/generate` | AI 호출 및 코드 후처리 후 반환 |
| OPTIONS | `*` | CORS preflight 처리 |

모든 응답에 `CORS_HEADERS` 포함 필수.

## Local Golden Rules

### Do's

- 새 AI 프로바이더 추가 시 `Provider` 타입, `ENV_KEYS`, `resolveApiKey`를 함께 업데이트한다.
- 에러 상태 코드: 400(키/프롬프트 없음), 429(레이트 리밋), 503(과부하), 500(기타).
- 사용자 노출 에러 메시지는 한국어로 작성한다.
- `SYSTEM_PROMPT`를 수정할 때 "No TypeScript syntax", "No imports", "Inline styles only", "render() 호출" 네 가지 규칙을 반드시 유지한다.

### Don'ts

- `Bun.serve` 외부에 요청 상태를 저장하지 않는다 — 서버는 stateless여야 한다.
- AI API 키를 로그에 출력하지 않는다.
- `SYSTEM_PROMPT`에서 TypeScript 허용 규칙을 추가하지 않는다 — react-live 파싱 오류 발생.
- Google API 응답에서 `finishReason === 'MAX_TOKENS'` 체크를 제거하지 않는다 — 잘린 코드가 프론트엔드로 전달된다.

## Testing Strategy

자동화 테스트 없음. 엔드포인트 수동 검증:

```bash
# 서버 단독 실행
bun run server

# 설정 확인
curl http://localhost:3002/api/config

# 코드 생성 테스트
curl -X POST http://localhost:3002/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a blue button","provider":"anthropic","apiKey":"sk-ant-..."}'
```
