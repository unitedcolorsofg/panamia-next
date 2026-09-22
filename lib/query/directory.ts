import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

interface SearchInterface {
  pageNum: number;
  pageLimit: number;
  searchTerm: string;
  filterLocations: string;
  filterCategories: string;
  random: number;
  geolat: number;
  geolng: number;
  mentorsOnly?: boolean;
  expertise?: string;
  languages?: string;
  freeOnly?: boolean;
}

export interface SearchResultsInterface {
  _id: string;
  score: number;
  score_details: Record<string, unknown>;
  name: string;
  screenname: string | null;
  details: string;
  five_words: string;
  geo: {
    coordinates?: Array<2>;
  };
  images: {
    primaryCDN: string;
  };
  primary_address?: { city?: string };
  /** True when the business has nowhere to visit, so distance does not apply. */
  online_only?: boolean;
  socials: Record<string, unknown>;
}

export interface SearchPaginationInterface {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SearchResponseInterface {
  success: boolean;
  data: SearchResultsInterface[];
  pagination: SearchPaginationInterface;
}

const emptyResponse: SearchResponseInterface = {
  success: false,
  data: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

export const searchParamsToString = (params: SearchInterface) => {
  const qs = new URLSearchParams();
  qs.append('q', params.searchTerm);
  if (params.pageNum > 1) {
    qs.append('page', params.pageNum.toString());
  }
  if (params.pageLimit !== 20) {
    qs.append('limit', params.pageLimit.toString());
  }
  if (params.filterLocations) {
    qs.append('floc', params.filterLocations);
  }
  if (params.filterCategories) {
    qs.append('fcat', params.filterCategories);
  }
  if (params.mentorsOnly) {
    qs.append('mentors', 'true');
  }
  if (params.expertise) {
    qs.append('expertise', params.expertise);
  }
  if (params.languages) {
    qs.append('lang', params.languages);
  }
  if (params.freeOnly) {
    qs.append('free', 'true');
  }
  return `${qs}`;
};

export const directorySearchKey = 'directorySearch';

export async function fetchSearch(query: SearchInterface) {
  const response = await axios
    .get<SearchResponseInterface>(
      `/api/getDirectorySearch?${searchParamsToString(query)}`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    )
    .catch((error: Error) => {
      console.log(error.name, error.message);
    });
  if (response) {
    return response.data;
  }
  return emptyResponse;
}

export const useSearch = (filters: SearchInterface) => {
  return useQuery<SearchResponseInterface, Error>({
    queryKey: [directorySearchKey, filters],
    queryFn: () => fetchSearch(filters),
  });
};
