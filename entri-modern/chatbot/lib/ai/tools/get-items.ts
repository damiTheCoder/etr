import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  search: z.string().optional(),
  limit: z.number().optional().default(10),
});

export const getItems = tool({
  description: "Get inventory and service items from entri backend.",
  inputSchema: schema,
  execute: async ({ search, limit }) => {
    try {
      const query = new URLSearchParams();
      if (search) query.append("search", search);
      if (limit) query.append("limit", limit.toString());

      const response = await fetch(`http://localhost:8000/api/Item?${query.toString()}`);
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
