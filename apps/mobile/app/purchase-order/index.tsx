import { TxnList } from "../../src/components/TxnList";

export default function PurchaseOrderListScreen() {
  return (
    <TxnList
      title="Purchase Order"
      txnType="purchase_order"
      chips={["All", "Open", "Closed", "Cancelled"]}
      emptyMessage={"No purchase orders yet.\nTap below to create your first order."}
      fabLabel="Add Purchase Order"
      fabRoute="/purchase-order/new"
    />
  );
}
