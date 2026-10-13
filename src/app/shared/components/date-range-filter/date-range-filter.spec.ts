import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateRange } from '../../utils/dates';
import { DateRangeFilter } from './date-range-filter';

describe('DateRangeFilter', () => {
  let fixture: ComponentFixture<DateRangeFilter>;
  let element: HTMLElement;

  function trigger(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('.trigger')!;
  }

  function presetButton(label: string): HTMLButtonElement {
    const button = Array.from(element.querySelectorAll<HTMLButtonElement>('.preset')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );

    if (!button) {
      throw new Error(`No preset ${label}`);
    }

    return button;
  }

  async function openPanel(): Promise<void> {
    trigger().click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    jasmine.clock().install();

    jasmine.clock().mockDate(new Date(2026, 9, 7, 12));

    fixture = TestBed.createComponent(DateRangeFilter);
    fixture.componentRef.setInput('range', { from: '2026-09-08', to: '2026-10-07' });
    element = fixture.nativeElement;
    document.body.appendChild(element);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    element.remove();
    jasmine.clock().uninstall();
  });

  it('names the preset that matches the range', () => {
    expect(trigger().querySelector('.trigger-preset')?.textContent).toBe('Last 30 days');
  });

  it('keeps the preset that was clicked when another yields the same range', async () => {
    await openPanel();
    presetButton('This month').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.range()).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(trigger().querySelector('.trigger-preset')?.textContent).toBe('This month');

    await openPanel();

    expect(presetButton('This month').getAttribute('aria-pressed')).toBe('true');
    expect(presetButton('Last 7 days').getAttribute('aria-pressed')).toBe('false');
  });

  it('moves focus into the panel when it opens', async () => {
    trigger().focus();
    await openPanel();

    expect(document.activeElement).toBe(presetButton('Last 30 days'));
  });

  it('ties the custom-range error to both date inputs', async () => {
    await openPanel();
    const [from, to] = Array.from(element.querySelectorAll<HTMLInputElement>('input[type=date]'));

    expect(from.getAttribute('aria-invalid')).toBe('false');
    expect(from.hasAttribute('aria-describedby')).toBeFalse();

    to.value = '2026-09-01';
    to.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    const error = element.querySelector('.field-error')!;

    expect(error.getAttribute('role')).toBe('alert');
    expect(error.id).toBeTruthy();
    expect(from.getAttribute('aria-describedby')).toBe(error.id);
    expect(to.getAttribute('aria-describedby')).toBe(error.id);
    expect(to.getAttribute('aria-invalid')).toBe('true');
  });

  it('closes when focus tabs out of it, without pulling focus back', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    await openPanel();
    outside.focus();
    await fixture.whenStable();

    expect(element.querySelector('.panel')).toBeNull();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    await openPanel();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(element.querySelector('.panel')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('applies a custom range and names it as custom', async () => {
    const range: DateRange = { from: '2026-09-02', to: '2026-09-20' };
    await openPanel();
    const [from, to] = Array.from(element.querySelectorAll<HTMLInputElement>('input[type=date]'));

    from.value = range.from;
    from.dispatchEvent(new Event('input'));
    to.value = range.to;
    to.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.range()).toEqual(range);
    expect(trigger().querySelector('.trigger-preset')?.textContent).toBe('Custom range');
  });
});
