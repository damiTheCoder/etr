import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  page_route: z.string().describe("Target route e.g. /sales-invoices, /purchase-invoices, /payments, /journal-entries, /reports/profit-and-loss, /parties/new"),
  description: z.string().optional().describe("Navigation reason"),
});

export const navigateToPage = tool({
  description: "Navigate the user UI directly to a specific page or route.",
  inputSchema: schema,
  execute: async ({ page_route, description = "" }) => {
    try {
      if (typeof window !== "undefined" && window.parent) {
        window.parent.postMessage({ type: "NAVIGATE_PAGE", route: page_route }, "*");
      }
      return { success: true, action: "navigate", route: page_route, description };
    } catch (error: any) {
      return { action: "navigate", route: page_route, description };
    }
  },
});
