'use client';

import { useAdminGate } from '@/components/Admin/gate';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { User } from 'lucide-react';
import PageMeta from '@/components/PageMeta';
import { UserInterface, Pagination } from '@/lib/interfaces';
import { standardizeDateTime } from '@/lib/standardized';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * The live user list.
 *
 * This is the original `/admin/users` page, moved here rather than deleted
 * when that path became the mock. It is the only screen in the product that
 * reads real `users` rows, so removing it to make room for a design would have
 * taken away a working tool to show a picture of a better one.
 *
 * It is off the sidebar. `/admin/users` links down to it.
 *
 * Two bugs were fixed in the move, both pre-existing:
 *
 * - `new URLSearchParams().append(...)` returns `undefined`, not the params
 *   object, so this requested `?undefined` and the page number was never sent.
 *   Every "page" showed page one, which is why Next appeared to do nothing.
 * - The avatar icon was `text-white` on a white card.
 */
export default function AdminUsersLivePage() {
  const { gate } = useAdminGate();
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
                  <User className="h-5 w-5 text-pana-ink/60" />
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
              </div>
            </div>
          </CardContent>
        </Card>
      );
    });
    return elements;
  }

  useEffect(() => {
    const params = new URLSearchParams();
    params.append('page', page_number.toString());
    axios
      .get(`/api/getUserList?${params.toString()}`, {
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

  if (gate) return gate;

  return (
    <>
      <PageMeta title="Users — live list | Admin" desc="" />
      <div>
        <h2 className="mb-2 text-3xl font-bold">Users — live list</h2>
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-pana-ink/70">
          Real rows from the database. This is the list as it exists today;{' '}
          <Link
            href="/admin/users"
            className="font-bold underline underline-offset-4"
          >
            the proposed screen
          </Link>{' '}
          is the mock.
        </p>
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
    </>
  );
}
