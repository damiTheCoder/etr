import { tool } from "ai";
import { z } from "zod";

const getDashboardMetricsSchema = z.object({
  period: z.string().optional().describe("Time period for metrics, e.g., 'monthly', 'yearly', 'today'. Defaults to 'monthly'."),
});

export const getDashboardMetrics = tool({
  description: "Get dashboard metrics like profit and loss or key financial indicators.",
  inputSchema: getDashboardMetricsSchema,
  execute: async ({ period = "monthly" }) => {
    try {
      const url = new URL("http://localhost:8000/api/reports/profit-and-loss");
      url.searchParams.set("period", period);
      
      const response = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return { error: `Failed to fetch dashboard metrics: ${response.statusText}` };
      }

      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  },
});
