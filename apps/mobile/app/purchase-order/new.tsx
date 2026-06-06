import { TxnForm } from "../../src/components/TxnForm";

export default function NewPurchaseOrderScreen() {
  return (
    <TxnForm
      title="Purchase Order"
      refLabel="Order No."
      partyLabel="Supplier *"
    />
  );
}
