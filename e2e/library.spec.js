const { test, expect } = require('@playwright/test');

/* global Node, DOMParser -- used inside functions that run in the browser */

test('library page renders book list', async ({ page }) => {
	await page.goto('/library/');

	await expect(page.locator('h1.post-title')).toContainText('My Library');
	await expect(page.locator('.books .book').first()).toBeVisible();
});

test('year filter shows only books read in that year', async ({ page }) => {
	await page.goto('/library/');

	// Find the first year card available in the summary
	const yearBtn = page.locator('.summary-card[data-filter-year]').first();

	await expect(yearBtn).toBeVisible();
	const year = await yearBtn.getAttribute('data-filter-year');

	await yearBtn.click();

	await expect(yearBtn).toHaveAttribute('aria-pressed', 'true');

	// All visible books should contain the selected year in their data-years
	const visibleBooks = page.locator('.books .book:visible');
	const count = await visibleBooks.count();

	expect(count).toBeGreaterThan(0);
	for (let i = 0; i < Math.min(count, 5); i++) {
		const years = await visibleBooks.nth(i).getAttribute('data-years');

		expect(years).toContain(year);
	}

	await expect(page.locator('[data-filter-label]')).toContainText(`read in ${year}`);
	await expect(page.locator('[data-filter-clear]')).toBeVisible();
});

test('author filter shows only books by that author', async ({ page }) => {
	await page.goto('/library/');

	// Use the first book's author button to filter
	const firstAuthorBtn = page.locator('.books .book:visible .book-author').first();
	const authorKey = await firstAuthorBtn.getAttribute('data-filter-author');

	await firstAuthorBtn.click();

	await expect(firstAuthorBtn).toHaveAttribute('aria-pressed', 'true');

	// All visible books should be by the selected author
	const visibleBooks = page.locator('.books .book:visible');
	const count = await visibleBooks.count();

	expect(count).toBeGreaterThan(0);
	for (let i = 0; i < count; i++) {
		await expect(visibleBooks.nth(i)).toHaveAttribute('data-author', authorKey);
	}

	// book-count shows total filtered books (may exceed current page size)
	const displayedCount = await page.locator('.book-count').textContent();

	expect(parseInt(displayedCount, 10)).toBeGreaterThan(0);
	await expect(page.locator('[data-filter-label]')).not.toBeEmpty();
});

test('rating filter shows only books with that rating', async ({ page }) => {
	await page.goto('/library/');

	// Use the first book's rating button to filter
	const firstRatingBtn = page.locator('.books .book:visible .book-rating').first();
	const ratingKey = await firstRatingBtn.getAttribute('data-filter-rating');

	await firstRatingBtn.click();

	await expect(firstRatingBtn).toHaveAttribute('aria-pressed', 'true');

	// All visible books should have the selected rating
	const visibleBooks = page.locator('.books .book:visible');
	const count = await visibleBooks.count();

	expect(count).toBeGreaterThan(0);
	for (let i = 0; i < count; i++) {
		await expect(visibleBooks.nth(i)).toHaveAttribute('data-rating', ratingKey);
	}

	// book-count shows total filtered books (may exceed current page size)
	const displayedCount = await page.locator('.book-count').textContent();

	expect(parseInt(displayedCount, 10)).toBeGreaterThan(0);
	await expect(page.locator('[data-filter-label]')).not.toBeEmpty();
});

test('clear filter restores all books', async ({ page }) => {
	await page.goto('/library/');

	const totalBooks = await page.locator('.book-count').textContent();

	await page.locator('.summary-card[data-filter-year]').first().click();
	await expect(page.locator('[data-filter-clear]')).toBeVisible();

	await page.locator('[data-filter-clear]').click();

	await expect(page.locator('[data-filter-clear]')).toHaveAttribute('hidden', '');
	// After clearing, the total count in the header should be restored
	await expect(page.locator('.book-count')).toContainText(String(totalBooks));
	// At least one page of books should be visible
	await expect(page.locator('.books .book:visible').first()).toBeVisible();
});

test('clicking active filter toggles it off', async ({ page }) => {
	await page.goto('/library/');

	const yearBtn = page.locator('.summary-card[data-filter-year]').first();

	await yearBtn.click();
	await expect(yearBtn).toHaveAttribute('aria-pressed', 'true');

	await yearBtn.click();
	await expect(yearBtn).toHaveAttribute('aria-pressed', 'false');
	await expect(page.locator('[data-filter-clear]')).toHaveAttribute('hidden', '');
	// After toggling off, books should be visible again
	await expect(page.locator('.books .book:visible').first()).toBeVisible();
});

test('summary cards show year and author data', async ({ page }) => {
	await page.goto('/library/');

	await expect(page.locator('.library-summary')).toBeVisible();

	// Year summary cards exist with counts
	const yearCards = page.locator('.summary-card[data-filter-year]');

	await expect(yearCards.first()).toBeVisible();
	const yearCount = await page.locator('.summary-card[data-filter-year] .summary-count').first().textContent();

	expect(parseInt(yearCount, 10)).toBeGreaterThan(0);

	// Author summary grid exists
	await expect(page.locator('.summary-grid-authors')).toBeVisible();
	const authorCards = page.locator('.summary-card[data-filter-author]');

	await expect(authorCards.first()).toBeVisible();
	const authorCount = await page.locator('.summary-card[data-filter-author] .summary-count').first().textContent();

	expect(parseInt(authorCount, 10)).toBeGreaterThan(0);
});

test('author summary card filters books', async ({ page }) => {
	await page.goto('/library/');

	// Use the first author card in the summary (most-read author)
	const authorCard = page.locator('.summary-card[data-filter-author]').first();

	await expect(authorCard).toBeVisible();
	const authorKey = await authorCard.getAttribute('data-filter-author');

	await authorCard.click();

	await expect(authorCard).toHaveAttribute('aria-pressed', 'true');

	// All visible books should be by that author
	const visibleBooks = page.locator('.books .book:visible');
	const count = await visibleBooks.count();

	expect(count).toBeGreaterThan(0);
	for (let i = 0; i < count; i++) {
		await expect(visibleBooks.nth(i)).toHaveAttribute('data-author', authorKey);
	}

	await expect(page.locator('[data-filter-clear]')).toBeVisible();
});

test('sitemap uses latest finished date for library', async ({ request }) => {
	const response = await request.get('/sitemap.xml');

	expect(response.ok()).toBe(true);
	const body = await response.text();

	const libraryMatch = body.match(
		/<loc>[^<]*\/library\/<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/,
	);

	expect(libraryMatch).not.toBeNull();
	expect(libraryMatch[1]).toMatch(/^2026-05-28T/);
});

// ---------------------------------------------------------------------------
// Progressive loading: the page ships one page of books as HTML and fetches
// the full list as JSON.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

async function libraryData(page, request) {
	const url = await page.locator('[data-library-table]').getAttribute('data-books-url');
	const response = await request.get(new URL(url, page.url()).href);

	expect(response.ok()).toBe(true);

	return response.json();
}

async function waitForData(page) {
	await expect(page.locator('[data-library-table][data-library-ready]')).toHaveCount(1);
}

// A whitespace-insensitive description of an element tree, for comparing
// server-rendered rows with rows built by library.js.
function describeRows(rows) {
	const describe = (node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent.replace(/\s+/g, ' ').trim();

			return text ? text : null;
		}

		if (node.nodeType !== Node.ELEMENT_NODE) return null;

		const attributes = [...node.attributes]
			.filter((attribute) => attribute.name !== 'aria-pressed')
			// Hugo percent-encodes some URL characters (such as parentheses) that
			// the browser leaves alone; both forms point to the same address.
			.map((attribute) => `${attribute.name}=${attribute.name === 'href' ? decodeURI(attribute.value) : attribute.value}`)
			.sort();

		return { tag: node.tagName.toLowerCase(), attributes, children: [...node.childNodes].map(describe).filter(Boolean) };
	};

	return Object.fromEntries(rows.map((row) => [`${row.dataset.title}\n${row.dataset.author}`, describe(row)]));
}

test('library ships one page of books and publishes the full list as fingerprinted JSON', async ({ page, request }) => {
	const response = await request.get('/library/');
	const html = await response.text();

	expect(html.match(/<div class="book" /g)).toHaveLength(PAGE_SIZE);

	const url = html.match(/data-books-url="([^"]+)"/)[1];

	expect(url).toMatch(/books\.[0-9a-f]{64}\.json$/);

	await page.goto('/library/');
	const data = await libraryData(page, request);
	const total = Number(await page.locator('.book-count').textContent());

	expect(data).toHaveLength(total);
	expect(total).toBeGreaterThan(PAGE_SIZE);

	for (const book of data) {
		expect(typeof book.title).toBe('string');
		expect(typeof book.titleKey).toBe('string');
		expect(typeof book.authorKey).toBe('string');
		expect(Number.isInteger(book.rating)).toBe(true);
		expect(Number.isInteger(book.finished)).toBe(true);
		expect(Array.isArray(book.years)).toBe(true);
		expect(Array.isArray(book.dates)).toBe(true);
	}

	// The JSON is in the same default order as the server-rendered rows.
	const firstKeys = await page.evaluate((source) => [...new DOMParser().parseFromString(source, 'text/html')
		.querySelectorAll('.books .book')].map((row) => row.dataset.title), html);

	expect(data.slice(0, PAGE_SIZE).map((book) => book.titleKey)).toEqual(firstKeys);

	const finished = data.map((book) => book.finished);

	expect(finished).toEqual([...finished].sort((a, b) => b - a));
});

test('rows built from JSON match the server-rendered markup', async ({ page, request }) => {
	const serverHtml = await (await request.get('/library/')).text();

	// Break the keys on the server rows so library.js can't reuse them and has
	// to build every row from the JSON instead.
	await page.route('**/library/', async (route) => {
		const response = await route.fetch();
		const body = (await response.text()).replace(/(<div class="book" data-title=")/g, '$1unused-');

		await route.fulfill({ response, body });
	});

	await page.goto('/library/');
	await waitForData(page);

	const built = await page.locator('.books .book').evaluateAll(describeRows);
	const server = await page.evaluate(([html, describe]) => {
		const doc = new DOMParser().parseFromString(html, 'text/html');

		return new Function('rows', `return (${describe})(rows);`)([...doc.querySelectorAll('.books .book')]);
	}, [serverHtml, describeRows.toString()]);

	expect(Object.keys(built)).toHaveLength(PAGE_SIZE);
	expect(Object.keys(built).sort()).toEqual(Object.keys(server).sort());
	for (const key of Object.keys(server)) {
		expect(built[key], key).toEqual(server[key]);
	}
});

test('server-rendered rows are reused once the data loads', async ({ page }) => {
	await page.goto('/library/');

	const first = page.locator('.books .book').first();

	await first.evaluate((row) => {
		row.dataset.marker = 'server';
	});
	await waitForData(page);

	await expect(page.locator('.books .book').first()).toHaveAttribute('data-marker', 'server');
	await expect(page.locator('.books .book')).toHaveCount(PAGE_SIZE);
});

test('load more appends the next page of books without duplicates', async ({ page, request }) => {
	await page.goto('/library/');
	await waitForData(page);
	const data = await libraryData(page, request);

	await expect(page.locator('.books .book')).toHaveCount(PAGE_SIZE);

	await page.locator('.prevnext .next').evaluate((link) => link.click());
	await expect(page.locator('.books .book')).toHaveCount(PAGE_SIZE * 2);

	const keys = await page.locator('.books .book').evaluateAll((rows) => rows.map((row) => row.dataset.title));

	expect(new Set(keys).size).toBe(keys.length);
	expect(keys).toEqual(data.slice(0, PAGE_SIZE * 2).map((book) => book.titleKey));
});

test('scrolling to the bottom loads more books', async ({ page }) => {
	await page.goto('/library/');
	await waitForData(page);

	await page.locator('.prevnext .next').scrollIntoViewIfNeeded();
	await expect.poll(() => page.locator('.books .book').count()).toBeGreaterThan(PAGE_SIZE);
});

test('only the rows on screen are in the DOM', async ({ page }) => {
	await page.goto('/library/');
	await waitForData(page);

	const total = Number(await page.locator('.book-count').textContent());

	expect(total).toBeGreaterThan(PAGE_SIZE);
	await expect(page.locator('.books .book')).toHaveCount(PAGE_SIZE);
	await expect(page.locator('.books .book:visible')).toHaveCount(PAGE_SIZE);
});

test('filters include books beyond the first page', async ({ page, request }) => {
	await page.goto('/library/');
	await waitForData(page);
	const data = await libraryData(page, request);
	const shown = new Set(data.slice(0, PAGE_SIZE).map((book) => book.authorKey));

	// Pick an author who isn't on the first page, so their books come from the JSON.
	const authors = await page.locator('.summary-card[data-filter-author]').evaluateAll((cards) => cards.map((item) => item.dataset.filterAuthor));
	const author = authors.find((key) => !shown.has(key));

	expect(author).toBeDefined();

	await page.locator(`.summary-card[data-filter-author="${author}"]`).click();

	const expected = data.filter((book) => book.authorKey === author);

	await expect(page.locator('.book-count')).toHaveText(String(expected.length));
	await expect(page.locator('.books .book')).toHaveCount(Math.min(expected.length, PAGE_SIZE));
	await expect(page.locator('[data-filter-label]')).toHaveText(` by ${expected[0].author}`);

	const rows = await page.locator('.books .book').evaluateAll((items) => items.map((row) => row.dataset.author));

	expect(rows.every((key) => key === author)).toBe(true);
	await expect(page.locator(`.books .book-author[data-filter-author="${author}"]`).first()).toHaveAttribute('aria-pressed', 'true');
});

test('a filter with one page of results hides load more', async ({ page, request }) => {
	await page.goto('/library/');
	await waitForData(page);
	const data = await libraryData(page, request);
	const button = page.locator('.books .book-author').first();
	const author = await button.getAttribute('data-filter-author');
	const expected = data.filter((book) => book.authorKey === author).length;

	expect(expected).toBeLessThan(PAGE_SIZE);
	await expect(page.locator('.prevnext')).toBeVisible();

	await button.click();

	await expect(page.locator('.books .book')).toHaveCount(expected);
	await expect(page.locator('.prevnext')).toBeHidden();
});

test('sorting by title orders the whole library', async ({ page, request }) => {
	await page.goto('/library/');
	await waitForData(page);
	const data = await libraryData(page, request);

	await page.locator('.book-sort[data-sort="title"]').click();
	await expect(page.locator('.book-sort[data-sort="title"]')).toHaveAttribute('aria-sort', 'ascending');

	const expected = await page.evaluate((keys) => keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
		|| a.localeCompare(b)).slice(0, 25), data.map((book) => book.titleKey));
	const keys = await page.locator('.books .book').evaluateAll((rows) => rows.map((row) => row.dataset.title));

	expect(keys).toEqual(expected);

	await page.locator('.book-sort[data-sort="title"]').click();
	await expect(page.locator('.book-sort[data-sort="title"]')).toHaveAttribute('aria-sort', 'descending');
});

test('sorting by rating puts the highest-rated books first', async ({ page }) => {
	await page.goto('/library/');
	await waitForData(page);

	await page.locator('.book-sort[data-sort="rating"]').click();
	await page.locator('.book-sort[data-sort="rating"]').click();
	await expect(page.locator('.book-sort[data-sort="rating"]')).toHaveAttribute('aria-sort', 'descending');

	const ratings = await page.locator('.books .book').evaluateAll((rows) => rows.map((row) => Number(row.dataset.rating)));

	expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
	expect(ratings[0]).toBe(5);
});

test('the chosen sort is remembered across visits', async ({ page }) => {
	await page.goto('/library/');
	await waitForData(page);
	await page.locator('.book-sort[data-sort="author"]').click();
	const firstAuthor = await page.locator('.books .book').first().getAttribute('data-author');

	await page.reload();
	await waitForData(page);

	await expect(page.locator('.book-sort[data-sort="author"]')).toHaveAttribute('aria-sort', 'ascending');
	await expect(page.locator('.books .book').first()).toHaveAttribute('data-author', firstAuthor);
});

test('filters and sorts clicked before the data loads are applied once it arrives', async ({ page, request }) => {
	let release;
	const held = new Promise((resolve) => {
		release = resolve;
	});

	await page.route('**/books.*.json', async (route) => {
		await held;
		await route.continue();
	});

	await page.goto('/library/');
	const yearCard = page.locator('.summary-card[data-filter-year]').first();
	const year = await yearCard.getAttribute('data-filter-year');

	await yearCard.click();
	await expect(page.locator('[data-library-table][data-library-ready]')).toHaveCount(0);
	release();
	await waitForData(page);

	const data = await libraryData(page, request);
	const expected = data.filter((book) => book.years.includes(year)).length;

	await expect(yearCard).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.book-count')).toHaveText(String(expected));
});

test('the library still works on the first page when the data fails to load', async ({ page }) => {
	await page.route('**/books.*.json', (route) => route.abort());
	await page.goto('/library/');
	await waitForData(page);

	await expect(page.locator('.books .book')).toHaveCount(PAGE_SIZE);
	await expect(page.locator('.prevnext')).toBeHidden();

	await page.locator('.book-sort[data-sort="title"]').click();
	const keys = await page.locator('.books .book').evaluateAll((rows) => rows.map((row) => row.dataset.title));

	expect(keys).toHaveLength(PAGE_SIZE);
	expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) || a.localeCompare(b)));

	const author = await page.locator('.books .book-author').first().getAttribute('data-filter-author');

	await page.locator('.books .book-author').first().click();
	const authors = await page.locator('.books .book').evaluateAll((rows) => rows.map((row) => row.dataset.author));

	expect(authors.length).toBeGreaterThan(0);
	expect(authors.every((key) => key === author)).toBe(true);
});

test('without JavaScript the library links to the full Markdown list', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();

	await page.goto('/library/');

	await expect(page.locator('.books .book')).toHaveCount(PAGE_SIZE);
	const link = page.locator('.books-noscript a');

	await expect(link).toBeVisible();
	expect(await link.getAttribute('href')).toMatch(/library\/index\.md$/);
	await context.close();
});
