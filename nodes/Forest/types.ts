import type { JSONSchema7 } from 'json-schema';

export type McpTool = {
	name: string;
	description?: string;
	inputSchema: JSONSchema7;
};

export type McpAuthenticationOption = 'bearerAuth' | 'mcpOAuth2Api';

export type CallToolResultContent =
	| { type: 'text'; text: string }
	| { type: 'image'; data: string; mimeType: string }
	| { type: 'audio'; data: string; mimeType: string }
	| { type: string; [key: string]: unknown };

export type CallToolResult = {
	content: CallToolResultContent[];
	isError?: boolean;
};
