import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  await page.goto('/login');
  await page.getByLabel(/Kullanıcı adı/i).fill('admin');
  await page.getByLabel(/Şifre/i).fill('admin123');
  await page.getByRole('button', { name: 'Giriş' }).click();
  await expect(page).toHaveURL(/\//);
  await expect(page.getByRole('heading', { name: /Hoş geldin/i })).toBeVisible({ timeout: 5000 });
}

test.describe('Müşteriler', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('müşteriler sayfası açılır', async ({ page }) => {
    await page.goto('/customers');
    await expect(page.getByText(/Müşteriler|Yeni Müşteri/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/Ara/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Yeni Müşteri/i })).toBeVisible();
  });

  test('yeni müşteri formu açılır', async ({ page }) => {
    await page.goto('/customers');
    await page.getByRole('button', { name: /Yeni Müşteri/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/Telefon/i)).toBeVisible();
  });
});
