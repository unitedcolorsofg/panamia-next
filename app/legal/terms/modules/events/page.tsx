import type { Metadata } from 'next';
import { moduleDefinitions, ModuleContent } from '../../module-content';

const module = moduleDefinitions.find((m) => m.id === 'events')!;

export const metadata: Metadata = {
  title: `${module.title} - Terms of Service - Pana MIA Club`,
  description: `Terms of Service module for ${module.title}`,
};

export default function EventsModulePage() {
  return (
    <>
      <header className="mb-8 border-b pb-6">
        <h1 className="text-4xl font-bold">{module.title}</h1>
        <p className="text-muted-foreground mt-2">Terms of Service — Module</p>
      </header>

      <article className="prose prose-gray dark:prose-invert max-w-none leading-relaxed">
        <ModuleContent module={module} />
      </article>
    </>
  );
}
