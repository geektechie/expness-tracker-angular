import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney } from '../utils/money';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(
    value: number | null | undefined,
    currency: string,
    style: 'standard' | 'compact' = 'standard',
  ): string {
    return formatMoney(value, currency, style);
  }
}
