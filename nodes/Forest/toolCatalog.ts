import type { ResourceMapperField } from 'n8n-workflow';

export type ResourceKey = 'record' | 'relation' | 'customAction';

export type ToolDefinition = {
	name: string;
	title: string;
	description: string;
	resource: ResourceKey;
	operation: string;
	action: string;
	needsCollection: boolean;
	needsAction: boolean;
	needsRelation: boolean;
	fields: ResourceMapperField[];
};

const objectField = (
	id: string,
	displayName: string,
	required = false,
): ResourceMapperField => ({
	id,
	displayName,
	type: 'object',
	required,
	defaultMatch: false,
	canBeUsedToMatch: false,
	display: true,
	defaultValue: '{}',
});

const arrayField = (
	id: string,
	displayName: string,
	required = false,
): ResourceMapperField => ({
	id,
	displayName,
	type: 'array',
	required,
	defaultMatch: false,
	canBeUsedToMatch: false,
	display: true,
	defaultValue: '[]',
});

const stringField = (
	id: string,
	displayName: string,
	required = false,
): ResourceMapperField => ({
	id,
	displayName,
	type: 'string',
	required,
	defaultMatch: false,
	canBeUsedToMatch: false,
	display: true,
});

const booleanField = (
	id: string,
	displayName: string,
	required = false,
): ResourceMapperField => ({
	id,
	displayName,
	type: 'boolean',
	required,
	defaultMatch: false,
	canBeUsedToMatch: false,
	display: true,
});

const listFields: ResourceMapperField[] = [
	stringField('search', 'search - Free-text search query'),
	objectField(
		'filters',
		'filters - Filters as { field, operator, value } or { aggregator, conditions }',
	),
	objectField('sort', 'sort - { field, ascending }'),
	booleanField('shouldSearchInRelation', 'shouldSearchInRelation - Search in related collections'),
	arrayField('fields', 'fields - Fields to include (use "@@@" for sub fields)'),
	objectField('pagination', 'pagination - { size, number }'),
	booleanField('enableCount', 'enableCount - Also return totalCount'),
];

export const TOOL_CATALOG: Record<string, ToolDefinition> = {
	describeCollection: {
		name: 'describeCollection',
		title: 'Describe a collection',
		description:
			"Discover a collection's schema: fields, types, operators, relations, and available actions. Always call this first before querying or modifying data.",
		resource: 'record',
		operation: 'describe',
		action: 'Describe a collection',
		needsCollection: true,
		needsAction: false,
		needsRelation: false,
		fields: [],
	},
	list: {
		name: 'list',
		title: 'List records',
		description: 'Retrieve a list of records from the specified collection.',
		resource: 'record',
		operation: 'list',
		action: 'List records',
		needsCollection: true,
		needsAction: false,
		needsRelation: false,
		fields: listFields,
	},
	listRelated: {
		name: 'listRelated',
		title: 'List records from a relation',
		description: 'Retrieve a list of records from a one-to-many or many-to-many relation.',
		resource: 'relation',
		operation: 'list',
		action: 'List related records',
		needsCollection: true,
		needsAction: false,
		needsRelation: true,
		fields: [stringField('parentRecordId', 'parentRecordId - ID of the parent record', true), ...listFields],
	},
	create: {
		name: 'create',
		title: 'Create a record',
		description: 'Create a new record in the specified collection.',
		resource: 'record',
		operation: 'create',
		action: 'Create a record',
		needsCollection: true,
		needsAction: false,
		needsRelation: false,
		fields: [objectField('attributes', 'attributes - Field name → value', true)],
	},
	update: {
		name: 'update',
		title: 'Update a record',
		description: 'Update an existing record in the specified collection.',
		resource: 'record',
		operation: 'update',
		action: 'Update a record',
		needsCollection: true,
		needsAction: false,
		needsRelation: false,
		fields: [
			stringField('recordId', 'recordId - ID of the record to update', true),
			objectField('attributes', 'attributes - Field name → value', true),
		],
	},
	delete: {
		name: 'delete',
		title: 'Delete records',
		description: 'Delete one or more records from the specified collection.',
		resource: 'record',
		operation: 'delete',
		action: 'Delete records',
		needsCollection: true,
		needsAction: false,
		needsRelation: false,
		fields: [arrayField('recordIds', 'recordIds - IDs of records to delete', true)],
	},
	associate: {
		name: 'associate',
		title: 'Associate records in a relation',
		description:
			'Link a record to another through a one-to-many or many-to-many relation. For many-to-many relations, this creates a new entry in the join table.',
		resource: 'relation',
		operation: 'associate',
		action: 'Associate records',
		needsCollection: true,
		needsAction: false,
		needsRelation: true,
		fields: [
			stringField('parentRecordId', 'parentRecordId - ID of the parent record', true),
			stringField('targetRecordId', 'targetRecordId - ID of the record to associate', true),
		],
	},
	dissociate: {
		name: 'dissociate',
		title: 'Dissociate records from a relation',
		description:
			'Unlink records from a one-to-many or many-to-many relation. Does not delete the target records.',
		resource: 'relation',
		operation: 'dissociate',
		action: 'Dissociate records',
		needsCollection: true,
		needsAction: false,
		needsRelation: true,
		fields: [
			stringField('parentRecordId', 'parentRecordId - ID of the parent record', true),
			arrayField('targetRecordIds', 'targetRecordIds - IDs of records to dissociate', true),
		],
	},
	getActionForm: {
		name: 'getActionForm',
		title: 'Retrieve action form',
		description:
			'Retrieve and validate the form for a specific action. Must be called before executeAction.',
		resource: 'customAction',
		operation: 'getForm',
		action: 'Retrieve action form',
		needsCollection: true,
		needsAction: true,
		needsRelation: false,
		fields: [
			arrayField('recordIds', 'recordIds - Record IDs (use [] for global actions)', true),
			objectField('values', 'values - Form field values'),
		],
	},
	executeAction: {
		name: 'executeAction',
		title: 'Execute an action',
		description:
			'Execute a specific action on one or more records. Call getActionForm first and ensure canExecute is true.',
		resource: 'customAction',
		operation: 'execute',
		action: 'Execute an action',
		needsCollection: true,
		needsAction: true,
		needsRelation: false,
		fields: [
			arrayField('recordIds', 'recordIds - Record IDs (use [] for global actions)', true),
			objectField('values', 'values - Form field values'),
		],
	},
};

export const TOOL_BY_RESOURCE_OP: Record<string, ToolDefinition> = Object.fromEntries(
	Object.values(TOOL_CATALOG).map((tool) => [`${tool.resource}:${tool.operation}`, tool]),
);

export function findTool(resource: string, operation: string): ToolDefinition | undefined {
	return TOOL_BY_RESOURCE_OP[`${resource}:${operation}`];
}
