import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class ForestMcpApi implements ICredentialType {
	name = 'forestMcpApi';
	displayName = 'Forest MCP API';
	documentationUrl =
		'https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/ai/mcp-server';
	properties: INodeProperties[] = [
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. https://your-server.com',
			description: 'The Forest Admin server URL (without /mcp suffix)',
		},
		{
			displayName: 'Token',
			name: 'token',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'The Bearer token to authenticate with your Forest MCP server',
		},
	];
}
