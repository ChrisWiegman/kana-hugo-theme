const { test, expect } = require("@playwright/test");

test("library page renders book list", async ({ page }) => {
  await page.goto("/library/");

  await expect(page.locator("h1.post-title")).toContainText("My Library");
  await expect(page.locator(".books .book").first()).toBeVisible();
});

test("year filter shows only books read in that year", async ({ page }) => {
  await page.goto("/library/");

  // Find the first year card available in the summary
  const yearBtn = page.locator(".summary-card[data-filter-year]").first();
  await expect(yearBtn).toBeVisible();
  const year = await yearBtn.getAttribute("data-filter-year");

  await yearBtn.click();

  await expect(yearBtn).toHaveAttribute("aria-pressed", "true");

  // All visible books should contain the selected year in their data-years
  const visibleBooks = page.locator(".books .book:visible");
  const count = await visibleBooks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < Math.min(count, 5); i++) {
    const years = await visibleBooks.nth(i).getAttribute("data-years");
    expect(years).toContain(year);
  }

  await expect(page.locator("[data-filter-label]")).toContainText(`read in ${year}`);
  await expect(page.locator("[data-filter-clear]")).toBeVisible();
});

test("author filter shows only books by that author", async ({ page }) => {
  await page.goto("/library/");

  // Use the first book's author button to filter
  const firstAuthorBtn = page.locator(".books .book:visible .book-author").first();
  const authorKey = await firstAuthorBtn.getAttribute("data-filter-author");
  await firstAuthorBtn.click();

  await expect(firstAuthorBtn).toHaveAttribute("aria-pressed", "true");

  // All visible books should be by the selected author
  const visibleBooks = page.locator(".books .book:visible");
  const count = await visibleBooks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(visibleBooks.nth(i)).toHaveAttribute("data-author", authorKey);
  }

  // book-count shows total filtered books (may exceed current page size)
  const displayedCount = await page.locator(".book-count").textContent();
  expect(parseInt(displayedCount, 10)).toBeGreaterThan(0);
  await expect(page.locator("[data-filter-label]")).not.toBeEmpty();
});

test("rating filter shows only books with that rating", async ({ page }) => {
  await page.goto("/library/");

  // Use the first book's rating button to filter
  const firstRatingBtn = page.locator(".books .book:visible .book-rating").first();
  const ratingKey = await firstRatingBtn.getAttribute("data-filter-rating");
  await firstRatingBtn.click();

  await expect(firstRatingBtn).toHaveAttribute("aria-pressed", "true");

  // All visible books should have the selected rating
  const visibleBooks = page.locator(".books .book:visible");
  const count = await visibleBooks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(visibleBooks.nth(i)).toHaveAttribute("data-rating", ratingKey);
  }

  // book-count shows total filtered books (may exceed current page size)
  const displayedCount = await page.locator(".book-count").textContent();
  expect(parseInt(displayedCount, 10)).toBeGreaterThan(0);
  await expect(page.locator("[data-filter-label]")).not.toBeEmpty();
});

test("clear filter restores all books", async ({ page }) => {
  await page.goto("/library/");

  const totalBooks = await page.locator(".books .book").count();

  await page.locator(".summary-card[data-filter-year]").first().click();
  await expect(page.locator("[data-filter-clear]")).toBeVisible();

  await page.locator("[data-filter-clear]").click();

  await expect(page.locator("[data-filter-clear]")).toHaveAttribute("hidden", "");
  // After clearing, the total count in the header should be restored
  await expect(page.locator(".book-count")).toContainText(String(totalBooks));
  // At least one page of books should be visible
  await expect(page.locator(".books .book:visible").first()).toBeVisible();
});

test("clicking active filter toggles it off", async ({ page }) => {
  await page.goto("/library/");

  const yearBtn = page.locator(".summary-card[data-filter-year]").first();

  await yearBtn.click();
  await expect(yearBtn).toHaveAttribute("aria-pressed", "true");

  await yearBtn.click();
  await expect(yearBtn).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-filter-clear]")).toHaveAttribute("hidden", "");
  // After toggling off, books should be visible again
  await expect(page.locator(".books .book:visible").first()).toBeVisible();
});

test("summary cards show year and author data", async ({ page }) => {
  await page.goto("/library/");

  await expect(page.locator(".library-summary")).toBeVisible();

  // Year summary cards exist with counts
  const yearCards = page.locator(".summary-card[data-filter-year]");
  await expect(yearCards.first()).toBeVisible();
  const yearCount = await page.locator(".summary-card[data-filter-year] .summary-count").first().textContent();
  expect(parseInt(yearCount, 10)).toBeGreaterThan(0);

  // Author summary grid exists
  await expect(page.locator(".summary-grid-authors")).toBeVisible();
  const authorCards = page.locator(".summary-card[data-filter-author]");
  await expect(authorCards.first()).toBeVisible();
  const authorCount = await page.locator(".summary-card[data-filter-author] .summary-count").first().textContent();
  expect(parseInt(authorCount, 10)).toBeGreaterThan(0);
});

test("author summary card filters books", async ({ page }) => {
  await page.goto("/library/");

  // Use the first author card in the summary (most-read author)
  const authorCard = page.locator(".summary-card[data-filter-author]").first();
  await expect(authorCard).toBeVisible();
  const authorKey = await authorCard.getAttribute("data-filter-author");

  await authorCard.click();

  await expect(authorCard).toHaveAttribute("aria-pressed", "true");

  // All visible books should be by that author
  const visibleBooks = page.locator(".books .book:visible");
  const count = await visibleBooks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(visibleBooks.nth(i)).toHaveAttribute("data-author", authorKey);
  }

  await expect(page.locator("[data-filter-clear]")).toBeVisible();
});

test("sitemap uses latest finished date for library", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const body = await response.text();

  const libraryMatch = body.match(
    /<loc>[^<]*\/library\/<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/,
  );
  expect(libraryMatch).not.toBeNull();
  expect(libraryMatch[1]).toMatch(/^2026-01-18T/);
});
