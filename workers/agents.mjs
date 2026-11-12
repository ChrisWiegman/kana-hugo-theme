/**
 * Read-only agent endpoints for a site built with this theme, run as a
 * Cloudflare Worker in front of the site's static assets:
 *
 * - /mcp: an MCP server (Streamable HTTP, stateless, JSON responses) with
 *   search_site, list_recent_posts, and get_page tools. Its card is also
 *   served at /mcp/server-card.
 * - /a2a: an A2A agent (JSON-RPC binding, protocol 1.0 and 0.3, stateless)
 *   with search, recent, and read skills. Every message gets an immediate
 *   reply; no tasks are stored. Its card is the "agentcard" output at
 *   /.well-known/agent-card.json.
 *
 * Route only those paths to the Worker (assets.run_worker_first); everything
 * else is served as static files without invoking it.
 *
 * Both read the files Hugo already publishes: the JSON search index
 * (/index.json) and each page's Markdown version (index.md).
 *
 * Requires an assets binding named ASSETS.
 */

const INDEX_PATH = '/index.json';
const MCP_CARD_PATH = '/.well-known/mcp/server-card.json';
const MCP_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const A2A_PROTOCOL_VERSIONS = ['1.0', '0.3'];
const MAX_RESULTS = 50;
const DEFAULT_RESULTS = 10;

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, A2A-Version, A2A-Extensions, If-None-Match',
	'Access-Control-Expose-Headers': 'ETag',
};

/* ---------- Shared: reading the site ---------- */

class UserError extends Error {}

async function asset(env, origin, path) {
	const response = await env.ASSETS.fetch(new Request(new URL(path, origin)));

	return response.ok ? response : null;
}

async function loadIndex(env, origin) {
	const response = await asset(env, origin, INDEX_PATH);

	if (!response) throw new UserError('The site\'s search index is unavailable.');

	return response.json();
}

function clampLimit(limit) {
	const value = Math.floor(Number(limit));

	return value > 0 ? Math.min(value, MAX_RESULTS) : DEFAULT_RESULTS;
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

async function searchSite(env, origin, query, limit) {
	const needle = String(query ?? '').trim().toLowerCase();

	if (!needle) throw new UserError('Give a word or phrase to search for.');

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

	return scored.slice(0, clampLimit(limit)).map(({ page }) => describe(page, origin));
}

async function recentPosts(env, origin, limit) {
	const pages = (await loadIndex(env, origin))
		.filter((page) => page.kind !== 'page' && page.date && !Number.isNaN(Date.parse(page.date)))
		.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

	return pages.slice(0, clampLimit(limit)).map((page) => describe(page, origin));
}

async function readPage(env, origin, url) {
	let target;

	try {
		target = new URL(String(url ?? ''), origin);
	} catch {
		throw new UserError('That isn\'t a valid URL or path.');
	}

	if (target.origin !== origin) throw new UserError(`Only pages on ${origin} can be read.`);

	const response = await asset(env, origin, markdownPath(target.pathname));

	if (!response) throw new UserError(`No page found at ${target.pathname}.`);

	return response.text();
}

/* ---------- Shared: HTTP and JSON-RPC ---------- */

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

function isRpc(message) {
	return message && message.jsonrpc === '2.0' && typeof message.method === 'string';
}

async function handleRpc(request, handle) {
	if (request.method === 'OPTIONS') return json(null, 204);

	if (request.method !== 'POST') {
		// Neither endpoint offers an SSE stream.
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
			const replies = (await Promise.all(body.map(handle))).filter(Boolean);

			return replies.length ? json(replies) : json(null, 202);
		}

		const reply = await handle(body);

		return reply ? json(reply) : json(null, 202);
	} catch {
		return json(rpcError(body?.id, -32603, 'Internal error'), 500);
	}
}

/* ---------- MCP ---------- */

const MCP_TOOLS = [
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

function toolResult(structuredContent) {
	return {
		content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
		structuredContent,
	};
}

const mcpTools = {
	async search_site({ query, limit }, env, origin) {
		return toolResult({ results: await searchSite(env, origin, query, limit) });
	},

	async list_recent_posts({ limit }, env, origin) {
		return toolResult({ results: await recentPosts(env, origin, limit) });
	},

	async get_page({ url }, env, origin) {
		return { content: [{ type: 'text', text: await readPage(env, origin, url) }] };
	},
};

async function handleMcpMessage(message, env, origin) {
	if (!isRpc(message)) return rpcError(message?.id, -32600, 'Invalid request');

	const { id, method, params = {} } = message;

	// Notifications (no id) get no response.
	if (id === undefined) return null;

	switch (method) {
		case 'initialize': {
			const response = await asset(env, origin, MCP_CARD_PATH);
			const card = response ? await response.json() : {};
			const requested = params.protocolVersion;

			return {
				jsonrpc: '2.0',
				id,
				result: {
					protocolVersion: MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0],
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
			return { jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } };

		case 'tools/call': {
			const tool = Object.hasOwn(mcpTools, params.name) ? mcpTools[params.name] : null;

			if (!tool) return rpcError(id, -32602, `Unknown tool: ${params.name}`);

			try {
				return { jsonrpc: '2.0', id, result: await tool(params.arguments || {}, env, origin) };
			} catch (error) {
				if (!(error instanceof UserError)) throw error;

				return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: error.message }], isError: true } };
			}
		}

		default:
			return rpcError(id, -32601, `Method not found: ${method}`);
	}
}

async function handleMcpCard(request, env, origin) {
	if (request.method === 'OPTIONS') return json(null, 204);

	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return json(null, 405, { Allow: 'GET, HEAD, OPTIONS' });
	}

	const response = await asset(env, origin, MCP_CARD_PATH);

	if (!response) return json({ error: 'Not found' }, 404);

	const headers = new Headers(response.headers);

	for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);

	headers.set('Content-Type', 'application/mcp-server-card+json');
	headers.set('Cache-Control', 'public, max-age=3600');
	headers.delete('Link');

	return new Response(request.method === 'HEAD' ? null : response.body, { status: 200, headers });
}

/* ---------- A2A ---------- */

const A2A_SKILLS = ['search', 'recent', 'read'];

// Versions 1.0 and 0.3 name methods, roles, and parts differently.
const A2A_METHODS = {
	'1.0': { send: 'SendMessage', stream: 'SendStreamingMessage', list: 'ListTasks', tasks: ['GetTask', 'CancelTask', 'SubscribeToTask'] },
	'0.3': { send: 'message/send', stream: 'message/stream', tasks: ['tasks/get', 'tasks/cancel', 'tasks/resubscribe'] },
};

// Clients that send no A2A-Version header are 0.3 clients (spec 3.6.1).
function a2aVersion(request) {
	const header = (request.headers.get('A2A-Version') || '').trim();

	if (!header) return '0.3';

	const [major, minor = '0'] = header.split('.');

	return `${major}.${minor}`;
}

function messageText(message) {
	return message.parts
		.filter((part) => typeof part.text === 'string')
		.map((part) => part.text)
		.join('\n')
		.trim();
}

function messageData(message) {
	const part = message.parts.find((p) => p.data && typeof p.data === 'object');

	return part ? part.data : {};
}

// Works out what the caller wants. An explicit skill in a data part wins;
// otherwise a URL or path on this site is read, a request for recent or
// latest posts lists them, and anything else is searched.
function a2aIntent(message, origin) {
	const data = messageData(message);
	const text = messageText(message);
	const skill = data.skill;

	if (skill) {
		if (!A2A_SKILLS.includes(skill)) throw new UserError(`Unknown skill "${skill}". Use one of: ${A2A_SKILLS.join(', ')}.`);

		return { skill, query: data.query ?? text, url: data.url ?? text, limit: data.limit };
	}

	if (/^(https?:\/\/\S+|\/\S*)$/.test(text)) {
		const url = new URL(text, origin);

		if (url.origin === origin) return { skill: 'read', url: url.href };
	}

	if (/^(what'?s\s+)?(new|recent|latest)\b|\b(recent|latest|newest)\s+(posts?|articles?)\b/i.test(text)) {
		return { skill: 'recent', limit: data.limit };
	}

	return { skill: 'search', query: text, limit: data.limit };
}

function resultList(results, heading) {
	if (!results.length) return `${heading}\n\nNothing found.`;

	return `${heading}\n\n` + results
		.map((r) => `- [${r.title}](${r.url})${r.date ? ` (${String(r.date).slice(0, 10)})` : ''}`)
		.join('\n');
}

async function a2aReply(intent, env, origin) {
	if (intent.skill === 'read') {
		return { text: await readPage(env, origin, intent.url), mediaType: 'text/markdown' };
	}

	if (intent.skill === 'recent') {
		const results = await recentPosts(env, origin, intent.limit);

		return { text: resultList(results, 'Recent posts:'), data: { results } };
	}

	const results = await searchSite(env, origin, intent.query, intent.limit);

	return { text: resultList(results, `Results for "${String(intent.query).trim()}":`), data: { results } };
}

function a2aMessage(version, reply, contextId) {
	const v1 = version === '1.0';
	const text = v1 ? { text: reply.text } : { kind: 'text', text: reply.text };

	if (reply.mediaType) {
		if (v1) {
			text.mediaType = reply.mediaType;
		} else {
			text.metadata = { mediaType: reply.mediaType };
		}
	}

	const parts = [text];

	if (reply.data) parts.push(v1 ? { data: reply.data, mediaType: 'application/json' } : { kind: 'data', data: reply.data });

	const message = { role: v1 ? 'ROLE_AGENT' : 'agent', parts, messageId: crypto.randomUUID() };

	if (contextId) message.contextId = contextId;

	if (!v1) message.kind = 'message';

	return message;
}

async function handleA2aMessage(rpc, version, env, origin) {
	if (!isRpc(rpc)) return rpcError(rpc?.id, -32600, 'Invalid request');

	const { id, method, params = {} } = rpc;

	if (id === undefined) return null;

	const methods = A2A_METHODS[version];

	if (!methods) {
		return rpcError(id, -32009, `A2A version ${version} isn't supported. Use ${A2A_PROTOCOL_VERSIONS.join(' or ')}.`);
	}

	if (method === methods.send) {
		const message = params.message;

		if (!message || !Array.isArray(message.parts) || !message.parts.length) {
			return rpcError(id, -32602, 'Invalid parameters: message.parts must contain at least one part');
		}

		if (message.taskId) {
			return rpcError(id, -32001, 'Task not found: this agent replies immediately and keeps no tasks');
		}

		let reply;

		try {
			reply = await a2aReply(a2aIntent(message, origin), env, origin);
		} catch (error) {
			if (!(error instanceof UserError)) throw error;

			reply = { text: error.message };
		}

		const result = a2aMessage(version, reply, message.contextId);

		return { jsonrpc: '2.0', id, result: version === '1.0' ? { message: result } : result };
	}

	if (method === methods.stream) {
		return rpcError(id, -32004, 'Streaming is not supported; send the message without streaming');
	}

	if (method === methods.list) {
		return { jsonrpc: '2.0', id, result: { tasks: [], nextPageToken: '', pageSize: 0, totalSize: 0 } };
	}

	if (methods.tasks.includes(method)) {
		return rpcError(id, -32001, 'Task not found: this agent replies immediately and keeps no tasks');
	}

	return rpcError(id, -32601, `Method not found: ${method}`);
}

/* ---------- Routing ---------- */

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname.replace(/\/+$/, '');
		const origin = url.origin;

		if (path === '/mcp') return handleRpc(request, (message) => handleMcpMessage(message, env, origin));

		if (path === '/mcp/server-card') return handleMcpCard(request, env, origin);

		if (path === '/a2a') {
			const version = a2aVersion(request);

			return handleRpc(request, (message) => handleA2aMessage(message, version, env, origin));
		}

		return env.ASSETS.fetch(request);
	},
};
