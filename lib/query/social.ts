/**
 * Social Query Hooks
 *
 * React Query hooks for social timeline features.
 * @see docs/SOCIAL-ROADMAP.md Phase 4
 */

import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SocialStatusDisplay, SocialActorDisplay } from '@/lib/interfaces';
import type { SocialActor } from '@/lib/schema';

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

/**
 * GETs a social API endpoint and unwraps its `{ success, data }` envelope.
 *
 * Anything that is genuinely a failure — network error, non-2xx response, or a
 * malformed envelope — is thrown so TanStack Query reports `isError` and
 * applies its retry/backoff. Crucially it never resolves to `undefined`, which
 * both violates TanStack's contract and makes a broken request look identical
 * to "there is no data".
 *
 * `expected` maps status codes that are *known states* rather than faults onto
 * a defined value: 401 means "signed out" (public pages mount these hooks for
 * anonymous visitors) and 404 means "no such actor/status". Retrying those
 * would be pointless, so they resolve to an explicit empty result instead.
 */
async function getSocial<T>(
  url: string,
  expected?: Record<number, () => T>
): Promise<T> {
  let envelope: ApiEnvelope<T> | undefined;

  try {
    envelope = (await axios.get<ApiEnvelope<T>>(url)).data;
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;

    const knownState = status === undefined ? undefined : expected?.[status];
    if (knownState) {
      return knownState();
    }

    const socialError = toSocialError(url, error, status);
    console.error(socialError.name, socialError.message);
    throw socialError;
  }

  if (!envelope?.success || envelope.data === undefined) {
    throw toSocialError(
      url,
      new Error(envelope?.error || 'Malformed response envelope'),
      200
    );
  }

  return envelope.data;
}

const emptyTimeline = (): TimelineResponse => ({
  statuses: [],
  nextCursor: null,
});
const emptyReplies = (): RepliesResponse => ({
  replies: [],
  nextCursor: null,
});
const emptyActors = (): ActorsResponse => ({ actors: [], nextCursor: null });

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchMyActor(): Promise<MyActorResponse> {
  return getSocial<MyActorResponse>('/api/social/actors/me', {
    401: () => ({
      actor: null,
      eligible: false,
      reason: 'Sign in to use social features.',
    }),
  });
}

async function fetchTimeline(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocial<TimelineResponse>(
    `/api/social/timeline?${params.toString()}`,
    { 401: emptyTimeline }
  );
}

async function fetchPublicTimeline(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocial<TimelineResponse>(
    `/api/social/statuses?${params.toString()}`
  );
}

async function fetchMyPosts(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocial<TimelineResponse>(
    `/api/social/actors/me/posts?${params.toString()}`,
    { 401: emptyTimeline }
  );
}

async function fetchActor(username: string): Promise<ActorResponse | null> {
  return getSocial<ActorResponse | null>(
    `/api/social/actors/${encodeURIComponent(username)}`,
    { 404: () => null }
  );
}

async function fetchActorPosts(
  username: string,
  cursor?: string,
  limit: number = 20,
  includeReplies: boolean = false
): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());
  if (includeReplies) params.set('replies', 'true');

  return getSocial<TimelineResponse>(
    `/api/social/actors/${encodeURIComponent(username)}/posts?${params.toString()}`,
    { 404: emptyTimeline }
  );
}

async function fetchStatus(
  statusId: string
): Promise<{ status: SocialStatusDisplay } | null> {
  return getSocial<{ status: SocialStatusDisplay } | null>(
    `/api/social/statuses/${statusId}`,
    { 404: () => null }
  );
}

async function fetchStatusReplies(
  statusId: string,
  cursor?: string,
  limit: number = 20
): Promise<RepliesResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocial<RepliesResponse>(
    `/api/social/statuses/${statusId}/replies?${params.toString()}`,
    { 404: emptyReplies }
  );
}

async function fetchFollows(
  type: 'following' | 'followers',
  cursor?: string,
  limit: number = 20
): Promise<ActorsResponse> {
  const params = new URLSearchParams();
  params.set('type', type);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocial<ActorsResponse>(`/api/social/follows?${params.toString()}`, {
    401: emptyActors,
  });
}

async function fetchInboxMessages(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocial<TimelineResponse>(
    `/api/social/messages/inbox?${params.toString()}`,
    { 401: emptyTimeline }
  );
}

async function fetchSentMessages(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return getSocial<TimelineResponse>(
    `/api/social/messages/sent?${params.toString()}`,
    { 401: emptyTimeline }
  );
}

// ============================================================================
// Query Hooks
// ============================================================================

export const useMyActor = () => {
  return useQuery<MyActorResponse, Error>({
    queryKey: [socialQueryKey, 'me'],
    queryFn: () => fetchMyActor(),
  });
};

export const useTimeline = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse, Error>({
    queryKey: [socialQueryKey, 'timeline', 'home', cursor, limit],
    queryFn: () => fetchTimeline(cursor, limit),
  });
};

export const usePublicTimeline = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse, Error>({
    queryKey: [socialQueryKey, 'timeline', 'public', cursor, limit],
    queryFn: () => fetchPublicTimeline(cursor, limit),
  });
};

export const useMyPosts = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse, Error>({
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
  return useQuery<TimelineResponse, Error>({
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
  return useQuery<RepliesResponse, Error>({
    queryKey: [socialQueryKey, 'status', statusId, 'replies', cursor, limit],
    queryFn: () => fetchStatusReplies(statusId, cursor, limit),
    enabled: !!statusId,
  });
};

export const useFollows = (
  type: 'following' | 'followers',
  cursor?: string,
  limit: number = 20
) => {
  return useQuery<ActorsResponse, Error>({
    queryKey: [socialQueryKey, 'follows', type, cursor, limit],
    queryFn: () => fetchFollows(type, cursor, limit),
  });
};

export const useInboxMessages = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse, Error>({
    queryKey: [socialQueryKey, 'messages', 'inbox', cursor, limit],
    queryFn: () => fetchInboxMessages(cursor, limit),
  });
};

export const useSentMessages = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse, Error>({
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
