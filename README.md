# n8n-nodes-forest

This is an n8n community node for integrating with Forest.

## Installation

### In n8n Desktop or Self-hosted

1. Go to **Settings > Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-forest` in the input field
4. Click **Install**

### Manual Installation

```bash
pnpm install n8n-nodes-forest
```

## Development

### Prerequisites

- Node.js >= 18.10
- pnpm >= 9.1

### Setup

```bash
# Use Node.js 20
nvm use 20

# Install n8n
npm install -g n8n

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run in development mode (watch)
pnpm dev

# Run n8n
n8n
```

### Testing in n8n

1. Build the package: `pnpm build`
2. Link the package globally: `pnpm link --global`
3. In your n8n installation directory: `pnpm link --global n8n-nodes-forest`
4. Restart n8n

## Credentials

This node requires Forest API credentials:
- **API Key**: Your Forest API key
- **Base URL**: The Forest API base URL (default: https://api.forestadmin.com)

## Usage

### List Tool Parameters

When using the `list` tool on a collection, the following parameters are available:

#### Pagination

Control the number of results returned:

```json
{
  "size": 10,
  "number": 1
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `size` | number | 15 | Number of items per page |
| `number` | number | 1 | Page number (1-based) |

#### Sort

Sort the results by a field:

```json
{
  "field": "createdAt",
  "ascending": false
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `field` | string | Field name to sort by |
| `ascending` | boolean | `true` for ascending, `false` for descending |

#### Filters

Filter results using conditions:

```json
{
  "field": "paymentMethod",
  "operator": "NotEqual",
  "value": "stripe"
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `field` | string | Field name to filter on |
| `operator` | string | Comparison operator (see below) |
| `value` | any | Value to compare against (optional for some operators) |

**Available operators:**

| Operator | Description |
|----------|-------------|
| `Equal` | Equals value |
| `NotEqual` | Not equals value |
| `In` | Value in array |
| `NotIn` | Value not in array |
| `Contains` | String contains (case-sensitive) |
| `IContains` | String contains (case-insensitive) |
| `StartsWith` / `EndsWith` | String prefix/suffix match |
| `LessThan` / `GreaterThan` | Numeric comparison |
| `LessThanOrEqual` / `GreaterThanOrEqual` | Numeric comparison |
| `Before` / `After` | Date comparison |
| `Blank` / `Present` | Null checks |

**Combining multiple filters (AND/OR):**

```json
{
  "aggregator": "And",
  "conditions": [
    { "field": "paymentMethod", "operator": "NotEqual", "value": "stripe" },
    { "field": "status", "operator": "Equal", "value": "active" }
  ]
}
```

#### Example: List with pagination, sort, and filters

Using JSON input mode:

```json
{
  "collectionName": "billing",
  "filters": {
    "field": "paymentMethod",
    "operator": "NotEqual",
    "value": "stripe"
  },
  "pagination": {
    "size": 5
  },
  "sort": {
    "field": "createdAt",
    "ascending": false
  }
}
```

## Resources

- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Forest Documentation](https://docs.forestadmin.com/)

## License

MIT
