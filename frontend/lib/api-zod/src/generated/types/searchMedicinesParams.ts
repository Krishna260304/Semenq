import type { SearchMedicinesSortBy } from './searchMedicinesSortBy';

export type SearchMedicinesParams = {
q: string;
lat?: number;
lng?: number;
radius?: number;
sortBy?: SearchMedicinesSortBy;
};
