import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  item_code: z.string().describe("Item code / title"),
  item_name: z.string().optional().default(""),
  rate: z.number().optional().default(0),
  category: z.string().optional().default("General"),
});

export const createItem = tool({
  description: "Create a new item in entri inventory master list.",
  inputSchema: schema,
  execute: async ({ item_code, item_name, rate, category }) => {
    try {
      const response = await fetch("http://localhost:8000/api/Item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            name: item_code,
            rate,
            incomeAccount: "Sales",
            expenseAccount: "Cost of Goods Sold",
            category,
          },
        }),
      });
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
