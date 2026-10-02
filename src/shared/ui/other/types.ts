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

