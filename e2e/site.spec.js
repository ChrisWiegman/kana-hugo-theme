const { test, expect } = require('@playwright/test');

test('search page returns results', async ({ page }) => {
	await page.goto('/search?s=hugo');

	await expect(page.locator('#search-count')).toBeVisible();
	await expect(page.locator('#search-results')).toBeVisible();
});

test('tag archive renders posts', async ({ page }) => {
	await page.goto('/tags/hugo/');

	await expect(page.locator('h1.post-title')).toContainText('Hugo');
	await expect(page.locator('.posts .post').first()).toBeVisible();
});

test('navigation links resolve to content pages', async ({ page }) => {
	await page.goto('/');

	await expect(page.locator('header .menu a[href$=\'/about/\']')).toBeVisible();
	await expect(page.locator('header .menu a[href$=\'/blog/\']')).toBeVisible();
	await expect(page.locator('footer .menu a[href$=\'/uses/\']')).toBeVisible();
	await expect(page.locator('footer .menu a[href$=\'/now/\']')).toBeVisible();

	await page.goto('/about/');
	await expect(page.locator('h1.post-title')).toContainText('About Me');

	await page.goto('/uses/');
	await expect(page.locator('h1.post-title')).toContainText('Uses');

	await page.goto('/now/');
	await expect(page.locator('h1.post-title')).toContainText('Now');
});

test('index json output contains post metadata', async ({ request }) => {
	const response = await request.get('/index.json');

	expect(response.ok()).toBe(true);
	const data = await response.json();

	expect(Array.isArray(data)).toBe(true);
	expect(
		data.some(
			(item) =>
				item.title === 'Hugo Development Post' &&
        item.permalink === '/2026/01/hugo-development-post/',
		),
	).toBe(true);
});
