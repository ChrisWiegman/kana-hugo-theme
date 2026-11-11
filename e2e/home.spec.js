const { test, expect } = require('@playwright/test');

test('homepage renders and navigation is present', async ({ page }) => {
	await page.goto('/');

	const siteTitleLink = page.locator('.site-title a');

	await expect(siteTitleLink).toContainText('Hugo Theme Development Site');
	await expect(siteTitleLink).toHaveAttribute('href', /\/$/);
	await expect(page.locator('header .menu')).toContainText('About');
	await expect(page.locator('header .menu')).toContainText('Blog');
	await expect(page.locator('h2.main-header')).toContainText('Recent Posts');
});

test('theme-color meta tag is present', async ({ page }) => {
	await page.goto('/');

	const themeColor = page.locator('meta[name=\'theme-color\']');

	await expect(themeColor).toHaveAttribute('content', '#1a1816');
});

test('404 page renders', async ({ page }) => {
	const response = await page.goto('/this-does-not-exist/');

	expect(response.status()).toBe(404);
	await expect(page.locator('h1.post-title')).toContainText(
		'Content not found.',
	);
});

test('homepage hero image renders via asset-image shortcode', async ({
	page,
}) => {
	await page.goto('/');

	const heroImg = page.locator('article.hero .content img');

	await expect(heroImg).toBeVisible();
	await expect(heroImg).toHaveAttribute('src', /\.webp/);
	await expect(heroImg).toHaveAttribute('width', '225');
	await expect(heroImg).toHaveAttribute('height', '225');
	await expect(heroImg).toHaveJSProperty('naturalWidth', 450);
});

test('homepage hero image keeps its width before it loads', async ({ page }) => {
	// Hold the hero image so it stays unloaded. Without an intrinsic size, a
	// flex item can shrink next to long text and then jump back to 225px when
	// the image arrives, shifting everything below the hero.
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.route('**/images/**', () => {});
	await page.goto('/', { waitUntil: 'domcontentloaded' });

	await page.locator('article.hero .intro p').first().evaluate((p) => {
		p.textContent = p.textContent.repeat(20);
	});

	const box = await page.locator('article.hero .content img').boundingBox();

	expect(box.width).toBe(225);
});

test('header icon is rendered at 2x its displayed size', async ({ page }) => {
	await page.goto('/');

	const icon = page.locator('header .site-title img');

	await expect(icon).toHaveAttribute('width', '20');
	await expect(icon).toHaveJSProperty('naturalWidth', 40);
});

test('rss feed uses author from site config', async ({ request }) => {
	const response = await request.get('/index.xml');

	expect(response.ok()).toBe(true);
	const body = await response.text();

	expect(body).toContain('<dc:creator>Chris Wiegman</dc:creator>');
});

test('sitemap and rss feeds are available', async ({ request }) => {
	const sitemapResponse = await request.get('/sitemap.xml');

	expect(sitemapResponse.ok()).toBe(true);
	const sitemapBody = await sitemapResponse.text();

	expect(sitemapBody).toContain('<urlset');

	const rssResponse = await request.get('/index.xml');

	expect(rssResponse.ok()).toBe(true);
	const rssBody = await rssResponse.text();

	expect(rssBody).toContain('<rss');
});

test('sitemap uses latest post date for homepage', async ({ request }) => {
	const response = await request.get('/sitemap.xml');

	expect(response.ok()).toBe(true);
	const body = await response.text();

	const notesMatch = body.match(
		/<loc>[^<]*\/<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/,
	);

	expect(notesMatch).not.toBeNull();
	expect(notesMatch[1]).toMatch(/^2026-01-14T/);
});
