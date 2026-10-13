import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ApiError } from '../../core/http/api-error';

export function controlErrorMessage(control: AbstractControl | null, fieldLabel: string): string | null {
  if (!control || !control.invalid || !(control.touched || control.dirty)) {
    return null;
  }

  const errors: ValidationErrors = control.errors ?? {};

  if (typeof errors['server'] === 'string') {
    return errors['server'];
  }

  if (errors['badInput']) {
    return `${fieldLabel} must be a number, e.g. 12.50.`;
  }

  if (errors['required'] || errors['blank']) {
    return `${fieldLabel} is required.`;
  }

  if (errors['maxlength']) {
    return `${fieldLabel} can be at most ${errors['maxlength'].requiredLength} characters.`;
  }

  if (errors['min']) {
    return `${fieldLabel} must be at least ${errors['min'].min}.`;
  }

  if (errors['max']) {
    return `${fieldLabel} can be at most ${errors['max'].max.toLocaleString()}.`;
  }

  if (errors['decimals']) {
    return `${fieldLabel} can have at most ${errors['decimals'].max} decimal places.`;
  }

  if (errors['pattern']) {
    return `${fieldLabel} is not in the expected format.`;
  }

  return `${fieldLabel} is not valid.`;
}

export function placeServerErrors(form: FormGroup, error: ApiError): string | null {
  let placed = false;
  const unplaced: string[] = [];

  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const message = messages[0];

    if (message === undefined) {
      continue;
    }

    const control = form.get(field);

    if (control?.enabled) {
      control.setErrors({ ...(control.errors ?? {}), server: message });
      control.markAsTouched();
      placed = true;
    } else {
      unplaced.push(message);
    }
  }

  if (unplaced.length > 0) {
    return unplaced.join(' ');
  }

  return placed ? null : error.displayMessage;
}

export function applyServerErrors(form: FormGroup, error: ApiError): boolean {
  return placeServerErrors(form, error) === null;
}

export const notBlank: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.length > 0 && control.value.trim().length === 0
    ? { blank: true }
    : null;

export function maxDecimals(max: number): ValidatorFn {
  return (control) => {
    const value = control.value;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    const [, fraction = ''] = String(value).split('.');

    return fraction.length > max ? { decimals: { max } } : null;
  };
}
