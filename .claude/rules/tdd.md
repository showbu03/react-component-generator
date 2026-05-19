---
description: TDD 규칙 — RED-GREEN-REFACTOR 사이클, 적용 기준, 삭제 강제 규칙
globs:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "server/**/*.ts"
---

# TDD Rules — React Component Generator

⚠️ **이 규칙은 Rigid하다. 상황에 맞게 변형하지 마라.**

`src/AGENTS.md`, `server/AGENTS.md`에 TDD 규칙이 있으면 그것이 **우선**된다.  
이 파일은 기본값(fallback)이다.

---

## 1. TDD 적용 기준

### ✅ **반드시 TDD를 적용하는 대상**

- **비즈니스 로직**: 생성 코드 후처리 (`ensureRenderCall`, 타입 보정), 컴포넌트 ID 생성 로직
- **API 엔드포인트**: `/api/generate`, `/api/config`, `/api/health` 등 백엔드 route
- **유틸 함수**: 범용 헬퍼 (`formatCode`, `validateInput`, `extractComponentName` 등)
- **버그 수정**: 기존 기능의 수정은 반드시 기존 테스트를 통과하면서 진행
- **AI 응답 검증**: 모델 응답 파싱, 오류 처리 로직

### ❌ **TDD 불필요한 대상**

- **타입 정의**: `.ts` 파일의 `type`, `interface`, `enum` (타입은 구조로 검증된다)
- **설정 파일**: `tsconfig.json`, `eslint.config.mjs`, `.env` 등
- **순수 UI 컴포넌트**: react-live에서 렌더링되는 생성 코드 (런타임 미리보기가 검증)
- **CSS/스타일**: 인라인 스타일, 스타일 정의만 있는 파일
- **마이그레이션/초기화**: DB 초기화, 데이터 마이그레이션 스크립트

---

## 2. RED-GREEN-REFACTOR 사이클

### 🔴 RED: 실패하는 테스트 작성

**하나의 동작 = 하나의 테스트**

```typescript
// ❌ 나쁜 예: 여러 동작을 한 테스트에 포함
it('should generate component', () => {
  const code = generateComponent('버튼 만들어');
  expect(code).toContain('onClick');
  expect(code).toContain('Button');
  expect(code).toContain('render(<Button />)');
});

// ✅ 좋은 예: 하나의 동작당 하나의 테스트
it('should append render call if missing', () => {
  const code = 'function Button() { return <button>Click</button>; }';
  const result = ensureRenderCall(code);
  expect(result).toContain('render(<Button />)');
});
```

**반드시 실행해서 실패 확인**

```bash
bun test -- --watch  # 실패해야 다음 단계로 진행
```

**실패 이유가 "기능 미구현"이어야 한다**

- ❌ 실패 원인: "타입 오류", "임포트 누락" → 먼저 타입/구조를 맞춘 후 RED 다시
- ✅ 실패 원인: `AssertionError: expected '...' to contain '...'` → 진행

---

### 🟢 GREEN: 최소한의 코드만 작성

**YAGNI 원칙: 지금 필요한 것만 구현한다**

```typescript
// ❌ 과도한 구현
function ensureRenderCall(code: string): string {
  // 복잡한 AST 파싱, 다양한 렌더 패턴 지원, 에러 핸들링...
}

// ✅ 최소 구현
function ensureRenderCall(code: string): string {
  if (!code.includes('render(')) {
    return code + '\nrender(<App />)';
  }
  return code;
}
```

**신규 테스트 + 기존 테스트 모두 통과 확인**

```bash
bun test  # 모든 테스트 GREEN이어야 함
```

---

### 🔵 REFACTOR: 중복 제거 & 개선

**green 상태 유지 — 테스트 코드 수정 금지**

허용:
- 중복 코드 제거
- 이름 개선 (변수명, 함수명)
- 헬퍼 함수 추출

금지:
- ❌ "리팩토링하면서 이 기능도 추가하자" → 새 동작 추가 절대 금지

---

### 🔄 반복

```
RED → GREEN → REFACTOR → RED (다음 동작) → ...
```

---

## 3. 삭제 강제 규칙

### ⛔ 프로덕션 코드를 먼저 작성했다면 삭제하고 RED부터 재시작

```bash
# ✅ 올바른 방식
git checkout src/utils.ts   # 또는 파일 직접 삭제
# → 테스트 파일 먼저 작성 (RED)
# → 최소 구현 (GREEN)
# → 정리 (REFACTOR)
```

**"참고용"으로 남기기 금지**

- ❌ `// 참고용 구현` 주석 + 코드 보관
- ❌ 별도 branch에 "임시 저장"
- ✅ 삭제만 한다. 필요하면 git history에서 복구

---

## 4. 변명 차단표

| 변명 | 반론 | 대처 |
|-----|------|------|
| "너무 단순해서 테스트 불필요" | 단순할수록 테스트 비용이 낮다. 회귀 버그를 막는 보험이다. | 1줄 테스트라도 작성. `expect(x).toBe(y)`는 5초. |
| "나중에 추가하겠다" | "나중"은 오지 않는다. TDD 사이클이 끝나야 진짜 끝이다. | 지금 즉시 작성. 5분 투자 > 2주 후 리마인드. |
| "시간이 없다" | TDD는 개발 속도를 높인다. 버그 조기 발견 = 총 시간 절감. | 1시간 투자로 4시간 디버깅 절약. ROI 명확. |
| "삭제하면 낭비" | working code라면 테스트로 검증하는 것이지 지우는 게 아니다. | TDD 재시작 전 코드를 테스트로 검증 후 진행. |
| "프로토타입이다" | 프로토타입도 동작해야 한다. TDD는 그것을 보장한다. | 프로토타입이라도 RED-GREEN 반드시 수행. |
| "UI는 테스트 어렵다" | 비즈니스 로직과 UI는 분리된다. API 로직은 테스트 가능. | UI 로직이 아닌 부분(API 호출, 데이터 변환)을 분리해서 테스트. |

---

## 5. 테스트 환경

```bash
# 의존성
bun add -D vitest @vitest/ui @testing-library/react

# 실행
bun test              # 전체 실행
bun test --watch      # watch 모드
bun test --coverage   # 커버리지
```

### 파일 위치 규칙

```
src/
  utils/
    ensureRenderCall.ts
    ensureRenderCall.test.ts   ← 같은 디렉토리

server/
  api/
    generate.ts
    generate.test.ts           ← 같은 디렉토리
```

---

## 6. PR/커밋 체크리스트

```
- [ ] RED: 테스트 작성 & 실행 (실패 확인)
- [ ] GREEN: 최소 구현 & 모든 테스트 통과
- [ ] REFACTOR: 중복 제거 & 개선 (테스트 유지)
- [ ] bun test — 전체 통과
- [ ] 비즈니스 로직 커버리지 70% 이상
```
