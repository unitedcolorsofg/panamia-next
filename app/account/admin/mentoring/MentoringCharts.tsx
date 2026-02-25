'use client';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  IconTrendingUp,
  IconCalendar,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';

interface MentoringChartsProps {
  chartsData: {
    sessionsOverTime: Array<{ date: string; sessions: number }>;
    sessionsByStatus: Array<{ name: string; value: number; color: string }>;
    topExpertiseChart: Array<{ name: string; count: number }>;
  };
  expandedSections: {
    sessionsOverTime: boolean;
    sessionsByStatus: boolean;
    topExpertise: boolean;
  };
  toggleSection: (
    section: 'sessionsOverTime' | 'sessionsByStatus' | 'topExpertise'
  ) => void;
}

export default function MentoringCharts({
  chartsData,
  expandedSections,
  toggleSection,
}: MentoringChartsProps) {
  return (
    <>
      {/* Sessions Over Time Chart */}
      <Card className="mb-8">
        <CardHeader
          className="cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => toggleSection('sessionsOverTime')}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <IconTrendingUp
                className="h-5 w-5"
                style={{ color: 'rgb(156, 163, 175)' }}
              />
              <span style={{ color: 'rgb(209, 213, 219)' }}>
                Sessions Over Time
              </span>
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
            {chartsData.sessionsOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartsData.sessionsOverTime}>
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
            <CardTitle className="flex items-center gap-2">
              <IconCalendar
                className="h-5 w-5"
                style={{ color: 'rgb(156, 163, 175)' }}
              />
              <span style={{ color: 'rgb(209, 213, 219)' }}>
                Sessions by Status
              </span>
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
            {chartsData.sessionsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartsData.sessionsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartsData.sessionsByStatus.map((entry, index) => (
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
            <CardTitle className="flex items-center gap-2">
              <IconTrendingUp
                className="h-5 w-5"
                style={{ color: 'rgb(156, 163, 175)' }}
              />
              <span style={{ color: 'rgb(209, 213, 219)' }}>
                Top Expertise Areas
              </span>
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
            {chartsData.topExpertiseChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartsData.topExpertiseChart}>
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
    </>
  );
}
