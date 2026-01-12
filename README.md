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
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run in development mode (watch)
pnpm dev
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

## Resources

- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Forest Documentation](https://docs.forestadmin.com/)

## License

MIT
