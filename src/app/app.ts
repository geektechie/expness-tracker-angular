import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  TitleStrategy,
} from '@angular/router';
import { filter } from 'rxjs';
import { Theme, ThemePreference } from './core/services/theme';
import { Icon, IconName } from './shared/components/icon/icon';
import { ToastHost } from './shared/components/toast-host/toast-host';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

const THEME_DISPLAY: Record<ThemePreference, { label: string; icon: IconName }> = {
  system: { label: 'System theme', icon: 'monitor' },
  light: { label: 'Light theme', icon: 'sun' },
  dark: { label: 'Dark theme', icon: 'moon' },
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly theme = inject(Theme);
  private readonly router = inject(Router);
  private readonly titleStrategy = inject(TitleStrategy);
  private readonly injector = inject(Injector);

  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  protected readonly nav: readonly NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/expenses', label: 'Expenses', icon: 'receipt' },
    { path: '/categories', label: 'Categories', icon: 'tag' },
    { path: '/budgets', label: 'Budgets', icon: 'target' },
    { path: '/reports', label: 'Reports', icon: 'chart' },
  ];

  protected readonly themeDisplay = computed(() => THEME_DISPLAY[this.theme.preference()]);

  protected readonly pageTitle = signal<string | null>(null);

  constructor() {
    let previousPath: string | null = null;

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const path = event.urlAfterRedirects.split(/[?#]/)[0];
        this.pageTitle.set(this.titleStrategy.buildTitle(this.router.routerState.snapshot) ?? null);

        if (previousPath !== null && path !== previousPath) {
          afterNextRender(() => this.main().nativeElement.focus({ preventScroll: true }), {
            injector: this.injector,
          });
        }
        previousPath = path;
      });
  }
}
