// @ts-check
const { test, expect } = require('@playwright/test');

const EXPECTED_NAV = ['Inventory', 'Why Us', 'Reviews', 'Portfolio', 'Company', 'Contact'];

/** @type {{ file: string, activeLabel: string | null }[]} */
const PAGES = [
  { file: 'index.html', activeLabel: null },
  { file: 'contact.html', activeLabel: 'Contact' },
  { file: 'portfolio.html', activeLabel: 'Portfolio' },
  { file: 'company.html', activeLabel: 'Company' },
];

test.describe('Nav consistency across pages', () => {
  for (const { file, activeLabel } of PAGES) {
    test(`${file} has the full nav, correct active link, and no console/page errors`, async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const response = await page.goto(`/${file}`);
      expect(response?.status()).toBe(200);

      const navLabels = (await page.locator('nav ul a').allTextContents()).map((t) => t.trim());
      expect(navLabels).toEqual(EXPECTED_NAV);

      const activeLabels = (await page.locator('nav ul a.active').allTextContents()).map((t) => t.trim());
      expect(activeLabels).toEqual(activeLabel ? [activeLabel] : []);

      expect(consoleErrors, 'unexpected console errors').toEqual([]);
      expect(pageErrors, 'unexpected uncaught page errors').toEqual([]);
    });
  }
});

test.describe('Nav links resolve', () => {
  for (const { file } of PAGES) {
    test(`${file}: every same-origin nav link returns 200`, async ({ page, request, baseURL }) => {
      await page.goto(`/${file}`);
      const hrefs = await page
        .locator('nav ul a')
        .evaluateAll((els) => els.map((el) => el.getAttribute('href')));

      for (const href of hrefs) {
        if (!href || href.startsWith('#')) continue; // in-page anchor on the current document
        const target = href.split('#')[0];
        const res = await request.get(`${baseURL}/${target}`);
        expect(res.ok(), `${file} -> ${href} (${res.status()})`).toBeTruthy();
      }
    });
  }
});

test.describe('Company page — management list', () => {
  test('renders 6 leadership cards, each with a name, title, and bio', async ({ page }) => {
    await page.goto('/company.html');
    const cards = page.locator('.team-card');
    await expect(cards).toHaveCount(6);

    const first = cards.first();
    await expect(first.locator('.team-name')).toHaveText('Robert Hayes');
    await expect(first.locator('.team-title')).toHaveText('Founder & CEO');

    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await expect(card.locator('.team-name')).not.toBeEmpty();
      await expect(card.locator('.team-title')).not.toBeEmpty();
      await expect(card.locator('.team-bio')).not.toBeEmpty();
    }
  });
});

test.describe('Contact form', () => {
  test('submitting reveals the thank-you message without leaving the page', async ({ page }) => {
    await page.goto('/contact.html');
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.selectOption('form select', { index: 1 });
    await page.click('button[type="submit"]');

    await expect(page.locator('#formStatus')).toBeVisible();
    await expect(page).toHaveURL(/contact\.html/);
  });
});
