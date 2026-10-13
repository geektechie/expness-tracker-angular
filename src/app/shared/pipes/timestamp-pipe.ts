import { Pipe, PipeTransform } from '@angular/core';
import { formatTimestamp } from '../utils/dates';

@Pipe({ name: 'timestamp' })
export class TimestampPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? formatTimestamp(value) : '';
  }
}
