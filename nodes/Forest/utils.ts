import type { IExecuteFunctions, ILoadOptionsFunctions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { McpAuthenticationOption, McpTool } from './types';

export type Result<T, E> = { ok: true; result: T } | { ok: false; error: E };

export function cleanParameters<T>(obj: T): T {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (Array.isArray(obj)) {
		const cleanedArray = obj
			.map((item) => cleanParameters(item))
			.filter((item) => item !== undefined);
		return cleanedArray as T;
	}

	if (typeof obj === 'object') {
		const cleaned: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			const cleanedValue = cleanParameters(value);
			// Skip undefined values and empty objects
			if (cleanedValue !== undefined) {
				if (
					typeof cleanedValue === 'object' &&
					cleanedValue !== null &&
					!Array.isArray(cleanedValue) &&
					Object.keys(cleanedValue).length === 0
				) {
					// Skip empty objects
					continue;
				}
				cleaned[key] = cleanedValue;
			}
		}
		return cleaned as T;
	}

	return obj;
}

function createResultOk<T>(result: T): Result<T, never> {
	return { ok: true, result };
}

function createResultError<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

type JsonRpcResponse = {
	jsonrpc: '2.0';
	id: number;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
};

type HttpRequestFn = (options: {
	url: string;
	method: 'POST';
	headers: Record<string, string>;
	body: unknown;
	returnFullResponse: true;
	timeout?: number;
	skipSslCertificateValidation?: boolean;
}) => Promise<{ body: JsonRpcResponse; headers: Record<string, unknown>; statusCode: number }>;

function parseSseOrJson(raw: string): JsonRpcResponse {
	try {
		return JSON.parse(raw);
	} catch {
		// Parse SSE format: "event: message\ndata: {...}\n\n"
		const lines = raw.split('\n');
		for (const line of lines) {
			if (line.startsWith('data: ')) {
				const data = line.slice(6);
				try {
					return JSON.parse(data);
				} catch {
					// continue looking for valid JSON data line
				}
			}
		}
		throw new Error(`Unable to parse MCP response: ${raw.slice(0, 200)}`);
	}
}

export class McpHttpClient {
	private endpointUrl: string;
	private headers: Record<string, string>;
	private sessionId: string | undefined;
	private requestId = 0;
	private httpRequest: HttpRequestFn;

	constructor(
		endpointUrl: string,
		headers: Record<string, string>,
		httpRequest: HttpRequestFn,
	) {
		this.endpointUrl = endpointUrl;
		this.headers = headers;
		this.httpRequest = httpRequest;
	}

	private async sendRequest(
		method: string,
		params?: Record<string, unknown>,
		timeout?: number,
	): Promise<unknown> {
		const requestHeaders: Record<string, string> = {
			...this.headers,
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
		};

		if (this.sessionId) {
			requestHeaders['mcp-session-id'] = this.sessionId;
		}

		const response = await this.httpRequest({
			url: this.endpointUrl,
			method: 'POST',
			headers: requestHeaders,
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: ++this.requestId,
				method,
				params,
			}),
			returnFullResponse: true,
			timeout,
		});

		// Capture session ID from response headers
		const sessionId =
			response.headers['mcp-session-id'] || response.headers['Mcp-Session-Id'];
		if (sessionId) {
			this.sessionId = String(sessionId);
		}

		let body: JsonRpcResponse;
		if (typeof response.body === 'string') {
			body = parseSseOrJson(response.body);
		} else {
			body = response.body;
		}

		if (body.error) {
			const err = new Error(body.error.message) as Error & { code: number };
			err.code = body.error.code;
			throw err;
		}

		return body.result;
	}

	async initialize(): Promise<void> {
		await this.sendRequest('initialize', {
			protocolVersion: '2025-03-26',
			capabilities: {},
			clientInfo: { name: 'n8n-forest', version: '1.0.0' },
		});

		// Send initialized notification (no response expected, but we send as request)
		try {
			await this.sendRequest('notifications/initialized');
		} catch {
			// Notifications may not return a response, ignore errors
		}
	}

	async listTools(params?: {
		cursor?: string;
	}): Promise<{ tools: McpTool[]; nextCursor?: string }> {
		const result = (await this.sendRequest('tools/list', params as Record<string, unknown>)) as {
			tools: McpTool[];
			nextCursor?: string;
		};
		return result;
	}

	async callTool(
		params: { name: string; arguments?: Record<string, unknown> },
		timeout?: number,
	): Promise<unknown> {
		return this.sendRequest('tools/call', params as Record<string, unknown>, timeout);
	}

	async close(): Promise<void> {
		// No persistent connection to close with HTTP transport
	}
}

export async function getAllTools(client: McpHttpClient, cursor?: string): Promise<McpTool[]> {
	const { tools, nextCursor } = await client.listTools({ cursor });

	if (nextCursor) {
		return (tools as McpTool[]).concat(await getAllTools(client, nextCursor));
	}

	return tools as McpTool[];
}

function normalizeAndValidateUrl(input: string): Result<URL, Error> {
	const withProtocol = !/^https?:\/\//i.test(input) ? `https://${input}` : input;
	try {
		return createResultOk(new URL(withProtocol));
	} catch (error) {
		return createResultError(error as Error);
	}
}

function errorHasCode(error: unknown, code: number): boolean {
	return (
		!!error &&
		typeof error === 'object' &&
		(('code' in error && Number(error.code) === code) ||
			('message' in error &&
				typeof error.message === 'string' &&
				error.message.includes(code.toString())))
	);
}

function isUnauthorizedError(error: unknown): boolean {
	return errorHasCode(error, 401);
}

function isForbiddenError(error: unknown): boolean {
	return errorHasCode(error, 403);
}

function isNotFoundError(error: unknown): boolean {
	return errorHasCode(error, 404);
}

type ConnectMcpClientError =
	| { type: 'invalid_url'; error: Error }
	| { type: 'connection'; error: Error }
	| { type: 'auth'; error: Error }
	| { type: 'not_found'; error: Error };

export function mapToNodeOperationError(
	node: INode,
	error: ConnectMcpClientError,
): NodeOperationError {
	switch (error.type) {
		case 'invalid_url':
			return new NodeOperationError(node, error.error, {
				message: 'Could not connect to your Forest MCP server. The provided URL is invalid.',
			});
		case 'auth':
			return new NodeOperationError(node, error.error, {
				message: 'Could not connect to your Forest MCP server. Authentication failed.',
			});
		case 'not_found':
			return new NodeOperationError(node, error.error, {
				message:
					'MCP server not found. The MCP server has not been setup on your Forest agent. See https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/ai/mcp-server',
			});
		case 'connection':
		default:
			return new NodeOperationError(node, error.error, {
				message: `Could not connect to your Forest MCP server: ${error.error.message}`,
			});
	}
}

export async function connectMcpClient({
	headers,
	endpointUrl,
	httpRequest,
}: {
	endpointUrl: string;
	headers?: Record<string, string>;
	httpRequest: HttpRequestFn;
}): Promise<Result<McpHttpClient, ConnectMcpClientError>> {
	const endpoint = normalizeAndValidateUrl(endpointUrl);

	if (!endpoint.ok) {
		return createResultError({ type: 'invalid_url', error: endpoint.error });
	}

	const client = new McpHttpClient(endpoint.result.toString(), headers || {}, httpRequest);

	try {
		await client.initialize();
		return createResultOk(client);
	} catch (error) {
		if (isUnauthorizedError(error) || isForbiddenError(error)) {
			return createResultError({ type: 'auth', error: error as Error });
		} else if (isNotFoundError(error)) {
			return createResultError({ type: 'not_found', error: error as Error });
		} else {
			return createResultError({ type: 'connection', error: error as Error });
		}
	}
}

export async function getAuthHeadersAndEndpoint(
	ctx: Pick<IExecuteFunctions | ILoadOptionsFunctions, 'getCredentials'>,
	authentication: McpAuthenticationOption,
): Promise<{ headers?: Record<string, string>; endpointUrl?: string }> {
	switch (authentication) {
		case 'bearerAuth': {
			const result = await ctx.getCredentials('forestMcpApi');

			const serverUrl = String(result.serverUrl ?? '').trim();
			const endpointUrl = serverUrl.endsWith('/mcp') ? serverUrl : `${serverUrl}/mcp`;

			const token = String(result.token ?? '').trim();
			if (!token) {
				return {};
			}

			return {
				headers: { Authorization: `Bearer ${token}` },
				endpointUrl,
			};
		}
		case 'mcpOAuth2Api':
		default: {
			const result = await ctx.getCredentials('forestMcpOAuth2Api');

			const serverUrl = String(result.serverUrl ?? '').trim();
			const endpointUrl = serverUrl.endsWith('/mcp') ? serverUrl : `${serverUrl}/mcp`;

			const oauthTokenData = result.oauthTokenData as
				| { access_token?: string }
				| undefined;
			const accessToken = String(oauthTokenData?.access_token ?? '').trim();
			if (!accessToken) {
				return {};
			}

			return {
				headers: { Authorization: `Bearer ${accessToken}` },
				endpointUrl,
			};
		}
	}
}
