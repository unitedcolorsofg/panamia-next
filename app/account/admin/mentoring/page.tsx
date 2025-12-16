'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AdminMenu from '@/components/Admin/AdminHeader';
import {
  IconUsers,
  IconCalendar,
  IconClock,
  IconTrendingUp,
  IconUserCheck,
  IconUserPlus,
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
} from '@tabler/icons-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface DashboardMetrics {
  totalMentors: number;
  activeMentors: number;
  sessions: {
    total: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  averageSessionDuration: number;
  topExpertise: Array<{ expertise: string; count: number }>;
  mentorUtilization: {
    totalSessions: number;
    activeMentors: number;
    averagePerMentor: number;
  };
  menteeEngagement: {
    uniqueMentees: number;
    returningMentees: number;
    totalBookings: number;
  };
  cancellationRate: {
    overall: number;
    byMentor: number;
    byMentee: number;
  };
  chartsData: {
    sessionsOverTime: Array<{ date: string; sessions: number }>;
    sessionsByStatus: Array<{ name: string; value: number; color: string }>;
    topExpertiseChart: Array<{ name: string; count: number }>;
  };
}

export default function MentoringDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range state (default: last 30 days)
  const [startDate, setStartDate] = useState<string>(
    format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );

  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState({
    sessionsOverTime: false,
    sessionsByStatus: false,
    topExpertise: false,
  });

  useEffect(() => {
    fetchMetrics();
  }, [startDate, endDate]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      const response = await fetch(`/api/admin/mentoring/dashboard?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const data = await response.json();
      setMetrics(data.metrics);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  if (loading && !metrics) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Mentoring Dashboard</h1>
        <p>Loading metrics...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Mentoring Dashboard</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">
              Error: {error || 'No data available'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const returningRate =
    metrics.menteeEngagement.uniqueMentees > 0
      ? Math.round(
          (metrics.menteeEngagement.returningMentees /
            metrics.menteeEngagement.uniqueMentees) *
            100
        )
      : 0;

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <AdminMenu />
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Mentoring Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Platform metrics and mentoring program performance
        </p>
      </div>

      {/* Date Range Filter */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Date Range Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded border px-3 py-2"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickRange(7)}
              >
                Last 7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickRange(30)}
              >
                Last 30 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickRange(90)}
              >
                Last 90 days
              </Button>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={fetchMetrics}
              disabled={loading}
            >
              <IconRefresh className="mr-1 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Overview Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mentors</CardTitle>
            <IconUsers className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalMentors}</div>
            <p className="text-xs text-gray-500">
              {metrics.activeMentors} active (
              {metrics.totalMentors > 0
                ? Math.round(
                    (metrics.activeMentors / metrics.totalMentors) * 100
                  )
                : 0}
              %)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sessions
            </CardTitle>
            <IconCalendar className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.sessions.total}</div>
            <p className="text-xs text-gray-500">
              {metrics.sessions.completed} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <IconClock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageSessionDuration}m
            </div>
            <p className="text-xs text-gray-500">Per session</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cancellation Rate
            </CardTitle>
            <IconAlertCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.cancellationRate.overall}%
            </div>
            <p className="text-xs text-gray-500">
              {metrics.sessions.cancelled} cancelled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sessions Over Time Chart */}
      <Card className="mb-8">
        <CardHeader
          className="cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => toggleSection('sessionsOverTime')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <IconTrendingUp className="h-5 w-5" />
              Sessions Over Time
            </CardTitle>
            {expandedSections.sessionsOverTime ? (
              <IconChevronUp className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            ) : (
              <IconChevronDown className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            )}
          </div>
        </CardHeader>
        {expandedSections.sessionsOverTime && (
          <CardContent>
            {metrics.chartsData.sessionsOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.chartsData.sessionsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), 'PPP')}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sessions"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Sessions"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-gray-500">
                No session data available for the selected date range
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Session Status Pie Chart */}
      <Card className="mb-8">
        <CardHeader
          className="cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => toggleSection('sessionsByStatus')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <IconCalendar className="h-5 w-5" />
              Sessions by Status
            </CardTitle>
            {expandedSections.sessionsByStatus ? (
              <IconChevronUp className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            ) : (
              <IconChevronDown className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            )}
          </div>
        </CardHeader>
        {expandedSections.sessionsByStatus && (
          <CardContent>
            {metrics.chartsData.sessionsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={metrics.chartsData.sessionsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {metrics.chartsData.sessionsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-gray-500">
                No session data available for the selected date range
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Top Expertise Bar Chart */}
      <Card className="mb-8">
        <CardHeader
          className="cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => toggleSection('topExpertise')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <IconTrendingUp className="h-5 w-5" />
              Top Expertise Areas
            </CardTitle>
            {expandedSections.topExpertise ? (
              <IconChevronUp className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            ) : (
              <IconChevronDown className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            )}
          </div>
        </CardHeader>
        {expandedSections.topExpertise && (
          <CardContent>
            {metrics.chartsData.topExpertiseChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.chartsData.topExpertiseChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#10b981" name="Mentors" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-gray-500">
                No expertise data available
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Sessions Breakdown & Other Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Session Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Scheduled</span>
                <span className="text-sm text-gray-500">
                  {metrics.sessions.scheduled}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">In Progress</span>
                <span className="text-sm text-gray-500">
                  {metrics.sessions.inProgress}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Completed</span>
                <span className="text-sm text-gray-500">
                  {metrics.sessions.completed}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cancelled</span>
                <span className="text-sm text-gray-500">
                  {metrics.sessions.cancelled}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cancellation Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Rate</span>
                <span className="text-sm text-gray-500">
                  {metrics.cancellationRate.overall}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">By Mentor</span>
                <span className="text-sm text-gray-500">
                  {metrics.cancellationRate.byMentor}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">By Mentee</span>
                <span className="text-sm text-gray-500">
                  {metrics.cancellationRate.byMentee}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mentor & Mentee Insights */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUserCheck className="h-5 w-5" />
              Mentor Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Active Mentors</span>
                <span className="text-sm text-gray-500">
                  {metrics.mentorUtilization.activeMentors}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Sessions</span>
                <span className="text-sm text-gray-500">
                  {metrics.mentorUtilization.totalSessions}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Avg Per Mentor</span>
                <span className="text-sm text-gray-500">
                  {metrics.mentorUtilization.averagePerMentor}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUserPlus className="h-5 w-5" />
              Mentee Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Unique Mentees</span>
                <span className="text-sm text-gray-500">
                  {metrics.menteeEngagement.uniqueMentees}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Returning Mentees</span>
                <span className="text-sm text-gray-500">
                  {metrics.menteeEngagement.returningMentees} ({returningRate}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Bookings</span>
                <span className="text-sm text-gray-500">
                  {metrics.menteeEngagement.totalBookings}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
