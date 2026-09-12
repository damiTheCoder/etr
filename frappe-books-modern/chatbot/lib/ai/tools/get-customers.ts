import { tool } from "ai";
import { z } from "zod";

const getCustomersSchema = z.object({
  limit: z.number().optional().describe("Number of customers to retrieve. Defaults to 10."),
  search: z.string().optional().describe("Search term to filter customers by name."),
});

export const getCustomers = tool({
  description: "Get a list of customers from the entri backend.",
  inputSchema: getCustomersSchema,
  execute: async ({ limit = 10, search }) => {
    try {
      const url = new URL("http://localhost:8000/api/Party");
      url.searchParams.set("party_type", "Customer");
      url.searchParams.set("limit", limit.toString());
      
      if (search) {
        url.searchParams.set("search", search);
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return { error: `Failed to fetch customers: ${response.statusText}` };
      }

      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
