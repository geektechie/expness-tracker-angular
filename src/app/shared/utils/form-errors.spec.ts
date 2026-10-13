import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error';
import {
  applyServerErrors,
  controlErrorMessage,
  maxDecimals,
  notBlank,
  placeServerErrors,
} from './form-errors';

function apiError(
  fieldErrors: Record<string, string[]>,
  detail: string | null = null,
): ApiError {
  return new ApiError(400, 'One or more validation errors occurred.', detail, fieldErrors, null);
}

function budgetForm(): FormGroup {
  return new FormGroup({
    categoryId: new FormControl<string>('food'),
    limit: new FormControl<number | null>(10),
  });
}

describe('controlErrorMessage', () => {
  function touched(control: FormControl): FormControl {
    control.markAsTouched();
    return control;
  }

  it('stays quiet until the control is invalid and touched or dirty', () => {
    expect(controlErrorMessage(null, 'Amount')).toBeNull();
    expect(controlErrorMessage(new FormControl('', Validators.required), 'Amount')).toBeNull();
    expect(controlErrorMessage(touched(new FormControl('x')), 'Amount')).toBeNull();
  });

  it('prefers the server message', () => {
    const control = touched(new FormControl(''));
    control.setErrors({ required: true, server: 'Category is archived.' });

    expect(controlErrorMessage(control, 'Category')).toBe('Category is archived.');
  });

  it('describes each client rule', () => {
    const control = touched(new FormControl(''));
    const message = (errors: Record<string, unknown>) => {
      control.setErrors(errors);
      return controlErrorMessage(control, 'Amount');
    };

    expect(message({ required: true })).toBe('Amount is required.');
    expect(message({ blank: true })).toBe('Amount is required.');
    expect(message({ maxlength: { requiredLength: 5 } })).toBe('Amount can be at most 5 characters.');
    expect(message({ min: { min: 0.01 } })).toBe('Amount must be at least 0.01.');
    expect(message({ decimals: { max: 2 } })).toBe('Amount can have at most 2 decimal places.');
    expect(message({ pattern: true })).toBe('Amount is not in the expected format.');
    expect(message({ unknown: true })).toBe('Amount is not valid.');
  });

  it('says a value that is not a number is not a number, not that it is missing', () => {
    const control = touched(new FormControl(null));
    control.setErrors({ badInput: true, required: true });

    expect(controlErrorMessage(control, 'Amount')).toBe('Amount must be a number, e.g. 12.50.');
  });
});

describe('placeServerErrors / applyServerErrors', () => {
  it('puts each camelCase field error under its control', () => {
    const form = budgetForm();
    const result = placeServerErrors(form, apiError({ limit: ['Limit is too big.', 'Ignored.'] }));

    expect(result).toBeNull();
    expect(form.controls['limit'].errors).toEqual({ server: 'Limit is too big.' });
    expect(form.controls['limit'].touched).toBeTrue();
    expect(controlErrorMessage(form.controls['limit'], 'Limit')).toBe('Limit is too big.');
  });

  it('reaches nested controls by dotted path', () => {
    const form = new FormGroup({ range: new FormGroup({ from: new FormControl('') }) });

    expect(applyServerErrors(form, apiError({ 'range.from': ['Too early.'] }))).toBeTrue();
    expect(form.get('range.from')?.errors).toEqual({ server: 'Too early.' });
  });

  it('keeps the client errors already on the control', () => {
    const form = budgetForm();
    form.controls['limit'].setErrors({ min: { min: 0.01 } });

    placeServerErrors(form, apiError({ limit: ['Bad limit.'] }));

    expect(form.controls['limit'].errors).toEqual({ min: { min: 0.01 }, server: 'Bad limit.' });
  });

  it('returns the messages no control could show, even when others landed', () => {
    const form = budgetForm();
    const error = apiError({ limit: ['Bad limit.'], month: ["Month must be in 'yyyy-MM' form."] });

    expect(placeServerErrors(form, error)).toBe("Month must be in 'yyyy-MM' form.");
    expect(form.controls['limit'].errors).toEqual({ server: 'Bad limit.' });
    expect(applyServerErrors(budgetForm(), error)).toBeFalse();
  });

  it('never hides a message under a disabled control', () => {
    const form = budgetForm();
    form.controls['categoryId'].disable();
    const error = apiError({ categoryId: ['No category exists with id food.'], limit: ['Bad.'] });

    expect(placeServerErrors(form, error)).toBe('No category exists with id food.');
    expect(form.controls['categoryId'].errors).toBeNull();
    expect(form.controls['limit'].errors).toEqual({ server: 'Bad.' });
  });

  it('falls back to the error message when there are no field errors', () => {
    const form = budgetForm();
    const error = apiError({}, 'An expense cannot be dated more than 1 day(s) in the future.');

    expect(placeServerErrors(form, error)).toBe(error.displayMessage);
    expect(applyServerErrors(form, error)).toBeFalse();
    expect(form.valid).toBeTrue();
  });

  it('skips empty message lists', () => {
    const form = budgetForm();

    expect(placeServerErrors(form, apiError({ limit: [] }, 'Failed.'))).toBe('Failed.');
    expect(form.controls['limit'].errors).toBeNull();
  });
});

describe('notBlank', () => {
  it('rejects only whitespace', () => {
    expect(notBlank(new FormControl('   '))).toEqual({ blank: true });
    expect(notBlank(new FormControl(''))).toBeNull();
    expect(notBlank(new FormControl(' a '))).toBeNull();
    expect(notBlank(new FormControl(null))).toBeNull();
  });
});

describe('maxDecimals', () => {
  const twoPlaces = maxDecimals(2);

  it('accepts up to the allowed decimal places', () => {
    for (const value of [12, 12.5, 12.34, '7.10', 0.01]) {
      expect(twoPlaces(new FormControl(value))).toBeNull();
    }
  });

  it('rejects more decimal places', () => {
    expect(twoPlaces(new FormControl(12.345))).toEqual({ decimals: { max: 2 } });
    expect(twoPlaces(new FormControl('0.001'))).toEqual({ decimals: { max: 2 } });
  });

  it('leaves empty values to required', () => {
    expect(twoPlaces(new FormControl(null))).toBeNull();
    expect(twoPlaces(new FormControl(''))).toBeNull();
  });
});
