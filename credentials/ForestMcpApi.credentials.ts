import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

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
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.token}}',
			},
		},
	};
	test: ICredentialTestRequest = {
		request: {
			method: 'POST',
			url: '={{$credentials.serverUrl.endsWith("/mcp") ? $credentials.serverUrl : $credentials.serverUrl + "/mcp"}}',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json, text/event-stream',
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: {
					protocolVersion: '2025-03-26',
					capabilities: {},
					clientInfo: { name: 'n8n-forest', version: '1.0.0' },
				},
			}),
		},
	};
}
