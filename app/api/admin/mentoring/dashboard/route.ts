import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { mentorSessions, profiles } from '@/lib/schema';
import { ProfileMentoring } from '@/lib/interfaces';
import { and, asc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';

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

export async function GET(request: NextRequest) {
  const session = await auth();

  // Check if user is admin
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Add admin role check
  // const user = await db.query.users.findFirst({ where: eq(users.email, session.user.email) });
  // if (user?.role !== 'admin') {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }

  try {
    // Parse date range from query params
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Default to last 30 days if no dates provided
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    // Set endDate to end of day (23:59:59.999) to include all sessions on that day
    endDate.setHours(23, 59, 59, 999);

    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // Set startDate to beginning of day (00:00:00.000)
    startDate.setHours(0, 0, 0, 0);

    console.log('Date filter:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Debug: Check total sessions without date filter
    const [{ count: totalSessionsInDB }] = await db
      .select({ count: sql<string>`count(*)` })
      .from(mentorSessions);
    console.log('Total sessions in DB:', totalSessionsInDB);

    // 1. Total mentors and active mentors
    // Get all profiles with mentoring enabled
    const mentorProfiles = await db
      .select({ mentoring: profiles.mentoring })
      .from(profiles)
      .where(sql`${profiles.mentoring}->>'enabled' = 'true'`);
    const totalMentors = mentorProfiles.length;

    // Active mentors (those with at least one completed session in date range)
    const activeMentorsSessions = await db
      .selectDistinct({ mentorEmail: mentorSessions.mentorEmail })
      .from(mentorSessions)
      .where(
        and(
          eq(mentorSessions.status, 'completed'),
          gte(mentorSessions.scheduledAt, startDate),
          lte(mentorSessions.scheduledAt, endDate)
        )
      );
    const activeMentors = activeMentorsSessions.length;

    // 2. Session counts by status (filtered by date)
    const sessionCountsByStatus = await db
      .select({
        status: mentorSessions.status,
        count: sql<string>`count(*)`.as('count'),
      })
      .from(mentorSessions)
      .where(
        and(
          gte(mentorSessions.scheduledAt, startDate),
          lte(mentorSessions.scheduledAt, endDate)
        )
      )
      .groupBy(mentorSessions.status);

    const sessions = {
      total: 0,
      scheduled: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    };

    sessionCountsByStatus.forEach((item) => {
      sessions.total += Number(item.count);
      if (item.status === 'scheduled') sessions.scheduled = Number(item.count);
      if (item.status === 'in_progress')
        sessions.inProgress = Number(item.count);
      if (item.status === 'completed') sessions.completed = Number(item.count);
      if (item.status === 'cancelled') sessions.cancelled = Number(item.count);
    });

    // 3. Average session duration (filtered by date)
    const [avgResult] = await db
      .select({ avg: sql<string | null>`avg(${mentorSessions.duration})` })
      .from(mentorSessions)
      .where(
        and(
          gte(mentorSessions.scheduledAt, startDate),
          lte(mentorSessions.scheduledAt, endDate)
        )
      );
    const averageSessionDuration = Number(avgResult?.avg ?? 0);

    // 4. Top expertise areas (no date filter - all mentors)
    // Process expertise from fetched mentor profiles
    const expertiseCounts = new Map<string, number>();
    for (const profile of mentorProfiles) {
      const mentoring = profile.mentoring as ProfileMentoring | null;
      if (mentoring?.expertise) {
        for (const exp of mentoring.expertise) {
          expertiseCounts.set(exp, (expertiseCounts.get(exp) || 0) + 1);
        }
      }
    }
    const expertiseStats = Array.from(expertiseCounts.entries())
      .map(([expertise, count]) => ({ expertise, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 5. Mentor utilization (filtered by date)
    const mentorUtilization = {
      totalSessions: sessions.completed,
      activeMentors,
      averagePerMentor:
        activeMentors > 0 ? sessions.completed / activeMentors : 0,
    };

    // 6. Mentee engagement (filtered by date)
    const uniqueMenteesSessions = await db
      .selectDistinct({ menteeEmail: mentorSessions.menteeEmail })
      .from(mentorSessions)
      .where(
        and(
          gte(mentorSessions.scheduledAt, startDate),
          lte(mentorSessions.scheduledAt, endDate)
        )
      );
    const uniqueMentees = uniqueMenteesSessions.length;

    const menteeBookings = await db
      .select({
        menteeEmail: mentorSessions.menteeEmail,
        count: sql<string>`count(*)`.as('count'),
      })
      .from(mentorSessions)
      .where(
        and(
          gte(mentorSessions.scheduledAt, startDate),
          lte(mentorSessions.scheduledAt, endDate)
        )
      )
      .groupBy(mentorSessions.menteeEmail);
    const returningMentees = menteeBookings.filter(
      (m) => Number(m.count) > 1
    ).length;

    const menteeEngagement = {
      uniqueMentees,
      returningMentees,
      totalBookings: sessions.total,
    };

    // 7. Cancellation rates (filtered by date)
    const cancelledSessions = await db
      .select({
        cancelledBy: mentorSessions.cancelledBy,
        mentorEmail: mentorSessions.mentorEmail,
        menteeEmail: mentorSessions.menteeEmail,
      })
      .from(mentorSessions)
      .where(
        and(
          eq(mentorSessions.status, 'cancelled'),
          isNotNull(mentorSessions.cancelledBy),
          gte(mentorSessions.scheduledAt, startDate),
          lte(mentorSessions.scheduledAt, endDate)
        )
      );

    let cancelledByMentor = 0;
    let cancelledByMentee = 0;

    for (const s of cancelledSessions) {
      if (s.cancelledBy === s.mentorEmail) {
        cancelledByMentor++;
      } else if (s.cancelledBy === s.menteeEmail) {
        cancelledByMentee++;
      }
    }

    const cancellationRate = {
      overall:
        sessions.total > 0 ? (sessions.cancelled / sessions.total) * 100 : 0,
      byMentor:
        sessions.cancelled > 0
          ? (cancelledByMentor / sessions.cancelled) * 100
          : 0,
      byMentee:
        sessions.cancelled > 0
          ? (cancelledByMentee / sessions.cancelled) * 100
          : 0,
    };

    // 8. Chart data: Sessions over time
    const sessionsForChart = await db
      .select({ scheduledAt: mentorSessions.scheduledAt })
      .from(mentorSessions)
      .where(
        and(
          gte(mentorSessions.scheduledAt, startDate),
          lte(mentorSessions.scheduledAt, endDate)
        )
      )
      .orderBy(asc(mentorSessions.scheduledAt));

    const sessionsByDate = new Map<string, number>();
    for (const s of sessionsForChart) {
      const dateStr = s.scheduledAt.toISOString().split('T')[0];
      sessionsByDate.set(dateStr, (sessionsByDate.get(dateStr) || 0) + 1);
    }
    const sessionsOverTime = Array.from(sessionsByDate.entries()).map(
      ([date, count]) => ({ date, sessions: count })
    );

    // 9. Chart data: Sessions by status (pie chart)
    const sessionsByStatus = [
      { name: 'Scheduled', value: sessions.scheduled, color: '#3b82f6' },
      { name: 'In Progress', value: sessions.inProgress, color: '#f59e0b' },
      { name: 'Completed', value: sessions.completed, color: '#10b981' },
      { name: 'Cancelled', value: sessions.cancelled, color: '#ef4444' },
    ].filter((item) => item.value > 0); // Only include non-zero values

    // 10. Chart data: Top expertise (bar chart)
    const topExpertiseChart = expertiseStats.map((item) => ({
      name: item.expertise,
      count: item.count,
    }));

    const metrics: DashboardMetrics = {
      totalMentors,
      activeMentors,
      sessions,
      averageSessionDuration: Math.round(averageSessionDuration),
      topExpertise: expertiseStats,
      mentorUtilization: {
        ...mentorUtilization,
        averagePerMentor:
          Math.round(mentorUtilization.averagePerMentor * 10) / 10,
      },
      menteeEngagement,
      cancellationRate: {
        overall: Math.round(cancellationRate.overall * 10) / 10,
        byMentor: Math.round(cancellationRate.byMentor * 10) / 10,
        byMentee: Math.round(cancellationRate.byMentee * 10) / 10,
      },
      chartsData: {
        sessionsOverTime,
        sessionsByStatus,
        topExpertiseChart,
      },
    };

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Error fetching mentoring dashboard metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
