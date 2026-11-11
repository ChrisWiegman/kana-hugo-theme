const { createHash } = require('node:crypto');
const { test, expect } = require('@playwright/test');

function jsonLd(html) {
	const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);

	expect(match).not.toBeNull();

	return JSON.parse(match[1])['@graph'];
}

test('llms.txt lists the site, its pages, and recent posts', async ({ request }) => {
	const response = await request.get('/llms.txt');

	expect(response.ok()).toBe(true);

	const body = await response.text();

	expect(body).toMatch(/^# Hugo Theme Development Site\n\n> A development site/);
	expect(body).toContain('## Pages');
	expect(body).toMatch(/- \[About Me\]\([^)]*\/about\/index\.md\): /);
	expect(body).not.toContain('Search Results');
	expect(body).toContain('## Recent posts');
	expect(body).toMatch(/- \[Hugo Development Post 2\]\([^)]*\/2026\/01\/hugo-development-post-2\/index\.md\) \(2026-01-14\)/);
	expect(body).toMatch(/- \[Full text of all posts\]\([^)]*\/llms-full\.txt\)/);
});

test('llms-full.txt contains the full Markdown of every post', async ({ request }) => {
	const body = await (await request.get('/llms-full.txt')).text();

	expect(body).toMatch(/This file contains the full text of \d+ posts/);
	expect(body).toContain('# Hugo Development Post\n');
	expect(body).toContain('add_action( \'some_wp_action\', __return_false );');
});

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

test('home publishes a Markdown version and links to it', async ({ page, request }) => {
	await page.goto('/');

	const alternate = page.locator('link[rel="alternate"][type="text/markdown"]');

	await expect(alternate).toHaveAttribute('href', /\/index\.md$/);
	await expect(alternate).toHaveAttribute('title', 'Hugo Theme Development Site (Markdown)');

	const response = await request.get('/index.md');

	expect(response.ok()).toBe(true);

	const body = await response.text();

	expect(body).toMatch(/^---\ntitle: "Hugo Theme Development Site"\n/);
	expect(body).toContain('## Recent posts');
	expect(body.match(/^- \[.+\]\([^)]+\/index\.md\) \(\d{4}-\d{2}-\d{2}\)/gm).length).toBeLessThanOrEqual(10);
	expect(body).toMatch(/\[All posts\]\([^)]*\/blog\/index\.md\)/);
});

test('library Markdown lists every book', async ({ request }) => {
	const body = await (await request.get('/library/index.md')).text();
	const count = Number(body.match(/(\d+) books\./)[1]);

	expect(count).toBeGreaterThan(0);
	expect(body.match(/^- .+ by .+/gm)).toHaveLength(count);
});

test('agent skills index lists a skill whose digest matches the file', async ({ request }) => {
	const response = await request.get('/.well-known/agent-skills/index.json');

	expect(response.ok()).toBe(true);

	const index = await response.json();

	expect(index.$schema).toBe('https://schemas.agentskills.io/discovery/0.2.0/schema.json');
	expect(index.skills).toHaveLength(1);

	const [skill] = index.skills;

	expect(skill.name).toBe('hugo-theme-development-site');
	expect(skill.type).toBe('skill-md');
	expect(skill.description).toBeTruthy();
	expect(skill.url).toMatch(/\/\.well-known\/agent-skills\/hugo-theme-development-site\/SKILL\.md$/);

	const body = await (await request.get(new URL(skill.url).pathname)).body();

	expect(skill.digest).toBe(`sha256:${createHash('sha256').update(body).digest('hex')}`);

	const text = body.toString();

	expect(text).toMatch(/^---\nname: hugo-theme-development-site\ndescription: /);
	expect(text).toMatch(/\/2026\/01\/[^`]+\/index\.md`/);
	expect(text).toContain('- Training or fine-tuning AI models: not allowed.');
	expect(text).toMatch(/\[\/llms\.txt\]\([^)]+\/llms\.txt\)/);
});

test('llms.txt links to the agent skills index', async ({ request }) => {
	const body = await (await request.get('/llms.txt')).text();

	expect(body).toMatch(/- \[Agent Skills index\]\([^)]*\/\.well-known\/agent-skills\/index\.json\)/);
});

test('robots.txt publishes content signals and blocked agents', async ({ request }) => {
	const body = await (await request.get('/robots.txt')).text();

	expect(body).toContain('User-agent: *\nContent-Signal: ai-input=yes, ai-train=no, search=yes\nDisallow:\n');
	expect(body).toContain('User-agent: ExampleBot\nDisallow: /');
	expect(body).toMatch(/Sitemap: \S+\/sitemap\.xml/);
});

test('head identifies the author and their profiles', async ({ page }) => {
	await page.goto('/2026/01/hugo-development-post/');

	await expect(page.locator('meta[name="author"]')).toHaveAttribute('content', 'Chris Wiegman');
	await expect(page.locator('link[rel="me"]')).toHaveCount(2);
});

test('home JSON-LD describes the site, author, and search action', async ({ request }) => {
	const graph = jsonLd(await (await request.get('/')).text());
	const person = graph.find((n) => n['@type'] === 'Person');
	const site = graph.find((n) => n['@type'] === 'WebSite');

	expect(person.name).toBe('Chris Wiegman');
	expect(person.sameAs).toContain('https://github.com/ChrisWiegman');
	expect(site.publisher['@id']).toBe(person['@id']);
	expect(site.potentialAction.target.urlTemplate).toMatch(/\/search\/\?s=\{search_term_string\}$/);
});

test('post JSON-LD links the article, author, site, and breadcrumbs', async ({ request }) => {
	const graph = jsonLd(await (await request.get('/2026/01/hugo-development-post/')).text());
	const post = graph.find((n) => n['@type'] === 'BlogPosting');
	const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList');

	expect(post.headline).toBe('Hugo Development Post');
	expect(post.author['@id']).toMatch(/#author$/);
	expect(post.isPartOf['@id']).toMatch(/#website$/);
	expect(post.datePublished).toMatch(/^2026-01-02T/);
	expect(post.dateModified).toBeTruthy();
	expect(post.encoding.contentUrl).toMatch(/index\.md$/);
	expect(crumbs.itemListElement.at(-1).name).toBe('Hugo Development Post');
	expect(crumbs.itemListElement[0].position).toBe(1);
});

test('library JSON-LD lists books when jsonldBooks is enabled', async ({ request }) => {
	const graph = jsonLd(await (await request.get('/library/')).text());
	const library = graph.find((n) => n['@type'] === 'CollectionPage');
	const first = library.mainEntity.itemListElement[0].item;

	expect(library.mainEntity.numberOfItems).toBeGreaterThan(0);
	expect(first['@type']).toBe('Book');
	expect(first.author.name).toBeTruthy();
});
