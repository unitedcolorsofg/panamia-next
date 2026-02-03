/**
 * Social Query Hooks
 *
 * React Query hooks for social timeline features.
 * @see docs/SOCIAL-ROADMAP.md Phase 4
 */

import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SocialStatusDisplay, SocialActorDisplay } from '@/lib/interfaces';
import { SocialActor, SocialStatus } from '@prisma/client';

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
  profileSlug?: string | null;
}

interface ActorsResponse {
  actors: SocialActor[];
  nextCursor: string | null;
}

interface RepliesResponse {
  replies: SocialStatusDisplay[];
  nextCursor: string | null;
}

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchMyActor(): Promise<MyActorResponse | undefined> {
  const response = await axios
    .get('/api/social/actors/me')
    .catch((error: Error) => {
      console.log(error.name, error.message);
    });

  if (response?.data?.success) {
    return response.data.data;
  }
  return undefined;
}

async function fetchTimeline(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse | undefined> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  const response = await axios
    .get(`/api/social/timeline?${params.toString()}`)
    .catch((error: Error) => {
      console.log(error.name, error.message);
    });

  if (response?.data?.success) {
    return response.data.data;
  }
  return undefined;
}

async function fetchPublicTimeline(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse | undefined> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  const response = await axios
    .get(`/api/social/statuses?${params.toString()}`)
    .catch((error: Error) => {
      console.log(error.name, error.message);
    });

  if (response?.data?.success) {
    return response.data.data;
  }
  return undefined;
}

async function fetchMyPosts(
  cursor?: string,
  limit: number = 20
): Promise<TimelineResponse | undefined> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  const response = await axios
    .get(`/api/social/actors/me/posts?${params.toString()}`)
    .catch((error: Error) => {
      console.log(error.name, error.message);
    });

  if (response?.data?.success) {
    return response.data.data;
  }
  return undefined;
}

async function fetchActor(
  username: string
): Promise<ActorResponse | undefined> {
  const response = await axios
    .get(`/api/social/actors/${encodeURIComponent(username)}`)
    .catch((error: Error) => {
      console.log(error.name, error.message);
    });

  if (response?.data?.success) {
    return response.data.data;
  }
  return undefined;
}

async function fetchActorPosts(
  username: string,
  cursor?: string,
  limit: number = 20,
  includeReplies: boolean = false
): Promise<TimelineResponse | undefined> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());
  if (includeReplies) params.set('replies', 'true');

  const response = await axios
    .get(
      `/api/social/actors/${encodeURIComponent(username)}/posts?${params.toString()}`
    )
    .catch((error: Error) => {
      console.log(error.name, error.message);
    });

  if (response?.data?.success) {
    return response.data.data;
  }
  return undefined;
}

async function fetchStatus(
  statusId: string
): Promise<{ status: SocialStatusDisplay } | undefined> {
  const response = await axios
    .get(`/api/social/statuses/${statusId}`)
    .catch((error: Error) => {
      console.log(error.name, error.message);
    });

  if (response?.data?.success) {
    return response.data.data;
  }
  return undefined;
}

async function fetchStatusReplies(
  statusId: string,
  cursor?: string,
  limit: number = 20
): Promise<RepliesResponse | undefined> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  const response = await axios
    .get(`/api/social/statuses/${statusId}/replies?${params.toString()}`)
    .catch((error: Error) => {
      console.log(error.name, error.message);
    });

  if (response?.data?.success) {
    return response.data.data;
  }
  return undefined;
}

async function fetchFollows(
  type: 'following' | 'followers',
  cursor?: string,
  limit: number = 20
): Promise<ActorsResponse | undefined> {
  const params = new URLSearchParams();
  params.set('type', type);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  const response = await axios
    .get(`/api/social/follows?${params.toString()}`)
    .catch((error: Error) => {
      console.log(error.name, error.message);
    });

  if (response?.data?.success) {
    return response.data.data;
  }
  return undefined;
}

// ============================================================================
// Query Hooks
// ============================================================================

export const useMyActor = () => {
  return useQuery<MyActorResponse | undefined, Error>({
    queryKey: [socialQueryKey, 'me'],
    queryFn: () => fetchMyActor(),
  });
};

export const useTimeline = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse | undefined, Error>({
    queryKey: [socialQueryKey, 'timeline', 'home', cursor, limit],
    queryFn: () => fetchTimeline(cursor, limit),
  });
};

export const usePublicTimeline = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse | undefined, Error>({
    queryKey: [socialQueryKey, 'timeline', 'public', cursor, limit],
    queryFn: () => fetchPublicTimeline(cursor, limit),
  });
};

export const useMyPosts = (cursor?: string, limit: number = 20) => {
  return useQuery<TimelineResponse | undefined, Error>({
    queryKey: [socialQueryKey, 'me', 'posts', cursor, limit],
    queryFn: () => fetchMyPosts(cursor, limit),
  });
};

export const useActor = (username: string) => {
  return useQuery<ActorResponse | undefined, Error>({
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
  return useQuery<TimelineResponse | undefined, Error>({
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
  return useQuery<{ status: SocialStatusDisplay } | undefined, Error>({
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
  return useQuery<RepliesResponse | undefined, Error>({
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
  return useQuery<ActorsResponse | undefined, Error>({
    queryKey: [socialQueryKey, 'follows', type, cursor, limit],
    queryFn: () => fetchFollows(type, cursor, limit),
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
      visibility?: 'public' | 'unlisted' | 'private';
      attachments?: Array<{
        type: string;
        mediaType: string;
        url: string;
        name: string;
      }>;
    }) => {
      return axios.post('/api/social/statuses', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'timeline'],
      });
      queryClient.invalidateQueries({
        queryKey: [socialQueryKey, 'me', 'posts'],
      });
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
