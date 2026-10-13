import { Pipe, PipeTransform } from '@angular/core';
import { PaymentMethod, paymentMethodLabel } from '../../core/models/payment-method';

@Pipe({ name: 'paymentMethodLabel' })
export class PaymentMethodLabelPipe implements PipeTransform {
  transform(value: PaymentMethod | null | undefined): string {
    return paymentMethodLabel(value);
  }
}
