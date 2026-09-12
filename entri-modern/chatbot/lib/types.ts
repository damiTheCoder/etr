import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { getSalesInvoices } from "./ai/tools/get-sales-invoices";
import type { createSalesInvoice } from "./ai/tools/create-sales-invoice";
import type { getPurchaseInvoices } from "./ai/tools/get-purchase-invoices";
import type { createPurchaseInvoice } from "./ai/tools/create-purchase-invoice";
import type { getPayments } from "./ai/tools/get-payments";
import type { createPayment } from "./ai/tools/create-payment";
import type { getJournalEntries } from "./ai/tools/get-journal-entries";
import type { createJournalEntry } from "./ai/tools/create-journal-entry";
import type { getPurchaseOrders } from "./ai/tools/get-purchase-orders";
import type { createPurchaseOrder } from "./ai/tools/create-purchase-order";
import type { getParties } from "./ai/tools/get-parties";
import type { createParty } from "./ai/tools/create-party";
import type { getItems } from "./ai/tools/get-items";
import type { createItem } from "./ai/tools/create-item";
import type { getAccounts } from "./ai/tools/get-accounts";
import type { getDashboardMetrics } from "./ai/tools/get-dashboard-metrics";
import type { getCustomers } from "./ai/tools/get-customers";
import type { getProfitAndLoss } from "./ai/tools/get-profit-and-loss";
import type { getBalanceSheet } from "./ai/tools/get-balance-sheet";
import type { getGeneralLedger } from "./ai/tools/get-general-ledger";
import type { getTrialBalance } from "./ai/tools/get-trial-balance";
import type { getAgingReport } from "./ai/tools/get-aging-report";
import type { navigateToPage } from "./ai/tools/navigate-to-page";
import type { Suggestion } from "./db/schema";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type getSalesInvoicesTool = InferUITool<typeof getSalesInvoices>;
type createSalesInvoiceTool = InferUITool<typeof createSalesInvoice>;
type getPurchaseInvoicesTool = InferUITool<typeof getPurchaseInvoices>;
type createPurchaseInvoiceTool = InferUITool<typeof createPurchaseInvoice>;
type getPaymentsTool = InferUITool<typeof getPayments>;
type createPaymentTool = InferUITool<typeof createPayment>;
type getJournalEntriesTool = InferUITool<typeof getJournalEntries>;
type createJournalEntryTool = InferUITool<typeof createJournalEntry>;
type getPurchaseOrdersTool = InferUITool<typeof getPurchaseOrders>;
type createPurchaseOrderTool = InferUITool<typeof createPurchaseOrder>;
type getPartiesTool = InferUITool<typeof getParties>;
type createPartyTool = InferUITool<typeof createParty>;
type getItemsTool = InferUITool<typeof getItems>;
type createItemTool = InferUITool<typeof createItem>;
type getAccountsTool = InferUITool<typeof getAccounts>;
type getDashboardMetricsTool = InferUITool<typeof getDashboardMetrics>;
type getCustomersTool = InferUITool<typeof getCustomers>;
type getProfitAndLossTool = InferUITool<typeof getProfitAndLoss>;
type getBalanceSheetTool = InferUITool<typeof getBalanceSheet>;
type getGeneralLedgerTool = InferUITool<typeof getGeneralLedger>;
type getTrialBalanceTool = InferUITool<typeof getTrialBalance>;
type getAgingReportTool = InferUITool<typeof getAgingReport>;
type navigateToPageTool = InferUITool<typeof navigateToPage>;

export type ChatTools = {
  getSalesInvoices: getSalesInvoicesTool;
  createSalesInvoice: createSalesInvoiceTool;
  getPurchaseInvoices: getPurchaseInvoicesTool;
  createPurchaseInvoice: createPurchaseInvoiceTool;
  getPayments: getPaymentsTool;
  createPayment: createPaymentTool;
  getJournalEntries: getJournalEntriesTool;
  createJournalEntry: createJournalEntryTool;
  getPurchaseOrders: getPurchaseOrdersTool;
  createPurchaseOrder: createPurchaseOrderTool;
  getParties: getPartiesTool;
  createParty: createPartyTool;
  getItems: getItemsTool;
  createItem: createItemTool;
  getAccounts: getAccountsTool;
  getDashboardMetrics: getDashboardMetricsTool;
  getCustomers: getCustomersTool;
  getProfitAndLoss: getProfitAndLossTool;
  getBalanceSheet: getBalanceSheetTool;
  getGeneralLedger: getGeneralLedgerTool;
  getTrialBalance: getTrialBalanceTool;
  getAgingReport: getAgingReportTool;
  navigateToPage: navigateToPageTool;
};

export type WaitingStatusData = {
  phase: "waiting" | "still-waiting" | "health" | "thinking";
  message: string;
  modelId: string;
  modelName: string;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
  "waiting-status": WaitingStatusData;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
