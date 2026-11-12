const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

// Runs the MCP Worker in Node with its ASSETS binding backed by the Hugo test
// server, so the tools read the same files a deployed site would serve.
const SITE = 'https://site.test';

async function setup(baseURL) {
	const worker = (await import(pathToFileURL(path.join(__dirname, '..', 'workers', 'mcp.mjs')).href)).default;
	const env = {
		ASSETS: {
			fetch: (request) => {
				const url = new URL(request.url);

				return fetch(new URL(url.pathname + url.search, baseURL));
			},
		},
	};

	const call = async (body, init = {}) => worker.fetch(new Request(`${SITE}/mcp`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
		body: JSON.stringify(body),
		...init,
	}), env);

	const rpc = async (method, params, id = 1) => (await call({ jsonrpc: '2.0', id, method, params })).json();

	return { worker, env, call, rpc };
}

test('initialize negotiates a protocol version and reports the server card identity', async ({ baseURL, request }) => {
	const { rpc } = await setup(baseURL);
	const card = await (await request.get('/.well-known/mcp/server-card.json')).json();
	const { result } = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });

	expect(result.protocolVersion).toBe('2025-06-18');
	expect(result.capabilities.tools).toBeDefined();
	expect(result.serverInfo).toEqual(expect.objectContaining({ name: card.name, title: 'Hugo Theme Development Site', version: '1.0.0' }));
	expect(result.instructions).toBe(card.description);

	const fallback = await rpc('initialize', { protocolVersion: '1999-01-01' });

	expect(fallback.result.protocolVersion).toBe('2025-11-25');
});

test('notifications are accepted without a response body', async ({ baseURL }) => {
	const { call } = await setup(baseURL);
	const response = await call({ jsonrpc: '2.0', method: 'notifications/initialized' });

	expect(response.status).toBe(202);
	expect(await response.text()).toBe('');
});

test('tools/list describes three read-only tools', async ({ baseURL }) => {
	const { rpc } = await setup(baseURL);
	const { result } = await rpc('tools/list');

	expect(result.tools.map((t) => t.name)).toEqual(['search_site', 'list_recent_posts', 'get_page']);
	expect(result.tools.every((t) => t.annotations.readOnlyHint && t.inputSchema.type === 'object')).toBe(true);
});

test('search_site finds posts and get_page returns their Markdown', async ({ baseURL }) => {
	const { rpc } = await setup(baseURL);
	const search = await rpc('tools/call', { name: 'search_site', arguments: { query: 'Hugo Development Post', limit: 3 } });
	const [first] = search.result.structuredContent.results;

	expect(search.result.structuredContent.results.length).toBeLessThanOrEqual(3);
	expect(first.title).toMatch(/Hugo Development Post/);
	expect(first.url.startsWith(`${SITE}/`)).toBe(true);
	expect(first.markdownUrl).toMatch(/\/index\.md$/);
	expect(JSON.parse(search.result.content[0].text)).toEqual(search.result.structuredContent);

	const page = await rpc('tools/call', { name: 'get_page', arguments: { url: first.url } });

	expect(page.result.isError).toBeUndefined();
	expect(page.result.content[0].text).toMatch(/^---\ntitle: "Hugo Development Post/);

	const byPath = await rpc('tools/call', { name: 'get_page', arguments: { url: '/about/' } });

	expect(byPath.result.content[0].text).toMatch(/^---\ntitle: "About Me"/);
});

test('list_recent_posts returns posts newest first', async ({ baseURL }) => {
	const { rpc } = await setup(baseURL);
	const { result } = await rpc('tools/call', { name: 'list_recent_posts', arguments: { limit: 5 } });
	const dates = result.structuredContent.results.map((r) => Date.parse(r.date));

	expect(dates).toHaveLength(5);
	expect(result.structuredContent.results.map((r) => r.url)).not.toContainEqual(expect.stringMatching(/\/(about|uses|now)\/$/));
	expect([...dates].sort((a, b) => b - a)).toEqual(dates);
});

test('tool errors are reported as results, protocol errors as JSON-RPC errors', async ({ baseURL }) => {
	const { rpc, call } = await setup(baseURL);

	const offsite = await rpc('tools/call', { name: 'get_page', arguments: { url: 'https://example.com/' } });

	expect(offsite.result.isError).toBe(true);
	expect(offsite.result.content[0].text).toMatch(/Only pages on/);

	const missing = await rpc('tools/call', { name: 'get_page', arguments: { url: '/no-such-page/' } });

	expect(missing.result.isError).toBe(true);

	const empty = await rpc('tools/call', { name: 'search_site', arguments: { query: '  ' } });

	expect(empty.result.isError).toBe(true);
	expect((await rpc('tools/call', { name: 'toString' })).error.code).toBe(-32602);
	expect((await rpc('resources/list')).error.code).toBe(-32601);

	const bad = await call(null, { body: '{not json' });

	expect(bad.status).toBe(400);
	expect((await bad.json()).error.code).toBe(-32700);
});

test('GET /mcp is not allowed and preflight requests get CORS headers', async ({ baseURL }) => {
	const { worker, env } = await setup(baseURL);
	const get = await worker.fetch(new Request(`${SITE}/mcp`), env);

	expect(get.status).toBe(405);
	expect(get.headers.get('allow')).toBe('POST, OPTIONS');

	const preflight = await worker.fetch(new Request(`${SITE}/mcp`, { method: 'OPTIONS' }), env);

	expect(preflight.status).toBe(204);
	expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
	expect(preflight.headers.get('access-control-allow-headers')).toMatch(/Mcp-Protocol-Version/);
});

test('the server card is published and served at /mcp/server-card', async ({ baseURL, request }) => {
	const { worker, env } = await setup(baseURL);
	const card = await (await request.get('/.well-known/mcp/server-card.json')).json();

	expect(card.$schema).toBe('https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json');
	expect(card.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
	expect(card.remotes[0]).toEqual(expect.objectContaining({ type: 'streamable-http', url: expect.stringMatching(/\/mcp$/) }));
	expect(card.serverInfo).toEqual({ name: card.name, title: card.title, version: card.version });
	expect(card.transport.endpoint).toBe(card.remotes[0].url);

	const served = await worker.fetch(new Request(`${SITE}/mcp/server-card`), env);

	expect(served.headers.get('content-type')).toBe('application/mcp-server-card+json');
	expect(served.headers.get('access-control-allow-origin')).toBe('*');
	expect(await served.json()).toEqual(card);

	const passthrough = await worker.fetch(new Request(`${SITE}/robots.txt`), env);

	expect(await passthrough.text()).toContain('User-agent: *');
});

test('the ARD manifest lists the MCP server', async ({ request }) => {
	const manifest = await (await request.get('/.well-known/ard.json')).json();
	const mcp = manifest.entries.find((e) => e.type === 'application/mcp-server-card+json');

	expect(mcp.url).toMatch(/\/\.well-known\/mcp\/server-card\.json$/);
	expect(mcp.capabilities).toEqual(['search_site', 'list_recent_posts', 'get_page']);
});
