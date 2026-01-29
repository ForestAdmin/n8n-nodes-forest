import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
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

export async function getAllTools(client: Client, cursor?: string): Promise<McpTool[]> {
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
				message: 'Could not connect to your Forest MCP server',
			});
	}
}

export async function connectMcpClient({
	headers,
	endpointUrl,
	name,
	version,
}: {
	endpointUrl: string;
	headers?: Record<string, string>;
	name: string;
	version: number;
}): Promise<Result<Client, ConnectMcpClientError>> {
	const endpoint = normalizeAndValidateUrl(endpointUrl);

	if (!endpoint.ok) {
		return createResultError({ type: 'invalid_url', error: endpoint.error });
	}

	const client = new Client({ name, version: version.toString() }, { capabilities: {} });

	try {
		const transport = new StreamableHTTPClientTransport(endpoint.result, {
			requestInit: { headers },
		});
		await client.connect(transport);
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
			let result: { token?: string; serverUrl?: string } | null = null;

			try {
				result = await ctx.getCredentials('forestMcpApi');
			} catch {
				// Credentials not configured or not accessible
				return {};
			}

			if (!result) return {};

			const serverUrl = result.serverUrl?.trim() || '';
			const endpointUrl = serverUrl.endsWith('/mcp') ? serverUrl : `${serverUrl}/mcp`;

			const token = result.token?.trim() || '';
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
			let result: {
				oauthTokenData?: {
					access_token?: string;
					refresh_token?: string;
					expires_in?: number;
				};
				serverUrl?: string;
			} | null = null;

			try {
				// n8n automatically refreshes the token if expired when getCredentials is called
				result = await ctx.getCredentials('forestMcpOAuth2Api');
			} catch (error) {
				// This can happen if:
				// - Credentials not configured
				// - Token refresh failed (refresh_token expired or invalid)
				// - OAuth server is unreachable
				console.error('Failed to get OAuth2 credentials:', error);
				return {};
			}

			if (!result) return {};

			const serverUrl = result.serverUrl?.trim() || '';
			const endpointUrl = serverUrl.endsWith('/mcp') ? serverUrl : `${serverUrl}/mcp`;

			// Check if oauthTokenData exists and has an access_token
			const accessToken = result.oauthTokenData?.access_token?.trim() || '';
			if (!accessToken) {
				// OAuth2 credentials exist but token data is not available yet
				// This can happen if:
				// - User hasn't completed the OAuth flow
				// - Token refresh failed and n8n cleared the token data
				return {};
			}

			return {
				headers: { Authorization: `Bearer ${accessToken}` },
				endpointUrl,
			};
		}
	}
}
