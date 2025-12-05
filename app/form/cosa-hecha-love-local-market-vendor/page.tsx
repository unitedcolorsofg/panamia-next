import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cosa Hecha + Love Local Market Vendor Form - Pana MIA Club',
  description:
    'A sustainability centric market hosted at the Hub on December 17th.',
};

export default function CosaHechaLoveLocalMarketVendorForm() {
  return (
    <div className="min-h-[90vh] bg-muted/20 p-0">
      <div className="mx-auto max-w-3xl">
        <iframe
          className="m-0 min-h-screen w-full border-0"
          src="https://docs.google.com/forms/d/e/1FAIpQLSe3Zku8K6Pv8461zFVEvTSmvfjtFDM752ssmYWmjTzpW2bqLQ/viewform?embedded=true"
          title="Cosa Hecha + Love Local Market Vendor Form"
        >
          Loading...
        </iframe>
      </div>
    </div>
  );
}
