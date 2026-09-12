import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  account: z.string().optional().describe("Account filter"),
  limit: z.number().optional().default(20),
});

export const getGeneralLedger = tool({
  description: "Get General Ledger transactions from entri backend.",
  inputSchema: schema,
  execute: async ({ account, limit }) => {
    try {
      const query = new URLSearchParams();
      if (account) query.append("account", account);
      if (limit) query.append("limit", limit.toString());

      const response = await fetch(`http://localhost:8000/api/reports/general-ledger?${query.toString()}`);
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
