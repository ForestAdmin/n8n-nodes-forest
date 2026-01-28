import type { JSONSchema7 } from 'json-schema';

export type McpTool = {
	name: string;
	description?: string;
	inputSchema: JSONSchema7;
};

export type McpAuthenticationOption = 'bearerAuth' | 'mcpOAuth2Api';
