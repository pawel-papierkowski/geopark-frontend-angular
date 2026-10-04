// TextBox component

/** Valid input types for TextBox component. */
export type enTextBoxType = 'text' | 'password' | 'email' | 'search' | 'tel' | 'url';

// DateTimePicker component

/** Valid modes for DateTimePicker component. */
export type enDateTimePickerMode = 'datetime' | 'date' | 'time';

/** Kind of calendar cell. */
export enum EnCalendarCellType {
  /** Standard date cell that should show day. */
  Date,
  /** Week cell that shows week number. */
  Week,
};

/** Dedicated date-only (year, month, day) type. */
export type CalendarCell = {
  /** Identifier of cell for data-testid attribute. */
  testid: string;

  /** Type of cell. */
  type: EnCalendarCellType;

  /** Day. */
  day: number;
  /** Month. */
  month: number;
  /** Year. */
  year: number;
  /** If true, this date is in the current month. */
  isCurrentMonth: boolean;
};

/**
 * Render-ready calendar cell: structural cell data plus presentation state, all precomputed
 * ONCE per cells rebuild (viewed month, selection, range, language) instead of being derived
 * in the template on every change-detection pass. Template bindings therefore only read
 * plain fields - no method calls, no `new Date()` allocations, no impure translate pipes.
 * Week cells (type `Week`) carry no per-day state: their day-only fields are `undefined`/neutral.
 */
export type CalendarCellView = CalendarCell & {
  /** Element id used by `aria-activedescendant`; undefined for week cells (not focusable targets). */
  id: string | undefined;
  /** Translated full-date accessible name; undefined for week cells. */
  ariaLabel: string | undefined;
  /** `aria-selected` value; boolean for date cells, undefined (attribute absent) for week cells. */
  ariaSelected: boolean | undefined;
  /** `aria-disabled`: true when out of range, undefined (attribute absent) otherwise. */
  ariaDisabled: true | undefined;
  /** `aria-current`: 'date' on today, null (attribute absent) otherwise. */
  ariaCurrent: 'date' | null;
  /** True for week-number cells (drives the `week-num` vs `day` class). */
  isWeek: boolean;
  /** True when a date cell lies outside the viewed month. */
  notCurrent: boolean;
  /** True for the local-today cell. */
  today: boolean;
  /** True for the selected cell. */
  selected: boolean;
  /** True when the cell's date is outside `dateMin`/`dateMax`. */
  disabled: boolean;
};

