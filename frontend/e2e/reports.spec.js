import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  await page.goto('/login');
  await page.getByLabel(/Kullanıcı adı/i).fill('admin');
  await page.getByLabel(/Şifre/i).fill('admin123');
  await page.getByRole('button', { name: 'Giriş' }).click();
  await expect(page).toHaveURL(/\//);
  await expect(page.getByRole('heading', { name: /Hoş geldin/i })).toBeVisible({ timeout: 5000 });
}

test.describe('Raporlar', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('raporlar sayfası açılır ve CDR görünür', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByText(/CDR Raporları|Filtrele/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Filtrele/i })).toBeVisible();
  });

  test('filtrele butonu çalışır', async ({ page }) => {
    await page.goto('/reports');
    await page.getByRole('button', { name: /Filtrele/i }).click();
    await expect(page.getByText(/CDR Raporları/i)).toBeVisible();
  });
});
