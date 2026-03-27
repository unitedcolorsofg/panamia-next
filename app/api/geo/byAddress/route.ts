// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';

interface GeoEntry {
  latitude?: number;
  longitude?: number;
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { address } = body;

  const a = address;
  const addressLine = `${a.street1} ${a.street2} ${a.city}, ${a.state} ${a.zipcode}`;
  const apikey = process.env.POSITIONSTACK_APIKEY;
  const url = `http://api.positionstack.com/v1/forward?access_key=${apikey}&query=${addressLine}`;
  // const url = `https://geocode.maps.co/search?q=${address}&api_key=${process.env.GEOCODING_API_KEY}`;
  const psResponse = await fetch(url);

  if (!psResponse.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          "We couldn't get your GeoLocation, check your address and try again",
      },
      { status: 200 }
    );
  }

  const georesponse = await psResponse.json();
  const geodata = georesponse.data as GeoEntry[];
  // console.log(geodata);
  if (geodata.length == 0) {
    return NextResponse.json(
      {
        success: false,
        error: "We couldn't find results for the address you entered",
      },
      { status: 200 }
    );
  }
  const firstAddress = geodata[0];
  if (firstAddress?.latitude && firstAddress.longitude) {
    const geoData = [
      {
        lat: firstAddress.latitude,
        lng: firstAddress.longitude,
      },
    ];
    return NextResponse.json({ success: true, data: geoData }, { status: 200 });
  }

  return NextResponse.json(
    {
      success: false,
      error: "We couldn't find results for the address you entered [2]",
    },
    { status: 200 }
  );
}
