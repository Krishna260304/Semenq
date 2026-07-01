import type { MapMarker } from './mapMarker';
import type { MedicineSearchResultExpansionLevel } from './medicineSearchResultExpansionLevel';
import type { SearchResultItem } from './searchResultItem';

export interface MedicineSearchResult {
  query: string;
  totalResults: number;
  searchRadius: number;
  expansionLevel: MedicineSearchResultExpansionLevel;
  results: SearchResultItem[];
  mapMarkers?: MapMarker[];
}
