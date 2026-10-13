import { PaymentMethodLabelPipe } from './payment-method-label-pipe';

describe('PaymentMethodLabelPipe', () => {
  const pipe = new PaymentMethodLabelPipe();

  it('turns a payment method into its label', () => {
    expect(pipe.transform('CreditCard')).toBe('Credit card');
    expect(pipe.transform('Cash')).toBe('Cash');
  });

  it('renders nothing for a missing method', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
