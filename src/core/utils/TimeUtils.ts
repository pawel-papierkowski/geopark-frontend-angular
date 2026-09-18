/** Time-related utility functions. */
export class TimeUtils {
  /**
   * Convert UTC date to date with local timezone applied.
   * @param dateStr Date as string in format `YYYY-MM-DDTHH:mm:ss` without timezone. Accepts `.SSS` if present.
   * @returns Date as string with timezone applied in format `YYYY-MM-DD HH:mm:ss`.
   */
  public static zoned(dateStr: string | null | undefined): string {
    if (dateStr === undefined || dateStr === null) return '';
    dateStr = dateStr.trim();

    // Parse as UTC by adding 'Z' (standard ISO 8601 expects 'T' separator).
    let dateFixedStr = dateStr.replace('T', ' ') || dateStr;
    dateFixedStr = dateFixedStr.replace('Z', '') || dateFixedStr; // prevent 'ZZ'
    const date = new Date(dateFixedStr + 'Z');

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
   * Converts a Date to an UTC ISO string describing full date and time (`YYYY-MM-DDTHH:mm:ss.SSS` or `YYYY-MM-DDTHH:mm:ss` if ms is zero).
   * Ignores timezone. You will need to initialize `Date` using `Date.UTC`. Example:
   * ```
   * const date = new Date(Date.UTC(2026, 5, 28, 0, 0, 0, 0));
   * const result = TimeUtils.cnvFull(date);
   * ```
   * @param date Date/time JavaScript class instance.
   * @returns Date and time as ISO-formatted string without zone. Returns null if given date is null.
   */
  public static cnvFull(date: Date | null): string | null {
    if (date === null) return null;

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
   * Converts a Date to an UTC ISO string describing date only (`YYYY-MM-DD`).
   * Ignores timezone. You will need to initialize `Date` using `Date.UTC`.
   * @param date Date/time JavaScript class instance.
   * @returns Date as ISO-formatted string without zone. Returns null if given date is null.
   */
  public static cnvDate(date: Date | null): string | null {
    if (date === null) return null;

    const YYYY = date.getUTCFullYear();
    const MM = this.pad(date.getUTCMonth() + 1);
    const DD = this.pad(date.getUTCDate());

    return `${YYYY}-${MM}-${DD}`;
  }

  /**
   * Converts a Date to an UTC ISO string describing time only (`HH:mm:ss.SSS` or `HH:mm:ss` if ms is zero).
   * Ignores timezone. You will need to initialize `Date` using `Date.UTC`.
   * @param date Date/time JavaScript class instance.
   * @returns Time as ISO-formatted string without zone. Returns null if given date is null.
   */
  public static cnvTime(date: Date | null): string | null {
    if (date === null) return null;

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
   * @returns Formatted date (`YYYY-MM-DD`) as string. If given Date is null, will return empty string.
   */
  public static formatUTCDate(date: Date | null): string {
    if (!date) return '';
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format time. Ignores timezone.
   * @param date Date. Can be null.
   * @returns Formatted time as string. If null, will return empty string.
   */
  public static formatUTCTime(date: Date | null): string {
    if (!date) return '';

    const hour = date.getUTCHours().toString().padStart(2, '0');
    const minute = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hour}:${minute}`;
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
