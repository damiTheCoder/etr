import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  remark: z.string().optional().describe("Description for the journal voucher"),
  entries: z.array(
    z.object({
      account: z.string().describe("Account name"),
      debit: z.number().optional().default(0),
      credit: z.number().optional().default(0),
    })
  ).describe("Debit and Credit accounts"),
});

export const createJournalEntry = tool({
  description: "Post a new journal entry voucher in entri backend.",
  inputSchema: schema,
  execute: async ({ remark, entries }) => {
    try {
      const response = await fetch("http://localhost:8000/api/JournalEntry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            userRemark: remark || "Journal Entry",
            accounts: entries.map((e) => ({
              account: e.account,
              debit: Number(e.debit || 0),
              credit: Number(e.credit || 0),
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
