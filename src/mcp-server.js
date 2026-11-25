// The field-service MCP server. Both agent modes talk to this exact server over real MCP (JSON-RPC);
// the only difference between the modes is how the model reaches these tools.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { store } from './data.js';

const json = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const fail = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

export function createMcpServer() {
  const server = new McpServer({ name: 'field-service', version: '1.0.0' });

  server.registerTool(
    'list_work_orders',
    {
      description:
        'List field-service work orders, sorted by due date (oldest first). ' +
        'Returns { total, offset, work_orders: WorkOrder[] }. Each WorkOrder has: id, title, description, region, depot_id, ' +
        'customer, site_address, site_contact, asset_id, asset_model, priority (low|medium|high|critical), ' +
        'status (open|in_progress|closed), assigned_tech, due_date, created_at, required_parts [{ sku, part_name, qty }], ' +
        'notes, is_overdue, days_overdue.',
      inputSchema: {
        region: z.string().optional().describe('North, South, East, West or Central'),
        status: z.enum(['open', 'in_progress', 'closed']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        overdue_only: z.boolean().optional().describe('Only work orders past their due date and not closed'),
        limit: z.number().int().min(1).max(100).optional().describe('Page size, default 50, max 100'),
        offset: z.number().int().min(0).optional().describe('For paging, default 0'),
      },
    },
    async (args) => json(await store.listWorkOrders(args)),
  );

  server.registerTool(
    'get_work_order',
    {
      description: 'Get one work order by id (for example "WO-1042"). Returns a WorkOrder (same shape as in list_work_orders).',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const wo = await store.getWorkOrder(id);
      return wo ? json(wo) : fail(`Work order ${id} not found`);
    },
  );

  server.registerTool(
    'get_part_stock',
    {
      description:
        'Get stock for one part SKU at one depot. Returns { depot_id, sku, part_name, qty_on_hand, reorder_level, bin_location, last_counted }.',
      inputSchema: {
        sku: z.string().describe('Part SKU, for example "PRT-1004"'),
        depot_id: z.string().describe('Depot id, for example "D-NORTH"'),
      },
    },
    async ({ sku, depot_id }) => {
      const row = await store.getPartStock(sku, depot_id);
      return row ? json(row) : fail(`No stock record for ${sku} at ${depot_id}`);
    },
  );

  server.registerTool(
    'list_depots',
    {
      description: 'List service depots. Returns Depot[] with id, name, region, address.',
      inputSchema: {},
    },
    async () => json(await store.listDepots()),
  );

  return server;
}

/** Start the MCP server and connect an MCP client to it over an in-memory transport. */
export async function connectMcp() {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'token-lens-agent', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const { tools } = await client.listTools();
  return {
    client,
    tools,
    /** Call a tool; returns { text, isError } where text is the raw tool output. */
    async call(name, args = {}) {
      const res = await client.callTool({ name, arguments: args });
      const text = (res.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('');
      return { text, isError: !!res.isError };
    },
    async close() {
      await client.close();
      await server.close();
    },
  };
}
