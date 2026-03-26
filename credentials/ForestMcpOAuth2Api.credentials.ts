import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class ForestMcpOAuth2Api implements ICredentialType {
	name = 'forestMcpOAuth2Api';
	displayName = 'Forest MCP OAuth2 API';
	icon = 'file:forest.svg' as const;
	documentationUrl =
		'https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/ai/mcp-server';
	extends = ['oAuth2Api'];
	properties: INodeProperties[] = [
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. https://your-server.com',
			description: 'The url of your Forest Admin server (without /mcp suffix)',
		},
		{
			displayName: 'Use Dynamic Client Registration',
			name: 'useDynamicClientRegistration',
			type: 'boolean',
			default: true,
			description: 'Whether to use OAuth 2.0 Dynamic Client Registration',
		},
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. https://your-auth-server.com/oauth/authorize',
			description: 'The OAuth2 authorization URL for your Forest Admin server',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. https://your-auth-server.com/oauth/token',
			description: 'The OAuth2 access token URL for your Forest Admin server',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
	];
}
