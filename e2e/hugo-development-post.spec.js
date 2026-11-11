const { test, expect } = require('@playwright/test');

test('hugo development post renders key content types', async ({ page }) => {
	await page.goto('/2026/01/hugo-development-post/');

	await expect(page.locator('h1.post-title')).toContainText(
		'Hugo Development Post',
	);

	const internalLink = page.locator(
		'.content a[href$=\'/2025/12/lorem-ipsum-post-7/\']',
	);

	await expect(internalLink).toHaveText('link');
	await expect(internalLink).toHaveAttribute(
		'href',
		/\/2025\/12\/lorem-ipsum-post-7\/$/,
	);

	const externalLink = page.locator(
		'.content a[href=\'https://github.com/ChrisWiegman/kana-hugo-theme\']',
	);

	await expect(externalLink).toHaveText('link');

	await expect(page.locator('pre code')).toContainText(
		'add_action( \'some_wp_action\', __return_false );',
	);

	const image = page.locator(
		'figure img[alt=\'A test picture used for this site\']',
	);

	await expect(image).toBeVisible();
	await expect(image).toHaveAttribute('src', /dev-image-01\.jpeg/);
	await expect(image).toHaveAttribute('srcset', /dev-image-01/);
	await expect(image).toHaveAttribute('srcset', /\.webp/);
	await expect(image).toHaveAttribute('sizes', /\(max-width: 300px\)/);
	await expect(image).toHaveAttribute('loading', 'lazy');
	await expect(image).not.toHaveAttribute('fetchpriority');
	await expect(page.locator('figure figcaption')).toContainText(
		'This is an image with alt text and a caption',
	);
});
