(() => {
	const table = document.querySelector('[data-library-table]');

	if (!table) return;

	const rows = [...table.querySelectorAll('.book')];
	const sortButtons = [...table.querySelectorAll('.book-sort')];
	const count = document.querySelector('.book-count');
	const clear = document.querySelector('[data-filter-clear]');
	const filterLabel = document.querySelector('[data-filter-label]');
	const hint = document.querySelector('[data-sort-hint]');
	const pageSize = Number(table.dataset.pageSize) || 25;
	const storageKey = 'librarySort:v1';
	let visible = pageSize;
	let activeFilter;

	const filters = {
		year: {
			matches: (row, value) => row.dataset.years.split(' ').includes(value),
			label: (value) => ` read in ${value}`,
		},
		author: {
			matches: (row, value) => row.dataset.author === value,
			label: (value) => {
				const button = document.querySelector(`.book-author[data-filter-author="${CSS.escape(value)}"]`);

				return button ? ` by ${button.textContent.trim()}` : '';
			},
		},
		rating: {
			matches: (row, value) => row.dataset.rating === value,
			label: (value) => ` rated ${'★'.repeat(value)}${'☆'.repeat(5 - value)}`,
		},
	};

	const filterButtons = Object.keys(filters).flatMap((type) =>
		[...document.querySelectorAll(`[data-filter-${type}]`)].map((button) => ({ button, type })),
	);

	const nav = document.createElement('nav');
	const more = document.createElement('a');

	nav.className = 'navigation prevnext';
	nav.setAttribute('aria-label', 'Load more books');
	more.href = '#';
	more.className = 'next';
	more.textContent = 'Load More Books ↓';
	nav.appendChild(more);
	table.after(nav);

	const renderRows = () => {
		const matching = rows.filter((row) => !row.hidden);

		visible = Math.min(visible, matching.length);
		matching.forEach((row, index) => {
			row.style.display = index < visible ? '' : 'none';
		});
		nav.hidden = visible >= matching.length;
	};

	const loadMore = () => {
		visible += pageSize;
		renderRows();
	};

	more.addEventListener('click', (event) => {
		event.preventDefault();
		loadMore();
	});

	new IntersectionObserver((entries) => {
		if (entries[0].isIntersecting && !nav.hidden) loadMore();
	}, { rootMargin: '600px 0px' }).observe(more);

	const renderFilter = () => {
		rows.forEach((row) => {
			row.hidden = activeFilter ? !filters[activeFilter.type].matches(row, activeFilter.value) : false;
		});
		filterButtons.forEach(({ button, type }) => {
			button.setAttribute('aria-pressed', String(activeFilter?.type === type
				&& button.dataset[`filter${type[0].toUpperCase()}${type.slice(1)}`] === activeFilter.value));
		});

		const matching = rows.filter((row) => !row.hidden).length;

		if (count) {
			count.textContent = matching;
			count.nextSibling.textContent = matching === 1 ? ' book' : ' books';

			if (count.previousSibling?.nodeType === Node.TEXT_NODE) {
				count.previousSibling.textContent = activeFilter ? 'You\'re viewing ' : 'You\'re viewing all ';
			}
		}

		if (filterLabel) {
			filterLabel.textContent = activeFilter ? filters[activeFilter.type].label(activeFilter.value) : '';
			filterLabel.hidden = !activeFilter;
		}

		if (clear) clear.hidden = !activeFilter;

		visible = pageSize;
		renderRows();
	};

	filterButtons.forEach(({ button, type }) => {
		button.addEventListener('click', () => {
			const value = button.getAttribute(`data-filter-${type}`);

			activeFilter = activeFilter?.type === type && activeFilter.value === value
				? undefined
				: { type, value };
			renderFilter();
		});
	});

	clear?.addEventListener('click', () => {
		activeFilter = undefined;
		renderFilter();
	});

	const compare = (key, direction) => (a, b) => {
		const numeric = key === 'rating' || key === 'finished';
		const difference = numeric
			? Number(a.dataset[key]) - Number(b.dataset[key])
			: a.dataset[key].localeCompare(b.dataset[key], undefined, { numeric: true, sensitivity: 'base' });

		return direction * difference || a.dataset.title.localeCompare(b.dataset.title);
	};

	const saveSort = (sort) => {
		try {
			localStorage.setItem(storageKey, JSON.stringify(sort));
		} catch { /* Storage may be unavailable. */ }
	};

	const applySort = (key, direction) => {
		const button = sortButtons.find((item) => item.dataset.sort === key);

		rows.sort(compare(key, direction)).forEach((row) => table.appendChild(row));
		sortButtons.forEach((item) => item.setAttribute('aria-sort', 'none'));
		button?.setAttribute('aria-sort', direction === 1 ? 'ascending' : 'descending');

		if (hint) {
			const descriptions = {
				finished: direction === -1 ? 'newest first' : 'oldest first',
				rating: direction === -1 ? 'highest first' : 'lowest first',
			};
			const description = descriptions[key] || (direction === 1 ? 'ascending' : 'descending');

			hint.innerHTML = `Sorted by <strong>${button?.textContent || key}</strong> (${description}). Click a column to change.`;
		}

		saveSort({ key, dir: direction });
		renderRows();
	};

	let sort = { key: 'finished', dir: -1 };

	try {
		const saved = JSON.parse(localStorage.getItem(storageKey));

		if (saved?.key && saved.dir) sort = saved;
	} catch { /* Keep the default sort. */ }

	sortButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const key = button.dataset.sort;

			sort = { key, dir: key === sort.key ? -sort.dir : 1 };
			applySort(sort.key, sort.dir);
		});
	});

	applySort(sort.key, sort.dir);
})();
