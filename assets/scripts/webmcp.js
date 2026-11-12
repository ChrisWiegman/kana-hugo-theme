(function() {
	'use strict';

	const modelContext = document.modelContext || navigator.modelContext;
	const script = document.currentScript;

	if (!modelContext || typeof modelContext.registerTool !== 'function' || !script) return;

	const indexUrl = script.dataset.index || '/index.json';
	const siteName = script.dataset.site || document.title;
	const hasMarkdown = 'markdown' in script.dataset;
	let indexPromise;

	function loadIndex() {
		if (!indexPromise) {
			indexPromise = fetch(indexUrl).then((response) => {
				if (!response.ok) throw new Error('HTTP ' + response.status);

				return response.json();
			}).catch((error) => {
				indexPromise = undefined;
				throw error;
			});
		}

		return indexPromise;
	}

	function includes(value, query) {
		return typeof value === 'string' && value.toLowerCase().includes(query);
	}

	function listIncludes(values, query) {
		return Array.isArray(values) && values.some((value) => includes(value, query));
	}

	function markdownUrl(path) {
		const file = path.endsWith('.md') ? path : path.replace(/\/?$/, '/') + 'index.md';

		return new URL(file, location.origin).href;
	}

	function register(tool) {
		try {
			Promise.resolve(modelContext.registerTool(tool)).catch(() => {});
		} catch {
			// Registration fails if another script already registered this name.
		}
	}

	register({
		name: 'search_site',
		description: `Search ${siteName} for posts and pages whose title, text, tags, or categories contain a word or phrase. Returns the best matches with their URLs.`,
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'The word or phrase to search for.' },
				limit: { type: 'integer', minimum: 1, maximum: 50, description: 'The most results to return (default 10).' },
			},
			required: ['query'],
		},
		annotations: { readOnlyHint: true },
		async execute({ query, limit }) {
			const needle = String(query || '').trim().toLowerCase();

			if (!needle) return { results: [] };

			const pages = await loadIndex();
			const results = [];

			pages.forEach((page) => {
				let score = 0;

				if (includes(page.title, needle)) score += 0.8;

				if (includes(page.contents, needle)) score += 0.5;

				if (listIncludes(page.tags, needle)) score += 0.3;

				if (listIncludes(page.categories, needle)) score += 0.3;

				if (score > 0) results.push({ page, score });
			});

			results.sort((a, b) => b.score - a.score);

			return {
				results: results.slice(0, Math.min(Number(limit) || 10, 50)).map(({ page }) => {
					const result = {
						title: page.title,
						url: new URL(page.permalink, location.origin).href,
						date: page.date,
						tags: page.tags || [],
						excerpt: page.contents,
					};

					if (hasMarkdown) result.markdownUrl = markdownUrl(page.permalink);

					return result;
				}),
			};
		},
	});

	if (!hasMarkdown) return;

	register({
		name: 'get_page_markdown',
		description: `Get the full text of a page on ${siteName} as Markdown, with front matter giving its title, canonical URL, dates, and tags.`,
		inputSchema: {
			type: 'object',
			properties: {
				url: { type: 'string', description: `The URL or path of a page on ${siteName}, for example one returned by search_site. Defaults to the current page.` },
			},
		},
		annotations: { readOnlyHint: true },
		async execute({ url } = {}) {
			const target = new URL(url || location.href, location.origin);

			if (target.origin !== location.origin) {
				throw new Error(`Only pages on ${location.origin} can be read.`);
			}

			const response = await fetch(markdownUrl(target.pathname), { headers: { Accept: 'text/markdown' } });

			if (!response.ok) throw new Error(`No Markdown version found for ${target.pathname} (HTTP ${response.status}).`);

			return response.text();
		},
	});
})();
