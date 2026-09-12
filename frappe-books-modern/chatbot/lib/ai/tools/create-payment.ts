import { tool } from "ai";
import { z } from "zod";

const schema = z.object({
  party: z.string().describe("Customer or supplier name"),
  amount: z.number().describe("Payment amount"),
  payment_type: z.enum(["Receive", "Pay"]).optional().default("Receive"),
  reference: z.string().optional().describe("Invoice or reference number"),
});

export const createPayment = tool({
  description: "Record a payment entry (Receive money or Pay money) in entri backend.",
  inputSchema: schema,
  execute: async ({ party, amount, payment_type = "Receive", reference = "" }) => {
    try {
      const response = await fetch("http://localhost:8000/api/Payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            party,
            amount,
            paymentType: payment_type,
            referenceNo: reference,
            account: "Cash",
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
