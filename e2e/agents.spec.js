const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

// Runs the agents Worker in Node with its ASSETS binding backed by the Hugo test
// server, so the tools read the same files a deployed site would serve.
const SITE = 'https://site.test';

async function setup(baseURL) {
	const worker = (await import(pathToFileURL(path.join(__dirname, '..', 'workers', 'agents.mjs')).href)).default;
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

	const a2a = async (method, params, version = '1.0', id = 1) => {
		const headers = { 'Content-Type': 'application/json' };

		if (version) headers['A2A-Version'] = version;

		return (await worker.fetch(new Request(`${SITE}/a2a`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
		}), env)).json();
	};

	const say = (parts) => ({ message: { role: 'ROLE_USER', messageId: 'm1', contextId: 'c1', parts } });

	return { worker, env, call, rpc, a2a, say };
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

test('A2A search returns links as text and results as data (protocol 1.0)', async ({ baseURL }) => {
	const { a2a, say } = await setup(baseURL);
	const { result } = await a2a('SendMessage', say([{ text: 'Hugo Development Post' }]));
	const { message } = result;

	expect(message.role).toBe('ROLE_AGENT');
	expect(message.contextId).toBe('c1');
	expect(message.messageId).toBeTruthy();
	expect(message.parts[0].text).toMatch(/^Results for "Hugo Development Post":\n\n- \[Hugo Development Post/);
	expect(message.parts[1].mediaType).toBe('application/json');
	expect(message.parts[1].data.results[0].url.startsWith(`${SITE}/`)).toBe(true);
});

test('A2A reads pages, lists recent posts, and honors explicit skills', async ({ baseURL }) => {
	const { a2a, say } = await setup(baseURL);

	const read = await a2a('SendMessage', say([{ text: `${SITE}/about/` }]));

	expect(read.result.message.parts[0].mediaType).toBe('text/markdown');
	expect(read.result.message.parts[0].text).toMatch(/^---\ntitle: "About Me"/);

	const recent = await a2a('SendMessage', say([{ text: 'What are the latest posts?' }]));

	expect(recent.result.message.parts[0].text).toMatch(/^Recent posts:/);
	expect(recent.result.message.parts[1].data.results.length).toBeGreaterThan(0);

	const explicit = await a2a('SendMessage', say([{ data: { skill: 'search', query: 'Hugo', limit: 2 } }]));

	expect(explicit.result.message.parts[1].data.results).toHaveLength(2);

	const unknown = await a2a('SendMessage', say([{ data: { skill: 'book-flight' } }]));

	expect(unknown.result.message.parts[0].text).toMatch(/Unknown skill "book-flight"/);

	const offsite = await a2a('SendMessage', say([{ data: { skill: 'read', url: 'https://example.com/' } }]));

	expect(offsite.result.message.parts[0].text).toMatch(/Only pages on/);
});

test('A2A 0.3 clients (no version header) get 0.3-shaped replies', async ({ baseURL }) => {
	const { a2a } = await setup(baseURL);
	const { result } = await a2a('message/send', {
		message: { kind: 'message', role: 'user', messageId: 'm1', parts: [{ kind: 'text', text: 'Hugo' }] },
	}, null);

	expect(result.kind).toBe('message');
	expect(result.role).toBe('agent');
	expect(result.parts[0].kind).toBe('text');
	expect(result.parts[1].kind).toBe('data');
});

test('A2A reports unsupported operations with spec error codes', async ({ baseURL }) => {
	const { a2a, say } = await setup(baseURL);

	expect((await a2a('SendStreamingMessage', say([{ text: 'Hugo' }]))).error.code).toBe(-32004);
	expect((await a2a('GetTask', { id: 'task-1' })).error.code).toBe(-32001);
	expect((await a2a('ListTasks', {})).result.tasks).toEqual([]);
	expect((await a2a('SendMessage', { message: { role: 'ROLE_USER', messageId: 'm', taskId: 't', parts: [{ text: 'x' }] } })).error.code).toBe(-32001);
	expect((await a2a('SendMessage', { message: { role: 'ROLE_USER', messageId: 'm', parts: [] } })).error.code).toBe(-32602);
	expect((await a2a('SendMessage', say([{ text: 'x' }]), '2.0')).error.code).toBe(-32009);
	expect((await a2a('message/send', say([{ text: 'x' }]))).error.code).toBe(-32601);
});

test('the A2A agent card declares both protocol versions at /a2a', async ({ request }) => {
	const card = await (await request.get('/.well-known/agent-card.json')).json();

	expect(card.name).toBe('Hugo Theme Development Site');
	expect(card.version).toBe('1.0.0');
	expect(card.supportedInterfaces.map((i) => [i.protocolBinding, i.protocolVersion])).toEqual([['JSONRPC', '1.0'], ['JSONRPC', '0.3']]);
	expect(card.supportedInterfaces.every((i) => i.url === card.url && i.url.endsWith('/a2a'))).toBe(true);
	expect(card.capabilities).toEqual({ streaming: false, pushNotifications: false, extendedAgentCard: false });
	expect(card.skills.map((skill) => skill.id)).toEqual(['search', 'recent', 'read']);
	expect(card.skills.every((skill) => skill.name && skill.description && skill.examples.length)).toBe(true);
});
