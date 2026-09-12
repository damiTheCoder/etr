import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  aging_type: z.enum(["ar", "ap"]).optional().default("ar").describe("ar for Accounts Receivable, ap for Accounts Payable"),
});

export const getAgingReport = tool({
  description: "Get AR or AP Aging report from entri backend.",
  inputSchema: schema,
  execute: async ({ aging_type = "ar" }) => {
    try {
      const endpoint = aging_type === "ap" ? "ap-aging" : "ar-aging";
      const response = await fetch(`http://localhost:8000/api/reports/${endpoint}`);
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
