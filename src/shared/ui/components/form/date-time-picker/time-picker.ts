import { Component, effect, inject, Injector, model, input, output, signal, computed, viewChild, ElementRef } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { TranslateService, TranslatePipe } from '@ngx-translate/core';

import { TimeUtils } from '@/core/utils/TimeUtils';
import { NavUtils } from '@/core/utils/NavUtils';
import { afterRender } from '@/shared/utils/render/after-render';

/**
 * This is a time picker. Uses `Date` class for both input and output. Do not use it directly.
 * Use DateTimePicker with attribute mode="time".
 * Note it is timezone-agnostic. It is up to you to adjust result to timezone etc. as needed.
 * Designed to be used with signal-based forms.
 *
 * CURRENTLY PLACEHOLDER.
 * TODO
 * - watch isClockVisible so it scrolls, same with disabling picker
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
  /** Reference to hour listbox. */
  hourRef = viewChild.required<ElementRef<HTMLDivElement>>('hourRef');
  /** Reference to minute listbox. */
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

  constructor() {
    // Watch `disabled` field: close clock panel when component becomes disabled.
    effect(() => {
      if (this.disabled() && this.isClockVisible()) this.hidePanel();
    });

    // Watch `disabled` field: react on panel opening.
    effect(() => {
      if ( this.isClockVisible()) this.scrollToSelected();
    });
  }

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

      await afterRender(this.injector);

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

  //

  /** Select hour. */
  selectHour(h: number | null) {
    if (this.disabled() || h === null) return;

    // Selecting same hour.
    if (this.value() && this.value()?.getUTCHours() === h) {
      if (this.canNull()) this.value.set(null); // Deselect time.
      return;
    }

    const date = this.value() ? new Date(this.value() || '') : new Date();
    if (!this.value()) date.setUTCSeconds(0, 0);
    date.setUTCHours(h);
    this.value.set(date);
  }

  /** Select minute. */
  selectMinute(m: number | null, viaKeyboard: boolean) {
    if (this.disabled() || m === null) return;

    // Selecting same minute.
    if (!viaKeyboard && this.value() && this.value()?.getUTCMinutes() === m) {
      if (this.canNull()) this.value.set(null); // Deselect time.
      return;
    }

    const date = this.value() ? new Date(this.value() || '') : new Date();
    if (!this.value()) date.setUTCSeconds(0, 0);
    date.setUTCMinutes(m);
    this.value.set(date);
  }

  /** Scroll to selected hour and minute. */
  async scrollToSelected() {
    await afterRender(this.injector);

    let selHourElement: Element | null = null;
    let selMinuteElement: Element | null = null;

    // If time is not selected, use current time as scroll target.
    if (this.value() === null) {
      if (this.hourRef()) selHourElement = this.hourRef().nativeElement.querySelector('.curr');
      if (this.minuteRef()) selMinuteElement = this.minuteRef().nativeElement.querySelector('.curr');
    } else {
      if (this.hourRef()) selHourElement = this.hourRef().nativeElement.querySelector('.selected');
      if (this.minuteRef()) selMinuteElement = this.minuteRef().nativeElement.querySelector('.selected');
    }
    if (selHourElement) selHourElement.scrollIntoView({ block: 'center' });
    if (selMinuteElement) selMinuteElement.scrollIntoView({ block: 'center' });
  }

  /** Scroll hour listbox so given hour is visible. */
  async scrollHourIntoView(h: number | null) {
    if (h === null) return;
    await afterRender(this.injector);

    if (this.hourRef()) {
      const el = this.hourRef().nativeElement.querySelector(`[data-testid="${this.ident()}_h${h}"]`);
      el?.scrollIntoView({ block: 'center' });
    }
  }

  /** Scroll minute listbox so given minute is visible. */
  async scrollMinuteIntoView(m: number | null) {
    if (m === null) return;
    await afterRender(this.injector);

    if (this.minuteRef()) {
      const el = this.minuteRef().nativeElement.querySelector(`[data-testid="${this.ident()}_m${m}"]`);
      el?.scrollIntoView({ block: 'center' });
    }
  }

  // EVENTS

  /** Tracks if the next focus event is caused by a mouse click (to avoid auto-open on click). */
  focusFromClick = false;

  /** Handle mousedown on input: mark that focus is from a click so auto-open is skipped. */
  handleMousedown() {
    this.focusFromClick = true;
  }

  /** Handle focus arriving on the input (e.g. via Tab). */
  async handleInputFocus() {
    if (!this.focusFromClick && !this.isClockVisible() && !this.disabled()) {
      await this.toggleTimePickerVisibility(false);
    }
    this.focusFromClick = false;
  }

  /**
   * Handle click.
   * @param viaKeyboard True if "click" was actually via keyboard.
   */
  async handleClick(viaKeyboard: boolean) {
    if (this.disabled()) return;
    await this.toggleTimePickerVisibility(viaKeyboard);
  };

  /**
   * Handle focus leaving the picker entirely (e.g. Tab out of grid). It will close clock panel.
   * @param e Focus event.
   */
  handleFocusOut(e: FocusEvent) {
    if (!this.isClockVisible()) return;
    const next = e.relatedTarget;
    if (next instanceof Node && this.pickerRef().nativeElement.contains(next)) return;
    this.hidePanel();
  }

  // EVENTS: KEYBOARD HANDLERS

  /**
   * Handle keyboard on the input element.
   * @param e Keyboard event.
   */
  async onInputKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!this.isClockVisible()) await this.toggleTimePickerVisibility(true);
    } else if (e.key === 'Escape' && this.isClockVisible()) {
      e.preventDefault();
      this.hidePanel();
    }
  }

  /**
   * Handle keyboard on the hour listbox.
   * @param e Keyboard event.
   */
  async onHourKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.focusedHour.update((currVal) => {
          if (currVal !== null) return currVal > 0 ? currVal - 1 : 23;
          return this.selectedHour() ?? this.viewHour() ?? 0;
        });
        this.scrollHourIntoView(this.focusedHour());
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.focusedHour.update((currVal) => {
          if (currVal !== null) return currVal < 23 ? currVal + 1 : 0;
          return this.selectedHour() ?? this.viewHour() ?? 0;
        });
        this.scrollHourIntoView(this.focusedHour());
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.keyPressSwitchColumn();
        break;
      case 'Home': // Jump to start of list.
        e.preventDefault();
        this.focusedHour.set(0);
        this.scrollHourIntoView(0);
        break;
      case 'End': // Jump to end of list.
        e.preventDefault();
        this.focusedHour.set(23);
        this.scrollHourIntoView(23);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.keyPressSelectHour();
        break;
      case 'Escape':
        e.preventDefault();
        this.hidePanelAndRefocus();
        break;
    }
  }

  /**
   * Handle keyboard on the minute listbox.
   * @param e Keyboard event.
   */
  async onMinuteKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.focusedMinute.update((currVal) => {
          if (currVal !== null) return currVal > 0 ? currVal - 1 : 59;
          return this.selectedMinute() ?? this.viewMinute() ?? 0;
        });
        this.scrollMinuteIntoView(this.focusedMinute());
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.focusedMinute.update((currVal) => {
          if (currVal !== null) return currVal < 59 ? currVal + 1 : 0;
          return this.selectedMinute() ?? this.viewMinute() ?? 0;
        });
        this.scrollMinuteIntoView(this.focusedMinute());
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.keyPressSwitchColumn();
        break;
      case 'Home': // Jump to start of list.
        e.preventDefault();
        this.focusedMinute.set(0);
        this.scrollMinuteIntoView(0);
        break;
      case 'End': // Jump to end of list.
        e.preventDefault();
        this.focusedMinute.set(59);
        this.scrollMinuteIntoView(59);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.keyPressSelectMinute();
        break;
      case 'Escape':
        e.preventDefault();
        this.hidePanelAndRefocus();
        break;
    }
  }

  //

  /** React to column change via key press. */
  async keyPressSwitchColumn() {
    if (this.focusedHour() === null || this.focusedMinute() === null) {
      // Just show focus without switching column.
      this.setupFocus(false);
      return;
    }

    if (this.activeColumn() === 'minute') {
      // Switch focus to hour column.
      this.activeColumn.set('hour');
      await afterRender(this.injector);
      this.hourRef().nativeElement.focus();
    } else {
      // Switch focus to minute column.
      this.activeColumn.set('minute');
      await afterRender(this.injector);
      this.minuteRef().nativeElement.focus();
    }
  }

  /** React to selecting hour via key press. */
  async keyPressSelectHour() {
    if (this.focusedHour() === null) {
      // Just show focus without selecting anything.
      this.setupFocus(false);
      return;
    }

    this.selectHour(this.focusedHour());
    await afterRender(this.injector);

    // If time was deselected (canNull same-hour toggle), close panel.
    // Otherwise move focus to minute column.
    if (this.value() === null) {
      this.hidePanelAndRefocus();
    } else {
      this.activeColumn.set('minute');
      if (this.focusedMinute() === null) {
        const val = this.value()?.getUTCMinutes() ?? this.viewMinute();
        this.focusedMinute.set(val ?? null);
      }
      await afterRender(this.injector);
      this.minuteRef().nativeElement.focus();
    }
  }

  /** React to selecting minute via key press. */
  keyPressSelectMinute() {
    if (this.focusedMinute() === null) {
      // Just show focus without selecting anything.
      this.setupFocus(false);
      return;
    }

    this.selectMinute(this.focusedMinute(), true);
    this.hidePanelAndFocusNext();
  }

  // UTILITIES

  /** Flip panel. */
  async flipPanel() {
    await this.toggleTimePickerVisibility(false);
  }

  /** Show panel (if not already visible). */
  async showPanel() {
    if (!this.isClockVisible()) await this.toggleTimePickerVisibility(false);
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
  async hidePanelAndRefocus() {
    this.hidePanel();

    await afterRender(this.injector);

    const inputEl = document.getElementById(this.ident());
    inputEl?.focus();
  }

  /** Hide panel and move focus to the next focusable element on page. */
  async hidePanelAndFocusNext() {
    this.hidePanel();

    await afterRender(this.injector);

    const inputEl = document.getElementById(this.ident());
    NavUtils.FocusNext(inputEl);
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
