export const MIN_GLOBAL_SEARCH_CHARACTERS = 2;

const GLOBAL_SEARCH_CHARACTER_RE = new RegExp("[\\p{L}\\p{N}]", "gu");

export function countGlobalSearchCharacters(value: string) {
  return value.match(GLOBAL_SEARCH_CHARACTER_RE)?.length ?? 0;
}

export function isValidGlobalSearchQuery(value: string) {
  return (
    countGlobalSearchCharacters(value.trim()) >= MIN_GLOBAL_SEARCH_CHARACTERS
  );
}
