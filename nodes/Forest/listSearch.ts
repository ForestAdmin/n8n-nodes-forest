import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import type { McpAuthenticationOption } from './types';
import { connectMcpClient, getAuthHeadersAndEndpoint, mapToNodeOperationError } from './utils';

export async function getTools(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const authentication = this.getNodeParameter('authentication') as McpAuthenticationOption;
	const { headers, endpointUrl } = await getAuthHeadersAndEndpoint(this, authentication);

	// Return empty results if credentials are not configured yet
	if (!endpointUrl) {
		return { results: [] };
	}

	const node = this.getNode();

	const client = await connectMcpClient({
		endpointUrl,
		headers,
		name: node.type,
		version: node.typeVersion,
	});

	// Throw error if connection fails (e.g., auth error, network error)
	if (!client.ok) {
		throw mapToNodeOperationError(node, client.error);
	}

	try {
		const result = await client.result.listTools({ cursor: paginationToken });
		const tools = filter
			? result.tools.filter((tool) => tool.name.toLowerCase().includes(filter.toLowerCase()))
			: result.tools;

		return {
			results: tools.map((tool) => ({
				name: tool.name,
				value: tool.name,
				description: tool.description,
			})),
			paginationToken: result.nextCursor,
		};
	} finally {
		await client.result.close();
	}
}
