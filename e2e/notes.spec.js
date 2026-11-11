const { test, expect } = require('@playwright/test');

test('notes page renders and paginates', async ({ page }) => {
	await page.goto('/notes/');

	await expect(page.locator('h1.post-title')).toContainText('All Notes');
	await expect(page.locator('.notes .note').first()).toBeVisible();
	const pagination = page.locator('.navigation.prevnext');

	if ((await pagination.count()) > 0) {
		expect(await pagination.locator('a').count()).toBeGreaterThan(0);
	}
});

test('sitemap uses latest note date for notes', async ({ request }) => {
	const response = await request.get('/sitemap.xml');

	expect(response.ok()).toBe(true);
	const body = await response.text();

	const notesMatch = body.match(
		/<loc>[^<]*\/notes\/<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/,
	);

	expect(notesMatch).not.toBeNull();
	expect(notesMatch[1]).toMatch(/^2025-07-23T/);
});
