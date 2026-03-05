import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('giriş sayfası görünür', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/OpenCC|Çağrı Merkezi/i)).toBeVisible();
    await expect(page.getByLabel(/Kullanıcı adı/i)).toBeVisible();
    await expect(page.getByLabel(/Şifre/i)).toBeVisible();
  });

  test('yanlış şifre ile giriş hata verir', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/Kullanıcı adı/i).fill('admin');
    await page.getByLabel(/Şifre/i).fill('wrong');
    await page.getByRole('button', { name: 'Giriş' }).click();
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });

  test('doğru bilgilerle giriş başarılı', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/Kullanıcı adı/i).fill('admin');
    await page.getByLabel(/Şifre/i).fill('admin123');
    await page.getByRole('button', { name: 'Giriş' }).click();
    await expect(page).toHaveURL(/\//);
    await expect(page.getByRole('heading', { name: /Hoş geldin/i })).toBeVisible({ timeout: 5000 });
  });
});
