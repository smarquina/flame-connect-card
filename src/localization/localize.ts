import en from './en.json';
import es from './es.json';
export function localize(language: string, key: string): string {
  const dictionary: Record<string, string> = language.toLowerCase().startsWith('es') ? es : en;
  const lookup = (entry: string) =>
    Object.hasOwn(dictionary, entry) ? dictionary[entry] : undefined;
  return (
    lookup(key) ??
    key
      .split('_')
      .map((part) => lookup(part) ?? part)
      .join(' + ')
  );
}
export function numberText(language: string, value: number): string {
  try {
    return new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
  } catch {
    return new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value);
  }
}
