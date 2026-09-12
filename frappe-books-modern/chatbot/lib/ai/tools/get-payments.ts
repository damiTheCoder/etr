import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  party: z.string().optional().describe("Filter by customer/supplier name"),
  limit: z.number().optional().default(10),
});

export const getPayments = tool({
  description: "Get payment entries from entri backend.",
  inputSchema: schema,
  execute: async ({ party, limit }) => {
    try {
      const query = new URLSearchParams();
      if (party) query.append("party", party);
      if (limit) query.append("limit", limit.toString());

      const response = await fetch(`http://localhost:8000/api/PaymentEntry?${query.toString()}`);
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
