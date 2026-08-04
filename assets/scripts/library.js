(() => {
	const root = document.querySelector('[data-library-table]');

	if (!root) return;

	const header = root.querySelector('.book-header');

	if (!header) return;

	const hint = document.querySelector('[data-sort-hint]');
	const buttons = Array.from(header.querySelectorAll('.book-sort'));
	const getRows = () => Array.from(root.querySelectorAll('.book'));

	const STORAGE_KEY = 'librarySort:v1';
	const PAGE_SIZE = parseInt(root.dataset.pageSize, 10) || 25;
	let visibleCount = PAGE_SIZE;

	const labelFor = (key) => {
		switch (key) {
			case 'title': return 'Title';
			case 'author': return 'Author';
			case 'rating': return 'Rating';
			case 'finished': return 'Finished';
			default: return key;
		}
	};

	const compare = (key, dir) => (a, b) => {
		const av = a.dataset[key] ?? '';
		const bv = b.dataset[key] ?? '';

		if (key === 'rating' || key === 'finished') {
			const an = Number(av) || 0;
			const bn = Number(bv) || 0;
			const diff = dir * (an - bn);

			if (diff !== 0) return diff;

			const at = a.dataset.title ?? '';
			const bt = b.dataset.title ?? '';

			return at.localeCompare(bt, undefined, { numeric: true, sensitivity: 'base' });
		}

		const diff = dir * av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });

		if (diff !== 0) return diff;

		const at = a.dataset.title ?? '';
		const bt = b.dataset.title ?? '';

		return at.localeCompare(bt, undefined, { numeric: true, sensitivity: 'base' });
	};

	const setAria = (activeBtn, dir) => {
		buttons.forEach((btn) => btn.setAttribute('aria-sort', 'none'));

		if (activeBtn) activeBtn.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
	};

	const updateHint = (key, dir) => {
		if (!hint) return;

		const dirText = dir === 1 ? 'ascending' : 'descending';
		const name = labelFor(key);

		const extra = (key === 'finished')
			? (dir === -1 ? 'newest first' : 'oldest first')
			: (key === 'rating')
				? (dir === -1 ? 'highest first' : 'lowest first')
				: dirText;

		hint.innerHTML = `Sorted by <strong>${name}</strong> (${extra}). Click a column to change.`;
	};

	const saveState = (key, dir) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, dir }));
		} catch { /* empty */ }
	};

	const loadState = () => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);

			if (!raw) return null;

			const parsed = JSON.parse(raw);

			if (!parsed || !parsed.key || !parsed.dir) return null;

			return parsed;
		} catch {
			return null;
		}
	};

	// ---- Pagination (progressive loading) ----

	const nav = document.createElement('nav');

	nav.className = 'navigation prevnext';
	nav.setAttribute('aria-label', 'Load more books');
	nav.hidden = true;
	root.after(nav);

	let loadMoreObserver = null;

	const loadMore = () => {
		const activeRows = getRows().filter((r) => !r.hidden);

		if (visibleCount >= activeRows.length) return;

		visibleCount += PAGE_SIZE;
		applyPagination();
	};

	const observeLoadMore = (target) => {
		if (loadMoreObserver) loadMoreObserver.disconnect();

		loadMoreObserver = new IntersectionObserver((entries) => {
			if (entries[0].isIntersecting) loadMore();
		}, { rootMargin: '600px 0px' });

		loadMoreObserver.observe(target);
	};

	const applyPagination = () => {
		const allRows = getRows();
		const activeRows = allRows.filter((r) => !r.hidden);

		visibleCount = Math.min(Math.max(visibleCount, PAGE_SIZE), activeRows.length);

		const visibleSet = new Set(activeRows.slice(0, visibleCount));

		allRows.forEach((row) => {
			row.style.display = (!row.hidden && !visibleSet.has(row)) ? 'none' : '';
		});

		const remaining = activeRows.length - visibleCount;

		nav.innerHTML = '';

		if (remaining > 0) {
			nav.hidden = false;

			const next = document.createElement('a');

			next.href = '#';
			next.className = 'next';
			next.textContent = 'Load More Books ↓';
			next.addEventListener('click', (e) => {
				e.preventDefault();
				loadMore();
			});
			nav.appendChild(next);

			observeLoadMore(next);
		} else {
			nav.hidden = true;

			if (loadMoreObserver) {
				loadMoreObserver.disconnect();
				loadMoreObserver = null;
			}
		}
	};

	const resetPagination = () => {
		visibleCount = PAGE_SIZE;
		applyPagination();
	};

	// ---- Sort ----

	const applySort = (key, dir) => {
		const btn = buttons.find((b) => b.dataset.sort === key) || null;
		const rows = getRows().sort(compare(key, dir));

		const frag = document.createDocumentFragment();

		rows.forEach((row) => frag.appendChild(row));
		root.appendChild(frag);

		setAria(btn, dir);
		updateHint(key, dir);
		saveState(key, dir);
		applyPagination();
	};

	let activeKey = null;
	let dir = 1;

	buttons.forEach((btn) => {
		btn.addEventListener('click', () => {
			const key = btn.dataset.sort;

			if (key === activeKey) dir *= -1;
			else {
				activeKey = key; dir = 1;
			}

			applySort(activeKey, dir);
		});
	});

	// ---- Filter ----

	let activeFilter = null;
	const countEl = document.querySelector('.book-count');
	const totalCount = getRows().length;
	const clearBtn = document.querySelector('[data-filter-clear]');

	const yearButtons = Array.from(document.querySelectorAll('.summary-card[data-filter-year]'));
	const authorButtons = Array.from(document.querySelectorAll('[data-filter-author]'));
	const ratingButtons = Array.from(document.querySelectorAll('[data-filter-rating]'));
	const filterLabel = document.querySelector('[data-filter-label]');

	const syncFilterUI = () => {
		yearButtons.forEach((b) =>
			b.setAttribute('aria-pressed',
				activeFilter?.type === 'year' && b.dataset.filterYear === activeFilter.value ? 'true' : 'false',
			),
		);
		authorButtons.forEach((b) =>
			b.setAttribute('aria-pressed',
				activeFilter?.type === 'author' && b.dataset.filterAuthor === activeFilter.value ? 'true' : 'false',
			),
		);
		ratingButtons.forEach((b) =>
			b.setAttribute('aria-pressed',
				activeFilter?.type === 'rating' && b.dataset.filterRating === activeFilter.value ? 'true' : 'false',
			),
		);

		if (countEl?.previousSibling?.nodeType === Node.TEXT_NODE) {
			countEl.previousSibling.textContent = activeFilter ? 'You\'re viewing ' : 'You\'re viewing all ';
		}

		if (filterLabel) {
			if (!activeFilter) {
				filterLabel.hidden = true;
				filterLabel.textContent = '';
			} else {
				let label = '';

				switch (activeFilter.type) {
					case 'year':
						label = ` read in ${activeFilter.value}`;
						break;
					case 'author': {
						const rowBtn = document.querySelector(`.book-author[data-filter-author="${CSS.escape(activeFilter.value)}"]`);

						label = rowBtn ? ` by ${rowBtn.textContent.trim()}` : '';
						break;
					}
					case 'rating': {
						const n = Number(activeFilter.value);

						label = ` rated ${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
						break;
					}
				}
				filterLabel.textContent = label;
				filterLabel.hidden = false;
			}
		}

		if (clearBtn) clearBtn.hidden = !activeFilter;
	};

	const applyFilter = () => {
		getRows().forEach((row) => {
			if (!activeFilter) {
				row.hidden = false;
				return;
			}

			let visible;

			switch (activeFilter.type) {
				case 'year':
					visible = (row.dataset.years || '').split(' ').includes(activeFilter.value);
					break;
				case 'author':
					visible = row.dataset.author === activeFilter.value;
					break;
				case 'rating':
					visible = row.dataset.rating === activeFilter.value;
					break;
				default:
					visible = true;
			}
			row.hidden = !visible;
		});

		if (countEl) {
			const count = activeFilter
				? getRows().filter((r) => !r.hidden).length
				: totalCount;

			countEl.textContent = count;
			countEl.nextSibling.textContent = count === 1 ? ' book' : ' books';
		}

		resetPagination();
	};

	const setFilter = (type, value) => {
		activeFilter = (activeFilter?.type === type && activeFilter?.value === value)
			? null
			: { type, value };
		syncFilterUI();
		applyFilter();
	};

	yearButtons.forEach((btn) =>
		btn.addEventListener('click', () => setFilter('year', btn.dataset.filterYear)),
	);
	authorButtons.forEach((btn) =>
		btn.addEventListener('click', () => setFilter('author', btn.dataset.filterAuthor)),
	);
	ratingButtons.forEach((btn) =>
		btn.addEventListener('click', () => setFilter('rating', btn.dataset.filterRating)),
	);

	if (clearBtn) {
		clearBtn.addEventListener('click', () => {
			activeFilter = null;
			syncFilterUI();
			applyFilter();
		});
	}

	// Default sort: Finished (descending), but restore saved sort if present
	const saved = loadState();

	if (saved) {
		activeKey = saved.key;
		dir = saved.dir;
		applySort(activeKey, dir);
	} else {
		activeKey = 'finished';
		dir = -1;
		applySort(activeKey, dir);
	}
})();
