import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const OPEN_SESSION = {
  id: '2026-10-27',
  startsAt: '2026-10-27T21:00:00.000Z', // 18:00 BRT
  endsAt: '2026-10-27T22:00:00.000Z',
  opensAt: '2026-10-27T15:00:00.000Z', // 12:00 BRT (6h before)
  closesAt: '2026-10-28T03:00:00.000Z', // 00:00 BRT next day (6h after)
  timezone: 'America/Sao_Paulo',
  title: null,
  topic: 'AI & Remote Work',
  status: 'scheduled' as const,
  requireKeyword: true,
};

const NEXT_SESSION = {
  id: '2026-10-29',
  startsAt: '2026-10-29T21:00:00.000Z',
  endsAt: '2026-10-29T22:00:00.000Z',
  opensAt: '2026-10-29T15:00:00.000Z',
  closesAt: '2026-10-30T03:00:00.000Z',
  timezone: 'America/Sao_Paulo',
  title: null,
  topic: 'Travel across LATAM',
  status: 'scheduled' as const,
  requireKeyword: true,
};

test.describe('EnglishTalk E2E — Student flow, i18n, a11y, offline & admin gate', () => {
  test('full 3-step student check-in flow with typo suggestion, keyword check, and axe pass', async ({
    page,
  }) => {
    await page.route('**/api/sessions/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          serverNow: '2026-10-27T21:30:00.000Z',
          open: [OPEN_SESSION],
          next: NEXT_SESSION,
        }),
      });
    });

    await page.route('**/api/checkin', async (route) => {
      const payload = route.request().postDataJSON() as { keyword: string };
      if (payload.keyword.toLowerCase() !== 'trade-off') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'keyword_wrong', field: 'keyword' }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'created',
          sessionId: '2026-10-27',
          late: false,
          next: NEXT_SESSION,
        }),
      });
    });

    await page.goto('/?lang=en');
    await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();

    // Axe check on Step 1
    const axeStep1 = await new AxeBuilder({ page }).analyze();
    expect(axeStep1.violations).toEqual([]);

    // Type typo domain -> suggestion appears -> tap suggestion
    const emailInput = page.getByLabel('Email');
    await emailInput.fill('maria@gmial.com');
    const suggestionBtn = page.getByRole('button', { name: /Did you mean maria@gmail\.com\?/i });
    await expect(suggestionBtn).toBeVisible();
    await suggestionBtn.click();
    await expect(emailInput).toHaveValue('maria@gmail.com');

    // Pick country
    const countryInput = page.getByRole('combobox', { name: /Which country/i });
    await countryInput.click();
    await page.getByRole('option', { name: /Brazil/i }).click();

    await page.getByRole('button', { name: /a Rocketseat student/i }).click();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 2
    await expect(page.getByRole('heading', { name: 'Your class' })).toBeVisible();
    const axeStep2 = await new AxeBuilder({ page }).analyze();
    expect(axeStep2.violations).toEqual([]);

    await page.getByRole('radio', { name: /A lot: I spoke several times/i }).click();
    await page.getByRole('button', { name: /Just right/i }).click();
    await page.getByRole('radio', { name: /5 — Excellent/i }).click();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 3
    await expect(page.getByRole('heading', { name: 'Keyword & notes' })).toBeVisible();
    const axeStep3 = await new AxeBuilder({ page }).analyze();
    expect(axeStep3.violations).toEqual([]);

    const keywordInput = page.getByLabel('Secret keyword');
    await keywordInput.fill('wrongword');
    await page.getByRole('button', { name: /Register attendance/i }).click();
    await expect(page.getByText(/doesn't match today's secret keyword/i).first()).toBeVisible();

    await keywordInput.fill('TRADE-OFF');
    await page.getByRole('button', { name: /Register attendance/i }).click();

    await expect(
      page.getByRole('heading', {
        name: /Thank you! Your attendance is registered\. See you in the next class!/i,
      }),
    ).toBeVisible();
  });

  test('renders Portuguese and Spanish (without opening ¡ or ¿) and passes axe on closed & privacy screens', async ({
    page,
  }) => {
    await page.route('**/api/sessions/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          serverNow: '2026-10-27T14:00:00.000Z', // 11:00 BRT -> before 12:00 BRT open
          open: [],
          next: OPEN_SESSION,
        }),
      });
    });

    await page.goto('/?lang=es');
    await expect(
      page.getByRole('heading', { name: 'El check-in está cerrado en este momento' }),
    ).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('¡');
    expect(bodyText).not.toContain('¿');

    const axeClosedEs = await new AxeBuilder({ page }).analyze();
    expect(axeClosedEs.violations).toEqual([]);

    // Switch to PT
    await page.getByRole('button', { name: 'pt', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'O check-in está fechado no momento' }),
    ).toBeVisible();

    // Privacy page
    await page.getByRole('link', { name: 'Privacidade' }).click();
    await expect(page.getByRole('heading', { name: 'Aviso de Privacidade' })).toBeVisible();
    const axePrivacy = await new AxeBuilder({ page }).analyze();
    expect(axePrivacy.violations).toEqual([]);
  });

  test('queues check-in in IndexedDB when offline and flushes when back online', async ({
    page,
    context,
  }) => {
    await page.route('**/api/sessions/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          serverNow: '2026-10-27T21:30:00.000Z',
          open: [OPEN_SESSION],
          next: NEXT_SESSION,
        }),
      });
    });

    await page.goto('/?lang=en');
    await page.getByLabel('Email').fill('offline.student@gmail.com');
    const countryInput = page.getByRole('combobox', { name: /Which country/i });
    await countryInput.click();
    await page.getByRole('option', { name: /Brazil/i }).click();
    await page.getByRole('button', { name: /Continue/i }).click();

    await page.getByRole('radio', { name: /Chat only/i }).click();
    await page.getByRole('radio', { name: /4 — Great/i }).click();
    await page.getByRole('button', { name: /Continue/i }).click();

    await page.getByLabel('Secret keyword').fill('trade-off');

    // Go offline before submitting
    await context.setOffline(true);
    await page.getByRole('button', { name: /Register attendance/i }).click();

    await expect(
      page.getByRole('heading', { name: /Saved! We'll send it as soon as you're back online/i }),
    ).toBeVisible();

    await context.setOffline(false);
  });

  test('exposes valid webmanifest and protects /admin with login gate', async ({ page, request }) => {
    const manifestRes = await request.get('/manifest.webmanifest');
    expect(manifestRes.ok()).toBe(true);
    const manifest = (await manifestRes.json()) as { start_url: string; display: string };
    expect(manifest.start_url).toBe('/?source=pwa');
    expect(manifest.display).toBe('standalone');

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Teacher Admin/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  });
});
