import { TxnForm } from "../../src/components/TxnForm";

export default function NewPurchaseReturnScreen() {
  return (
    <TxnForm
      title="Purchase Return"
      refLabel="Return No."
      partyLabel="Supplier *"
    />
  );
}
