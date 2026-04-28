import type { ILoadOptionsFunctions, ResourceMapperFields } from 'n8n-workflow';

import { TOOL_CATALOG } from './toolCatalog';

export async function getToolParameters(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const toolId = this.getNodeParameter('tool.value') as string;

	const tool = TOOL_CATALOG[toolId];
	if (!tool) {
		return { fields: [] };
	}

	return { fields: tool.fields };
}
