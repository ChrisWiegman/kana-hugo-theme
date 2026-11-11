const { test, expect } = require('@playwright/test');

test('posts publish a Markdown version and link to it', async ({ page, request }) => {
	await page.goto('/2026/01/hugo-development-post/');

	const alternate = page.locator('link[rel="alternate"][type="text/markdown"]');
	const href = await alternate.getAttribute('href');

	expect(href).toMatch(/\/2026\/01\/hugo-development-post\/index\.md$/);

	const body = await (await request.get('/2026/01/hugo-development-post/index.md')).text();

	expect(body).toMatch(/^---\ntitle: "Hugo Development Post"\n/);
	expect(body).toContain('tags: ["Hugo","Theme"]');
	expect(body).toContain('# Hugo Development Post\n');
	// Root-relative links are made absolute so they resolve outside the site.
	expect(body).toMatch(/\[link\]\(https?:\/\/[^)]+\/2025\/12\/lorem-ipsum-post-7\/\)/);
});

test('library Markdown lists every book', async ({ request }) => {
	const body = await (await request.get('/library/index.md')).text();
	const count = Number(body.match(/(\d+) books\./)[1]);

	expect(count).toBeGreaterThan(0);
	expect(body.match(/^- .+ by .+/gm)).toHaveLength(count);
});
