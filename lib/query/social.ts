/**
 * Social Query Hooks
 *
 * React Query hooks for social timeline features.
 * @see docs/SOCIAL-ROADMAP.md Phase 4
 */

import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SocialStatusDisplay, SocialActorDisplay } from '@/lib/interfaces';
import type {
  SocialActor,
  SocialGroup,
  SocialGroupJoinPolicy,
  SocialGroupRole,
  SocialGroupVisibility,
} from '@/lib/schema';

export const socialQueryKey = ['social'];

// ============================================================================
// Types
// ============================================================================

interface TimelineResponse {
  statuses: SocialStatusDisplay[];
  nextCursor: string | null;
}

interface ActorResponse {
  actor: SocialActorDisplay;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isSelf: boolean;
}

interface MyActorResponse {
  actor: SocialActor | null;
  eligible: boolean;
  reason?: string;
  screenname?: string | null;
}

interface ActorsResponse {
  actors: SocialActor[];
  nextCursor: string | null;
}

interface RepliesResponse {
  replies: SocialStatusDisplay[];
  nextCursor: string | null;
}

/** Envelope every /api/social route responds with. */
interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Request Helper
// ============================================================================

/**
 * Wraps a failed request in an Error carrying the API's own message when it
 * sent one, so TanStack Query surfaces something actionable via `error`.
 */
function toSocialError(url: string, error: unknown, status?: number): Error {
  const apiMessage = axios.isAxiosError(error)
    ? (error.response?.data as ApiEnvelope<unknown> | undefined)?.error
    : undefined;

  const detail =
    apiMessage ||
    (error instanceof Error ? error.message : String(error)) ||
    'Request failed';

  const wrapped = new Error(
    `${url} failed (${status ?? 'network error'}): ${detail}`,
    { cause: error }
  );
  wrapped.name = 'SocialApiError';
  return wrapped;
}

// ============================================================================
// Fetch Functions
// ============================================================================

/**
 * Fetches a social API envelope and unwraps its `data`.
 *
 * The distinction that matters here is absence versus failure. A 401, 403, or
 * 404 is a definitive answer — there is no actor, or none this viewer may see —
 * so it resolves to null and the caller renders an empty state. Anything else
 * is a genuine failure and throws, so React Query reports `isError` and retries
 * instead of pretending the data is simply empty.
 *
 * Returning `undefined` is not an option. React Query rejects it outright
 * ("Query data cannot be undefined") and the query never settles, so the caller
 * spins forever. That is exactly what stranded personal profiles belonging to
 * accounts that never enrolled in Pana Social, whose actor legitimately 404s.
 *
 * Genuine failures are wrapped by `toSocialError` so the thrown value is a
 * named `SocialApiError` carrying the API's own message. That is the half of
 * #165 worth keeping: its `getSocial` helper was dropped in the merge because
 * it returned a non-nullable `T` via per-status fallbacks, which contradicts
 * the `T | null` contract every caller here and downstream is written against.
 */
async function getSocialData<T>(url: string): Promise<T | null> {
  try {
    const response = await axios.get(url);

    if (response.data?.success) {
      return (response.data.data ?? null) as T | null;
    }

    throw new Error(response.data?.error ?? `Request to ${url} failed`);
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;

    if (status === 401 || status === 403 || status === 404) {
      return null;
    }

    throw toSocialError(url, error, status);
  }
}

async function fetchMyActor(): Promise<MyActorResponse | null> {
  return getSocialData('/api/social/actors/me');
}

async function fetchTimeline(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse | null> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocialData(`/api/social/timeline?${params.toString()}`);
}

async function fetchPublicTimeline(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse | null> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocialData(`/api/social/statuses?${params.toString()}`);
}

async function fetchMyPosts(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse | null> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocialData(`/api/social/actors/me/posts?${params.toString()}`);
}

async function fetchActor(username: string): Promise<ActorResponse | null> {
  return getSocialData(`/api/social/actors/${encodeURIComponent(username)}`);
}

async function fetchActorPosts(
  username: string,
  cursor?: string,
  limit: number = 20,
  includeReplies: boolean = false
): Promise<TimelineResponse | null> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());
  if (includeReplies) params.set('replies', 'true');

  return getSocialData(
    `/api/social/actors/${encodeURIComponent(username)}/posts?${params.toString()}`
  );
}

async function fetchStatus(
  statusId: string
): Promise<{ status: SocialStatusDisplay } | null> {
  return getSocialData(`/api/social/statuses/${statusId}`);
}

async function fetchStatusReplies(
  statusId: string,
  cursor?: string,
  limit: number = 20
): Promise<RepliesResponse | null> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocialData(
    `/api/social/statuses/${statusId}/replies?${params.toString()}`
  );
}

async function fetchFollows(
  type: 'following' | 'followers',
  cursor?: string,
  limit: number = 20
): Promise<ActorsResponse | null> {
  const params = new URLSearchParams();
  params.set('type', type);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocialData(`/api/social/follows?${params.toString()}`);
}

async function fetchInboxMessages(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse | null> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocialData(`/api/social/messages/inbox?${params.toString()}`);
}

async function fetchSentMessages(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse | null> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocialData(`/api/social/messages/sent?${params.toString()}`);
}

// ============================================================================
// Query Hooks
// ============================================================================

export const useMyActor = () => {
  return useQuery<MyActorResponse | null, Error>({
    queryKey: [socialQueryKey, 'me'],
    queryFn: () => fetchMyActor(),
  });
};

export const useTimeline = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse | null, Error>({
    queryKey: [socialQueryKey, 'timeline', 'home', cursor, limit],
    queryFn: () => fetchTimeline(cursor, limit),
  });
};

export const usePublicTimeline = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse | null, Error>({
    queryKey: [socialQueryKey, 'timeline', 'public', cursor, limit],
    queryFn: () => fetchPublicTimeline(cursor, limit),
  });
};

export const useMyPosts = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse | null, Error>({
    queryKey: [socialQueryKey, 'me', 'posts', cursor, limit],
    queryFn: () => fetchMyPosts(cursor, limit),
  });
};

export const useActor = (username: string) => {
  return useQuery<ActorResponse | null, Error>({
    queryKey: [socialQueryKey, 'actor', username],
    queryFn: () => fetchActor(username),
    enabled: !!username,
  });
};

export const useActorPosts = (
  username: string,
  cursor?: string,
  limit: number = 20,
  includeReplies: boolean = false
) => {
  return useQuery<TimelineResponse | null, Error>({
    queryKey: [
      socialQueryKey,
      'actor',
      username,
      'posts',
      cursor,
      limit,
      includeReplies,
    ],
    queryFn: () => fetchActorPosts(username, cursor, limit, includeReplies),
    enabled: !!username,
  });
};

export interface PanaSummary {
  id: string;
  username: string;
  domain: string;
  name: string | null;
  summary: string | null;
  iconUrl: string | null;
}

export interface PanasResponse {
  count: number;
  // False for signed-out viewers: the count is public, the list is not.
  canSeeList: boolean;
  actors: PanaSummary[];
}

export interface ProfileGroupSummary {
  id: string;
  handle: string;
  name: string;
  summary: string | null;
  iconUrl: string | null;
  memberCount: number;
}

export interface ProfileGroupsResponse {
  groups: ProfileGroupSummary[];
}

async function fetchPanas(username: string): Promise<PanasResponse | null> {
  return getSocialData(`/api/social/actors/${username}/panas`);
}

async function fetchProfileGroups(
  username: string
): Promise<ProfileGroupsResponse | null> {
  return getSocialData(`/api/social/actors/${username}/groups`);
}

/** Panas (mutual follows) for a handle. Count public, list gated server-side. */
export const usePanas = (username: string) => {
  return useQuery<PanasResponse | null, Error>({
    queryKey: [socialQueryKey, 'actor', username, 'panas'],
    queryFn: () => fetchPanas(username),
    enabled: !!username,
  });
};

/** Discoverable groups for a handle. */
export const useProfileGroups = (username: string) => {
  return useQuery<ProfileGroupsResponse | null, Error>({
    queryKey: [socialQueryKey, 'actor', username, 'groups'],
    queryFn: () => fetchProfileGroups(username),
    enabled: !!username,
  });
};

/**
 * One group as discovery returns it.
 *
 * Identity only. The search endpoint never returns posts, roster or events,
 * which is what lets private groups appear in results at all — see
 * GROUP_COLUMNS in lib/server/group-search.ts for that reasoning.
 */
export interface GroupSearchSummary {
  id: string;
  actorId: string;
  handle: string;
  domain: string;
  name: string | null;
  summary: string | null;
  iconUrl: string | null;
  topics: Record<string, boolean>;
  visibility: SocialGroupVisibility;
  joinPolicy: SocialGroupJoinPolicy;
  memberCount: number;
}

export interface GroupSearchResponse {
  groups: GroupSearchSummary[];
  /** Echoed back so a stale render can tell which term it is showing. */
  query: string;
}

async function fetchGroupSearch(
  term: string
): Promise<GroupSearchResponse | null> {
  return getSocialData(
    `/api/social/groups?q=${encodeURIComponent(term)}&limit=${GROUP_SEARCH_LIMIT}`
  );
}

/** How many groups a search page asks for. Server clamps at 50 regardless. */
const GROUP_SEARCH_LIMIT = 24;

/**
 * Group discovery.
 *
 * An empty term is not an error and is not disabled: the endpoint browses the
 * liveliest groups instead, which is what makes the Groups tab worth opening
 * before anybody has typed anything.
 */
export const useGroupSearch = (term: string) => {
  return useQuery<GroupSearchResponse | null, Error>({
    queryKey: [socialQueryKey, 'groups', 'search', term],
    queryFn: () => fetchGroupSearch(term),
  });
};

/** What the viewer is allowed to do with a group, decided by the server. */
export interface GroupViewer {
  canRead: boolean;
  canPost: boolean;
  isMember: boolean;
  isPending: boolean;
  role: string | null;
  /** Null when signed out -- "we do not know you yet", not "you may not". */
  canJoin: boolean | null;
}

export interface GroupDetailResponse {
  group: SocialGroup;
  actor: SocialActor;
  viewer: GroupViewer;
}

async function fetchGroup(handle: string): Promise<GroupDetailResponse | null> {
  return getSocialData(`/api/social/groups/${encodeURIComponent(handle)}`);
}

/**
 * One group, plus what the viewer may do with it.
 *
 * Returns null for a missing group rather than throwing, because
 * `getSocialData` folds 404 into null -- so a caller checks `data` and not
 * `isError` to tell "no such group" from "the request failed".
 */
export const useGroup = (handle: string) => {
  return useQuery<GroupDetailResponse | null, Error>({
    queryKey: [socialQueryKey, 'group', handle],
    queryFn: () => fetchGroup(handle),
    enabled: Boolean(handle),
  });
};

/**
 * Join a group, or ask to.
 *
 * No optimistic update, unlike `useFollowActor`. Following always lands the
 * same way, so guessing the result is safe; joining resolves to either a
 * membership or a pending request depending on the group's join policy, and
 * that is the server's call. Flashing "Joined" before a request-to-join group
 * answers "Requested" is a worse experience than waiting for the truth.
 */
export const useJoinGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (handle: string) =>
      axios.post(`/api/social/groups/${encodeURIComponent(handle)}/join`),
    onSettled: (_data, _error, handle) => {
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'group', handle],
      });
      // The member count moved, so any list showing this group is now stale.
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'groups'],
      });
    },
  });
};

/** Leave a group, or withdraw a pending request. */
export const useLeaveGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (handle: string) =>
      axios.delete(`/api/social/groups/${encodeURIComponent(handle)}/join`),
    onSettled: (_data, _error, handle) => {
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'group', handle],
      });
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'groups'],
      });
    },
  });
};

/**
 * One of the signed-in member's own groups.
 *
 * Carries `visibility` and `role`, which ProfileGroupSummary deliberately
 * does not — that list renders on pages strangers read, so admitting a group
 * is private would disclose both the group and the membership.
 */
export interface MyGroupSummary {
  id: string;
  handle: string;
  name: string;
  summary: string | null;
  iconUrl: string | null;
  memberCount: number;
  visibility: SocialGroupVisibility;
  joinPolicy: SocialGroupJoinPolicy;
  role: SocialGroupRole;
}

interface MyGroupsResponse {
  groups: MyGroupSummary[];
}

async function fetchMyGroups(): Promise<MyGroupsResponse | null> {
  return getSocialData('/api/social/actors/me/groups');
}

/**
 * Every group the signed-in member belongs to, private ones included.
 *
 * Not interchangeable with `useProfileGroups`. That one asks "what may a
 * stranger know about this person" and hides private groups; this one asks
 * "where do I belong", which is the member asking about themselves. Using the
 * public one for the member's own surfaces is why the feed rail used to
 * undercount anyone in a private group.
 */
export const useMyGroups = () => {
  return useQuery<MyGroupsResponse | null, Error>({
    queryKey: [socialQueryKey, 'me', 'groups'],
    queryFn: fetchMyGroups,
  });
};

/** What the create form collects. Mirrors the POST body the route validates. */
export interface NewGroupInput {
  handle: string;
  name: string;
  summary?: string;
  topics?: string[];
  rules?: string[];
  visibility?: SocialGroupVisibility;
  joinPolicy?: SocialGroupJoinPolicy;
}

/** What POST /api/social/groups hands back on success. */
export interface CreatedGroup {
  group: SocialGroup;
  /** The group's actor. `username` is the handle it is reachable by. */
  actor: SocialActor;
}

/**
 * Create a group. The creator becomes its founding admin.
 *
 * Resolves to the group *and* its actor, because the handle a caller needs to
 * navigate to lives on the actor rather than the group row -- a group is an
 * actor, and `username` is where its address is kept.
 *
 * The server's rejection messages are unwrapped rather than collapsed into a
 * generic failure, because they are the ones worth reading: "that handle is
 * taken" and "handles may not contain spaces" are different problems with
 * different fixes, and a form that says only "could not create group" leaves
 * the member guessing which one they hit.
 */
export const useCreateGroup = () => {
  const queryClient = useQueryClient();
  return useMutation<CreatedGroup, Error, NewGroupInput>({
    mutationFn: async (input) => {
      try {
        const response = await axios.post<ApiEnvelope<CreatedGroup>>(
          '/api/social/groups',
          input
        );
        const created = response.data?.data;
        if (!created?.group) {
          throw new Error(response.data?.error ?? 'Group was not created');
        }
        return created;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const message = (error.response?.data as ApiEnvelope<never>)?.error;
          if (message) throw new Error(message);
        }
        throw error;
      }
    },
    onSuccess: () => {
      // The founder is a member the moment the group exists, so both the
      // menu and the rail count are stale.
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'me', 'groups'],
      });
      queryClient.invalidateQueries({ queryKey: [socialQueryKey, 'groups'] });
    },
  });
};

/**
 * A group's events.
 *
 * Mirrors useGroupPosts, including its silence: a non-member of a private
 * group gets an empty list rather than an error, so render off
 * `viewer.canRead` from `useGroup` rather than off emptiness.
 */
export interface GroupEventSummary {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  visibility: string;
  mode: string;
  attendeeCount: number;
  venue: { name: string; city: string; state: string } | null;
}

export const useGroupEvents = (handle: string) => {
  return useQuery<{ events: GroupEventSummary[] } | null, Error>({
    queryKey: [socialQueryKey, 'group', handle, 'events'],
    queryFn: () =>
      getSocialData(`/api/social/groups/${encodeURIComponent(handle)}/events`),
    enabled: Boolean(handle),
  });
};

async function fetchGroupPosts(
  handle: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse | null> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  return getSocialData(
    `/api/social/groups/${encodeURIComponent(handle)}/posts?${params}`
  );
}

/**
 * A group's posts.
 *
 * A non-member reading a private group gets an empty timeline rather than an
 * error, because that is the honest answer -- the server will not say whether
 * there was anything to miss. Callers should render the locked panel off
 * `viewer.canRead` from `useGroup` instead of inferring it from emptiness.
 */
export const useGroupPosts = (
  handle: string,
  cursor?: string,
  limit: number = 20
) => {
  return useQuery<TimelineResponse | null, Error>({
    queryKey: [socialQueryKey, 'group', handle, 'posts', cursor, limit],
    queryFn: () => fetchGroupPosts(handle, cursor, limit),
    enabled: Boolean(handle),
  });
};

/**
 * Post into a group.
 *
 * Separate from `useCreatePost` because the endpoint is different: the group
 * route re-checks membership and owns the addressing of a private group's
 * posts, neither of which the generic status endpoint can do from a groupId
 * it was handed by a client.
 */
export const useCreateGroupPost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, content }: { handle: string; content: string }) =>
      axios.post(`/api/social/groups/${encodeURIComponent(handle)}/posts`, {
        content,
      }),
    onSettled: (_data, _error, { handle }) => {
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'group', handle],
      });
      // The post also belongs in the author's own feed and profile.
      queryClient.invalidateQueries({ queryKey: [socialQueryKey, 'timeline'] });
    },
  });
};

export interface SuggestedPana extends PanaSummary {
  /**
   * Panas shared with the viewer. Zero means the server had no graph to walk
   * and fell back to recently joined accounts, which is the normal state for a
   * new Pana and needs different copy rather than a hidden card.
   */
  mutualCount: number;
}

export interface SuggestionsResponse {
  actors: SuggestedPana[];
}

async function fetchSuggestedPanas(): Promise<SuggestionsResponse | null> {
  return getSocialData('/api/social/suggestions');
}

/**
 * Panas you might know. Always about the signed-in viewer, so it takes no
 * handle -- the server reads the actor from the session.
 *
 * Held stale for five minutes because this renders inline in the timeline: a
 * recommendation set that reshuffles every time the feed refetches makes the
 * page feel unstable and moves the Follow button out from under a thumb.
 */
export const useSuggestedPanas = () => {
  return useQuery<SuggestionsResponse | null, Error>({
    queryKey: [socialQueryKey, 'suggestions'],
    queryFn: fetchSuggestedPanas,
    staleTime: 5 * 60 * 1000,
  });
};

export const useStatus = (statusId: string) => {
  return useQuery<{ status: SocialStatusDisplay } | null, Error>({
    queryKey: [socialQueryKey, 'status', statusId],
    queryFn: () => fetchStatus(statusId),
    enabled: !!statusId,
  });
};

export const useStatusReplies = (
  statusId: string,
  cursor?: string,
  limit: number = 20
) => {
  return useQuery<RepliesResponse | null, Error>({
    queryKey: [socialQueryKey, 'status', statusId, 'replies', cursor, limit],
    queryFn: () => fetchStatusReplies(statusId, cursor, limit),
    enabled: !!statusId,
  });
};

// `enabled` lets callers skip the request for signed-out viewers: this endpoint
// is session-scoped and answers 401 with no session, so firing it anonymously
// only produces console noise.
export const useFollows = (
  type: 'following' | 'followers',
  cursor?: string,
  limit: number = 20,
  enabled: boolean = true
) => {
  return useQuery<ActorsResponse | null, Error>({
    queryKey: [socialQueryKey, 'follows', type, cursor, limit],
    queryFn: () => fetchFollows(type, cursor, limit),
    enabled,
  });
};

export const useInboxMessages = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse | null, Error>({
    queryKey: [socialQueryKey, 'messages', 'inbox', cursor, limit],
    queryFn: () => fetchInboxMessages(cursor, limit),
  });
};

export const useSentMessages = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse | null, Error>({
    queryKey: [socialQueryKey, 'messages', 'sent', cursor, limit],
    queryFn: () => fetchSentMessages(cursor, limit),
  });
};

// ============================================================================
// Mutation Hooks
// ============================================================================

export const useEnableSocial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      return axios.post('/api/social/actors/me');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'me'],
      });
    },
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      content: string;
      contentWarning?: string;
      inReplyTo?: string;
      visibility?: 'public' | 'unlisted' | 'private' | 'direct';
      attachments?: Array<{
        type: string;
        mediaType: string;
        url: string;
        name: string;
      }>;
      /** For 'direct' visibility: array of recipient actor IDs (max 8) */
      recipientActorIds?: string[];
      /** Optional location (coordinates, name, or both) */
      location?: {
        type?: 'Place';
        latitude?: number;
        longitude?: number;
        name?: string;
        precision?: 'precise' | 'general';
      };
      /** CC license selection (default: cc-by-4) */
      ccLicense?: 'cc-by-4' | 'cc-by-sa-4' | 'cc-0';
    }) => {
      return axios.post('/api/social/statuses', data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'timeline'],
      });
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'me', 'posts'],
      });
      // Invalidate messages if this was a direct message
      if (variables.visibility === 'direct') {
        queryClient.invalidateQueries({
          queryKey: [socialQueryKey, 'messages'],
        });
      }
    },
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (statusId: string) => {
      return axios.delete(`/api/social/statuses/${statusId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'timeline'],
      });
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'me', 'posts'],
      });
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'messages'],
      });
    },
  });
};

export const useLikePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (statusId: string) => {
      return axios.post(`/api/social/statuses/${statusId}/like`);
    },
    onMutate: async (statusId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [socialQueryKey, 'status', statusId],
      });

      // Snapshot the previous value
      const previousStatus = queryClient.getQueryData([
        socialQueryKey,
        'status',
        statusId,
      ]);

      // Optimistically update
      queryClient.setQueryData(
        [socialQueryKey, 'status', statusId],
        (old: { status: SocialStatusDisplay } | undefined) => {
          if (!old) return old;
          return {
            status: {
              ...old.status,
              liked: true,
              likesCount: old.status.likesCount + 1,
            },
          };
        }
      );

      return { previousStatus };
    },
    onError: (_err, statusId, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          [socialQueryKey, 'status', statusId],
          context.previousStatus
        );
      }
    },
    onSettled: (_data, _error, statusId) => {
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'status', statusId],
      });
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'timeline'],
      });
    },
  });
};

export const useUnlikePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (statusId: string) => {
      return axios.delete(`/api/social/statuses/${statusId}/like`);
    },
    onMutate: async (statusId: string) => {
      await queryClient.cancelQueries({
        queryKey: [socialQueryKey, 'status', statusId],
      });

      const previousStatus = queryClient.getQueryData([
        socialQueryKey,
        'status',
        statusId,
      ]);

      queryClient.setQueryData(
        [socialQueryKey, 'status', statusId],
        (old: { status: SocialStatusDisplay } | undefined) => {
          if (!old) return old;
          return {
            status: {
              ...old.status,
              liked: false,
              likesCount: Math.max(0, old.status.likesCount - 1),
            },
          };
        }
      );

      return { previousStatus };
    },
    onError: (_err, statusId, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          [socialQueryKey, 'status', statusId],
          context.previousStatus
        );
      }
    },
    onSettled: (_data, _error, statusId) => {
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'status', statusId],
      });
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'timeline'],
      });
    },
  });
};

export const useFollowActor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => {
      return axios.post(
        `/api/social/actors/${encodeURIComponent(username)}/follow`
      );
    },
    onMutate: async (username: string) => {
      await queryClient.cancelQueries({
        queryKey: [socialQueryKey, 'actor', username],
      });

      const previousActor = queryClient.getQueryData([
        socialQueryKey,
        'actor',
        username,
      ]);

      queryClient.setQueryData(
        [socialQueryKey, 'actor', username],
        (old: ActorResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            isFollowing: true,
            actor: {
              ...old.actor,
              followersCount: old.actor.followersCount + 1,
            },
          };
        }
      );

      return { previousActor };
    },
    onError: (_err, username, context) => {
      if (context?.previousActor) {
        queryClient.setQueryData(
          [socialQueryKey, 'actor', username],
          context.previousActor
        );
      }
    },
    onSettled: (_data, _error, username) => {
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'actor', username],
      });
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'follows'],
      });
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'timeline'],
      });
    },
  });
};

export const useUnfollowActor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => {
      return axios.delete(
        `/api/social/actors/${encodeURIComponent(username)}/follow`
      );
    },
    onMutate: async (username: string) => {
      await queryClient.cancelQueries({
        queryKey: [socialQueryKey, 'actor', username],
      });

      const previousActor = queryClient.getQueryData([
        socialQueryKey,
        'actor',
        username,
      ]);

      queryClient.setQueryData(
        [socialQueryKey, 'actor', username],
        (old: ActorResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            isFollowing: false,
            actor: {
              ...old.actor,
              followersCount: Math.max(0, old.actor.followersCount - 1),
            },
          };
        }
      );

      return { previousActor };
    },
    onError: (_err, username, context) => {
      if (context?.previousActor) {
        queryClient.setQueryData(
          [socialQueryKey, 'actor', username],
          context.previousActor
        );
      }
    },
    onSettled: (_data, _error, username) => {
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'actor', username],
      });
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'follows'],
      });
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'timeline'],
      });
    },
  });
};
