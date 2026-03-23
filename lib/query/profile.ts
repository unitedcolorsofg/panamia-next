import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import i18n from '@/lib/i18n';

import { ProfileInterface } from '@/lib/interfaces';

export const profileQueryKey = ['profile'];
export const profilePublicQueryKey = 'publicProfile';

export async function fetchProfile() {
  console.log('fetchProfile');
  const profile = await axios
    .get('/api/getProfile', {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
    .catch((error: Error) => {
      console.log(error.name, error.message);
      throw error;
    });
  if (profile?.data?.data) {
    return profile.data.data;
  }
  throw new Error('No profile data returned');
}

export async function fetchPublicProfile(handle: string) {
  console.log('fetchPublicProfile');

  const params = new URLSearchParams();
  params.append('handle', handle);
  const profile = await axios
    .get(`/api/profile/public?${params}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
    .catch((error: Error) => {
      console.log(error.name, error.message);
      throw error;
    });
  if (profile?.data?.data) {
    return profile.data.data;
  }
  throw new Error('No profile data returned');
}

export const useProfile = () => {
  return useQuery<ProfileInterface, Error>({
    queryKey: profileQueryKey,
    queryFn: () => fetchProfile(),
  });
};

export const useMutateProfileContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => {
      return axios.post('/api/profile/saveContact', updates);
    },
    onSuccess: () => {
      toast({
        title: i18n.t('success', { ns: 'toast' }),
        description: i18n.t('profileUpdated', { ns: 'toast' }),
      });
      return queryClient.invalidateQueries({
        queryKey: profileQueryKey,
        exact: true,
      });
    },
    onError: () => {
      toast({
        title: i18n.t('error', { ns: 'toast' }),
        description: i18n.t('profileUpdateFailed', { ns: 'toast' }),
        variant: 'destructive',
      });
    },
  });
};

export const useMutateProfileGenteDePana = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => {
      return axios.post('/api/profile/saveGenteDePana', updates);
    },
    onSuccess: () => {
      toast({
        title: i18n.t('success', { ns: 'toast' }),
        description: i18n.t('profileUpdated', { ns: 'toast' }),
      });
      return queryClient.invalidateQueries({
        queryKey: profileQueryKey,
        exact: true,
      });
    },
    onError: () => {
      toast({
        title: i18n.t('error', { ns: 'toast' }),
        description: i18n.t('profileUpdateFailed', { ns: 'toast' }),
        variant: 'destructive',
      });
    },
  });
};

export const useMutateProfileDesc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => {
      return axios.post('/api/profile/saveDesc', updates);
    },
    onSuccess: () => {
      toast({
        title: i18n.t('success', { ns: 'toast' }),
        description: i18n.t('profileUpdated', { ns: 'toast' }),
      });
      return queryClient.invalidateQueries({
        queryKey: profileQueryKey,
        exact: true,
      });
    },
    onError: () => {
      toast({
        title: i18n.t('error', { ns: 'toast' }),
        description: i18n.t('profileUpdateFailed', { ns: 'toast' }),
        variant: 'destructive',
      });
    },
  });
};

export const useMutateProfileSocial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => {
      return axios.post('/api/profile/saveSocial', updates);
    },
    onSuccess: () => {
      toast({
        title: i18n.t('success', { ns: 'toast' }),
        description: i18n.t('profileUpdated', { ns: 'toast' }),
      });
      return queryClient.invalidateQueries({
        queryKey: profileQueryKey,
        exact: true,
      });
    },
    onError: () => {
      toast({
        title: i18n.t('error', { ns: 'toast' }),
        description: i18n.t('profileUpdateFailed', { ns: 'toast' }),
        variant: 'destructive',
      });
    },
  });
};

export const useMutateProfileAddress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => {
      return axios.post('/api/profile/saveAddress', updates);
    },
    onSuccess: () => {
      toast({
        title: i18n.t('success', { ns: 'toast' }),
        description: i18n.t('profileUpdated', { ns: 'toast' }),
      });
      return queryClient.invalidateQueries({
        queryKey: profileQueryKey,
        exact: true,
      });
    },
    onError: () => {
      toast({
        title: i18n.t('error', { ns: 'toast' }),
        description: i18n.t('profileUpdateFailed', { ns: 'toast' }),
        variant: 'destructive',
      });
    },
  });
};

export const useMutateProfileCategories = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => {
      return axios.post('/api/profile/saveCategories', updates);
    },
    onSuccess: () => {
      toast({
        title: i18n.t('success', { ns: 'toast' }),
        description: i18n.t('profileUpdated', { ns: 'toast' }),
      });
      return queryClient.invalidateQueries({
        queryKey: profileQueryKey,
        exact: true,
      });
    },
    onError: () => {
      toast({
        title: i18n.t('error', { ns: 'toast' }),
        description: i18n.t('profileUpdateFailed', { ns: 'toast' }),
        variant: 'destructive',
      });
    },
  });
};
