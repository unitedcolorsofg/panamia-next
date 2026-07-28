import { emailLayout, escape } from './layout';

/**
 * Receipt sent to whoever submitted the Contact Us form, echoing back what we
 * received. Goes to the address typed into (or prefilled on) the form, so it
 * also doubles as a "you typo'd your email" signal when it never arrives.
 * See app/api/createContactUs.
 *
 * The quoted message is entirely sender-supplied, and anyone can put a third
 * party's address in the form — so this email can be used to deliver arbitrary
 * text to a stranger under Pana MIA branding and a valid DKIM signature. The
 * copy is therefore built to make that useless: the block is attributed as
 * submitted text BEFORE the reader reaches it, and the "we never ask for…"
 * line pre-empts the credential/payment lure it would otherwise carry. Keep
 * both above the quote — a warning underneath is read too late.
 */
export function contactReceived(params: Record<string, unknown>) {
  const name = escape(String(params.name || ''));
  const category = escape(String(params.category || 'General question'));
  const message = escape(String(params.message || ''));

  return {
    subject: 'Copy of your message to Pana MIA',
    html: emailLayout({
      title: 'Copy of your message',
      preheader:
        'A copy of the message submitted through our Contact Us form — no action needed.',
      body: `
        <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 22px; font-weight: 600;">Copy of your message</h2>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
          Hi ${name}! Thanks for reaching out. We'll get back to you as soon as we can.
        </p>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
          This is a receipt, not a request — <strong>there is nothing you need to do</strong>.
        </p>
        <div style="margin: 0 0 24px 0; padding: 14px 18px; background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; color: #92400e; font-size: 14px; line-height: 1.6;">
          Everything in the grey box below was typed into our Contact Us form by
          whoever submitted it. It is <strong>not</strong> a message from Pana MIA, and
          we can't vouch for it. We will never ask you for a password or a payment by
          email. If you didn't send this, ignore it — and don't act on anything it says.
        </div>
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
          Category submitted: <strong style="color: #374151;">${category}</strong>
        </p>
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Submitted message:</p>
        <blockquote style="margin: 0; padding: 16px 20px; background-color: #f9fafb; border-left: 4px solid #9ca3af; color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message}</blockquote>`,
    }),
    text: [
      'Copy of your message to Pana MIA',
      '============================',
      '',
      `Hi ${String(params.name || '')}!`,
      '',
      "Thanks for reaching out. We'll get back to you as soon as we can.",
      'This is a receipt, not a request — there is nothing you need to do.',
      '',
      'NOTE: everything below the line was typed into our Contact Us form by',
      'whoever submitted it. It is NOT a message from Pana MIA, and we cannot',
      'vouch for it. We will never ask you for a password or a payment by email.',
      "If you didn't send this, ignore it — and don't act on anything it says.",
      '',
      `Category submitted: ${String(params.category || 'General question')}`,
      '',
      '--- submitted message ---',
      String(params.message || ''),
      '--- end of submitted message ---',
      '',
      '---',
      'Pana MIA · panamia.club · hola@panamia.club',
    ].join('\n'),
  };
}
