import type { SalesReturn, Transaction } from '../types';

export interface BillItemReturnStatus {
  itemIndex: number;
  productId: string;
  name: string;
  unit: string;
  sellingPrice: number;
  mrp: number;
  purchasedQty: number;
  returnedQty: number;
  remainingQty: number;
  isFullyReturned: boolean;
  isPartiallyReturned: boolean;
}

export interface BillReturnSummary {
  totalPurchasedQty: number;
  totalReturnedQty: number;
  totalRemainingQty: number;
  returnedItemCount: number;
  totalItemCount: number;
  isFullyReturned: boolean;
  isPartiallyReturned: boolean;
  totalRefundedAmount: number;
  billReturns: SalesReturn[];
}

export function roundQty(val: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 1000) / 1000;
}

function normName(name?: string): string {
  return String(name || '').trim().toLowerCase();
}

/**
 * Computes line-by-line return accounting for a given bill against all recorded returns.
 * Supports both new index-tagged returns (`itemIndex`) and legacy product/name-only returns,
 * enabling accurate partial ("part-by-part") returns while blocking duplicate over-returns.
 */
export function getBillItemsReturnStatus(
  bill: Pick<Transaction, 'id' | 'items'> | null | undefined,
  allReturns: SalesReturn[]
): BillItemReturnStatus[] {
  if (!bill || !Array.isArray(bill.items)) return [];

  const statuses: BillItemReturnStatus[] = bill.items.map((it: any, idx: number) => {
    const sp = Number(it.sellingPrice ?? it.price ?? 0);
    const mrp = Number(it.mrp ?? sp);
    const purchasedQty = roundQty(Math.max(0, Number(it.qty ?? 0)));
    return {
      itemIndex: idx,
      productId: String(it.productId || it.id || '').trim(),
      name: String(it.name || it.productName || 'Product').trim(),
      unit: String(it.unit || ''),
      sellingPrice: sp,
      mrp,
      purchasedQty,
      returnedQty: 0,
      remainingQty: purchasedQty,
      isFullyReturned: purchasedQty <= 0,
      isPartiallyReturned: false,
    };
  });

  const billReturns = (Array.isArray(allReturns) ? allReturns : []).filter(
    (ret) => String(ret.originalBillId || '') === String(bill.id || '')
  );

  // Pass 1: apply explicitly indexed return items first for exact line attribution.
  const unindexedItems: Array<{ productId: string; productName: string; qty: number }> = [];

  for (const ret of billReturns) {
    const retItems = Array.isArray(ret.items) ? ret.items : [];
    for (const rItem of retItems) {
      const rQty = roundQty(Math.max(0, Number(rItem.qty || 0)));
      if (rQty <= 0) continue;

      const idx = typeof rItem.itemIndex === 'number' ? rItem.itemIndex : -1;
      const target = idx >= 0 && idx < statuses.length ? statuses[idx] : null;
      const rPid = String(rItem.productId || '').trim();
      const rName = normName(rItem.productName);

      const matchesIndexedTarget =
        target &&
        ((rPid && target.productId && target.productId === rPid) ||
          (rName && normName(target.name) === rName) ||
          (!rPid && !rName));

      if (target && matchesIndexedTarget) {
        target.returnedQty = roundQty(target.returnedQty + rQty);
      } else {
        unindexedItems.push({
          productId: rPid,
          productName: String(rItem.productName || ''),
          qty: rQty,
        });
      }
    }
  }

  // Pass 2: attribute legacy unindexed return items by productId or normalized name.
  for (const rItem of unindexedItems) {
    let remainingToAssign = rItem.qty;
    const rPid = rItem.productId;
    const rName = normName(rItem.productName);

    const candidateIndices: number[] = [];
    statuses.forEach((st, i) => {
      const idMatch = rPid && st.productId && st.productId === rPid;
      const nameMatch = rName && normName(st.name) === rName;
      if (idMatch || nameMatch) {
        candidateIndices.push(i);
      }
    });

    for (const cIdx of candidateIndices) {
      if (remainingToAssign <= 0) break;
      const st = statuses[cIdx];
      const capacity = roundQty(Math.max(0, st.purchasedQty - st.returnedQty));
      if (capacity > 0) {
        const take = roundQty(Math.min(capacity, remainingToAssign));
        st.returnedQty = roundQty(st.returnedQty + take);
        remainingToAssign = roundQty(remainingToAssign - take);
      }
    }

    // If legacy pre-fix data had over-returns, record excess on the first matching line so it stays locked.
    if (remainingToAssign > 0 && candidateIndices.length > 0) {
      const first = statuses[candidateIndices[0]];
      first.returnedQty = roundQty(first.returnedQty + remainingToAssign);
    }
  }

  // Finalize remaining & status flags
  for (const st of statuses) {
    st.remainingQty = roundQty(Math.max(0, st.purchasedQty - st.returnedQty));
    st.isFullyReturned = st.purchasedQty > 0 ? st.remainingQty <= 0.0001 : true;
    st.isPartiallyReturned = st.returnedQty > 0.0001 && !st.isFullyReturned;
  }

  return statuses;
}

/**
 * Summarizes overall return status across all line items in a bill.
 */
export function getBillReturnSummary(
  bill: Pick<Transaction, 'id' | 'items'> | null | undefined,
  allReturns: SalesReturn[]
): BillReturnSummary {
  const billReturns = (Array.isArray(allReturns) ? allReturns : []).filter(
    (ret) => String(ret.originalBillId || '') === String(bill?.id || '')
  );
  const itemStatuses = getBillItemsReturnStatus(bill, billReturns);

  const totalPurchasedQty = roundQty(itemStatuses.reduce((sum, s) => sum + s.purchasedQty, 0));
  const totalReturnedQty = roundQty(itemStatuses.reduce((sum, s) => sum + Math.min(s.returnedQty, s.purchasedQty), 0));
  const totalRemainingQty = roundQty(itemStatuses.reduce((sum, s) => sum + s.remainingQty, 0));
  const returnedItemCount = itemStatuses.filter((s) => s.returnedQty > 0.0001).length;
  const totalItemCount = itemStatuses.length;

  const isFullyReturned = totalItemCount > 0 && totalPurchasedQty > 0 && totalRemainingQty <= 0.0001;
  const isPartiallyReturned =
    !isFullyReturned &&
    (billReturns.length > 0 && (totalReturnedQty > 0.0001 || returnedItemCount > 0));

  const totalRefundedAmount = roundQty(
    billReturns.reduce((sum, ret) => sum + Number(ret.totalRefund || 0), 0)
  );

  return {
    totalPurchasedQty,
    totalReturnedQty,
    totalRemainingQty,
    returnedItemCount,
    totalItemCount,
    isFullyReturned,
    isPartiallyReturned,
    totalRefundedAmount,
    billReturns,
  };
}
