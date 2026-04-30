export type JsonSchemaTypeName =
	| 'string'
	| 'number'
	| 'integer'
	| 'boolean'
	| 'object'
	| 'null'
	| 'array';

export type JsonSchema = {
	type?: JsonSchemaTypeName | JsonSchemaTypeName[];
	properties?: Record<string, JsonSchema>;
	required?: string[];
	description?: string;
	enum?: unknown[];
	default?: unknown;
	items?: JsonSchema;
	[key: string]: unknown;
};

export type McpTool = {
	name: string;
	description?: string;
	inputSchema: JsonSchema;
};

export type McpAuthenticationOption = 'bearerAuth' | 'mcpOAuth2Api';

export type CallToolResultContent =
	| { type: 'text'; text: string }
	| { type: 'image'; data: string; mimeType: string }
	| { type: 'audio'; data: string; mimeType: string };

export type CallToolResult = {
	content: CallToolResultContent[];
	isError?: boolean;
};
