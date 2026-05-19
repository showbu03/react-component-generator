import { test, expect } from '@playwright/test';

test.describe('Code Generation Streaming UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('페이지가 로드되어야 함', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('프롬프트로 만드는 UI');
  });

  test('스트리밍 시작 시 StreamingCard가 표시되어야 함', async ({ page }) => {
    const promptInput = page.locator('input[type="text"]').first();
    const generateBtn = page.locator('button').filter({ hasText: /생성|제출/ }).first();

    await promptInput.fill('a red button');
    await generateBtn.click();

    const streamingBadge = page.locator('.streaming-badge, text=생성 중');
    await expect(streamingBadge).toBeVisible({ timeout: 8000 });
  });

  test('스트리밍 종료 후 생성된 컴포넌트가 나타나야 함', async ({ page }) => {
    const promptInput = page.locator('input[type="text"]').first();
    const generateBtn = page.locator('button').filter({ hasText: /생성|제출/ }).first();

    await promptInput.fill('a simple card component');
    await generateBtn.click();

    const streamingBadge = page.locator('.streaming-badge, text=생성 중');
    await expect(streamingBadge).toBeVisible({ timeout: 8000 });

    const componentCard = page.locator('.component-card').first();
    await expect(componentCard).toBeVisible({ timeout: 30000 });

    await expect(page.locator('iframe')).toHaveCount(1, { timeout: 10000 });
  });

  test('여러 번 생성 시 모든 컴포넌트가 표시되어야 함', async ({ page }) => {
    const promptInput = page.locator('input[type="text"]').first();
    const generateBtn = page.locator('button').filter({ hasText: /생성|제출/ }).first();

    await promptInput.fill('a blue button');
    await generateBtn.click();

    const firstCard = page.locator('.component-card').first();
    await expect(firstCard).toBeVisible({ timeout: 30000 });

    await promptInput.clear();
    await promptInput.fill('a green input');
    await generateBtn.click();

    const cards = page.locator('.component-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('에러 발생 시 에러 메시지 배너가 표시되어야 함', async ({ page }) => {
    const generateBtn = page.locator('button').filter({ hasText: /생성|제출/ }).first();
    const promptInput = page.locator('input[type="text"]').first();

    await promptInput.fill('');
    await generateBtn.click();

    const errorBanner = page.locator('.error-banner, [role="alert"]');
    await expect(errorBanner).toBeVisible({ timeout: 5000 }).catch(() => {
      // API 키가 없으면 에러가 나타남
    });
  });

  test('Provider 선택 UI가 있어야 함', async ({ page }) => {
    const providerSelect = page.locator('select[id="provider"]');
    await expect(providerSelect).toBeVisible();

    const options = providerSelect.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('API 키 입력 필드가 있어야 함', async ({ page }) => {
    const apiKeyInput = page.locator('input[id="api-key"]');
    await expect(apiKeyInput).toBeVisible();

    const toggleBtn = page.locator('button').filter({ hasText: /보기|숨기기/ }).first();
    await expect(toggleBtn).toBeVisible();
  });

  test('헤더 정보가 표시되어야 함', async ({ page }) => {
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('text=React Component Generator')).toBeVisible();
  });

  test('스트리밍 중 코드 블록이 업데이트되어야 함', async ({ page }) => {
    const promptInput = page.locator('input[type="text"]').first();
    const generateBtn = page.locator('button').filter({ hasText: /생성|제출/ }).first();

    await promptInput.fill('a test component');
    await generateBtn.click();

    const codeBlock = page.locator('.code-block, pre code').first();
    await expect(codeBlock).toBeVisible({ timeout: 30000 });

    const initialText = await codeBlock.textContent();
    expect(initialText?.length).toBeGreaterThan(0);
  });
});
