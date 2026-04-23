/**
 * JSON-LD Structured Data for Legal Pages
 *
 * Embeds a slim schema.org DigitalDocument snippet in the HTML <head>
 * so search engines and automated tools can discover policy metadata
 * without parsing the full policy.json files.
 */

interface LegalJsonLdProps {
  name: string;
  description: string;
  url: string;
  version: string;
  /** Relative path to the machine-readable policy file, e.g. "/legal/privacy/policy.json" */
  policyJsonUrl?: string;
}

export function LegalJsonLd({
  name,
  description,
  url,
  version,
  policyJsonUrl,
}: LegalJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name,
    description,
    url,
    version,
    inLanguage: 'en',
    publisher: {
      '@type': 'Organization',
      name: 'Pana MIA Club, Corp.',
      url: 'https://pana.social',
    },
    ...(policyJsonUrl && {
      encoding: {
        '@type': 'MediaObject',
        contentUrl: policyJsonUrl,
        encodingFormat: 'application/json',
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
