/** Time-related utility functions. */
export class TimeUtils {
  /**
   * Convert UTC date to date with local timezone applied.
   * @param dateStr Date as string in format `YYYY-MM-DDTHH:mm:ss` without timezone. Accepts `.SSS` if present.
   *   An explicit zone (trailing `Z` or a numeric UTC offset such as `+02:00`/`-0500`) is honored instead of
   *   being reinterpreted as UTC. Input that cannot be parsed is returned trimmed and unchanged.
   * @returns Date as string with timezone applied in format `YYYY-MM-DD HH:mm:ss`.
   */
  public static zoned(dateStr: string | null | undefined): string {
    if (dateStr === undefined || dateStr === null) return '';
    dateStr = dateStr.trim();

    // Normalize the ISO 8601 'T' separator to a space (matches the format we emit).
    const normalized = dateStr.replace('T', ' ');

    // If the input already carries a zone designator (trailing 'Z' or a numeric UTC offset like
    // '+02:00'/'-0500'), parse it as-is so the offset is honored. Otherwise mark the value as UTC
    // by appending 'Z'. Blindly appending 'Z' to an offset-bearing string ('...+02:00' + 'Z') makes
    // the parser silently discard the offset and reinterpret the value as plain UTC.
    const hasZone = /Z$/i.test(normalized)
      || /\s\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?[+-]\d{2}(?::?\d{2})?$/.test(normalized);
    const date = new Date(hasZone ? normalized : normalized + 'Z');

    if (isNaN(date.getTime())) return dateStr; // If parsing fails, return original.

    // Note that parsing will take timezone into account, so we do not have to do anything else.
    // JS automatically applies the offset that was valid ON THAT DATE.
    // In Polish timezone, if date is in Jan, it uses UTC+1. If in June, it uses UTC+2.
    const YYYY = date.getFullYear();
    const MM = this.pad(date.getMonth() + 1);
    const DD = this.pad(date.getDate());
    const hh = this.pad(date.getHours());
    const mm = this.pad(date.getMinutes());
    const ss = this.pad(date.getSeconds());
    const zonedDateStr = `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;

    return zonedDateStr;
  }

  //

  /**
   * Converts a Date to a UTC ISO string describing full date and time (`YYYY-MM-DDTHH:mm:ss.SSS` or `YYYY-MM-DDTHH:mm:ss` if ms is zero).
   * Ignores timezone. You will need to initialize `Date` using `Date.UTC`. Example:
   * ```
   * const date = new Date(Date.UTC(2026, 5, 28, 0, 0, 0, 0));
   * const result = TimeUtils.cnvFull(date);
   * ```
   * @param date Date/time JavaScript class instance.
   * @returns Date and time as ISO-formatted string without zone. Returns null if given date is null or invalid.
   */
  public static cnvFull(date: Date | null): string | null {
    if (date === null || isNaN(date.getTime())) return null;

    const YYYY = date.getUTCFullYear();
    const MM = this.pad(date.getUTCMonth() + 1);
    const DD = this.pad(date.getUTCDate());
    const hh = this.pad(date.getUTCHours());
    const mm = this.pad(date.getUTCMinutes());
    const ss = this.pad(date.getUTCSeconds());
    const ms = this.pad(date.getUTCMilliseconds(), 3);

    let isoStr = `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}`;
    if (ms !== '000') isoStr += `.${ms}`;
    return isoStr;
  }

  /**
   * Converts a Date to a UTC ISO string describing date only (`YYYY-MM-DD`).
   * Ignores timezone. You will need to initialize `Date` using `Date.UTC`.
   * @param date Date/time JavaScript class instance.
   * @returns Date as ISO-formatted string without zone. Returns null if given date is null or invalid.
   */
  public static cnvDate(date: Date | null): string | null {
    if (date === null || isNaN(date.getTime())) return null;

    const YYYY = date.getUTCFullYear();
    const MM = this.pad(date.getUTCMonth() + 1);
    const DD = this.pad(date.getUTCDate());

    return `${YYYY}-${MM}-${DD}`;
  }

  /**
   * Converts a Date to a UTC ISO string describing time only (`HH:mm:ss.SSS` or `HH:mm:ss` if ms is zero).
   * Ignores timezone. You will need to initialize `Date` using `Date.UTC`.
   * @param date Date/time JavaScript class instance.
   * @returns Time as ISO-formatted string without zone. Returns null if given date is null or invalid.
   */
  public static cnvTime(date: Date | null): string | null {
    if (date === null || isNaN(date.getTime())) return null;

    const hh = this.pad(date.getUTCHours());
    const mm = this.pad(date.getUTCMinutes());
    const ss = this.pad(date.getUTCSeconds());
    const ms = this.pad(date.getUTCMilliseconds(), 3);

    let isoStr = `${hh}:${mm}:${ss}`;
    if (ms !== '000') isoStr += `.${ms}`;
    return isoStr;
  }

  //

  /**
   * Format date. Ignores timezone.
   * @param date Date. Can be null.
   * @returns Formatted date (`YYYY-MM-DD`) as string. If given Date is null or invalid, will return empty string.
   */
  public static formatUTCDate(date: Date | null): string {
    if (!date || isNaN(date.getTime())) return '';
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format time. Ignores timezone.
   * @param date Date. Can be null.
   * @returns Formatted time as string. If null or invalid, will return empty string.
   */
  public static formatUTCTime(date: Date | null): string {
    if (!date || isNaN(date.getTime())) return '';

    const hour = date.getUTCHours().toString().padStart(2, '0');
    const minute = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hour}:${minute}`;
  }

  /**
   * Reduce a date to UTC midnight of its UTC calendar day (time-of-day stripped).
   * Use for dates that already carry the UTC-carried calendar identity (calendar cells,
   * keyboard cursor), so a value carrying a time compares as its DAY instead of its timestamp.
   * @param date Date.
   * @returns Date at 00:00:00.000 UTC of the same UTC calendar day. Invalid input propagates as Invalid Date.
   */
  public static startOfUTCDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  /**
   * Reduce a date to UTC midnight of its LOCAL calendar day.
   * Use for consumer-provided bounds (e.g. `dateMin`/`dateMax`): callers think in the calendar
   * days their own clock shows (`new Date()`, an end-of-day local timestamp), so the bound's
   * LOCAL date part - not its timestamp or its UTC date - is the intended boundary day.
   * @param date Date.
   * @returns Date at 00:00:00.000 UTC of the same LOCAL calendar day. Invalid input propagates as Invalid Date.
   */
  public static startOfLocalDay(date: Date): Date {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  }

  /**
   * Get how many days are present in given year and month. Ignores timezone.
   * @param year Year.
   * @param month Month.
   * @returns Count of days in given year and month.
   */
  public static getUTCDaysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  }

  /**
   * Find out the first day of the month. Ignores timezone.
   * @param year Year.
   * @param month Month.
   * @returns Weekday as number. 0 = Monday, 1 = Tuesday, ..., 6 = Sunday.
   */
  public static getUTCFirstDayOfMonth(year: number, month: number): number {
    const day = new Date(Date.UTC(year, month, 1)).getUTCDay();
    return (day + 6) % 7;
  }

  //

  /**
   * Calculates week number.
   * @param date Date.
   * @returns Week number.
   */
  public static getWeekNumberFromDate(date: Date): number {
    return TimeUtils.getWeekNumber(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  /**
   * Calculates week number. Date is UTC.
   * Note: ISO 8601 sometimes gives results that look wrong for the edge case "week that belongs to previous and next year", so we don't use that.
   * The algorithm used always considers the first days of January until Sunday as the 1st week of that year.
   * @param year Year.
   * @param month Month.
   * @param day Day.
   * @returns Week number.
   */
  public static getWeekNumber(year: number, month: number, day: number): number {
    const date = new Date(Date.UTC(year, month, day));

    // Find Monday of the current week.
    const dow = date.getUTCDay() || 7; // day of week
    const currWeekStart = new Date(date);
    currWeekStart.setUTCDate(date.getUTCDate() - (dow - 1));

    // Find Monday of the week containing Jan 1.
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const jan1Dow = jan1.getUTCDay() || 7;
    const week1Start = new Date(jan1);
    week1Start.setUTCDate(jan1.getUTCDate() - (jan1Dow - 1));

    return Math.floor((currWeekStart.getTime() - week1Start.getTime()) / (7 * 86400000)) + 1;
  }

  //

  private static pad(n: number, length: number = 2): string {
    return n.toString().padStart(length, '0');
  }
}
