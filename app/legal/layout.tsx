import Link from 'next/link';

const legalNav = [
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/dmca', label: 'DMCA Policy' },
  { href: '/legal/breach', label: 'Breach Disclosure' },
  { href: '/legal/accessibility', label: 'Accessibility' },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <nav className="mb-8 flex flex-wrap gap-3 text-sm">
          {legalNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
