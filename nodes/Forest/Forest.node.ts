import type {
	IBinaryKeyData,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeExecutionWithMetadata,
} from 'n8n-workflow';
import { jsonParse, NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import * as listSearch from './listSearch';
import * as resourceMapping from './resourceMapping';
import { TOOL_CATALOG } from './toolCatalog';
import type { CallToolResult, McpAuthenticationOption } from './types';
import {
	cleanParameters,
	connectMcpClient,
	getAuthHeadersAndEndpoint,
	mapToNodeOperationError,
} from './utils';

const ACTION_TOOLS = ['getActionForm', 'executeAction'];
const RELATION_TOOLS = ['listRelated', 'associate', 'dissociate'];

export class Forest implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Forest Admin',
		name: 'forest',
		icon: 'file:forest.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["tool"]["value"]}}',
		description: 'Make calls directly to Forest Admin securely with the same security, compliance, and control you rely on today through the Forest Admin MCP Server.',
		defaults: {
			name: 'Forest Admin',
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [NodeConnectionTypes.Main],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
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
						name: 'Bearer Auth',
						value: 'bearerAuth',
					},
					{
						name: 'MCP OAuth2',
						value: 'mcpOAuth2Api',
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
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Tool',
						value: 'tool',
					},
				],
				default: 'tool',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['tool'],
					},
				},
				options: [
					{
						name: 'Execute',
						value: 'execute',
						description: 'Execute a tool on the Forest Admin MCP Server',
						action: 'Execute a tool',
					},
				],
				default: 'execute',
			},
			{
				displayName: 'Tool',
				name: 'tool',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'The tool to use',
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
				displayName: 'Collection',
				name: 'collectionName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'The collection to operate on',
				typeOptions: {
					loadOptionsDependsOn: ['authentication'],
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'getCollections',
							searchable: true,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
					},
				],
				displayOptions: {
					hide: {
						'tool.value': [''],
					},
				},
			},
			{
				displayName: 'Action',
				name: 'actionName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'The action to run on the selected collection',
				typeOptions: {
					loadOptionsDependsOn: ['authentication', 'collectionName.value'],
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'getActions',
							searchable: true,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
					},
				],
				displayOptions: {
					show: {
						'tool.value': ACTION_TOOLS,
					},
				},
			},
			{
				displayName: 'Relation',
				name: 'relationName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'The to-many relation to operate on',
				typeOptions: {
					loadOptionsDependsOn: ['authentication', 'collectionName.value'],
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'getRelations',
							searchable: true,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
					},
				],
				displayOptions: {
					show: {
						'tool.value': RELATION_TOOLS,
					},
				},
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
					loadOptionsDependsOn: ['tool.value'],
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
			httpRequest: this.helpers.httpRequest,
		});

		if (!client.ok) {
			throw mapToNodeOperationError(node, client.error);
		}

		try {
			const inputMode = this.getNodeParameter('inputMode', 0, 'manual') as 'manual' | 'json';
			const items = this.getInputData();
			const returnData: INodeExecutionData[] = [];

			for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
				try {
					const tool = this.getNodeParameter('tool.value', itemIndex) as string;
					const definition = TOOL_CATALOG[tool];
					const options = this.getNodeParameter('options', itemIndex) as IDataObject;

					let parameters: IDataObject = {};

					if (inputMode === 'manual') {
						const rawParams = this.getNodeParameter('parameters.value', itemIndex);
						parameters = (rawParams as IDataObject) ?? {};
					} else {
						parameters = this.getNodeParameter('jsonInput', itemIndex) as IDataObject;
					}

					const args: IDataObject = { ...parameters };

					if (definition?.needsCollection) {
						args.collectionName = this.getNodeParameter('collectionName.value', itemIndex) as string;
					}
					if (definition?.needsAction) {
						args.actionName = this.getNodeParameter('actionName.value', itemIndex) as string;
					}
					if (definition?.needsRelation) {
						args.relationName = this.getNodeParameter('relationName.value', itemIndex) as string;
					}

					const result = (await client.result.callTool(
						{
							name: tool,
							arguments: cleanParameters(args),
						},
						options.timeout ? Number(options.timeout) : undefined,
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
					const errorMessage = e instanceof Error ? e.message : String(e);

					if (this.continueOnFail()) {
						returnData.push({
							json: {
								error: {
									message: errorMessage,
								},
							},
							pairedItem: {
								item: itemIndex,
							},
						});
						continue;
					}

					throw new NodeApiError(node, e instanceof Error ? (e as unknown as JsonObject) : { message: String(e) }, {
						itemIndex,
						message: errorMessage,
					});
				}
			}

			return [returnData];
		} finally {
			await client.result.close();
		}
	}
}
