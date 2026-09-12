import { tool } from "ai";
import { z } from "zod";

export const getTrialBalance = tool({
  description: "Get Trial Balance financial statement from entri backend.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const response = await fetch("http://localhost:8000/api/reports/trial-balance");
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
