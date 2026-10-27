/** RFC 4180 CSV with formula-injection protection for spreadsheet apps. */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  // Prevent CSV/formula injection when opened in Excel / Sheets.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T extends Record<string, unknown>>(rows: readonly T[], columns: readonly (keyof T & string)[]): string {
  const header = columns.map(csvEscape).join(',');
  const body = rows.map((row) => columns.map((c) => csvEscape(row[c])).join(','));
  // BOM so Excel opens UTF-8 (accents, emoji) correctly.
  return '\uFEFF' + [header, ...body].join('\r\n') + '\r\n';
}
