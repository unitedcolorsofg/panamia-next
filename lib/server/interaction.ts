import { db } from '@/lib/db';
import { interactions } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

const interactionActions = {
  newsletter_signup: {
    points: 0,
  },
  user_signup: {
    points: 10,
  },
  profile_signup: {
    points: 50,
  },
  donation_onetime: {
    points: 100,
  },
  donation_membership: {
    points: 100,
  },
};

interface SaveInteraction {
  email: string;
  action:
    | 'user_signup'
    | 'newsletter_signup'
    | 'profile_signup'
    | 'donation_onetime'
    | 'donation_membership';
  affiliate?: string;
}

export const saveInteraction = async ({
  email,
  action,
  affiliate,
}: SaveInteraction) => {
  const points = interactionActions[action].points;

  const [newInteraction] = await db
    .insert(interactions)
    .values({
      email,
      action,
      affiliate: affiliate || null,
      points,
    })
    .returning();

  if (affiliate) {
    // const update = await calculatePoints(affiliate)
  }
  return newInteraction;
};

export const calculatePoints = async (affiliate: string) => {
  // Aggregate points by affiliate using Drizzle
  const pointsSum = await db
    .select({
      affiliate: interactions.affiliate,
      totalPoints: sql<string>`sum(${interactions.points})`,
    })
    .from(interactions)
    .where(eq(interactions.affiliate, affiliate))
    .groupBy(interactions.affiliate);

  // points and interactions should eventually be historically tracked to minimize large db calls
  console.log(pointsSum);
  return pointsSum;
};
