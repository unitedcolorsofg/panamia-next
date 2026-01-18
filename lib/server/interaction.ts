import { getPrisma } from '@/lib/prisma';

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
  const prisma = await getPrisma();

  const newInteraction = await prisma.interaction.create({
    data: {
      email: email,
      action: action,
      affiliate: affiliate || null,
      points: points,
    },
  });

  if (affiliate) {
    // const update = await calculatePoints(affiliate)
  }
  return newInteraction;
};

export const calculatePoints = async (affiliate: string) => {
  const prisma = await getPrisma();

  // Aggregate points by affiliate using Prisma
  const pointsSum = await prisma.interaction.groupBy({
    by: ['affiliate'],
    where: {
      affiliate: affiliate,
    },
    _sum: {
      points: true,
    },
  });

  // points and interactions should eventually be historically tracked to minimize large db calls
  console.log(pointsSum);
  return pointsSum;
};
