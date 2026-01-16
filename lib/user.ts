import axios from 'axios';

export const getUserSession = async (host?: String) => {
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

export const saveUserSession = async (data: {}, host?: String) => {
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

export const unguardUser = (user: any) => {
  // only send safe for public fields
  return {
    email: user.email,
    screenname: user.screenname,
    name: user.profile?.name || user.name,
    status: {
      role: user?.status?.role || user?.role,
    },
    accountType: user.accountType,
  };
};
