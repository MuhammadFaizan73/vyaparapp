import { TxnList } from "../../src/components/TxnList";

export default function PaymentOutListScreen() {
  return (
    <TxnList
      title="Payment-Out"
      txnType="payment_out"
      dateRange
      emptyMessage={"No outgoing payments yet.\nTap below to record a payment."}
      fabLabel="Add Payment-Out"
      fabRoute="/payment-out/new"
    />
  );
}
