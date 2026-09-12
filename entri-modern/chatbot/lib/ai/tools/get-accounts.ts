import { tool } from "ai";
import { z } from "zod";

export const getAccounts = tool({
  description: "Get Chart of Accounts tree from entri backend.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const response = await fetch("http://localhost:8000/api/accounts/tree");
      if (!response.ok) return { error: `Failed: ${response.statusText}` };
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
