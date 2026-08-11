import ImpactContent from './impact-content';

// Static content — cache at the edge, revalidate hourly (Workers Cache).
export const revalidate = 3600;

export const metadata = {
  title: 'Impact Report | Pana MIA',
  description:
    'In 2025, Pana MIA Club sponsored 17 events reaching over 5,000 people across South Florida. Our programs, partners, and outcomes.',
};

// The body is a client component because the copy lives in the `impact` i18n
// namespace and the two charts are Recharts. Keeping this wrapper on the server
// is what preserves the `metadata` export above — a 'use client' page cannot
// have one.
export default function ImpactPage() {
  return <ImpactContent />;
}
