import { TxnList } from "../../src/components/TxnList";

export default function PurchaseReturnListScreen() {
  return (
    <TxnList
      title="Purchase Return"
      txnType="debit_note"
      dateRange
      emptyMessage={"No purchase returns yet.\nTap below to record a return."}
      fabLabel="Add Purchase Return"
      fabRoute="/purchase-return/new"
    />
  );
}
