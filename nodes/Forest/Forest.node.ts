import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type {
	IBinaryKeyData,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeExecutionWithMetadata,
} from 'n8n-workflow';
import { jsonParse, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { ZodError } from 'zod';

import * as listSearch from './listSearch';
import * as resourceMapping from './resourceMapping';
import type { McpAuthenticationOption } from './types';
import { connectMcpClient, getAuthHeadersAndEndpoint, mapToNodeOperationError } from './utils';

export class Forest implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Forest MCP Client',
		name: 'forest',
		icon: 'file:forest.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["tool.value"]}}',
		description: 'Connect to Forest MCP Server',
		defaults: {
			name: 'Forest MCP Client',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'forestMcpApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['bearerAuth'],
					},
				},
			},
			{
				name: 'forestMcpOAuth2Api',
				required: true,
				displayOptions: {
					show: {
						authentication: ['mcpOAuth2Api'],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'MCP OAuth2',
						value: 'mcpOAuth2Api',
					},
					{
						name: 'Bearer Auth',
						value: 'bearerAuth',
					},
				],
				default: 'mcpOAuth2Api',
				description: 'The way to authenticate with your Forest MCP endpoint',
			},
			{
				displayName: 'Credentials',
				name: 'credentials',
				type: 'credentials',
				default: '',
			},
			{
				displayName: 'Tool',
				name: 'tool',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'The tool to use',
				typeOptions: {
					loadOptionsDependsOn: ['authentication'],
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'getTools',
							searchable: true,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
					},
				],
			},
			{
				displayName: 'Input Mode',
				name: 'inputMode',
				type: 'options',
				default: 'manual',
				noDataExpression: true,
				options: [
					{
						name: 'Manual',
						value: 'manual',
						description: 'Manually specify the input data for each tool parameter',
					},
					{
						name: 'JSON',
						value: 'json',
						description: 'Specify the input data as a JSON object',
					},
				],
			},
			{
				displayName: 'Parameters',
				name: 'parameters',
				type: 'resourceMapper',
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				noDataExpression: true,
				required: true,
				typeOptions: {
					loadOptionsDependsOn: ['tool.value', 'authentication'],
					resourceMapper: {
						resourceMapperMethod: 'getToolParameters',
						mode: 'add',
						fieldWords: {
							singular: 'parameter',
							plural: 'parameters',
						},
						supportAutoMap: true,
					},
				},
				displayOptions: {
					show: {
						inputMode: ['manual'],
					},
				},
			},
			{
				displayName: 'JSON',
				name: 'jsonInput',
				type: 'json',
				typeOptions: {
					rows: 5,
				},
				default: '{\n  "my_field_1": "value",\n  "my_field_2": 1\n}\n',
				validateType: 'object',
				displayOptions: {
					show: {
						inputMode: ['json'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Convert to Binary',
						name: 'convertToBinary',
						type: 'boolean',
						default: true,
						description:
							'Whether to convert images and audio to binary data. If false, images and audio will be returned as base64 encoded strings.',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 1,
						},
						default: 60000,
						description: 'Time in ms to wait for tool calls to finish',
					},
				],
			},
		],
	};

	methods = {
		listSearch,
		resourceMapping,
	};

	async execute(
		this: IExecuteFunctions,
	): Promise<INodeExecutionData[][] | NodeExecutionWithMetadata[][] | null> {
		const authentication = this.getNodeParameter('authentication', 0) as McpAuthenticationOption;
		const node = this.getNode();
		const { headers, endpointUrl } = await getAuthHeadersAndEndpoint(this, authentication);

		if (!endpointUrl) {
			throw new NodeOperationError(node, 'Server URL is required in credentials');
		}

		const client = await connectMcpClient({
			endpointUrl,
			headers,
			name: node.type,
			version: node.typeVersion,
		});

		if (!client.ok) {
			throw mapToNodeOperationError(node, client.error);
		}

		const inputMode = this.getNodeParameter('inputMode', 0, 'manual') as 'manual' | 'json';
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const tool = this.getNodeParameter('tool.value', itemIndex) as string;
				const options = this.getNodeParameter('options', itemIndex) as IDataObject;
				let parameters: IDataObject = {};

				if (inputMode === 'manual') {
					parameters = this.getNodeParameter('parameters.value', itemIndex) as IDataObject;
				} else {
					parameters = this.getNodeParameter('jsonInput', itemIndex) as IDataObject;
				}

				const result = (await client.result.callTool(
					{
						name: tool,
						arguments: parameters,
					},
					undefined,
					{
						timeout: options.timeout ? Number(options.timeout) : undefined,
					},
				)) as CallToolResult;

				let binaryIndex = 0;
				const binary: IBinaryKeyData = {};
				const content: IDataObject[] = [];
				const convertToBinary = options.convertToBinary ?? true;

				for (const contentItem of result.content) {
					if (contentItem.type === 'text') {
						content.push({
							...contentItem,
							text: jsonParse(contentItem.text, { fallbackValue: contentItem.text }),
						});
						continue;
					}

					if (convertToBinary && (contentItem.type === 'image' || contentItem.type === 'audio')) {
						binary[`data_${binaryIndex}`] = await this.helpers.prepareBinaryData(
							Buffer.from(contentItem.data, 'base64'),
							undefined,
							contentItem.mimeType,
						);
						binaryIndex++;
						continue;
					}

					content.push(contentItem as IDataObject);
				}

				returnData.push({
					json: {
						content: content.length > 0 ? content : undefined,
					},
					binary: Object.keys(binary).length > 0 ? binary : undefined,
					pairedItem: {
						item: itemIndex,
					},
				});
			} catch (e) {
				const errorMessage =
					e instanceof ZodError
						? e.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')
						: e instanceof Error
							? e.message
							: String(e);

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: {
								message: errorMessage,
								issues: e instanceof ZodError ? e.issues : undefined,
							},
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}

				throw new NodeOperationError(node, errorMessage, {
					itemIndex,
				});
			}
		}

		return [returnData];
	}
}
