/**
 * Format a number with commas as thousands separators and specified decimal places
 */
export function formatNumber(number: number, decimalPlaces: number = 2): string {
  return number.toLocaleString('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  });
}

/**
 * Format duration in minutes to a human readable string (e.g. "1h 30m" or "45m")
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  } else {
    return `${mins}m`;
  }
}

/**
 * Format a date to a simple day, month, year format
 * @param date The date to format
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const day = d.getDate();
  const month = d.getMonth() + 1; // JavaScript months are 0-indexed
  const year = d.getFullYear();
  
  // Format as DD/MM/YYYY
  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
} 