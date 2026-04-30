import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import type {
	CallToolResultContent,
	JsonSchema,
	McpAuthenticationOption,
	McpTool,
} from './types';
import {
	connectMcpClient,
	getAllTools,
	getAuthHeadersAndEndpoint,
	mapToNodeOperationError,
} from './utils';

function matchesFilter(name: string, filter?: string): boolean {
	return !filter || name.toLowerCase().includes(filter.toLowerCase());
}

export async function getCollections(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const authentication = this.getNodeParameter('authentication') as McpAuthenticationOption;
	const { headers, endpointUrl } = await getAuthHeadersAndEndpoint(this, authentication);

	if (!endpointUrl) {
		return { results: [] };
	}

	const node = this.getNode();
	const client = await connectMcpClient({
		endpointUrl,
		headers,
		httpRequest: this.helpers.httpRequest,
	});

	if (!client.ok) {
		throw mapToNodeOperationError(node, client.error);
	}

	try {
		const tools = await getAllTools(client.result);
		const collectionNames = extractCollectionNames(tools);

		return {
			results: collectionNames
				.filter((name) => matchesFilter(name, filter))
				.map((name) => ({ name, value: name })),
		};
	} finally {
		await client.result.close();
	}
}

export async function getActions(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const collection = (this.getNodeParameter('collectionName.value', '') as string) ?? '';

	if (!collection) {
		return { results: [] };
	}

	const description = await fetchDescribeCollection(this, collection);
	if (!description) {
		return { results: [] };
	}

	const actions = (description.actions ?? []) as Array<{
		name: string;
		description?: string | null;
	}>;

	return {
		results: actions
			.filter((action) => matchesFilter(action.name, filter))
			.map((action) => ({
				name: action.name,
				value: action.name,
				description: action.description ?? undefined,
			})),
	};
}

export async function getRelations(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const collection = (this.getNodeParameter('collectionName.value', '') as string) ?? '';

	if (!collection) {
		return { results: [] };
	}

	const description = await fetchDescribeCollection(this, collection);
	if (!description) {
		return { results: [] };
	}

	const relations = (description.relations ?? []) as Array<{
		name: string;
		type?: string;
	}>;

	return {
		results: relations
			.filter(
				(relation) =>
					(relation.type === 'one-to-many' || relation.type === 'many-to-many') &&
					matchesFilter(relation.name, filter),
			)
			.map((relation) => ({
				name: `${relation.name} (${relation.type})`,
				value: relation.name,
			})),
	};
}

function extractCollectionNames(tools: McpTool[]): string[] {
	const fromList = readEnumFromTool(tools, 'list');
	if (fromList.length > 0) {
		return fromList;
	}

	for (const tool of tools) {
		const candidate = readCollectionEnum(tool.inputSchema as JsonSchema);
		if (candidate.length > 0) {
			return candidate;
		}
	}

	return [];
}

function readEnumFromTool(tools: McpTool[], toolName: string): string[] {
	const tool = tools.find((t) => t.name === toolName);
	if (!tool) return [];

	return readCollectionEnum(tool.inputSchema as JsonSchema);
}

function readCollectionEnum(schema: JsonSchema | undefined): string[] {
	const property = schema?.properties?.collectionName as JsonSchema | undefined;
	const values = property?.enum;

	if (!Array.isArray(values)) return [];

	return values.filter((v): v is string => typeof v === 'string');
}

async function fetchDescribeCollection(
	ctx: ILoadOptionsFunctions,
	collectionName: string,
): Promise<Record<string, unknown> | undefined> {
	const authentication = ctx.getNodeParameter('authentication') as McpAuthenticationOption;
	const { headers, endpointUrl } = await getAuthHeadersAndEndpoint(ctx, authentication);

	if (!endpointUrl) {
		return undefined;
	}

	const client = await connectMcpClient({
		endpointUrl,
		headers,
		httpRequest: ctx.helpers.httpRequest,
	});

	if (!client.ok) {
		return undefined;
	}

	try {
		const result = (await client.result.callTool({
			name: 'describeCollection',
			arguments: { collectionName },
		})) as { content?: CallToolResultContent[] };

		const textContent = (result.content ?? []).find(
			(item): item is { type: 'text'; text: string } => item.type === 'text',
		);

		if (!textContent) return undefined;

		try {
			return JSON.parse(textContent.text) as Record<string, unknown>;
		} catch {
			return undefined;
		}
	} catch {
		return undefined;
	} finally {
		await client.result.close();
	}
}
