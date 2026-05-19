# Playwright E2E 테스트 가이드

## 개요

이 프로젝트는 Playwright를 사용한 E2E(엔드-투-엔드) 테스트를 포함합니다. 코드 생성 스트리밍 기능이 정상 작동하는지 확인합니다.

## 테스트 파일 구조

```
e2e/
├── streaming-api.spec.ts      # SSE 스트림 API 테스트
└── streaming-ui.spec.ts       # UI 통합 테스트
```

## 설치 및 실행

### 1. 초기 설정

```bash
# Playwright 브라우저 설치 (처음 1회만)
bun x @playwright/test install chromium
```

### 2. 테스트 실행

#### 전체 테스트 실행
```bash
bun run e2e
```

#### UI 모드로 실행 (권장: 테스트 진행 상황 시각화)
```bash
bun run e2e:ui
```

#### 디버그 모드로 실행
```bash
bun run e2e:debug
```

#### 특정 테스트만 실행
```bash
bun run e2e -- e2e/streaming-api.spec.ts
```

## 테스트 내용

### streaming-api.spec.ts (API 스트리밍 테스트)

#### 1. **SSE 스트림 수신 테스트**
- SSE(Server-Sent Events) 형식으로 청크 데이터 수신 확인
- `event: chunk`, `event: done`, `event: error` 이벤트 파싱

**검증 항목:**
- ✓ HTTP 200 상태 코드
- ✓ Content-Type: text/event-stream
- ✓ 청크 이벤트 수신
- ✓ 최종 코드 포함 `render()` 호출

#### 2. **CORS 헤더 검증**
- 모든 응답에 CORS 헤더 포함 확인

**검증 항목:**
- ✓ Access-Control-Allow-Origin: *
- ✓ Cache-Control: no-cache
- ✓ Connection: keep-alive

#### 3. **에러 처리**
- 프롬프트 없을 때: 400 에러
- API 키 없을 때: 400 에러

#### 4. **생성 코드 검증**
- 생성된 코드의 형식 검증
- render() 호출 포함 여부
- 코드 펜스(```) 제거 확인
- TypeScript 문법 미포함 확인

### streaming-ui.spec.ts (UI 통합 테스트)

#### 1. **페이지 로드**
- 메인 제목과 헤더 표시 확인

#### 2. **스트리밍 UI 변화**
- 생성 시작: StreamingCard 표시
- 생성 완료: 일반 ComponentCard로 변환

#### 3. **컴포넌트 카드**
- react-live iframe 렌더링 확인
- 코드 블록 표시 확인

#### 4. **다중 생성**
- 여러 컴포넌트 동시 보관 확인

#### 5. **UI 구성 요소**
- Provider 선택 드롭다운
- API 키 입력 필드
- 표시/숨기기 토글

## 테스트 환경

### 필수 환경 변수

`.env` 또는 `.env.local` 파일에 설정:

```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

### Playwright 설정

`playwright.config.ts`:
- **브라우저:** Chromium, Firefox, WebKit (병렬 실행)
- **기본 URL:** http://localhost:5173
- **보고서:** playwright-report/ 디렉토리

### WebServer 자동 시작

Playwright가 테스트 시작 시 자동으로 실행:
- 프론트엔드: Vite (포트 5173)
- 백엔드: Bun 서버 (포트 3002)

## 테스트 결과 분석

### HTML 리포트 보기

```bash
# 테스트 실행 후
open playwright-report/index.html  # macOS/Linux
start playwright-report\index.html # Windows
```

### 자주 실패하는 이유

| 문제 | 해결책 |
|------|--------|
| API 키 없음 | .env 파일에 GOOGLE_API_KEY 또는 ANTHROPIC_API_KEY 설정 |
| 포트 충돌 | 기존 개발 서버 중단 (bun dev, Vite 등) |
| 브라우저 없음 | `bun x @playwright/test install chromium` 실행 |
| 타임아웃 | API 응답 지연 시 timeout 값 증가 |
| 로케이터 오류 | UI 구조 변경 시 선택자 업데이트 |

## Best Practices

### 작성 시 고려사항

1. **명확한 테스트 이름**
   - "should receive SSE stream chunks" ✓
   - "streaming works" ✗

2. **적절한 대기 시간**
   ```typescript
   // 나쁜 예
   await page.waitForTimeout(5000);
   
   // 좋은 예
   await expect(element).toBeVisible({ timeout: 30000 });
   ```

3. **로케이터 전략**
   ```typescript
   // 안정적인 선택자
   page.locator('input[id="api-key"]')
   page.locator('button').filter({ hasText: '생성' })
   page.locator('.streaming-badge')
   
   // 피해야 할 선택자
   page.locator('div:nth-child(5)')  // 취약함
   ```

4. **에러 처리**
   ```typescript
   // 선택적 확인
   await expect(errorBanner).toBeVisible().catch(() => {
     // 에러가 없을 수도 있음
   });
   ```

## 지속적 통합 (CI)

GitHub Actions에서 실행 시:

```yaml
- name: Run Playwright tests
  run: bun run e2e
  
- name: Upload report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## 트러블슈팅

### 테스트가 hang 되는 경우

```bash
# 타임아웃으로 테스트 종료
bun run e2e -- --timeout 120000
```

### 특정 브라우저만 테스트

```bash
bun run e2e -- --project chromium
```

### 한 번만 실패한 경우 재실행

```bash
bun run e2e -- --retries 2
```

## 참고 자료

- [Playwright 공식 문서](https://playwright.dev)
- [Playwright 최적화 가이드](https://playwright.dev/docs/best-practices)
- [이 프로젝트의 AGENTS.md](./AGENTS.md)
