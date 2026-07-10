import { emailLayout, button, escape } from './layout';

/**
 * Magic-link confirmation for an anonymous (no-account) RSVP. Clicking the link
 * verifies the email and counts the RSVP. See app/api/events/[slug]/rsvp.
 */
export function eventRsvpConfirm(params: Record<string, unknown>) {
  const name = escape(String(params.name || ''));
  const eventTitle = escape(String(params.eventTitle || 'the event'));
  const confirmUrl = String(params.confirmUrl || '');
  const statusLabel = escape(String(params.statusLabel || 'RSVP'));

  return {
    subject: `Confirm your RSVP — ${String(params.eventTitle || 'Pana MIA')}`,
    html: emailLayout({
      title: 'Confirm your RSVP',
      preheader: `One click to confirm your RSVP for ${String(
        params.eventTitle || 'the event'
      )}.`,
      body: `
        <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 22px; font-weight: 600;">Confirm your RSVP</h2>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
          Hi ${name}! You're marked as <strong>${statusLabel}</strong> for <strong>${eventTitle}</strong>.
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
          Tap the button below to confirm. Your RSVP won't count until you do.
        </p>
        ${button('Confirm my RSVP', confirmUrl)}
        <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
          If you didn't request this, you can ignore this email.
        </p>`,
    }),
    text: [
      `Confirm your RSVP — ${String(params.eventTitle || 'Pana MIA')}`,
      '============================',
      '',
      `Hi ${String(params.name || '')}!`,
      '',
      `You're marked as ${String(
        params.statusLabel || 'RSVP'
      )} for ${String(params.eventTitle || 'the event')}.`,
      '',
      "Confirm your RSVP (your RSVP won't count until you do):",
      confirmUrl,
      '',
      "If you didn't request this, you can ignore this email.",
      '',
      '---',
      'Pana MIA · panamia.club · hola@panamia.club',
    ].join('\n'),
  };
}
