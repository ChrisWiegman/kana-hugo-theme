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

	const LABELS = { title: 'Title', author: 'Author', rating: 'Rating', finished: 'Finished' };
	const labelFor = (key) => LABELS[key] || key;

	const titleOf = (row) => row.dataset.title ?? '';
	const compareText = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

	const compare = (key, dir) => (a, b) => {
		const av = a.dataset[key] ?? '';
		const bv = b.dataset[key] ?? '';

		const diff = (key === 'rating' || key === 'finished')
			? dir * ((Number(av) || 0) - (Number(bv) || 0))
			: dir * compareText(av, bv);

		return diff !== 0 ? diff : compareText(titleOf(a), titleOf(b));
	};

	const setAria = (activeBtn, dir) => {
		buttons.forEach((btn) => btn.setAttribute('aria-sort', 'none'));

		if (activeBtn) activeBtn.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
	};

	const HINT_EXTRA = {
		finished: (dir) => (dir === -1 ? 'newest first' : 'oldest first'),
		rating: (dir) => (dir === -1 ? 'highest first' : 'lowest first'),
	};

	const updateHint = (key, dir) => {
		if (!hint) return;

		const extra = HINT_EXTRA[key] ? HINT_EXTRA[key](dir) : (dir === 1 ? 'ascending' : 'descending');

		hint.innerHTML = `Sorted by <strong>${labelFor(key)}</strong> (${extra}). Click a column to change.`;
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

			return (parsed && parsed.key && parsed.dir) ? parsed : null;
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

		if (remaining <= 0) {
			nav.hidden = true;

			if (loadMoreObserver) {
				loadMoreObserver.disconnect();
				loadMoreObserver = null;
			}

			return;
		}

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

	const FILTER_TYPES = ['year', 'author', 'rating'];

	const FILTER_MATCHERS = {
		year: (row, value) => (row.dataset.years || '').split(' ').includes(value),
		author: (row, value) => row.dataset.author === value,
		rating: (row, value) => row.dataset.rating === value,
	};

	const FILTER_LABELS = {
		year: (value) => ` read in ${value}`,
		author: (value) => {
			const rowBtn = document.querySelector(`.book-author[data-filter-author="${CSS.escape(value)}"]`);

			return rowBtn ? ` by ${rowBtn.textContent.trim()}` : '';
		},
		rating: (value) => {
			const n = Number(value);

			return ` rated ${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
		},
	};

	const filterButtons = new Map(
		FILTER_TYPES.map((type) => [type, Array.from(document.querySelectorAll(`[data-filter-${type}]`))]),
	);

	let activeFilter = null;
	const countEl = document.querySelector('.book-count');
	const totalCount = getRows().length;
	const clearBtn = document.querySelector('[data-filter-clear]');
	const filterLabel = document.querySelector('[data-filter-label]');

	const syncFilterUI = () => {
		FILTER_TYPES.forEach((type) => {
			filterButtons.get(type).forEach((btn) => {
				const active = activeFilter?.type === type && btn.getAttribute(`data-filter-${type}`) === activeFilter.value;

				btn.setAttribute('aria-pressed', String(active));
			});
		});

		if (countEl?.previousSibling?.nodeType === Node.TEXT_NODE) {
			countEl.previousSibling.textContent = activeFilter ? 'You\'re viewing ' : 'You\'re viewing all ';
		}

		if (filterLabel) {
			filterLabel.textContent = activeFilter ? FILTER_LABELS[activeFilter.type](activeFilter.value) : '';
			filterLabel.hidden = !activeFilter;
		}

		if (clearBtn) clearBtn.hidden = !activeFilter;
	};

	const applyFilter = () => {
		getRows().forEach((row) => {
			row.hidden = activeFilter ? !FILTER_MATCHERS[activeFilter.type](row, activeFilter.value) : false;
		});

		if (countEl) {
			const count = activeFilter ? getRows().filter((r) => !r.hidden).length : totalCount;

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

	FILTER_TYPES.forEach((type) => {
		filterButtons.get(type).forEach((btn) =>
			btn.addEventListener('click', () => setFilter(type, btn.getAttribute(`data-filter-${type}`))),
		);
	});

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
	} else {
		activeKey = 'finished';
		dir = -1;
	}

	applySort(activeKey, dir);
})();
