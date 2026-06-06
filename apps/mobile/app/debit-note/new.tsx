import { TxnForm } from "../../src/components/TxnForm";

export default function NewDebitNoteScreen() {
  return (
    <TxnForm
      title="Debit Note"
      refLabel="Note No."
      partyLabel="Supplier *"
    />
  );
}
