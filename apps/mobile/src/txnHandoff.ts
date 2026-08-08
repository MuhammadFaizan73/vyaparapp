import type { Transaction } from "@vyapar/api-client";

export type TxnWithParty = Transaction & { partyName: string };

// Home's transaction list already holds the full Transaction object (joined with its
// party name) in memory — stashing it here for the View/Edit screens to pick up avoids a
// redundant re-fetch (there's no GET /transactions/:id endpoint) and avoids cramming a
// whole object through a route param. Screens that can also be deep-linked into (not just
// navigated from Home) must fall back to scanning getAllTransactions() by id when empty.
let handoff: TxnWithParty | null = null;

export function setHandoffTxn(txn: TxnWithParty) {
  handoff = txn;
}

export function takeHandoffTxn(id: string): TxnWithParty | null {
  if (handoff?.id !== id) return null;
  const txn = handoff;
  handoff = null;
  return txn;
}
