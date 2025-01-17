"use server";

import { getUserIdElseThrow } from "@/actions/auth";
import {
  TotalExpensePerCategory,
  TransactionPercentagePerType,
} from "@/data/get-dashboard-data/types";
import { db } from "@/lib/prisma";
import { TransactionType } from "@prisma/client";

export async function getDashBoardData(month: string) {
  const userId = await getUserIdElseThrow();
  const where = {
    userId,
    date: {
      gte: new Date(`2024-${month}-01`),
      lte: new Date(`2024-${month}-31`),
    },
  };

  const depositsTotal =
    (
      await db.transaction.aggregate({
        where: { ...where, type: "DEPOSIT" },
        _sum: { amountInCents: true },
      })
    )?._sum?.amountInCents || 0;

  const investmentsTotal =
    (
      await db.transaction.aggregate({
        where: { ...where, type: "INVESTMENT" },
        _sum: { amountInCents: true },
      })
    )?._sum?.amountInCents || 0;

  const expensesTotal =
    (
      await db.transaction.aggregate({
        where: { ...where, type: "EXPENSE" },
        _sum: { amountInCents: true },
      })
    )?._sum?.amountInCents || 0;

  const balance = depositsTotal - investmentsTotal - expensesTotal;

  const transactionsTotal =
    (
      await db.transaction.aggregate({
        where,
        _sum: { amountInCents: true },
      })
    )?._sum?.amountInCents || 0;

  const typesPercentages: TransactionPercentagePerType = {
    [TransactionType.DEPOSIT]: Math.round(
      (depositsTotal / transactionsTotal) * 100,
    ),
    [TransactionType.EXPENSE]: Math.round(
      (expensesTotal / transactionsTotal) * 100,
    ),
    [TransactionType.INVESTMENT]: Math.round(
      (investmentsTotal / transactionsTotal) * 100,
    ),
  };

  const totalExpensePerCategory: TotalExpensePerCategory[] = (
    await db.transaction.groupBy({
      by: ["category"],
      where: {
        ...where,
        type: TransactionType.EXPENSE,
      },
      _sum: { amountInCents: true },
    })
  ).map((category) => {
    const totalAmountPerCategory = category._sum?.amountInCents || 0;
    const data = {
      category: category.category,
      totalAmount: totalAmountPerCategory,
      percentageOfTotal: Math.round(
        (totalAmountPerCategory / expensesTotal) * 100,
      ),
    };
    return data;
  });

  const lastTransactions = await db.transaction.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return {
    balance,
    depositsTotal,
    investmentsTotal,
    expensesTotal,
    typesPercentages,
    totalExpensePerCategory,
    lastTransactions,
  };
}
