import { sendEmail } from '@/lib/email';
import {
  SOCIAL_REPORT_REASON_LABELS,
  type SocialReportReason,
} from '@/lib/social-report-reasons';

// Emails the admin team when a member files an in-app content report.
//
// The relay-side equivalent lives in lib/server/relay-reports.ts and is not
// reusable here: every field it formats is Nostr-shaped (hex pubkeys, npub
// encoding, NIP-56 kind names), and an in-app report has none of those. What
// IS shared is the duty — a queue nobody is told about is not a reporting
// mechanism, it is a log file.

export interface SocialReportForEmail {
  reporterHandle: string | null;
  targetHandle: string | null;
  targetStatusId: string | null;
  reason: SocialReportReason;
  details: string;
  reportedContent: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The mandatory-reporting notice applies only to the categories that can
// implicate child sexual abuse material. Showing it on every report would
// train moderators to skim past it, which is the opposite of the point.
const NCMEC_REASONS = new Set<SocialReportReason>(['csam', 'sexual_content']);

const NCMEC_TEXT = [
  'MANDATORY-REPORTING NOTICE: if this report concerns sexual content and there',
  'is any indication a minor is involved, it must be reported to the National',
  'Center for Missing & Exploited Children (NCMEC) as soon as possible, and no',
  'later than 60 days, per 18 U.S.C. § 2258A and the REPORT Act. File at',
  'https://report.cybertip.org. Removal from public access is permitted only',
  'after a copy has been preserved for the legally required retention period;',
  'the original material must not be destroyed prior to reporting and',
  'preservation.',
];

/**
 * Email every ADMIN_EMAILS recipient about a newly filed report. Best-effort:
 * builds the message and sends to each admin independently, and never throws —
 * a notification failure must not break the report itself, because the row is
 * already durable and the queue will still show it.
 */
export async function notifyAdminsOfSocialReport(
  report: SocialReportForEmail
): Promise<void> {
  try {
    const admins =
      process.env.ADMIN_EMAILS?.split(',')
        .map((e) => e.trim())
        .filter(Boolean) || [];
    if (admins.length === 0) return;

    const host =
      process.env.NEXT_PUBLIC_HOST_URL || 'https://daydream.pana.social';
    const adminUrl = `${host}/account/admin/social-reports`;
    const label = SOCIAL_REPORT_REASON_LABELS[report.reason];
    const reporter = report.reporterHandle
      ? `@${report.reporterHandle}`
      : '(deleted account)';
    const target = report.targetHandle
      ? `@${report.targetHandle}`
      : '(deleted account)';
    const what = report.targetStatusId
      ? `${host}/p/${report.targetHandle ?? 'unknown'}/${report.targetStatusId}`
      : 'The account itself (not a single post)';

    const subject = `[Pana content report] ${label} — ${target} reported by ${reporter}`;
    const showNcmec = NCMEC_REASONS.has(report.reason);

    const rows: Array<[string, string]> = [
      ['Reason', escapeHtml(label)],
      ['Reported account', escapeHtml(target)],
      ['Reporter', escapeHtml(reporter)],
      ['What was reported', escapeHtml(what)],
    ];

    const tableRows = rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;white-space:nowrap;">${k}</td><td style="padding:4px 0;color:#111;">${v}</td></tr>`
      )
      .join('');

    const reportedBlock = report.reportedContent
      ? `<blockquote style="margin:0;padding:12px 16px;background:#f5f5f5;border-left:4px solid #ec4899;border-radius:4px;white-space:pre-wrap;font-size:14px;color:#222;">${escapeHtml(
          report.reportedContent
        )}</blockquote>`
      : '<em style="color:#888;">(the report is about the account, not one post)</em>';

    const ncmecHtml = showNcmec
      ? `<div style="margin:24px 0 0;padding:14px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;">
    <p style="margin:0;font-size:13px;line-height:1.6;color:#991b1b;">
      <strong>Mandatory-reporting notice:</strong> if this report concerns sexual content and there is <em>any</em> indication a minor is involved, it must be reported to the National Center for Missing &amp; Exploited Children (NCMEC) as soon as possible — and no later than 60 days — per 18 U.S.C. &sect; 2258A and the REPORT Act. File at
      <a href="https://report.cybertip.org" style="color:#dc2626;">report.cybertip.org</a>. Removal from public access is permitted only after a copy has been preserved for the legally required retention period; the original material must not be destroyed prior to reporting and preservation.
    </p>
  </div>`
      : '';

    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 4px;font-size:20px;">New content report</h2>
  <p style="margin:0 0 20px;color:#666;font-size:14px;">A member reported something in the Pana Social app.</p>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:20px;">${tableRows}</table>
  <h3 style="margin:0 0 6px;font-size:15px;">What the reporter said</h3>
  <p style="margin:0 0 20px;white-space:pre-wrap;font-size:14px;">${
    report.details
      ? escapeHtml(report.details)
      : '<em style="color:#888;">(nothing written)</em>'
  }</p>
  <h3 style="margin:0 0 6px;font-size:15px;">Reported content</h3>
  ${reportedBlock}
  ${ncmecHtml}
  <p style="margin:24px 0 0;font-size:14px;"><a href="${adminUrl}" style="color:#ec4899;">Open the moderation queue →</a></p>
</body></html>`;

    const text = [
      'New content report in the Pana Social app',
      '',
      ...rows.map(([k, v]) => `${k}: ${v.replace(/<[^>]+>/g, '')}`),
      '',
      'What the reporter said:',
      report.details || '(nothing written)',
      '',
      'Reported content:',
      report.reportedContent ||
        '(the report is about the account, not one post)',
      ...(showNcmec ? ['', ...NCMEC_TEXT] : []),
      '',
      `Moderation queue: ${adminUrl}`,
    ].join('\n');

    await Promise.allSettled(
      admins.map((to) => sendEmail(to, subject, html, text))
    );
  } catch (err) {
    console.error('Failed to notify admins of content report:', err);
  }
}
