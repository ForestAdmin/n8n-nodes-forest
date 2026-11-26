# n8n-nodes-forest

An n8n community node that lists, creates, updates and deletes Forest records, works on relations, and runs custom actions through your Forest MCP server.

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

The node calls your Forest [MCP server](https://docs.forest.app/product/embed/mcp-server) and supports two credential types. Both ask for your Forest server URL, without the `/mcp` suffix.

- **Forest MCP OAuth2 API** (default): signs in as you, through OAuth2 with optional Dynamic Client Registration. The workflow runs with your own permissions.
- **Forest MCP API** (Bearer Auth): an application token of a Forest service account, which starts with `fgw_`. Use it for workflows that run unattended.

Personal tokens are not accepted by the MCP server. To create an application token, a project admin opens **Project Settings** → **Service accounts**, creates a service account with a role and a team, then selects **Generate application token**. Forest shows the secret only once. The workflow gets the permissions of the account's role.

## Usage

The node has three resources: **Record** (describe a collection, list, create, update, delete), **Relation** (list, associate, dissociate) and **Custom** (retrieve an action form, execute an action). It doesn't trigger workflows on Forest events.

For details on filters and aggregations syntax, see the [Forest filters documentation](https://docs.forest.app/reference/agent-api/nodejs#conditiontree-utilities).

## Resources

- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Forest Documentation](https://docs.forest.app/)

## License

MIT
