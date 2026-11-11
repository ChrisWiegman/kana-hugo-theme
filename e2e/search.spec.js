const { test, expect } = require('@playwright/test');

test('search lists matching posts', async ({ page }) => {
	await page.goto('/search/?s=lorem');

	await expect(page.locator('#search-term')).toHaveText('lorem');
	const results = page.locator('#search-results a.post');

	await expect(results.first()).toBeVisible();
	expect(Number(await page.locator('#search-count').textContent())).toBe(await results.count());
});

test('search reports when nothing matches', async ({ page }) => {
	await page.goto('/search/?s=zzzz-no-such-content');

	await expect(page.locator('#search-results')).toContainText('No matches found');
	await expect(page.locator('#search-count')).toHaveText('0');
});

test('search without a query redirects to the blog', async ({ page }) => {
	await page.goto('/search/');

	await expect(page).toHaveURL(/\/blog\/$/);
});

test('search query is shown as text, not markup', async ({ page }) => {
	await page.goto('/search/?s=' + encodeURIComponent('<b>lorem</b>'));

	await expect(page.locator('#search-term')).toHaveText('<b>lorem</b>');
	await expect(page.locator('#search-term b')).toHaveCount(0);
});
