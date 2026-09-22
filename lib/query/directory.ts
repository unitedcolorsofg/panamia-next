import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

export type DirectorySort = 'relevance' | 'nearest' | 'recommended' | 'name';

interface SearchInterface {
  pageNum: number;
  pageLimit: number;
  searchTerm: string;
  filterLocations: string;
  filterCategories: string;
  random: number;
  geolat: number;
  geolng: number;
  sort?: DirectorySort;
  certifiedOnly?: boolean;
  withEventsOnly?: boolean;
  mentorsOnly?: boolean;
  expertise?: string;
  languages?: string;
  freeOnly?: boolean;
}

/** The next public event a listing is hosting, within three months. */
export interface SearchEventInterface {
  slug: string;
  title: string;
  /** ISO 8601. Serialised as a string because it crosses a JSON boundary. */
  startsAt: string;
  timezone: string;
  online: boolean;
  venueCity: string | null;
}

export interface SearchResultsInterface {
  _id: string;
  id: string;
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
  /** First gallery photo, standing in for a cover. Null when there are none. */
  coverImage?: string | null;
  primary_address?: { city?: string };
  /** True when the business has nowhere to visit, so distance does not apply. */
  online_only?: boolean;
  categories?: string[];
  counties?: string[];
  /** Awarded by Pana Mia, not self-declared. */
  certified?: boolean;
  /** Has a handle, so it has a profile page. Otherwise it gets a claim CTA. */
  claimed?: boolean;
  saves?: number;
  recommends?: number;
  /** Faces for the recommend row. Recommendations only — saves are private. */
  recommenderAvatars?: string[];
  nextEvent?: SearchEventInterface | null;
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
  // Sent at two decimal places so the edge cache key stays low-cardinality and
  // the CDN never sees a precise location. Omitted entirely when absent, so a
  // visitor who has not shared one produces the same URL as everybody else.
  if (Number.isFinite(params.geolat) && Number.isFinite(params.geolng)) {
    if (params.geolat !== 0 || params.geolng !== 0) {
      qs.append('geolat', params.geolat.toFixed(2));
      qs.append('geolng', params.geolng.toFixed(2));
    }
  }
  if (params.sort && params.sort !== 'relevance') {
    qs.append('sort', params.sort);
  }
  if (params.certifiedOnly) {
    qs.append('certified', 'true');
  }
  if (params.withEventsOnly) {
    qs.append('events', 'true');
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
