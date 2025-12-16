import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import MentorSession from '@/lib/model/mentorSession';
import Profile from '@/lib/model/profile';

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

  await dbConnect();

  // TODO: Add admin role check
  // const user = await User.findOne({ email: session.user.email });
  // if (user?.status?.role !== 'admin') {
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

    // Date filter for sessions
    const dateFilter = {
      scheduledAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    console.log('Date filter:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dateFilter,
    });

    // Debug: Check total sessions without date filter
    const totalSessionsInDB = await MentorSession.countDocuments({});
    console.log('Total sessions in DB:', totalSessionsInDB);

    // Debug: Get sample session dates
    const sampleSessions = await MentorSession.find({})
      .limit(5)
      .sort({ scheduledAt: 1 })
      .select('scheduledAt status');
    console.log(
      'Sample sessions:',
      sampleSessions.map((s) => ({
        scheduledAt: s.scheduledAt,
        status: s.status,
      }))
    );

    // 1. Total mentors and active mentors
    const totalMentors = await Profile.countDocuments({
      'mentoring.enabled': true,
    });

    // Active mentors (those with at least one completed session in date range)
    const activeMentorsSessions = await MentorSession.distinct('mentorEmail', {
      status: 'completed',
      ...dateFilter,
    });
    const activeMentors = activeMentorsSessions.length;

    // 2. Session counts by status (filtered by date)
    const sessionCounts = await MentorSession.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const sessions = {
      total: 0,
      scheduled: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    };

    sessionCounts.forEach((item) => {
      sessions.total += item.count;
      if (item._id === 'scheduled') sessions.scheduled = item.count;
      if (item._id === 'in_progress') sessions.inProgress = item.count;
      if (item._id === 'completed') sessions.completed = item.count;
      if (item._id === 'cancelled') sessions.cancelled = item.count;
    });

    // 3. Average session duration (filtered by date)
    const avgDuration = await MentorSession.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          average: { $avg: '$duration' },
        },
      },
    ]);
    const averageSessionDuration = avgDuration[0]?.average || 0;

    // 4. Top expertise areas (no date filter - all mentors)
    const expertiseStats = await Profile.aggregate([
      { $match: { 'mentoring.enabled': true } },
      { $unwind: '$mentoring.expertise' },
      {
        $group: {
          _id: '$mentoring.expertise',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $project: {
          expertise: '$_id',
          count: 1,
          _id: 0,
        },
      },
    ]);

    // 5. Mentor utilization (filtered by date)
    const mentorUtilization = {
      totalSessions: sessions.completed,
      activeMentors,
      averagePerMentor:
        activeMentors > 0 ? sessions.completed / activeMentors : 0,
    };

    // 6. Mentee engagement (filtered by date)
    const uniqueMentees = await MentorSession.distinct(
      'menteeEmail',
      dateFilter
    );
    const menteeBookings = await MentorSession.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$menteeEmail',
          bookings: { $sum: 1 },
        },
      },
    ]);
    const returningMentees = menteeBookings.filter(
      (m) => m.bookings > 1
    ).length;

    const menteeEngagement = {
      uniqueMentees: uniqueMentees.length,
      returningMentees,
      totalBookings: sessions.total,
    };

    // 7. Cancellation rates (filtered by date)
    const cancelledSessions = await MentorSession.find({
      status: 'cancelled',
      cancelledBy: { $exists: true },
      ...dateFilter,
    });

    let cancelledByMentor = 0;
    let cancelledByMentee = 0;

    for (const session of cancelledSessions) {
      if (session.cancelledBy === session.mentorEmail) {
        cancelledByMentor++;
      } else if (session.cancelledBy === session.menteeEmail) {
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
    const sessionsOverTime = await MentorSession.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$scheduledAt' },
          },
          sessions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          sessions: 1,
          _id: 0,
        },
      },
    ]);

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
