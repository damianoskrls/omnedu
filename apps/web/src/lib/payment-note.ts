export const PAY_METHODS = [
  { id: 'cash', label: 'Μετρητά' },
  { id: 'bank', label: 'Τραπεζική κατάθεση' },
  { id: 'card', label: 'Κάρτα' },
  { id: 'iris', label: 'IRIS' },
  { id: 'other', label: 'Άλλο' },
] as const;

export type PaymentInfo = {
  paidAmount: number;
  paidAt: string;
  payerName: string;
  addresseeName: string;
  method: string;
  sendReceipt: boolean;
  receiptAmount: number;
};

export function methodLabel(method: string) {
  return PAY_METHODS.find(item => item.id === method)?.label ?? method;
}

export function paymentNote(info: PaymentInfo, previous?: string | null) {
  const [year, month, day] = info.paidAt.split('-');
  const date = day && month && year ? `${day}/${month}/${year}` : info.paidAt;
  const line = `Πληρωμή ${date} · ${methodLabel(info.method)} · ${info.payerName} · ${info.paidAmount.toFixed(2)}€`;
  const prev = (previous ?? '')
    .split('\n')
    .map(row => row.trim())
    .filter(row => row && !row.startsWith('Πληρωμή '))
    .join('\n');
  return prev ? `${line}\n${prev}` : line;
}
