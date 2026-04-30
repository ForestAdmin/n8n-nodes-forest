import type { ILoadOptionsFunctions, ResourceMapperFields } from 'n8n-workflow';

import { findTool } from './toolCatalog';

export async function getToolParameters(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const resource = this.getNodeParameter('resource') as string;
	const operation = this.getNodeParameter('operation') as string;

	const tool = findTool(resource, operation);
	if (!tool) {
		return { fields: [] };
	}

	return { fields: tool.fields };
}
