'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { User } from 'lucide-react';
import PageMeta from '@/components/PageMeta';
import { UserInterface, Pagination } from '@/lib/interfaces';
import { standardizeDateTime } from '@/lib/standardized';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AdminMenu from '@/components/Admin/AdminHeader';

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [page_number, setPageNumber] = useState(1);
  const [submissions_list, setSubmissionsList] = useState([]);
  const [pagination, setPagination] = useState({} as Pagination);

  function createListElements() {
    const elements = submissions_list.map((item: UserInterface, index) => {
      return (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="text-sm">
                  Created: {standardizeDateTime(item?.createdAt)}
                </div>
                <div className="text-sm">
                  Updated: {standardizeDateTime(item?.updatedAt)}
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">Name:</span> {item?.name}
                </div>
                <div>
                  <span className="font-semibold">Email:</span> {item?.email}
                </div>
                <div>
                  <span className="font-semibold">Role:</span>{' '}
                  {item?.status?.role}
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
      .get(`/api/getUserList?${params}`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      .then((resp) => {
        setSubmissionsList(resp.data.data);
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
      <main className="min-h-screen bg-gray-50 py-8 dark:bg-gray-900">
        <PageMeta title="Unauthorized" desc="" />
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-6 text-3xl font-bold">UNAUTHORIZED</h2>
          <h3 className="text-xl">You must be logged in to view this page.</h3>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 dark:bg-gray-900">
      <PageMeta title="Users | Admin" desc="" />
      <AdminMenu />
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-6 text-3xl font-bold">Users</h2>
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
