import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-category-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-chip.html',
  styleUrl: './category-chip.css',
})
export class CategoryChip {
  readonly name = input.required<string>();
  readonly colorHex = input.required<string>();
  readonly archived = input(false);
}
