import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  supplier: z.string().optional().describe("Filter by supplier"),
  limit: z.number().optional().default(10),
});

export const getPurchaseOrders = tool({
  description: "Get purchase orders list from entri backend.",
  inputSchema: schema,
  execute: async ({ supplier, limit }) => {
    try {
      const query = new URLSearchParams();
      if (supplier) query.append("supplier", supplier);
      if (limit) query.append("limit", limit.toString());

      const response = await fetch(`http://localhost:8000/api/PurchaseOrder?${query.toString()}`);
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
