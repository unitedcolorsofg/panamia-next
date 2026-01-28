import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

import { UserInterface } from '@/lib/interfaces';

export const userQueryKey = ['user'];

export async function fetchUser() {
  const user = await axios
    .get('/api/user/get', {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
    .catch((error: Error) => {
      console.log(error.name, error.message);
    });
  if (user) {
    return user.data.data;
  }
  return undefined;
}

export const useUser = () => {
  return useQuery<UserInterface | undefined, Error>({
    queryKey: userQueryKey,
    queryFn: () => fetchUser(),
  });
};
