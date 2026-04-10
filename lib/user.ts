import axios from 'axios';

export const getUserSession = async (host?: string) => {
  const path = '/api/getSessionUser';
  if (process.env.NEXT_PUBLIC_HOST_URL?.includes('localhost')) {
    host = process.env.NEXT_PUBLIC_HOST_URL;
  }
  const url = host ? `${host}${path}` : path;
  const userSession = await axios
    .get(url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
    .catch((error: Error) => {
      console.log(error.name, error.message, error.cause);
      return null;
    });
  if (userSession) {
    return userSession.data.data;
  }
  return null;
};

export const saveUserSession = async (
  data: Record<string, unknown>,
  host?: string
) => {
  const path = '/api/saveSessionUser';
  const url = host ? `${host}${path}` : path;
  const userSession = await axios
    .post(url, data, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
    .catch((error) => {
      console.log(error);
      return null;
    });
  if (userSession) {
    return userSession.data?.data;
  }
  return null;
};

export const unguardUser = (user: Record<string, unknown>) => {
  // only send safe for public fields
  const profile = user.profile as Record<string, unknown> | undefined;
  const status = user.status as Record<string, unknown> | undefined;
  return {
    email: user.email,
    screenname: user.screenname,
    name: profile?.name || user.name,
    status: {
      role: status?.role || user?.role,
    },
    accountType: user.accountType,
  };
};
