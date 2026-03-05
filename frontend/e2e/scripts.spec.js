import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  await page.goto('/login');
  await page.getByLabel(/Kullanıcı adı/i).fill('admin');
  await page.getByLabel(/Şifre/i).fill('admin123');
  await page.getByRole('button', { name: 'Giriş' }).click();
  await expect(page).toHaveURL(/\//);
  await expect(page.getByRole('heading', { name: /Hoş geldin/i })).toBeVisible({ timeout: 5000 });
}

test.describe('Scriptler', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('scriptler sayfası açılır', async ({ page }) => {
    await page.goto('/scripts');
    await expect(page.getByText(/Scriptler|Tahsilat|Yeni Script/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Yeni Script/i })).toBeVisible();
  });
});
