/**
 * @deprecated This route uses legacy MongoDB. See docs/DEPRECATED-ROUTES.md
 * Replace with: prisma.intakeForm.findFirst({ where: { email, formType, complete: true } })
 * Note: 6 intake collections consolidated into single IntakeForm table with formType enum
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import users from '@/lib/model/users';
import artIntake from '@/lib/model/artintake';
import servicesIntake from '@/lib/model/servicesintake';
import orgIntake from '@/lib/model/orgintake';
import apparelIntake from '@/lib/model/apparelintake';
import goodsIntake from '@/lib/model/goodsintake';
import foodIntake from '@/lib/model/foodintake';

interface ResponseData {
  error?: string;
  success?: boolean;
  msg?: string;
  data?: any[];
}
const getServicesIntakes = async (email: string) => {
  await dbConnect();
  console.log(email);
  const intake = await servicesIntake.findOne({ email: email, complete: true });
  if (intake) {
    console.log('true - form completed');
    return true;
  } else {
    return false;
  }
};

const getArtIntakes = async (email: string) => {
  await dbConnect();
  console.log(email);
  const intake = await artIntake.findOne({ email: email, complete: true });
  if (intake) {
    console.log('true - form completed');
    return true;
  } else {
    return false;
  }
};

const getGoodsIntakes = async (email: string) => {
  await dbConnect();
  console.log(email);
  const intake = await goodsIntake.findOne({ email: email, complete: true });
  if (intake) {
    console.log('true - form completed');
    return true;
  } else {
    return false;
  }
};

const getFoodIntakes = async (email: string) => {
  await dbConnect();
  console.log(email);
  const intake = await foodIntake.findOne({ email: email, complete: true });
  if (intake) {
    console.log('true - form completed');
    return true;
  } else {
    return false;
  }
};

const getOrgIntakes = async (email: string) => {
  await dbConnect();
  console.log(email);
  const intake = await orgIntake.findOne({ email: email, complete: true });
  if (intake) {
    console.log('true - form completed');
    return true;
  } else {
    return false;
  }
};

const getApparelIntakes = async (email: string) => {
  await dbConnect();
  console.log(email);
  const intake = await apparelIntake.findOne({ email: email, complete: true });
  if (intake) {
    console.log('true - form completed');
    return true;
  } else {
    return false;
  }
};

export async function GET(request: NextRequest) {
  // validate if it is a GET
  let category = '';
  let Email = '';
  let intake = false;
  if (
    request.nextUrl.searchParams.get('userEmail') &&
    request.nextUrl.searchParams.get('category')
  ) {
    Email = request.nextUrl.searchParams.get('userEmail')!.toString();
    category = request.nextUrl.searchParams.get('category')!.toString();
    console.log(category);
    console.log(Email, category);
    try {
      if (category == 'Services') {
        intake = await getServicesIntakes(Email.toString());
      } else if (category == 'Art') {
        intake = await getArtIntakes(Email.toString());
      } else if (category == 'Food') {
        intake = await getFoodIntakes(Email.toString());
      } else if (category == 'Apparel/Accessories') {
        intake = await getApparelIntakes(Email.toString());
      } else if (category == 'Collectives/Platforms') {
        intake = await getOrgIntakes(Email.toString());
      } else if (category == 'Goods') {
        intake = await getGoodsIntakes(Email.toString());
      }

      return NextResponse.json(
        { success: true, data: [intake] },
        { status: 200 }
      );
    } catch (err: any) {
      return NextResponse.json({
        error: "Error on '/api/getIntakeFormStatus': " + err,
      });
    }
  }
  return NextResponse.json(
    { error: 'Missing required parameters' },
    { status: 400 }
  );
}
