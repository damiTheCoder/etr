import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  name: z.string().describe("Party name"),
  party_type: z.enum(["Customer", "Supplier"]).optional().default("Customer"),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
});

export const createParty = tool({
  description: "Create a new Customer or Supplier in entri backend.",
  inputSchema: schema,
  execute: async ({ name, party_type = "Customer", email, phone }) => {
    try {
      const response = await fetch("http://localhost:8000/api/Party", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { name, partyType: party_type, email, phone },
        }),
      });
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
