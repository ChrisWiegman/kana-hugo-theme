(function() {
	'use strict';

	// Get search query from URL parameter
	const searchQuery = getUrlParam('s');
	const searchInput = document.getElementById('search');
	const searchTerm = document.getElementById('search-term');
	const searchCount = document.getElementById('search-count');
	const searchResults = document.getElementById('search-results');

	const indexUrl = (searchResults && searchResults.dataset.index) || '/index.json';
	const fallbackUrl = (searchResults && searchResults.dataset.fallback) || '/';
	const locale = document.documentElement.lang || undefined;

	if (!searchResults) return;

	if (!searchQuery) {
		window.location.assign(fallbackUrl);
		return;
	}

	// Set search query in UI
	if (searchInput) searchInput.value = searchQuery;

	if (searchTerm) searchTerm.textContent = searchQuery;

	// Execute search
	executeSearch(searchQuery);

	function executeSearch(query) {
		fetch(indexUrl)
			.then((response) => {
				if (!response.ok) throw new Error('HTTP ' + response.status);

				return response.json();
			})
			.then((data) => {
				const results = search(data, query);

				if (searchCount) {
					searchCount.textContent = results.length;
				}

				if (results.length > 0) {
					populateResults(results);
				} else {
					searchResults.innerHTML = '<p>No matches found</p>';
				}
			})
			.catch((error) => {
				// eslint-disable-next-line no-console
				console.error('Search error:', error);
				searchResults.innerHTML = '<p>Error loading search results</p>';
			});
	}

	function search(pages, query) {
		const lowerQuery = query.toLowerCase();
		const results = [];

		pages.forEach((page) => {
			let score = 0;

			// Search in title (highest weight)
			if (page.title && page.title.toLowerCase().includes(lowerQuery)) {
				score += 0.8;
			}

			// Search in contents (medium weight)
			if (page.contents && page.contents.toLowerCase().includes(lowerQuery)) {
				score += 0.5;
			}

			// Search in tags (lower weight)
			if (page.tags && Array.isArray(page.tags)) {
				const tagsMatch = page.tags.some((tag) =>
					tag.toLowerCase().includes(lowerQuery),
				);

				if (tagsMatch) score += 0.3;
			}

			// Search in categories (lower weight)
			if (page.categories && Array.isArray(page.categories)) {
				const categoriesMatch = page.categories.some((cat) =>
					cat.toLowerCase().includes(lowerQuery),
				);

				if (categoriesMatch) score += 0.3;
			}

			if (score > 0) {
				results.push({ item: page, score: score });
			}
		});

		// Sort by score (highest first)
		results.sort((a, b) => b.score - a.score);

		return results;
	}

	function populateResults(results) {
		const template = document.getElementById('search-result-template').innerHTML;
		const fragment = document.createDocumentFragment();
		const dateFormat = new Intl.DateTimeFormat(locale, {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});

		results.forEach((result, index) => {
			const date = new Date(result.item.date);
			const displayDate = isNaN(date) ? '' : dateFormat.format(date);
			const html = render(template, {
				key: index,
				title: escapeHtml(result.item.title || ''),
				link: escapeHtml(result.item.permalink || ''),
				date: escapeHtml(displayDate),
			});

			const wrapper = document.createElement('div');

			wrapper.innerHTML = html;
			fragment.appendChild(wrapper.firstElementChild);
		});

		searchResults.appendChild(fragment);
	}

	function escapeHtml(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function getUrlParam(name) {
		const params = new URLSearchParams(window.location.search);

		return params.get(name) || '';
	}

	function render(templateString, data) {
		let result = templateString;

		// Handle conditionals: ${ isset key }content${ end }
		const conditionalPattern = /\$\{\s*isset\s+([a-zA-Z]*)\s*\}(.*?)\$\{\s*end\s*\}/g;

		result = result.replace(conditionalPattern, (match, key, content) => {
			return data[key] ? content : '';
		});

		// Replace simple variables: ${key}
		Object.keys(data).forEach((key) => {
			const pattern = new RegExp('\\$\\{\\s*' + key + '\\s*\\}', 'g');

			result = result.replace(pattern, () => data[key]);
		});

		return result;
	}
})();
