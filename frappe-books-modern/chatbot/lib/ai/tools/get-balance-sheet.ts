import { tool } from "ai";
import { z } from "zod";

export const getBalanceSheet = tool({
  description: "Get Balance Sheet statement (Assets, Liabilities, Equity) from entri backend.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const response = await fetch("http://localhost:8000/api/reports/balance-sheet");
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
