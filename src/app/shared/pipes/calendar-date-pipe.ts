import { Pipe, PipeTransform } from '@angular/core';
import { formatDate, formatDayShort, formatMonth } from '../utils/dates';

@Pipe({ name: 'calendarDate' })
export class CalendarDatePipe implements PipeTransform {
  transform(value: string | null | undefined, style: 'medium' | 'short' | 'month' = 'medium'): string {
    if (!value) {
      return '';
    }

    switch (style) {
      case 'short':
        return formatDayShort(value);
      case 'month':
        return formatMonth(value.slice(0, 7));
      default:
        return formatDate(value);
    }
  }
}
