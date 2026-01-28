import type { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import type {
	FieldType,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	ResourceMapperField,
	ResourceMapperFields,
} from 'n8n-workflow';

import type { McpAuthenticationOption, McpTool } from './types';
import { connectMcpClient, getAllTools, getAuthHeadersAndEndpoint } from './utils';

function jsonSchemaTypeToFieldType(type: JSONSchema7TypeName | JSONSchema7TypeName[]): FieldType {
	const primaryType = Array.isArray(type) ? type[0] : type;

	switch (primaryType) {
		case 'string':
			return 'string';
		case 'number':
		case 'integer':
			return 'number';
		case 'boolean':
			return 'boolean';
		case 'array':
			return 'array';
		case 'object':
			return 'object';
		default:
			return 'string';
	}
}

function convertJsonSchemaToResourceMapperFields(
	schema: JSONSchema7,
	requiredFields: string[] = [],
): ResourceMapperField[] {
	const fields: ResourceMapperField[] = [];

	if (schema.type !== 'object' || !schema.properties) {
		return fields;
	}

	for (const [key, value] of Object.entries(schema.properties)) {
		if (typeof value === 'boolean') continue;

		const propertySchema = value as JSONSchema7;
		const displayName = propertySchema.description ? `${key} - ${propertySchema.description}` : key;

		const fieldType = jsonSchemaTypeToFieldType(propertySchema.type || 'string');

		const field: ResourceMapperField = {
			id: key,
			displayName,
			type: fieldType,
			required: requiredFields.includes(key),
			defaultMatch: false,
			canBeUsedToMatch: false,
			display: true,
		};

		// Set default value for object and array types
		if (fieldType === 'object') {
			field.defaultValue = '{}';
		} else if (fieldType === 'array') {
			field.defaultValue = '[]';
		}

		if (
			propertySchema.enum &&
			Array.isArray(propertySchema.enum) &&
			propertySchema.enum.length > 0
		) {
			field.type = 'options';
			field.options = propertySchema.enum.map((value) => ({
				name: String(value),
				value,
			})) as INodePropertyOptions[];
		}

		fields.push(field);
	}

	return fields;
}

export async function getToolParameters(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const toolId = this.getNodeParameter('tool.value') as string;

	// Return empty fields if no tool is selected yet
	if (!toolId) {
		return { fields: [] };
	}

	const authentication = this.getNodeParameter('authentication') as McpAuthenticationOption;
	const node = this.getNode();
	const { headers, endpointUrl } = await getAuthHeadersAndEndpoint(this, authentication);

	if (!endpointUrl) {
		return { fields: [] };
	}

	const client = await connectMcpClient({
		endpointUrl,
		headers,
		name: node.type,
		version: node.typeVersion,
	});

	// Return empty fields if connection fails (e.g., auth error, network error)
	if (!client.ok) {
		return { fields: [] };
	}

	try {
		const tools = await getAllTools(client.result);
		const tool = tools.find((t): t is McpTool => t.name === toolId);

		// Return empty fields if tool not found
		if (!tool) {
			return { fields: [] };
		}

		const schema = tool.inputSchema as JSONSchema7;
		const requiredFields = Array.isArray(schema.required) ? schema.required : [];

		const fields = convertJsonSchemaToResourceMapperFields(schema, requiredFields);

		return { fields };
	} finally {
		await client.result.close();
	}
}
