'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  IconUsers,
  IconFileDescription,
  IconEdit,
  IconArticle,
} from '@tabler/icons-react';
import PageMeta from '@/components/PageMeta';
import AdminMenu from '@/components/Admin/AdminHeader';

export default function AdminDashboardPage() {
  const { data: session } = useSession();

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

  const adminSections = [
    {
      title: 'Articles',
      description: 'Moderate community articles and content',
      href: '/account/admin/articles',
      icon: IconArticle,
      color: 'text-indigo-600',
    },
    {
      title: 'Mentoring',
      description: 'View mentoring program metrics and analytics',
      href: '/account/admin/mentoring',
      icon: IconUsers,
      color: 'text-blue-600',
    },
    {
      title: 'Podcasts',
      description: 'Manage podcast submissions and content',
      href: '/account/admin/podcasts',
      icon: IconFileDescription,
      color: 'text-purple-600',
    },
    {
      title: 'Newsletter Signups',
      description: 'View and manage newsletter subscribers',
      href: '/account/admin/signups',
      icon: IconEdit,
      color: 'text-green-600',
    },
    {
      title: 'Contact Us',
      description: 'View contact form submissions',
      href: '/account/admin/contactus',
      icon: IconEdit,
      color: 'text-orange-600',
    },
    {
      title: 'Users',
      description: 'Manage user accounts and permissions',
      href: '/account/admin/users',
      icon: IconUsers,
      color: 'text-red-600',
    },
  ];

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <PageMeta title="Admin Dashboard" desc="" />
      <AdminMenu />
      <div>
        <h2 className="mb-6 text-3xl font-bold">Admin Dashboard</h2>
        <p className="mb-8 text-gray-600 dark:text-gray-400">
          Select an admin function to manage platform content and users
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {adminSections.map((section, index) => (
            <Link key={index} href={section.href}>
              <Card className="h-full transition-all hover:scale-105 hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <section.icon className={`h-6 w-6 ${section.color}`} />
                    <span>{section.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {section.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
