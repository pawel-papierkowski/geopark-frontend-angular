import { Component, inject, Injector, model, input, output, signal, computed, viewChild, ElementRef, afterNextRender } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { TranslateService, TranslatePipe } from '@ngx-translate/core';

import { TimeUtils } from '@/core/utils/TimeUtils';
import { NavUtils } from '@/core/utils/NavUtils';

/**
 * This is a time picker. Uses `Date` class for both input and output. Do not use it directly.
 * Use DateTimePicker with attribute mode="time".
 * Note it is timezone-agnostic. It is up to you to adjust result to timezone etc. as needed.
 * Designed to be used with signal-based forms.
 *
 * CURRENTLY PLACEHOLDER.
 *
 * Features:
 * - Can select time.
 * - Can disable or mark as invalid.
 * - Keyboard navigation supported via arrows (open panel or change hour/minute), enter/space (pick hour/minute) and esc (close panel).
 * - Supports <label>.
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and id attribute in focusable element (so <label> etc. work properly). Optional.
 * - label - For `aria-labelledby`. Optional.
 * - canNull - If true, allow deselecting date. Optional, default is false.
 *
 * Outputs:
 * - touch - Informs that user blurred out of component.
 *
 * Special (set indirectly):
 * - required - If true, component is required. Default is false.
 * - disabled - If true, acts as disabled component. Default is false.
 * - invalid - If true, shows component as having invalid state. Visual only. Default is false.
 */
@Component({
  selector: 'time-picker',
  imports: [ TranslatePipe ],
  styleUrl: './time-picker.css',
  templateUrl: './time-picker.html',
})
export class TimePicker implements FormValueControl<Date | null> {
  private injector = inject(Injector);
  private readonly translateService = inject(TranslateService);

  /** Value held by component. */
  value = model<Date | null>(null);
  /** Identifier for this component. */
  ident = input<string>('');
  /** Label reference. */
  label = input<string>('');
  /** If true, allow deselecting date. */
  canNull = input<boolean>(false);
  /** Is component required? */
  readonly required = input<boolean>(false);
  /** Is component disabled? */
  readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  touch = output<void>();

  /** Indicates visibility of clock panel. */
  isClockVisible = signal(false);
  /** Root focusable element. */
  pickerRef = viewChild.required<ElementRef<HTMLDivElement>>('pickerRef');
  /** Reference to clock panel. */
  clockPanelRef = viewChild.required<ElementRef<HTMLDivElement>>('clockPanelRef');
  /** Reference to hour scroller. */
  hourRef = viewChild.required<ElementRef<HTMLDivElement>>('hourRef');
  /** Reference to minute scroller. */
  minuteRef = viewChild.required<ElementRef<HTMLDivElement>>('minuteRef');

  /** Keyboard-focus hour index. Set when panel opens, updated via arrow navigation. */
  focusedHour = signal<number | null>(null);
  /** Keyboard-focus minute index. Set when panel opens, updated via arrow navigation. */
  focusedMinute = signal<number | null>(null);
  /** Which listbox column currently has keyboard focus. */
  activeColumn = signal<'hour' | 'minute'>('hour');

  /** List of hours. We use full 24-hour clock. */
  hours = Array.from({ length: 24 }, (_, i) => i);
  /** List of minutes. */
  minutes = Array.from({ length: 60 }, (_, i) => i);

  /** Currently viewed hour. */
  viewHour = signal<number | null>(null);
  /** Currently viewed minute. */
  viewMinute = signal<number | null>(null);

  /** Style of clock panel. Used to ensure correct positioning of panel. */
  containerStyle = signal({
    left: '0',
    right: 'auto',
  });

  // COMPUTED

  /** Currently selected hour. */
  selectedHour = computed(() => this.value()?.getUTCHours() ?? null);
  /** Currently selected minute. */
  selectedMinute = computed(() => this.value()?.getUTCMinutes() ?? null);

  /** aria-activedescendant value for the hour listbox. */
  hourActiveDesc = computed(() => {
    if (this.focusedHour() === null) return undefined;
    return `${this.ident}_opt_h${this.focusedHour()}`;
  });
  /** aria-activedescendant value for the minute listbox. */
  minuteActiveDesc = computed(() => {
    if (this.focusedMinute() === null) return undefined;
    return `${this.ident}_opt_m${this.focusedMinute()}`;
  });

  /** Compute currently displayed time value in time input. */
  displayTimeValue = computed(() => {
    const formattedTime = TimeUtils.formatUTCTime(this.value());
    if (!formattedTime) return null;
    return '🕜 ' + formattedTime;
  });
  /** Compute placeholder value for time input. */
  placeholderTimeValue = computed(() => {
    return '🕜 ' + this.translateService.instant('dateTimePicker.placeholder.time');
  });

  // GENERAL

  /** Toggle visibility of time picker panel. */
  async toggleTimePickerVisibility(viaKeyboard: boolean) {
    if (this.isClockVisible()) {
      this.hidePanel();
    } else {
      this.isClockVisible.set(true);
      this.findViewTime();

      // Initialize keyboard focus state.
      if (viaKeyboard) {
        this.setupFocus(true);
        if (this.value()) {
          this.focusedHour.set(this.value()?.getUTCHours() ?? null);
          this.focusedMinute.set(this.value()?.getUTCMinutes() ?? null);
        } else {
          this.focusedHour.set(this.viewHour());
          this.focusedMinute.set(this.viewMinute());
        }
      }
      this.activeColumn.set('hour');

      //await nextTick(); we likely need angular's equivalent of this

      // Adjust picker position if needed to prevent window overflow.
      if (this.clockPanelRef()) {
        const rect = this.clockPanelRef().nativeElement.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          this.containerStyle.set({ left: 'auto', right: '0' });
        } else {
          this.containerStyle.set({ left: '0', right: 'auto' });
        }
      }

      // Move keyboard focus into the panel (hour column) so user can navigate immediately.
      this.hourRef()?.nativeElement.focus();
    }
  }

  /** Find and set current time. */
  findViewTime() {
    const date = new Date();
    this.viewHour.set(date.getUTCHours());
    this.viewMinute.set(date.getUTCMinutes());
  }

  // EVENTS

  /**
   * Handle focus leaving the picker entirely (e.g. Tab out of grid). It will close clock panel.
   */
  handleFocusOut(e: FocusEvent) {
    if (!this.isClockVisible()) return;
    const next = e.relatedTarget;
    if (next instanceof Node && this.pickerRef().nativeElement.contains(next)) return;
    this.hidePanel();
  }

  // UTILITIES

  /** Flip panel. */
  flipPanel() {
    this.toggleTimePickerVisibility(false);
  }

  /** Show panel (if not already visible). */
  showPanel() {
    if (!this.isClockVisible()) this.toggleTimePickerVisibility(false);
  }

  /**
   * Hide clock panel with hours and minutes.
   */
  hidePanel() {
    if (!this.isClockVisible()) return; // already hidden

    this.isClockVisible.set(false);
    this.focusedHour.set(null);
    this.focusedMinute.set(null);
  }

  /** Hide panel and return focus to the input. */
  hidePanelAndRefocus() {
    this.hidePanel();
    afterNextRender(() => {
      const inputEl = document.getElementById(this.ident());
      inputEl?.focus();
     }, { injector: this.injector });
  }

  /** Hide panel and move focus to the next focusable element on page. */
  hidePanelAndFocusNext() {
    this.hidePanel();
    afterNextRender(() => {
      const inputEl = document.getElementById(this.ident());
      NavUtils.FocusNext(inputEl);
     }, { injector: this.injector });
  }

  /**
   * Set up focus values.
   * @param force If true, will override focused values. If false, will set focused values only if these are null.
   */
  setupFocus(force: boolean) {
    if (force || this.focusedHour() === null) {
      const val = this.value()?.getUTCHours() ?? this.viewHour();
      this.focusedHour.set(val ?? null);
    }
    if (force || this.focusedMinute() === null) {
      const val = this.value()?.getUTCMinutes() ?? this.viewMinute();
      this.focusedMinute.set(val ?? null);
    }
  }

  /**
   * Resolve class of hour item.
   * @param h Hour.
   */
  resolveHourClass(h: number) {
    return {
      selected: this.selectedHour() === h,
      curr: this.viewHour() === h,
      focused: this.activeColumn() === 'hour' && this.focusedHour() === h,
    };
  }

  /**
   * Resolve class of minute item.
   * @param m Minute.
   */
  resolveMinuteClass(m: number) {
    return {
      selected: this.selectedMinute() === m,
      curr: this.viewMinute() === m,
      focused: this.activeColumn() === 'minute' && this.focusedMinute() === m,
    };
  }
}
