
export type SearchSuggestionType = typeof SearchSuggestionType[keyof typeof SearchSuggestionType];


export const SearchSuggestionType = {
  medicine: 'medicine',
  generic: 'generic',
  brand: 'brand',
  category: 'category',
} as const;
