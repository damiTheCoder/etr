import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  supplier: z.string().describe("Supplier name"),
  date: z.string().optional().describe("Date YYYY-MM-DD"),
  items: z.array(
    z.object({
      item_code: z.string(),
      qty: z.number(),
      rate: z.number(),
    })
  ).describe("Items ordered"),
});

export const createPurchaseOrder = tool({
  description: "Create a new purchase order to a supplier in entri backend.",
  inputSchema: schema,
  execute: async ({ supplier, date, items }) => {
    try {
      const response = await fetch("http://localhost:8000/api/PurchaseOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            party: supplier,
            date,
            items: items.map((i) => ({
              item: i.item_code,
              quantity: i.qty,
              rate: i.rate,
            })),
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
