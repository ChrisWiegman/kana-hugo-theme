/**
 * Library book list.
 *
 * The page ships only the first page of books as HTML. The full list is
 * fetched in the background from the JSON file named by data-books-url, and
 * rows are built from it as they're needed, so only the books on screen are in
 * the DOM. Sorting, filtering, and "load more" wait for that data; if it can't
 * be loaded, they work on the books already on the page.
 */
(() => {
	const table = document.querySelector('[data-library-table]');

	if (!table) return;

	const root = table.closest('.library') || document;
	const header = table.querySelector('.book-header');
	const sortButtons = [...table.querySelectorAll('.book-sort')];
	const count = root.querySelector('.book-count');
	const clear = root.querySelector('[data-filter-clear]');
	const filterLabel = root.querySelector('[data-filter-label]');
	const hint = root.querySelector('[data-sort-hint]');
	const pageSize = Number(table.dataset.pageSize) || 25;
	const storageKey = 'librarySort:v1';
	const filterTypes = ['year', 'author', 'rating'];
	const filterSelector = filterTypes.map((type) => `[data-filter-${type}]`).join(', ');
	const linkLabels = { amazon: 'Amazon', openlibrary: 'Open Library', goodreads: 'Goodreads' };
	const sortFields = { title: 'titleKey', author: 'authorKey', rating: 'rating', finished: 'finished' };
	let visible = pageSize;
	let activeFilter;

	const stars = (rating) => {
		const filled = Math.max(0, Math.min(5, rating));

		return '★'.repeat(filled) + '☆'.repeat(5 - filled);
	};

	// A book read from a server-rendered row, used until (or if) the JSON fails to load.
	const fromRow = (row) => ({
		titleKey: row.dataset.title,
		authorKey: row.dataset.author,
		author: row.querySelector('.book-author')?.textContent.trim() || '',
		rating: Number(row.dataset.rating) || 0,
		finished: Number(row.dataset.finished) || 0,
		years: row.dataset.years ? row.dataset.years.split(' ') : [],
		el: row,
	});

	let books = [...table.querySelectorAll('.book')].map(fromRow);

	const make = (tag, className, text) => {
		const element = document.createElement(tag);

		if (className) element.className = className;

		if (text !== undefined) element.textContent = text;

		return element;
	};

	// Mirrors layouts/_partials/books/row.html.
	const buildRow = (book) => {
		const row = make('div', 'book');

		row.dataset.title = book.titleKey;
		row.dataset.author = book.authorKey;
		row.dataset.rating = String(book.rating);
		row.dataset.finished = String(book.finished);
		row.dataset.years = book.years.join(' ');

		const author = make('button', 'book-meta book-author', book.author);

		author.type = 'button';
		author.dataset.filterAuthor = book.authorKey;

		const rating = make('button', 'book-meta book-rating', stars(book.rating));

		rating.type = 'button';
		rating.dataset.filterRating = String(book.rating);
		rating.setAttribute('aria-label', `Rating: ${book.rating} out of 5`);

		const links = make('span', 'book-meta book-links');

		Object.entries(linkLabels).forEach(([key, label]) => {
			const href = book.links?.[key];

			if (!href || !/^https?:\/\//i.test(href)) return;

			const link = make('a', '', label);

			link.href = href;
			link.rel = 'nofollow noopener noreferrer';
			link.target = '_blank';
			links.append(link);
		});

		const dates = make('span', 'book-meta book-date');

		if (book.dates.length) {
			book.dates.forEach((date) => dates.append(make('span', 'date', date)));
		} else {
			dates.append(make('span', 'date date-empty', '—'));
		}

		row.append(make('h3', 'book-title', book.title), author, rating, links, dates);

		return row;
	};

	const element = (book) => {
		if (!book.el) book.el = buildRow(book);

		return book.el;
	};

	const filters = {
		year: {
			matches: (book, value) => book.years.includes(value),
			label: (value) => ` read in ${value}`,
		},
		author: {
			matches: (book, value) => book.authorKey === value,
			label: (value) => {
				const book = books.find((item) => item.authorKey === value);

				return book?.author ? ` by ${book.author}` : '';
			},
		},
		rating: {
			matches: (book, value) => String(book.rating) === value,
			label: (value) => ` rated ${stars(Number(value))}`,
		},
	};

	const nav = make('nav', 'navigation prevnext');
	const more = make('a', 'next', 'Load More Books ↓');

	nav.setAttribute('aria-label', 'Load more books');
	more.href = '#';
	nav.appendChild(more);
	table.after(nav);

	const matchingBooks = () => (activeFilter
		? books.filter((book) => filters[activeFilter.type].matches(book, activeFilter.value))
		: books);

	const updatePressed = () => {
		root.querySelectorAll(filterSelector).forEach((button) => {
			const type = filterTypes.find((item) => button.hasAttribute(`data-filter-${item}`));

			button.setAttribute('aria-pressed', String(activeFilter?.type === type
				&& button.getAttribute(`data-filter-${type}`) === activeFilter.value));
		});
	};

	const renderRows = () => {
		const matching = matchingBooks();

		table.replaceChildren(...[header, ...matching.slice(0, visible).map(element)].filter(Boolean));
		nav.hidden = visible >= matching.length;
		updatePressed();
	};

	const renderFilter = () => {
		const matching = matchingBooks().length;

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

	const compare = (key, direction) => {
		const field = sortFields[key] || 'finished';

		return (a, b) => {
			const difference = typeof a[field] === 'number'
				? a[field] - b[field]
				: String(a[field]).localeCompare(String(b[field]), undefined, { numeric: true, sensitivity: 'base' });

			return direction * difference || a.titleKey.localeCompare(b.titleKey);
		};
	};

	const saveSort = (value) => {
		try {
			localStorage.setItem(storageKey, JSON.stringify(value));
		} catch { /* Storage may be unavailable. */ }
	};

	const applySort = (key, direction) => {
		const button = sortButtons.find((item) => item.dataset.sort === key);

		books.sort(compare(key, direction));
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

	// Swap in the full list, reusing the server-rendered rows for the books they show.
	const useData = (data) => {
		const serverRows = new Map(books.map((book) => [`${book.titleKey}\n${book.authorKey}`, book.el]));

		books = data.map((book) => ({
			...book,
			years: book.years || [],
			dates: book.dates || [],
			el: serverRows.get(`${book.titleKey}\n${book.authorKey}`),
		}));
	};

	const url = table.dataset.booksUrl;
	const ready = (url
		? fetch(url).then((response) => {
			if (!response.ok) throw new Error(`Library data request failed: ${response.status}`);

			return response.json();
		}).then(useData)
		: Promise.reject(new Error('No library data URL')))
		.catch(() => { /* Keep working with the books already on the page. */ })
		.then(() => {
			table.dataset.libraryReady = '';
			applySort(sort.key, sort.dir);
		});

	const loadMore = () => ready.then(() => {
		visible += pageSize;
		renderRows();
	});

	// Until the data arrives, offer "load more" whenever the page lists more books than it shows.
	nav.hidden = !(Number(count?.textContent) > books.length);

	more.addEventListener('click', (event) => {
		event.preventDefault();
		loadMore();
	});

	new IntersectionObserver((entries) => {
		if (entries[0].isIntersecting && !nav.hidden) loadMore();
	}, { rootMargin: '600px 0px' }).observe(more);

	root.addEventListener('click', (event) => {
		const button = event.target.closest?.(filterSelector);

		if (!button || !root.contains(button)) return;

		const type = filterTypes.find((item) => button.hasAttribute(`data-filter-${item}`));
		const value = button.getAttribute(`data-filter-${type}`);

		ready.then(() => {
			activeFilter = activeFilter?.type === type && activeFilter.value === value
				? undefined
				: { type, value };
			renderFilter();
		});
	});

	clear?.addEventListener('click', () => ready.then(() => {
		activeFilter = undefined;
		renderFilter();
	}));

	sortButtons.forEach((button) => {
		button.addEventListener('click', () => ready.then(() => {
			const key = button.dataset.sort;

			sort = { key, dir: key === sort.key ? -sort.dir : 1 };
			applySort(sort.key, sort.dir);
		}));
	});
})();
