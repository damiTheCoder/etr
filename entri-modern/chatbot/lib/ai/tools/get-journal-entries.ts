import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  limit: z.number().optional().default(10),
});

export const getJournalEntries = tool({
  description: "Get list of journal entries from entri backend.",
  inputSchema: schema,
  execute: async ({ limit }) => {
    try {
      const response = await fetch(`http://localhost:8000/api/JournalEntry?limit=${limit}`);
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
