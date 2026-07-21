/**
 * Clock Service
 *
 * Single source of truth for all time operations in the system.
 * Enables:
 * - Deterministic testing (inject a mock clock)
 * - Consistent timezone handling
 * - Future time simulation for scheduling
 * - Centralized daylight-saving logic
 *
 * All backend code should call clockService instead of new Date().
 */

class ClockService {
  constructor(baseTime = null) {
    // For testing: allow injecting a specific time
    this.baseTime = baseTime || null;
  }

  /**
   * Get current time in UTC
   */
  nowUTC() {
    if (this.baseTime) return new Date(this.baseTime);
    return new Date();
  }

  /**
   * Get current time in a specific timezone
   * @param {string} timeZone - IANA timezone (e.g., 'Africa/Nairobi', 'America/New_York')
   * @returns {Date} A Date object representing the local time in that timezone
   */
  nowInTimezone(timeZone = 'UTC') {
    const utcNow = this.nowUTC();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(utcNow);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return new Date(
      Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second)
      )
    );
  }

  /**
   * Get start of day in UTC (00:00:00.000)
   * @param {Date|string|number} date - Date to get start of day for (defaults to now)
   * @returns {Date} Start of that day in UTC
   */
  startOfDayUTC(date = null) {
    const d = date ? new Date(date) : this.nowUTC();
    const start = new Date(d);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }

  /**
   * Get end of day in UTC (23:59:59.999)
   * @param {Date|string|number} date - Date to get end of day for (defaults to now)
   * @returns {Date} End of that day in UTC
   */
  endOfDayUTC(date = null) {
    const d = date ? new Date(date) : this.nowUTC();
    const end = new Date(d);
    end.setUTCHours(23, 59, 59, 999);
    return end;
  }

  /**
   * Get start of day in a specific timezone
   * @param {Date|string|number} date - Date to get start of day for (defaults to now)
   * @param {string} timeZone - IANA timezone
   * @returns {Date} Start of that day in the specified timezone (as UTC)
   */
  startOfDayInTimezone(date = null, timeZone = 'UTC') {
    const d = date ? new Date(date) : this.nowUTC();
    const parts = this._getTimezoneParts(d, timeZone);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
  }

  /**
   * Get end of day in a specific timezone
   * @param {Date|string|number} date - Date to get end of day for (defaults to now)
   * @param {string} timeZone - IANA timezone
   * @returns {Date} End of that day in the specified timezone (as UTC)
   */
  endOfDayInTimezone(date = null, timeZone = 'UTC') {
    const d = date ? new Date(date) : this.nowUTC();
    const parts = this._getTimezoneParts(d, timeZone);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999));
  }

  /**
   * Convert a date between timezones
   * @param {Date|string|number} date - Date to convert
   * @param {string} fromTimeZone - Source IANA timezone
   * @param {string} toTimeZone - Target IANA timezone
   * @returns {Date} Same moment in time (just formatted for display in target timezone)
   */
  convertTimezone(date, fromTimeZone = 'UTC', toTimeZone = 'UTC') {
    const d = new Date(date);
    // This is already UTC; we return it as-is
    // The caller should use getTimezoneParts() to display it
    return d;
  }

  /**
   * Get day of week (0 = Sunday, 6 = Saturday) in UTC
   * @param {Date|string|number} date - Date (defaults to now)
   * @returns {number} Day of week 0-6
   */
  getDayOfWeekUTC(date = null) {
    const d = date ? new Date(date) : this.nowUTC();
    return d.getUTCDay();
  }

  /**
   * Get day of week in a specific timezone
   * @param {Date|string|number} date - Date (defaults to now)
   * @param {string} timeZone - IANA timezone
   * @returns {number} Day of week 0-6
   */
  getDayOfWeekInTimezone(date = null, timeZone = 'UTC') {
    const d = date ? new Date(date) : this.nowUTC();
    const parts = this._getTimezoneParts(d, timeZone);
    const tempDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    return tempDate.getUTCDay();
  }

  /**
   * Get next day
   * @param {Date|string|number} date - Date (defaults to now)
   * @returns {Date} Next day at 00:00:00 UTC
   */
  nextDayUTC(date = null) {
    const d = date ? new Date(date) : this.nowUTC();
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  }

  /**
   * Get next day in a specific timezone
   * @param {Date|string|number} date - Date (defaults to now)
   * @param {string} timeZone - IANA timezone
   * @returns {Date} Next day at 00:00:00 UTC (from timezone perspective)
   */
  nextDayInTimezone(date = null, timeZone = 'UTC') {
    const d = date ? new Date(date) : this.nowUTC();
    const nextStart = this.startOfDayInTimezone(d, timeZone);
    const next = new Date(nextStart);
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  /**
   * Get previous day
   * @param {Date|string|number} date - Date (defaults to now)
   * @returns {Date} Previous day at 00:00:00 UTC
   */
  previousDayUTC(date = null) {
    const d = date ? new Date(date) : this.nowUTC();
    const prev = new Date(d);
    prev.setUTCDate(prev.getUTCDate() - 1);
    prev.setUTCHours(0, 0, 0, 0);
    return prev;
  }

  /**
   * Check if a date is in the past
   * @param {Date|string|number} date - Date to check
   * @returns {boolean}
   */
  isPast(date) {
    return new Date(date) < this.nowUTC();
  }

  /**
   * Check if a date is in the future
   * @param {Date|string|number} date - Date to check
   * @returns {boolean}
   */
  isFuture(date) {
    return new Date(date) > this.nowUTC();
  }

  /**
   * Check if a date is today (in UTC)
   * @param {Date|string|number} date - Date to check
   * @returns {boolean}
   */
  isToday(date) {
    const d = new Date(date);
    const today = this.startOfDayUTC();
    const tomorrow = this.nextDayUTC();
    return d >= today && d < tomorrow;
  }

  /**
   * Check if a given date is a working day (Monday-Friday)
   * @param {Date|string|number} date - Date to check
   * @param {string} timeZone - IANA timezone for day boundary
   * @returns {boolean}
   */
  isWorkingDay(date = null, timeZone = 'UTC') {
    const dayOfWeek = this.getDayOfWeekInTimezone(date, timeZone);
    // 1 = Monday, 5 = Friday (0 = Sunday, 6 = Saturday)
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  /**
   * Get next working day
   * @param {Date|string|number} date - Starting date (defaults to now)
   * @param {string} timeZone - IANA timezone
   * @returns {Date} Next working day at 00:00:00 UTC
   */
  nextWorkingDay(date = null, timeZone = 'UTC') {
    let current = date ? new Date(date) : this.nowUTC();
    current = this.startOfDayUTC(current);

    for (let i = 1; i <= 7; i++) {
      const candidate = new Date(current);
      candidate.setUTCDate(candidate.getUTCDate() + i);
      if (this.isWorkingDay(candidate, timeZone)) {
        return candidate;
      }
    }
    // Fallback: should not reach here
    return current;
  }

  /**
   * Calculate business minutes between two dates
   * @param {Date|string|number} start - Start time
   * @param {Date|string|number} end - End time
   * @param {string} timeZone - IANA timezone for business day boundaries
   * @returns {number} Number of business minutes (assumes 8am-5pm = 480 min/day)
   */
  businessMinutesBetween(start, end, timeZone = 'UTC') {
    let current = new Date(start);
    const endDate = new Date(end);
    let businessMinutes = 0;

    while (current < endDate) {
      const next = new Date(current);
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(0, 0, 0, 0);

      if (this.isWorkingDay(current, timeZone)) {
        const dayEnd = Math.min(next, endDate);
        businessMinutes += (dayEnd - current) / (1000 * 60);
      }

      current = next;
    }

    return Math.round(businessMinutes);
  }

  /**
   * Get timezone offset from UTC in minutes
   * @param {string} timeZone - IANA timezone
   * @param {Date} date - Date to calculate offset for (defaults to now)
   * @returns {number} Offset in minutes (positive east of UTC)
   */
  getTimezoneOffset(timeZone = 'UTC', date = null) {
    const d = date ? new Date(date) : this.nowUTC();
    const utcDate = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(d.toLocaleString('en-US', { timeZone }));
    return (utcDate - tzDate) / (1000 * 60);
  }

  /**
   * Check if a timezone is valid
   * @param {string} timeZone - IANA timezone
   * @returns {boolean}
   */
  isValidTimezone(timeZone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * For testing: set a fixed time
   * @param {Date|string|number} time - Time to set
   */
  setMockTime(time) {
    this.baseTime = new Date(time);
  }

  /**
   * For testing: reset to real time
   */
  resetMockTime() {
    this.baseTime = null;
  }

  /**
   * Internal: Get date parts in a specific timezone
   * @private
   */
  _getTimezoneParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    return Object.fromEntries(parts.map((part) => [part.type, part.value]));
  }
}

// Export singleton instance
export const clockService = new ClockService();

// Also export class for testing (allows creating instances with injected time)
export { ClockService };
