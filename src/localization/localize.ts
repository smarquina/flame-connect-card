import en from './en.json';
import es from './es.json';
export type TranslationKey = keyof typeof en;
export function translate(language: string, key: TranslationKey): string {
  return localize(language, key);
}
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
export function numberText(language: string, value: number, precision = 1): string {
  try {
    return new Intl.NumberFormat(language, { maximumFractionDigits: precision }).format(value);
  } catch {
    return new Intl.NumberFormat('en', { maximumFractionDigits: precision }).format(value);
  }
}
