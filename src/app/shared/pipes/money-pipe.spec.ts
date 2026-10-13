import { formatMoney } from '../utils/money';
import { MoneyPipe } from './money-pipe';

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('delegates to formatMoney in either style', () => {
    expect(pipe.transform(1234.5, 'USD')).toBe(formatMoney(1234.5, 'USD'));
    expect(pipe.transform(1234.5, 'USD', 'compact')).toBe(formatMoney(1234.5, 'USD', 'compact'));
  });

  it('shows a dash for a missing amount', () => {
    expect(pipe.transform(null, 'USD')).toBe('—');
  });
});
