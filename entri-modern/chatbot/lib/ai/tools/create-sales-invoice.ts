import { tool } from "ai";
import { z } from "zod";

const createSalesInvoiceSchema = z.object({
  customer: z.string().describe("Customer name or ID"),
  date: z.string().optional().describe("Invoice date (YYYY-MM-DD)"),
  items: z.array(
    z.object({
      item: z.string().optional().describe("Item name"),
      item_code: z.string().optional().describe("Item code"),
      qty: z.number().optional().default(1),
      quantity: z.number().optional().default(1),
      rate: z.number().describe("Unit price"),
    })
  ).describe("List of items for the invoice"),
});

export const createSalesInvoice = tool({
  description: "Create a new sales invoice in the entri backend.",
  inputSchema: createSalesInvoiceSchema,
  execute: async ({ customer, date, items }) => {
    try {
      const response = await fetch("http://localhost:8000/api/SalesInvoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            party: customer,
            date: date || new Date().toISOString().split("T")[0],
            items: items.map((i) => ({
              item: i.item || i.item_code || "Sales Item",
              quantity: i.quantity || i.qty || 1,
              rate: Number(i.rate || 0),
            })),
          },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        return { error: errJson.detail || errJson.message || `Failed: ${response.statusText}` };
      }

      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
