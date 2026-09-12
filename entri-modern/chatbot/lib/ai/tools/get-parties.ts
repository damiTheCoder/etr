import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  party_type: z.enum(["Customer", "Supplier"]).optional(),
  search: z.string().optional(),
  limit: z.number().optional().default(10),
});

export const getParties = tool({
  description: "Get list of parties (customers & suppliers) from entri backend.",
  inputSchema: schema,
  execute: async ({ party_type, search, limit }) => {
    try {
      const query = new URLSearchParams();
      if (party_type) query.append("partyType", party_type);
      if (search) query.append("search", search);
      if (limit) query.append("limit", limit.toString());

      const response = await fetch(`http://localhost:8000/api/Party?${query.toString()}`);
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
