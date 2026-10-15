import { TxnList } from "../../src/components/TxnList";

export default function SaleReturnListScreen() {
  return (
    <TxnList
      title="Sale Return"
      txnType="credit_note"
      dateRange
      emptyMessage={"No sale returns yet.\nTap below to create one."}
      fabLabel="Add Sale Return"
      fabRoute="/sale-return/new"
      editRoute="/sale-return/new"
    />
  );
}
