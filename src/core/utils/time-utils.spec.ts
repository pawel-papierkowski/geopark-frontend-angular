import { TimeUtils } from './time-utils';

/**
 * Unit tests of TimeUtils.
 * All expectations use fixed values computed for the `Europe/Warsaw` timezone pinned in
 * `vitest.config.ts`, so the timezone-sensitive `zoned` assertions are deterministic and
 * non-vacuous on every machine. The suite opens with a precondition check that fails loudly
 * when the pin is missing (e.g. after the config is edited or another pool is introduced).
 */
describe('TimeUtils', () => {
  /**
   * Create a Date from UTC parts, i.e. from the same fields the utilities read.
   * @param y Year.
   * @param m Month, zero-based.
   * @param d Day of month.
   * @param h Hours.
   * @param min Minutes.
   * @param s Seconds.
   * @param ms Milliseconds.
   * @returns Date pointing at the given UTC moment.
   */
  function utc(y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0): Date {
    return new Date(Date.UTC(y, m, d, h, min, s, ms));
  }

  describe('zoned', () => {
    it('should run in the pinned Europe/Warsaw timezone (precondition for this suite)', () => {
      // Arrange: A fixed UTC moment, 12:00 UTC on a summer day.
      const date = utc(2026, 5, 28, 12, 0, 0);

      // Act: Read the local hour the test environment resolves.
      const localHour = date.getHours();

      // Assert: The pin from vitest.config.ts must reach the worker, and Warsaw is UTC+2 in
      // June, so 12:00 UTC must render as 14:00 local. The env check gives a precise failure
      // message when the pin is missing (e.g. config edited or another pool introduced).
      expect(process.env['TZ'], 'process.env.TZ should carry the pin from vitest.config.ts').toBe('Europe/Warsaw');
      expect(localHour, 'timezone pin should be active for Date in this worker').toBe(14);
    });

    it('should return empty string for null', () => {
      // Arrange: No input.

      // Act: Convert null.
      const result = TimeUtils.zoned(null);

      // Assert: Nothing in, nothing out.
      expect(result, 'zoned(null) should be an empty string').toBe('');
    });

    it('should return empty string for undefined', () => {
      // Arrange: No input.

      // Act: Convert undefined.
      const result = TimeUtils.zoned(undefined);

      // Assert: Nothing in, nothing out.
      expect(result, 'zoned(undefined) should be an empty string').toBe('');
    });

    it('should return empty string for an empty input', () => {
      // Arrange: Empty string input.

      // Act: Convert the empty string.
      const result = TimeUtils.zoned('');

      // Assert: Empty input stays empty instead of returning "Invalid Date" garbage.
      expect(result, 'zoned("") should be an empty string').toBe('');
    });

    it('should trim surrounding whitespace before converting', () => {
      // Arrange: Valid UTC datetime padded with spaces.
      const input = '  2026-06-28T12:00:00  ';

      // Act: Convert the padded input.
      const result = TimeUtils.zoned(input);

      // Assert: Whitespace is ignored and the summer offset (+02:00) applied.
      expect(result, 'padded input should be trimmed and converted to 14:00 local').toBe('2026-06-28 14:00:00');
    });

    it('should apply the summer UTC offset', () => {
      // Arrange: Noon UTC in June (Polish summer time, UTC+2).
      const input = '2026-06-28T12:00:00';

      // Act: Convert to local time.
      const result = TimeUtils.zoned(input);

      // Assert: Output carries the +2h summer offset and the "YYYY-MM-DD HH:mm:ss" format.
      expect(result, 'June input should shift by two hours in Europe/Warsaw').toBe('2026-06-28 14:00:00');
    });

    it('should apply the winter UTC offset', () => {
      // Arrange: Noon UTC in January (Polish winter time, UTC+1).
      const input = '2026-01-15T12:00:00';

      // Act: Convert to local time.
      const result = TimeUtils.zoned(input);

      // Assert: Output carries the +1h winter offset, proving the offset valid on that date.
      expect(result, 'January input should shift by one hour in Europe/Warsaw').toBe('2026-01-15 13:00:00');
    });

    it('should accept a fractional-seconds input and drop the milliseconds', () => {
      // Arrange: UTC datetime carrying milliseconds.
      const input = '2026-06-28T12:00:00.123';

      // Act: Convert to local time.
      const result = TimeUtils.zoned(input);

      // Assert: Conversion succeeds, but the output format has no milliseconds.
      expect(result, 'millisecond suffix should be tolerated and not appear in the output').toBe('2026-06-28 14:00:00');
    });

    it('should accept an input with a trailing Z', () => {
      // Arrange: UTC datetime already marked with the Z designator.
      const input = '2026-06-28T12:00:00Z';

      // Act: Convert to local time.
      const result = TimeUtils.zoned(input);

      // Assert: The single Z is stripped before parsing, so no double-Z parse failure occurs.
      expect(result, 'trailing Z should be stripped and the datetime converted').toBe('2026-06-28 14:00:00');
    });

    it('should treat a date-only input as midnight UTC', () => {
      // Arrange: Input without a time part.
      const input = '2026-06-28';

      // Act: Convert to local time.
      const result = TimeUtils.zoned(input);

      // Assert: Midnight UTC falls at 02:00 local time during Polish summer time.
      expect(result, 'date-only input should be read as 00:00 UTC and shifted').toBe('2026-06-28 02:00:00');
    });

    it('should return the trimmed input unchanged when it cannot be parsed', () => {
      // Arrange: Two unparseable inputs - a non-date word and impossible calendar values.
      const textInput = '  not-a-date  ';
      const impossibleInput = '2026-13-45T99:00:00';

      // Act: Convert both inputs.
      const textResult = TimeUtils.zoned(textInput);
      const impossibleResult = TimeUtils.zoned(impossibleInput);

      // Assert: Garbage in, same garbage (trimmed) out - never "Invalid Date".
      expect(textResult, 'unparseable text should come back trimmed, without conversion').toBe('not-a-date');
      expect(impossibleResult, 'impossible calendar values should come back unchanged').toBe('2026-13-45T99:00:00');
    });
  });

  describe('cnvFull', () => {
    it('should return null for a null date', () => {
      // Arrange: No input.

      // Act: Convert null.
      const result = TimeUtils.cnvFull(null);

      // Assert: Null propagates instead of becoming a string.
      expect(result, 'cnvFull(null) should be null').toBeNull();
    });

    it('should format a full UTC datetime without milliseconds when milliseconds are zero', () => {
      // Arrange: Midnight UTC with zero milliseconds.
      const date = utc(2026, 5, 28);

      // Act: Convert to an ISO string.
      const result = TimeUtils.cnvFull(date);

      // Assert: No millisecond suffix is appended for zero milliseconds.
      expect(result, 'zero milliseconds should produce a date-time without a fractional part').toBe('2026-06-28T00:00:00');
    });

    it('should append zero-padded milliseconds when they are non-zero', () => {
      // Arrange: UTC datetime with 7 milliseconds.
      const date = utc(2026, 5, 28, 13, 45, 30, 7);

      // Act: Convert to an ISO string.
      const result = TimeUtils.cnvFull(date);

      // Assert: Milliseconds are padded to three digits.
      expect(result, '7 ms should render as ".007" with three-digit padding').toBe('2026-06-28T13:45:30.007');
    });

    it('should pad single-digit date and time parts', () => {
      // Arrange: UTC datetime built entirely from single-digit parts.
      const date = utc(2026, 0, 5, 7, 8, 9);

      // Act: Convert to an ISO string.
      const result = TimeUtils.cnvFull(date);

      // Assert: Every part except the year is padded to its fixed width.
      expect(result, 'single-digit month, day and time parts should all be zero-padded').toBe('2026-01-05T07:08:09');
    });
  });

  describe('cnvDate', () => {
    it('should return null for a null date', () => {
      // Arrange: No input.

      // Act: Convert null.
      const result = TimeUtils.cnvDate(null);

      // Assert: Null propagates instead of becoming a string.
      expect(result, 'cnvDate(null) should be null').toBeNull();
    });

    it('should format a UTC date with padded parts', () => {
      // Arrange: UTC datetime with single-digit month and day.
      const date = utc(2026, 0, 5, 23, 59, 59);

      // Act: Convert to a date-only string.
      const result = TimeUtils.cnvDate(date);

      // Assert: Date part only, month and day padded, time part ignored.
      expect(result, 'output should contain only the padded UTC date').toBe('2026-01-05');
    });

    it('should format a plain mid-year UTC date', () => {
      // Arrange: UTC datetime in June.
      const date = utc(2026, 5, 28, 12, 30);

      // Act: Convert to a date-only string.
      const result = TimeUtils.cnvDate(date);

      // Assert: The UTC calendar date is used regardless of any local timezone.
      expect(result, 'output should be the UTC calendar date').toBe('2026-06-28');
    });
  });

  describe('cnvTime', () => {
    it('should return null for a null date', () => {
      // Arrange: No input.

      // Act: Convert null.
      const result = TimeUtils.cnvTime(null);

      // Assert: Null propagates instead of becoming a string.
      expect(result, 'cnvTime(null) should be null').toBeNull();
    });

    it('should format UTC time without milliseconds when milliseconds are zero', () => {
      // Arrange: UTC datetime with zero milliseconds.
      const date = utc(2026, 5, 28, 13, 45, 30);

      // Act: Convert to a time-only string.
      const result = TimeUtils.cnvTime(date);

      // Assert: No millisecond suffix is appended for zero milliseconds.
      expect(result, 'zero milliseconds should produce a time without a fractional part').toBe('13:45:30');
    });

    it('should append zero-padded milliseconds when they are non-zero', () => {
      // Arrange: UTC datetime with 7 milliseconds.
      const date = utc(2026, 5, 28, 13, 45, 30, 7);

      // Act: Convert to a time-only string.
      const result = TimeUtils.cnvTime(date);

      // Assert: Milliseconds are padded to three digits.
      expect(result, '7 ms should render as ".007" with three-digit padding').toBe('13:45:30.007');
    });

    it('should format midnight with padded parts', () => {
      // Arrange: UTC datetime exactly at midnight.
      const date = utc(2026, 5, 28);

      // Act: Convert to a time-only string.
      const result = TimeUtils.cnvTime(date);

      // Assert: Hours, minutes and seconds are all zero-padded.
      expect(result, 'midnight should render as "00:00:00"').toBe('00:00:00');
    });
  });

  describe('formatUTCDate', () => {
    it('should return an empty string for a null date', () => {
      // Arrange: No input.

      // Act: Format null.
      const result = TimeUtils.formatUTCDate(null);

      // Assert: Unlike cnvDate, the fallback is an empty string.
      expect(result, 'formatUTCDate(null) should be an empty string').toBe('');
    });

    it('should format a UTC date with padded parts', () => {
      // Arrange: UTC datetime with single-digit month and day.
      const date = utc(2026, 0, 5, 7, 8, 9);

      // Act: Format the date.
      const result = TimeUtils.formatUTCDate(date);

      // Assert: Month and day are zero-padded, time part is ignored.
      expect(result, 'single-digit month and day should be zero-padded').toBe('2026-01-05');
    });

    it('should format a plain mid-year UTC date', () => {
      // Arrange: UTC datetime in June.
      const date = utc(2026, 5, 28, 12, 30);

      // Act: Format the date.
      const result = TimeUtils.formatUTCDate(date);

      // Assert: The UTC calendar date is used regardless of any local timezone.
      expect(result, 'output should be the UTC calendar date').toBe('2026-06-28');
    });
  });

  describe('formatUTCTime', () => {
    it('should return an empty string for a null date', () => {
      // Arrange: No input.

      // Act: Format null.
      const result = TimeUtils.formatUTCTime(null);

      // Assert: Nothing in, nothing out.
      expect(result, 'formatUTCTime(null) should be an empty string').toBe('');
    });

    it('should format UTC hours and minutes with padding', () => {
      // Arrange: UTC datetime at 07:05.
      const date = utc(2026, 5, 28, 7, 5, 30);

      // Act: Format the time.
      const result = TimeUtils.formatUTCTime(date);

      // Assert: Hours and minutes are zero-padded, seconds are dropped.
      expect(result, 'single-digit hour and minute should be zero-padded').toBe('07:05');
    });

    it('should format midnight as 00:00', () => {
      // Arrange: UTC datetime exactly at midnight.
      const date = utc(2026, 5, 28);

      // Act: Format the time.
      const result = TimeUtils.formatUTCTime(date);

      // Assert: Midnight renders with a zero hour, not a missing one.
      expect(result, 'midnight should render as "00:00"').toBe('00:00');
    });

    it('should format the end of the day as 23:59', () => {
      // Arrange: UTC datetime at 23:59.
      const date = utc(2026, 5, 28, 23, 59, 30);

      // Act: Format the time.
      const result = TimeUtils.formatUTCTime(date);

      // Assert: The largest hour value renders without padding surprises.
      expect(result, '23:59 should render unchanged').toBe('23:59');
    });
  });

  describe('startOfUTCDay', () => {
    it('should strip the time-of-day using UTC parts', () => {
      // Arrange: UTC datetime carrying non-zero time parts.
      const date = utc(2026, 5, 28, 13, 45, 30, 7);

      // Act: Reduce to the start of the day.
      const result = TimeUtils.startOfUTCDay(date);

      // Assert: Same UTC calendar day, exactly midnight.
      expect(result.toISOString(), 'time-of-day should be zeroed on the UTC calendar day').toBe('2026-06-28T00:00:00.000Z');
    });

    it('should keep the UTC day when the local date already rolled over', () => {
      // Arrange: 4 January 2026, 23:30 UTC - in Europe/Warsaw (UTC+1) the local date is 5 January.
      const date = utc(2026, 0, 4, 23, 30);

      // Act: Reduce to the start of the day.
      const result = TimeUtils.startOfUTCDay(date);

      // Assert: UTC parts decide - the day stays 4 January, not the rolled-over local 5 January.
      expect(result.toISOString(), 'UTC calendar day must win over the rolled-over local date').toBe('2026-01-04T00:00:00.000Z');
    });

    it('should propagate invalid input as Invalid Date', () => {
      // Arrange: Date carrying NaN time.
      const date = new Date(Number.NaN);

      // Act: Reduce the invalid date.
      const result = TimeUtils.startOfUTCDay(date);

      // Assert: No calendar day is fabricated from NaN parts.
      expect(Number.isNaN(result.getTime()), 'invalid input should stay invalid').toBe(true);
    });
  });

  describe('startOfLocalDay', () => {
    it('should map the local calendar day to UTC midnight', () => {
      // Arrange: Noon UTC in June - local and UTC calendar dates agree (Warsaw is UTC+2).
      const date = utc(2026, 5, 28, 12, 30);

      // Act: Reduce to the start of the local day.
      const result = TimeUtils.startOfLocalDay(date);

      // Assert: Local day carried as UTC midnight, time-of-day dropped.
      expect(result.toISOString(), 'local day should be carried as UTC midnight').toBe('2026-06-28T00:00:00.000Z');
    });

    it('should use the rolled-over local date when it differs from the UTC date', () => {
      // Arrange: 4 January 2026, 23:30 UTC = 5 January 00:30 in Europe/Warsaw.
      const date = utc(2026, 0, 4, 23, 30);

      // Act: Reduce to the start of the local day.
      const result = TimeUtils.startOfLocalDay(date);

      // Assert: The result resolves to the day the caller's clock shows (5 January).
      expect(result.toISOString(), 'local calendar date should decide the boundary day').toBe('2026-01-05T00:00:00.000Z');
    });

    it('should propagate invalid input as Invalid Date', () => {
      // Arrange: Date carrying NaN time.
      const date = new Date(Number.NaN);

      // Act: Reduce the invalid date.
      const result = TimeUtils.startOfLocalDay(date);

      // Assert: No calendar day is fabricated from NaN parts.
      expect(Number.isNaN(result.getTime()), 'invalid input should stay invalid').toBe(true);
    });
  });

  describe('getUTCDaysInMonth', () => {
    it('should return 28 days for February of a common year', () => {
      // Arrange: February 2026 (not a leap year).

      // Act: Ask for the day count.
      const result = TimeUtils.getUTCDaysInMonth(2026, 1);

      // Assert: Common-year February has 28 days.
      expect(result, 'February 2026 should have 28 days').toBe(28);
    });

    it('should honour the leap-year rule for February', () => {
      // Arrange: Three Februaries covering modern leap, divisible-by-400 and divisible-by-100 cases.

      // Act: Ask for the day count of each.
      const leapResult = TimeUtils.getUTCDaysInMonth(2028, 1);
      const by400Result = TimeUtils.getUTCDaysInMonth(2000, 1);
      const by100Result = TimeUtils.getUTCDaysInMonth(1900, 1);

      // Assert: 2028 and 2000 are leap years, 1900 is not.
      expect(leapResult, '2028 is divisible by 4, so February should have 29 days').toBe(29);
      expect(by400Result, '2000 is divisible by 400, so February should have 29 days').toBe(29);
      expect(by100Result, '1900 is divisible by 100 but not 400, so February should have 28 days').toBe(28);
    });

    it('should return correct day counts for 31-day and 30-day months', () => {
      // Arrange: January (31 days) and April (30 days).

      // Act: Ask for the day count of each.
      const januaryResult = TimeUtils.getUTCDaysInMonth(2026, 0);
      const aprilResult = TimeUtils.getUTCDaysInMonth(2026, 3);

      // Assert: Month lengths follow the calendar.
      expect(januaryResult, 'January should have 31 days').toBe(31);
      expect(aprilResult, 'April should have 30 days').toBe(30);
    });

    it('should treat the month as a zero-based index', () => {
      // Arrange: Index 0 should mean January, index 1 February.

      // Act: Ask for the day count of both indices.
      const indexZeroResult = TimeUtils.getUTCDaysInMonth(2026, 0);
      const indexOneResult = TimeUtils.getUTCDaysInMonth(2026, 1);

      // Assert: Results match January and February, not February and March.
      expect(indexZeroResult, 'month index 0 should be January').toBe(31);
      expect(indexOneResult, 'month index 1 should be February').toBe(28);
    });
  });

  describe('getUTCFirstDayOfMonth', () => {
    it('should return 1 for a month starting on Tuesday', () => {
      // Arrange: 1 September 2026 is a Tuesday.

      // Act: Ask for the first weekday.
      const result = TimeUtils.getUTCFirstDayOfMonth(2026, 8);

      // Assert: Tuesday is index 1 in the Monday-based scheme.
      expect(result, 'Tuesday should map to 1 when Monday is 0').toBe(1);
    });

    it('should return 6 for a month starting on Sunday', () => {
      // Arrange: 1 February 2026 is a Sunday.

      // Act: Ask for the first weekday.
      const result = TimeUtils.getUTCFirstDayOfMonth(2026, 1);

      // Assert: Sunday folds to the end of the Monday-based week instead of staying 0.
      expect(result, 'Sunday should map to 6 when Monday is 0').toBe(6);
    });

    it('should return 0 for a month starting on Monday', () => {
      // Arrange: 1 June 2026 is a Monday.

      // Act: Ask for the first weekday.
      const result = TimeUtils.getUTCFirstDayOfMonth(2026, 5);

      // Assert: Monday is the zero point of the scheme.
      expect(result, 'Monday should map to 0').toBe(0);
    });
  });

  describe('getWeekNumber', () => {
    it('should count the week containing January 1st as week 1 even when the year does not start on Monday', () => {
      // Arrange: 1 January 2026 is a Thursday, 4 January 2026 is a Sunday.

      // Act: Ask for the week number of both days.
      const newYearResult = TimeUtils.getWeekNumber(2026, 0, 1);
      const sundayResult = TimeUtils.getWeekNumber(2026, 0, 4);

      // Assert: The whole first partial week belongs to week 1 of its own year.
      expect(newYearResult, 'January 1st should always be week 1 of its year').toBe(1);
      expect(sundayResult, 'the Sunday closing the first partial week should still be week 1').toBe(1);
    });

    it('should start week 2 on the first Monday of January', () => {
      // Arrange: 5 January 2026 is the first Monday of 2026.

      // Act: Ask for the week number.
      const result = TimeUtils.getWeekNumber(2026, 0, 5);

      // Assert: The first full week is week 2.
      expect(result, 'the first Monday of the year should open week 2').toBe(2);
    });

    it('should calculate a mid-year week number', () => {
      // Arrange: 28 June 2026, passed with a zero-based month index (5 = June).

      // Act: Ask for the week number.
      const result = TimeUtils.getWeekNumber(2026, 5, 28);

      // Assert: 26 full weeks have started since the first week of 2026.
      expect(result, 'late June 2026 should fall into week 26').toBe(26);
    });

    it('should assign days before the first Monday of January to week 1 of their own year (non-ISO)', () => {
      // Arrange: 1 January 2022 is a Saturday (ISO 8601 would call it week 52 of 2021).

      // Act: Ask for the week number.
      const result = TimeUtils.getWeekNumber(2022, 0, 1);

      // Assert: The documented algorithm keeps it in week 1 of 2022 instead.
      expect(result, 'pre-Monday January days should stay in week 1, unlike ISO 8601').toBe(1);
    });

    it('should reach week 53 for years whose first week starts late in the previous December', () => {
      // Arrange: Two years whose first Monday of January falls in the previous December.

      // Act: Ask for the week number of the last day of each year.
      const saturdayResult = TimeUtils.getWeekNumber(2022, 11, 31);
      const thursdayResult = TimeUtils.getWeekNumber(2025, 11, 31);

      // Assert: Both years run to a 53rd week under this algorithm.
      expect(saturdayResult, '31 December 2022 should close week 53').toBe(53);
      expect(thursdayResult, '31 December 2025 should close week 53').toBe(53);
    });
  });

  describe('getWeekNumberFromDate', () => {
    it('should use the UTC date even when the local date already rolled over', () => {
      // Arrange: Sunday 4 January 2026, 23:30 UTC - in Europe/Warsaw (UTC+1) the local date
      // is Monday 5 January, which already belongs to week 2.
      const date = utc(2026, 0, 4, 23, 30);

      // Act: Ask for the week number.
      const result = TimeUtils.getWeekNumberFromDate(date);

      // Assert: The UTC date decides - week 1, not the week of the rolled-over local date.
      expect(result, 'week number should follow UTC parts, not local timezone parts').toBe(1);
    });

    it('should delegate to the same week calculation for a mid-year date', () => {
      // Arrange: Midnight UTC on 28 June 2026.
      const date = utc(2026, 5, 28);

      // Act: Ask for the week number.
      const result = TimeUtils.getWeekNumberFromDate(date);

      // Assert: Same value as calling getWeekNumber with the UTC parts.
      expect(result, 'mid-year date should resolve to week 26').toBe(26);
    });
  });
});
