'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Heart } from 'lucide-react';
import { useSearch } from '@/lib/query/directory';
import { calcDistance } from '@/lib/geolocation';
import { forceInt } from '@/lib/standardized';
import { SearchResultCard } from './search-result-card';
import { SearchFilters } from './search-filters';
import { SearchPagination } from './search-pagination';

function getSearchParams(searchParams: URLSearchParams) {
  const pageNum = forceInt(searchParams.get('p') || '', 1);
  const pageLimit = forceInt(searchParams.get('l') || '', 20);
  const searchTerm = searchParams.get('q') || '';
  const random = forceInt(searchParams.get('random') || '', 0);
  const geolat = searchParams.get('geolat') || null;
  const geolng = searchParams.get('geolng') || null;
  const filterLocations = searchParams.get('floc') || '';
  const filterCategories = searchParams.get('fcat') || '';
  const mentorsOnly = searchParams.get('mentors') === 'true';
  const expertise = searchParams.get('expertise') || '';
  const languages = searchParams.get('lang') || '';
  const freeOnly = searchParams.get('free') === 'true';

  return {
    pageNum,
    pageLimit,
    searchTerm,
    geolat: geolat ? parseFloat(geolat) : 0,
    geolng: geolng ? parseFloat(geolng) : 0,
    filterLocations,
    filterCategories,
    random,
    mentorsOnly,
    expertise,
    languages,
    freeOnly,
  };
}

export function DirectorySearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const params = getSearchParams(searchParams || new URLSearchParams());
  const [searchInput, setSearchInput] = useState(params.searchTerm);

  const { data: searchData, isLoading } = useSearch(params);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    qs.append('q', searchInput);
    router.push(`/directory/search/?${qs}`);
  };

  const handleApplyFilters = (filters: {
    locations: string[];
    categories: string[];
    mentorsOnly: boolean;
    expertise: string;
    languages: string;
    freeOnly: boolean;
  }) => {
    const newParams = new URLSearchParams(searchParams?.toString() || '');
    newParams.set('floc', filters.locations.join('+'));
    newParams.set('fcat', filters.categories.join('+'));
    newParams.set('mentors', filters.mentorsOnly.toString());
    newParams.set('expertise', filters.expertise);
    newParams.set('lang', filters.languages);
    newParams.set('free', filters.freeOnly.toString());
    newParams.set('p', '1'); // Reset to page 1 when filtering
    router.push(`/directory/search/?${newParams}`);
  };

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams?.toString() || '');
    newParams.set('p', newPage.toString());
    router.push(`/directory/search/?${newParams}`);
  };

  const calculateDistance = (lat: number, lng: number) => {
    if (params.geolat && params.geolng && lat && lng) {
      return calcDistance(params.geolat, params.geolng, lat, lng);
    }
    return 0;
  };

  const totalResults = searchData?.[0]?.meta?.count?.total || 0;
  const totalPages = totalResults
    ? Math.ceil(totalResults / params.pageLimit)
    : 1;

  const selectedLocations = params.filterLocations
    ? params.filterLocations.split('+').filter(Boolean)
    : [];
  const selectedCategories = params.filterCategories
    ? params.filterCategories.split('+').filter(Boolean)
    : [];

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <section className="text-center">
          <h1 className="text-4xl font-bold">Pana Mia Directory</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Explore South Florida locals and communities
          </p>
        </section>

        {/* Search Form */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <label
                htmlFor="search-field"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                Enter a name, keyword or search by location to find local
                creatives and businesses!
              </label>
              <div className="flex gap-2">
                <Input
                  id="search-field"
                  name="search_term"
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search Pana Mia"
                  className="flex-1"
                />
                <Button type="submit" className="gap-2">
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <SearchFilters
            selectedLocations={selectedLocations}
            selectedCategories={selectedCategories}
            mentorsOnly={params.mentorsOnly}
            expertise={params.expertise}
            languages={params.languages}
            freeOnly={params.freeOnly}
            onApplyFilters={handleApplyFilters}
          />
        </div>

        {/* No Search Message */}
        {params.searchTerm.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                You haven't searched anything yet, explore some of our local
                profiles below!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">Loading...</p>
            </CardContent>
          </Card>
        )}

        {/* Search Results */}
        {!isLoading && searchData && searchData.length > 0 && (
          <div className="space-y-4">
            {searchData.map((profile) => {
              const lat = profile.geo?.coordinates?.[1];
              const lng = profile.geo?.coordinates?.[0];
              const distance =
                lat && lng ? calculateDistance(lat, lng) : undefined;
              const profileId = profile._id as string;
              const isMentor = (profile as any).mentoring?.enabled === true;

              return (
                <SearchResultCard
                  key={profileId}
                  profile={profile}
                  distance={distance}
                  isMentor={isMentor}
                />
              );
            })}

            {/* Pagination */}
            <SearchPagination
              currentPage={params.pageNum}
              totalPages={totalPages}
              totalResults={totalResults}
              onPageChange={handlePageChange}
            />
          </div>
        )}

        {/* No Results */}
        {!isLoading &&
          searchData &&
          searchData.length === 0 &&
          params.searchTerm.length > 0 && (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  No results found. Try a different search term or adjust your
                  filters.
                </p>
              </CardContent>
            </Card>
          )}

        {/* Signup CTA */}
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardHeader>
            <CardTitle>Your Profile Here!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              A listing is an awesome way to share your work with the South
              Florida community.
            </p>
            <Button asChild>
              <Link href="/form/become-a-pana">
                Sign up to see your business listed!
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Social CTA */}
        {!session && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                <Link
                  href="/api/auth/signin"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Sign Up
                </Link>{' '}
                to follow{' '}
                <Heart className="inline h-4 w-4 fill-red-500 text-red-500" />{' '}
                your favorite profiles and see their posts in your timeline!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Referral CTA */}
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Don't see your favorite local spot here?{' '}
              <Link
                href="/form/contact-us"
                className="font-semibold text-blue-600 hover:underline"
              >
                Send us a recommendation!
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
