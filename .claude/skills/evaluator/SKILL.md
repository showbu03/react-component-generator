---
name: evaluator
description: 메인 에이전트가 생성한 코드를 적대적 관점에서 리뷰하는 서브에이전트. "평가해줘", "코드 검증해줘", "evaluator 실행", "/evaluator" 호출 시 반드시 실행하라. generator-evaluator 패턴으로 문제 발견 시 수정 후 재검증까지 처리한다.
version: 1.0.0
allowed-tools: Read, Glob, Grep, Bash, Agent, Edit, Write
---

# Evaluator 서브에이전트 스킬

generator-evaluator 패턴을 구현한다. 최근 변경된 코드 중 검증이 필요한 파일만 선별하여 적대적 관점에서 리뷰하고, 문제 발견 시 수정 후 재검증한다.

## 핵심 원칙

- **적대적 관점**: 코드가 틀렸다는 가정에서 시작. 동작한다고 믿지 않는다.
- **선별 리뷰**: 모든 코드를 보지 않는다. 검증이 필요한 파일만 골라 리뷰한다.
- **최대 3회 반복**: generator → evaluator → (fix → evaluator) 루프는 최대 3회.
- **구체적 피드백**: "버그가 있다"가 아니라 "N번 줄에서 X 조건 시 Y가 발생한다"처럼 정확히.

---

## Step 1: 검증 대상 파일 선별

다음 명령으로 최근 변경 파일을 수집한다:

```bash
git diff --name-only HEAD
git diff --name-only HEAD~1 HEAD
```

**포함 기준** (하나 이상이면 검증 대상):
- `server/` 아래 `.ts` 파일 (API 엔드포인트, 비즈니스 로직)
- `src/` 아래 `.ts`/`.tsx` 파일 중 hooks, utils, context 디렉토리
- 테스트 파일 (`.test.ts`, `.test.tsx`)

**제외 기준** (이것만 해당하면 스킵):
- `*.d.ts`, `tsconfig*.json`, `*.config.*`, `.env*` — 타입 정의 및 설정
- `*.css`, `*.svg`, `*.png` — 스타일 및 에셋
- `AGENTS.md`, `CLAUDE.md`, `*.md` — 문서

변경 파일이 없거나 모두 제외 대상이면: "검증할 코드가 없습니다." 출력 후 종료.

---

## Step 2: 적대적 서브에이전트 실행

검증 대상 파일 각각에 대해 Agent 도구로 adversarial reviewer 서브에이전트를 스폰한다.
**모델**: `sonnet` (Agent 도구의 model 파라미터에 명시)
**병렬 실행 가능**: 파일들이 독립적이면 단일 메시지에서 복수 Agent 호출.

서브에이전트에게 전달할 프롬프트:

```
당신은 적대적 코드 리뷰어다. 코드가 올바르다고 가정하지 말고, 반드시 문제를 찾으려 시도하라.

[파일 경로]: {FILE_PATH}
[파일 내용]: Read 도구로 직접 읽어라.

다음 규칙 컨텍스트를 참고한다 (Read로 로드):
- ./AGENTS.md (golden rules)
- ./src/AGENTS.md 또는 ./server/AGENTS.md (해당하는 쪽)
- ./.claude/rules/tdd.md (TDD 규칙)

4가지 관점에서 각각 독립적으로 검토하라:

1. **AGENTS.md 규칙 위반** (react-live 생성 코드 한정)
   - TypeScript 문법 (타입 어노테이션, interface, generic)이 포함되어 있는가?
   - import 문이 포함되어 있는가?
   - render() 호출이 누락되어 있는가?
   - 인라인 스타일이 아닌 CSS 클래스/모듈이 사용되었는가?
   - React.useState/React.useEffect가 아닌 직접 import 형식으로 사용되었는가?

2. **코드 품질 / 버그 가능성**
   - undefined/null 접근으로 런타임 에러를 유발할 수 있는 패턴
   - React hooks 규칙 위반 (조건부 hook, 루프 내 hook)
   - 비동기 처리 오류 (unhandled promise, race condition 가능성)
   - 무한 루프 또는 무한 렌더링을 유발할 수 있는 패턴
   - 사용하지 않는 변수, 도달 불가 코드

3. **TDD 준수 여부**
   - 비즈니스 로직이 있는 파일에 대응하는 .test.ts 파일이 존재하는가? (Glob으로 확인)
   - 테스트가 존재한다면: 실제 동작을 검증하는가, 아니면 형식적인가?
   - TDD 적용 대상인데 테스트가 없으면 FAIL로 판정한다.

4. **보안 취약점**
   - dangerouslySetInnerHTML 또는 eval 사용 여부
   - API 키 또는 시크릿이 코드에 하드코딩되었는가?
   - 사용자 입력이 검증 없이 직접 사용되는가?
   - CORS 헤더 누락 (서버 코드의 경우)

출력 형식 (이 형식을 정확히 따를 것):
- 문제 없음: "PASS: {FILE_PATH}"
- 문제 있음:
  "FAIL: {FILE_PATH}
  - [관점명]: 줄 N — 구체적 문제 설명 (어떤 입력/조건에서 어떤 결과가 나오는가)"

FAIL은 반드시 줄 번호와 재현 조건을 포함해야 한다.
```

---

## Step 3: 결과 집계

모든 서브에이전트 결과를 취합한다.

**전체 PASS**: "✓ 모든 검증 통과 — 이슈 없음" 출력 후 종료.

**FAIL 있음**: 이슈 목록을 출력하고 사용자에게 확인 요청:

```
=== Evaluator 결과 (iteration N/3) ===
검증 대상: N개 파일

✓ PASS: server/index.ts
✗ FAIL: src/utils/ensureRenderCall.ts
  - [코드 품질]: 줄 14 — 컴포넌트명 추출 실패 시 'App'으로 폴백하지만 함수형/클래스 구분 없어 화살표 함수 컴포넌트에서 오동작
  - [TDD]: ensureRenderCall.test.ts 없음 — 비즈니스 로직이므로 테스트 필수

→ 위 이슈를 수정할까요? (수정 후 자동 재검증)
```

---

## Step 4: 수정 및 재검증 루프

사용자 승인 후:

1. 각 이슈에 대해 수정 진행 (Edit 또는 Write 도구)
2. TDD 위반이 있는 경우: 프로덕션 코드 수정 전 테스트 파일 작성 먼저
3. 수정된 파일에 대해서만 Step 2 재실행
4. 최대 3회 반복

```
iteration 1: 초기 평가
iteration 2: 1차 수정 후 재검증
iteration 3: 2차 수정 후 최종 검증

3회 후에도 이슈가 남으면:
"3회 반복 후에도 해결되지 않은 이슈가 있습니다. 수동 검토가 필요합니다."
```

---

## 주의사항

- 서브에이전트는 반드시 **model: "sonnet"** 을 지정한다
- 파일당 서브에이전트 하나 — 단일 에이전트가 모든 파일을 처리하지 않는다
- 수정은 사용자 승인 후 진행 (자동 수정 금지)
- 생성된 React 컴포넌트 코드는 react-live 제약 규칙(AGENTS.md golden rules)이 다른 코드보다 우선 적용된다
- `bun test` 실행으로 기존 테스트가 깨지지 않았는지 수정 후 반드시 확인한다
