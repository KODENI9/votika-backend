import {
  listTransactions,
  getTotalRevenue,
} from "../models/transaction.model";
import type { Transaction, TransactionStatus } from "../models/transaction.model";
import type { ListTransactionsQuery } from "../schemas/vote.schema";

/**
 * Transaction service — read-oriented queries for admin and reporting.
 */

export async function listTransactionsForAdmin(
  query: ListTransactionsQuery
): Promise<Transaction[]> {
  const limit = query.limit ?? 20;
  const offset = ((query.page ?? 1) - 1) * limit;

  return listTransactions({
    status: query.status as TransactionStatus | undefined,
    limit,
    offset,
  });
}

export async function getDashboardRevenue(): Promise<number> {
  return getTotalRevenue();
}
