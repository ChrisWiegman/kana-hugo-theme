/**
 * A read-only MCP server (Streamable HTTP, stateless, JSON responses) for a
 * site built with this theme, run as a Cloudflare Worker in front of the
 * site's static assets. It answers only /mcp and /mcp/server-card; route just
 * those paths to it (assets.run_worker_first) and everything else is served
 * as static files without invoking the Worker.
 *
 * The tools read the files Hugo already publishes: the JSON search index
 * (/index.json) and each page's Markdown version (index.md). The server's
 * name, title, and version come from the "mcpcard" output
 * (/.well-known/mcp/server-card.json), so the card and the live server agree.
 *
 * Requires an assets binding named ASSETS.
 */

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const CARD_PATH = '/.well-known/mcp/server-card.json';
const INDEX_PATH = '/index.json';
const MAX_RESULTS = 50;

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, If-None-Match',
	'Access-Control-Expose-Headers': 'ETag',
};

const TOOLS = [
	{
		name: 'search_site',
		title: 'Search the site',
		description: 'Search posts and pages whose title, text, tags, or categories contain a word or phrase. Returns the best matches with their URLs, dates, tags, and an excerpt.',
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'The word or phrase to search for.' },
				limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS, description: 'The most results to return (default 10).' },
			},
			required: ['query'],
		},
		annotations: { readOnlyHint: true, openWorldHint: false },
	},
	{
		name: 'list_recent_posts',
		title: 'List recent posts',
		description: 'List the most recently published posts, newest first, with their URLs, dates, tags, and an excerpt.',
		inputSchema: {
			type: 'object',
			properties: {
				limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS, description: 'How many to return (default 10).' },
			},
		},
		annotations: { readOnlyHint: true, openWorldHint: false },
	},
	{
		name: 'get_page',
		title: 'Read a page',
		description: 'Get the full text of a page on the site as Markdown, with front matter giving its title, canonical URL, dates, and tags. Quote or summarize it with a link to that URL.',
		inputSchema: {
			type: 'object',
			properties: {
				url: { type: 'string', description: 'The page\'s URL or path, for example one returned by search_site.' },
			},
			required: ['url'],
		},
		annotations: { readOnlyHint: true, openWorldHint: false },
	},
];

class ToolError extends Error {}

function json(body, status = 200, headers = {}) {
	return new Response(body === null ? null : JSON.stringify(body), {
		status,
		headers: {
			...CORS_HEADERS,
			...(body === null ? {} : { 'Content-Type': 'application/json' }),
			...headers,
		},
	});
}

function rpcError(id, code, message) {
	return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function asset(env, origin, path) {
	const response = await env.ASSETS.fetch(new Request(new URL(path, origin)));

	return response.ok ? response : null;
}

async function loadCard(env, origin) {
	const response = await asset(env, origin, CARD_PATH);

	return response ? response.json() : {};
}

async function loadIndex(env, origin) {
	const response = await asset(env, origin, INDEX_PATH);

	if (!response) throw new ToolError('The site\'s search index is unavailable.');

	return response.json();
}

function clampLimit(limit) {
	const value = Math.floor(Number(limit));

	return value > 0 ? Math.min(value, MAX_RESULTS) : 10;
}

function includes(value, needle) {
	return typeof value === 'string' && value.toLowerCase().includes(needle);
}

function listIncludes(values, needle) {
	return Array.isArray(values) && values.some((value) => includes(value, needle));
}

function markdownPath(pathname) {
	return pathname.endsWith('.md') ? pathname : pathname.replace(/\/?$/, '/') + 'index.md';
}

function describe(page, origin) {
	const url = new URL(page.permalink, origin);

	return {
		title: page.title,
		url: url.href,
		markdownUrl: new URL(markdownPath(url.pathname), origin).href,
		date: page.date,
		tags: page.tags || [],
		excerpt: page.contents,
	};
}

function result(structuredContent) {
	return {
		content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
		structuredContent,
	};
}

const handlers = {
	async search_site({ query, limit }, env, origin) {
		const needle = String(query ?? '').trim().toLowerCase();

		if (!needle) throw new ToolError('Give a word or phrase to search for.');

		const scored = [];

		for (const page of await loadIndex(env, origin)) {
			let score = 0;

			if (includes(page.title, needle)) score += 0.8;

			if (includes(page.contents, needle)) score += 0.5;

			if (listIncludes(page.tags, needle)) score += 0.3;

			if (listIncludes(page.categories, needle)) score += 0.3;

			if (score > 0) scored.push({ page, score });
		}

		scored.sort((a, b) => b.score - a.score);

		return result({ results: scored.slice(0, clampLimit(limit)).map(({ page }) => describe(page, origin)) });
	},

	async list_recent_posts({ limit }, env, origin) {
		const pages = (await loadIndex(env, origin))
			.filter((page) => page.kind !== 'page' && page.date && !Number.isNaN(Date.parse(page.date)))
			.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

		return result({ results: pages.slice(0, clampLimit(limit)).map((page) => describe(page, origin)) });
	},

	async get_page({ url }, env, origin) {
		let target;

		try {
			target = new URL(String(url ?? ''), origin);
		} catch {
			throw new ToolError('That isn\'t a valid URL or path.');
		}

		if (target.origin !== origin) throw new ToolError(`Only pages on ${origin} can be read.`);

		const response = await asset(env, origin, markdownPath(target.pathname));

		if (!response) throw new ToolError(`No page found at ${target.pathname}.`);

		return { content: [{ type: 'text', text: await response.text() }] };
	},
};

async function handleMessage(message, env, origin) {
	if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
		return rpcError(message?.id, -32600, 'Invalid request');
	}

	const { id, method, params = {} } = message;

	// Notifications (no id) get no response.
	if (id === undefined) return null;

	switch (method) {
		case 'initialize': {
			const card = await loadCard(env, origin);
			const requested = params.protocolVersion;

			return {
				jsonrpc: '2.0',
				id,
				result: {
					protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
					capabilities: { tools: { listChanged: false } },
					serverInfo: {
						name: card.name || new URL(origin).hostname,
						title: card.title,
						version: card.version || '1.0.0',
						websiteUrl: card.websiteUrl,
					},
					instructions: card.description,
				},
			};
		}

		case 'ping':
			return { jsonrpc: '2.0', id, result: {} };

		case 'tools/list':
			return { jsonrpc: '2.0', id, result: { tools: TOOLS } };

		case 'tools/call': {
			const handler = Object.hasOwn(handlers, params.name) ? handlers[params.name] : null;

			if (!handler) return rpcError(id, -32602, `Unknown tool: ${params.name}`);

			try {
				return { jsonrpc: '2.0', id, result: await handler(params.arguments || {}, env, origin) };
			} catch (error) {
				if (!(error instanceof ToolError)) throw error;

				return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: error.message }], isError: true } };
			}
		}

		default:
			return rpcError(id, -32601, `Method not found: ${method}`);
	}
}

async function handleMcp(request, env, origin) {
	if (request.method === 'OPTIONS') return json(null, 204);

	if (request.method !== 'POST') {
		// This server doesn't offer an SSE stream or sessions.
		return json(rpcError(null, -32000, 'Method not allowed'), 405, { Allow: 'POST, OPTIONS' });
	}

	let body;

	try {
		body = await request.json();
	} catch {
		return json(rpcError(null, -32700, 'Parse error'), 400);
	}

	try {
		if (Array.isArray(body)) {
			const replies = (await Promise.all(body.map((message) => handleMessage(message, env, origin)))).filter(Boolean);

			return replies.length ? json(replies) : json(null, 202);
		}

		const reply = await handleMessage(body, env, origin);

		return reply ? json(reply) : json(null, 202);
	} catch {
		return json(rpcError(body?.id, -32603, 'Internal error'), 500);
	}
}

async function handleCard(request, env, origin) {
	if (request.method === 'OPTIONS') return json(null, 204);

	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return json(null, 405, { Allow: 'GET, HEAD, OPTIONS' });
	}

	const response = await asset(env, origin, CARD_PATH);

	if (!response) return json({ error: 'Not found' }, 404);

	const headers = new Headers(response.headers);

	for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);

	headers.set('Content-Type', 'application/mcp-server-card+json');
	headers.set('Cache-Control', 'public, max-age=3600');
	headers.delete('Link');

	return new Response(request.method === 'HEAD' ? null : response.body, { status: 200, headers });
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname.replace(/\/+$/, '');

		if (path === '/mcp') return handleMcp(request, env, url.origin);

		if (path === '/mcp/server-card') return handleCard(request, env, url.origin);

		return env.ASSETS.fetch(request);
	},
};
