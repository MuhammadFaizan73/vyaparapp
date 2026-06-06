import { TxnList } from "../../src/components/TxnList";

export default function DebitNoteListScreen() {
  return (
    <TxnList
      title="Debit Note"
      txnType="debit_note"
      dateRange
      emptyMessage={"No debit notes yet.\nTap below to create one."}
      fabLabel="Add Debit Note"
      fabRoute="/debit-note/new"
    />
  );
}
