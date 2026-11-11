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

test('notes rss feed uses author from site config and links to note pages', async ({ request }) => {
	const response = await request.get('/notes/index.xml');

	expect(response.ok()).toBe(true);

	const body = await response.text();

	expect(body).toContain('<dc:creator>Chris Wiegman</dc:creator>');

	const links = [...body.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((m) => m[1]);

	expect(links.length).toBeGreaterThan(0);

	// The dev site renders note pages, so feed items link to them directly.
	for (const link of links) {
		expect(link).toMatch(/\/notes\/\d{4}\/[\w-]+\/$/);
	}
});

test('rendered note pages are linked from the archive but hidden from search engines', async ({ page, request }) => {
	await page.goto('/notes/');

	const permalink = page.locator('.notes .note .note-title a.u-url').first();
	const href = await permalink.getAttribute('href');

	expect(href).toMatch(/notes\/\d{4}\/[\w-]+\/$/);

	await permalink.click();
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');

	const sitemap = await (await request.get('/sitemap.xml')).text();

	expect(sitemap).not.toMatch(/<loc>[^<]*\/notes\/\d{4}\//);
});
