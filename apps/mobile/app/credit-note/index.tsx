import { TxnList } from "../../src/components/TxnList";

export default function CreditNoteListScreen() {
  return (
    <TxnList
      title="Credit Note"
      txnType="credit_note"
      dateRange
      emptyMessage={"No credit notes yet.\nTap below to create one."}
      fabLabel="Add Credit Note"
      fabRoute="/credit-note/new"
    />
  );
}
