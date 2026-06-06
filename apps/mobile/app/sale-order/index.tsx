import { TxnList } from "../../src/components/TxnList";

export default function SaleOrderListScreen() {
  return (
    <TxnList
      title="Sale Order"
      txnType="sale_order"
      chips={["All", "Open", "Closed"]}
      emptyMessage={"No sale orders yet.\nTap below to create your first order."}
      fabLabel="Add Sale Order"
      fabRoute="/sale-order/new"
    />
  );
}
