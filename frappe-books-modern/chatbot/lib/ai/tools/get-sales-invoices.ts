import { tool } from "ai";
import { z } from "zod";

const getSalesInvoicesSchema = z.object({
  limit: z.number().optional().describe("Number of invoices to retrieve. Defaults to 10."),
  customer: z.string().optional().describe("Filter by customer name."),
});

export const getSalesInvoices = tool({
  description: "Get sales invoices from the entri backend. You can filter by customer or get the latest invoices.",
  inputSchema: getSalesInvoicesSchema,
  execute: async ({ limit = 10, customer }) => {
    try {
      const url = new URL("http://localhost:8000/api/Sales Invoice");
      url.searchParams.set("limit", limit.toString());
      if (customer) {
        url.searchParams.set("customer", customer);
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return { error: `Failed to fetch sales invoices: ${response.statusText}` };
      }

      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
