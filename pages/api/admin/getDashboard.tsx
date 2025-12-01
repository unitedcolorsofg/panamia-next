// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { auth } from '@/auth';

import dbConnect from '@/lib/connectdb';
import { forceInt, forceString } from '@/lib/standardized';
import { getSearch } from '@/lib/server/directory';
import user from '@/lib/model/user';
import { getAdminDashboard, getAdminSearch } from '@/lib/server/admin';

interface ResponseData {
  error?: string;
  success?: boolean;
  msg?: string;
  data?: any[] | any;
  pagination?: {};
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const session = await auth();

  //if (!session) { // secured route
  //  return res.status(401).json({ error: "Not Authorized:session" });
  //}

  await dbConnect();
  const userSession = session?.user?.email
    ? await user.findOne({ email: session.user.email })
    : null;
  if (!(userSession?.status?.role === 'admin')) {
    return res.status(401).json({ error: 'Not Authorized:admin' });
  }

  if (req.method !== 'GET') {
    return res
      .status(200)
      .json({ error: 'This API call only accepts GET methods' });
  }

  const dashboardMetrics = await getAdminDashboard();
  // console.log("dashboardMetrics", dashboardMetrics);
  if (dashboardMetrics) {
    return res
      .status(200)
      .json({ success: true, data: dashboardMetrics, pagination: {} });
  }
  return res.status(200).json({ success: true, data: [], pagination: {} });
}

export const config = {
  api: {
    responseLimit: '15mb',
  },
};
