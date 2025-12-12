'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Circle, CheckCircle } from 'lucide-react';
import PageMeta from '@/components/PageMeta';
import { SignupInterface, Pagination } from '@/lib/interfaces';
import { standardizeDateTime } from '@/lib/standardized';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AdminMenu from '@/components/Admin/AdminHeader';

export default function AdminSignupsPage() {
  const { data: session } = useSession();
  const [page_number, setPageNumber] = useState(1);
  const [signups_list, setSignupsList] = useState([]);
  const [pagination, setPagination] = useState({} as Pagination);

  function signupType(value: any) {
    if (value == 'creative_biz_org') {
      return 'I am a locally-based creative/business/organization';
    }
    if (value == 'resident_support') {
      return 'I am a South Florida resident interested in supporting local';
    }
    if (value == 'visiting_florida') {
      return "I'm visiting South Florida and want to engage with the local scene";
    }
  }

  function createListElements() {
    const elements = signups_list.map((item: SignupInterface, index) => {
      return (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  {!item.acknowledged && (
                    <Circle className="h-5 w-5 text-white" />
                  )}
                  {item.acknowledged && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <div className="text-sm">
                  Created: {standardizeDateTime(item?.createdAt)}
                </div>
                <div className="text-sm">
                  Updated: {standardizeDateTime(item?.updatedAt)}
                </div>
                {!item.acknowledged && <Button size="sm">Acknowledge</Button>}
              </div>
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">Name:</span> {item?.name}
                </div>
                <div>
                  <span className="font-semibold">Email:</span> {item?.email}
                </div>
                <div>
                  <span className="font-semibold">Signup Type:</span>{' '}
                  {signupType(item?.signupType)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    });
    return elements;
  }

  useEffect(() => {
    const params = new URLSearchParams().append('page', page_number.toString());
    axios
      .get(`/api/getSignupList?${params}`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      .then((resp) => {
        setSignupsList(resp.data.data);
        setPagination(resp.data.pagination);
        return resp;
      })
      .catch((error) => {
        console.log(error);
        return [];
      });
  }, [page_number]);

  if (!session) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <PageMeta title="Unauthorized" desc="" />
        <div>
          <h2 className="mb-6 text-3xl font-bold">UNAUTHORIZED</h2>
          <h3 className="text-xl">You must be logged in to view this page.</h3>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <PageMeta title="Newsletter Submissions | Admin" desc="" />
      <AdminMenu />
      <div>
        <h2 className="mb-6 text-3xl font-bold">Newsletter Submissions</h2>
        <div className="space-y-6">
          <div className="space-y-4">{createListElements()}</div>
          <div className="flex items-center gap-4">
            <small>Page: {pagination?.page_number}</small>
            <Button
              onClick={() => setPageNumber(page_number - 1)}
              disabled={pagination?.page_number == 1}
            >
              Previous
            </Button>
            <Button
              onClick={() => setPageNumber(page_number + 1)}
              disabled={pagination?.page_number == pagination.total_pages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
