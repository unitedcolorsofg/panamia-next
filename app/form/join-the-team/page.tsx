'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function JoinTheTeamPage() {
  const { t } = useTranslation('jointeam');

  return (
    <div className="from-background to-muted/20 flex min-h-screen flex-col bg-gradient-to-b">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-4xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-lg">{t('subtitle')}</p>
        </div>

        {/* Job Positions Accordion */}
        <div className="mb-12">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left text-xl font-semibold">
                {t('role1.title')}
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>{t('role1.p1')}</p>
                <p>
                  <strong>{t('role1.p2')}</strong>
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left text-xl font-semibold">
                {t('role2.title')}
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>{t('role2.p1')}</p>
                <p>{t('role2.p2')}</p>
                <p>
                  <strong>{t('role2.p3')}</strong>
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left text-xl font-semibold">
                {t('role3.title')}
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>{t('role3.p1')}</p>
                <p>
                  <strong>{t('role3.p2')}</strong>
                </p>
                <p>
                  <strong>{t('role3.p3')}</strong>
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left text-xl font-semibold">
                {t('role4.title')}
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>{t('role4.p1')}</p>
                <p>
                  <strong>{t('role4.p2')}</strong>
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-left text-xl font-semibold">
                {t('role5.title')}
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>{t('role5.p1')}</p>
                <p>{t('role5.p2')}</p>
                <p>
                  <strong>{t('role5.p3')}</strong>
                </p>
                <p>
                  <strong>{t('role5.p4')}</strong>
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="text-left text-xl font-semibold">
                {t('role6.title')}
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>{t('role6.p1')}</p>
                <p>
                  <strong>{t('role6.p2')}</strong>
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger className="text-left text-xl font-semibold">
                {t('role7.title')}
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>{t('role7.p1')}</p>
                <p>{t('role7.p2')}</p>
                <p>
                  <strong>{t('role7.p3')}</strong>
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Contact Us */}
        <div className="rounded-lg border p-6 text-center">
          <p className="mb-4 text-lg font-semibold">{t('cta.question')}</p>
          <p className="text-muted-foreground mb-6">{t('cta.desc')}</p>
          <Link
            href="/form/contact-us"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-block rounded-md px-6 py-3 font-semibold transition-colors"
          >
            {t('cta.button')}
          </Link>
        </div>
      </div>
    </div>
  );
}
