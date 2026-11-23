# n8n-nodes-forest

This is an n8n community node for integrating with Forest.

## Installation

### In n8n Desktop or Self-hosted

1. Go to **Settings > Community Nodes**
2. Select **Install**
3. Enter `@forestnpm/n8n-nodes-forest` in the input field
4. Click **Install**

### Manual Installation

```bash
pnpm install @forestnpm/n8n-nodes-forest
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
3. In your n8n installation directory: `pnpm link --global @forestnpm/n8n-nodes-forest`
4. Restart n8n

## Credentials

The node calls your Forest MCP server and supports two credential types (see the [Forest MCP server documentation](https://docs.forest.app/product/embed/mcp-server)):
- **Forest MCP API**: your Forest server URL (without the `/mcp` suffix) and a bearer token
- **Forest MCP OAuth2 API**: your Forest server URL, with OAuth2 (optionally through Dynamic Client Registration)

## Usage

For details on filters and aggregations syntax, see the [Forest filters documentation](https://docs.forest.app/reference/agent-api/nodejs#conditiontree-utilities).

## Resources

- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Forest Documentation](https://docs.forest.app/)

## License

MIT
