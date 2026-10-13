export type PaymentMethod =
  | 'Cash'
  | 'DebitCard'
  | 'CreditCard'
  | 'BankTransfer'
  | 'DirectDebit'
  | 'DigitalWallet'
  | 'Other';

export const PAYMENT_METHODS: readonly { value: PaymentMethod; label: string }[] = [
  { value: 'Cash', label: 'Cash' },
  { value: 'DebitCard', label: 'Debit card' },
  { value: 'CreditCard', label: 'Credit card' },
  { value: 'BankTransfer', label: 'Bank transfer' },
  { value: 'DirectDebit', label: 'Direct debit' },
  { value: 'DigitalWallet', label: 'Digital wallet' },
  { value: 'Other', label: 'Other' },
];

export function paymentMethodLabel(value: PaymentMethod | null | undefined): string {
  return PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value ?? '';
}
