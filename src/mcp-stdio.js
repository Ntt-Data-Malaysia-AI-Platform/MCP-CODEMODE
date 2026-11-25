// Run the same field-service MCP server over stdio, so you can also plug it into
// Gemini CLI, Claude or any other MCP client:  node src/mcp-stdio.js
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp-server.js';

await createMcpServer().connect(new StdioServerTransport());
