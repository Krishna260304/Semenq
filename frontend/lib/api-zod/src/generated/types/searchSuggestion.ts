import type { SearchSuggestionType } from './searchSuggestionType';

export interface SearchSuggestion {
  text: string;
  type: SearchSuggestionType;
  medicineId?: number | null;
  category?: string | null;
}
