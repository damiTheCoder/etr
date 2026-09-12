import { tool } from "ai";
import { z } from "zod";

export const getProfitAndLoss = tool({
  description: "Get detailed Profit and Loss financial statement from entri backend.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const response = await fetch("http://localhost:8000/api/reports/profit-and-loss");
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
