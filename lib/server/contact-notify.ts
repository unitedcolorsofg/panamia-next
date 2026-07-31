import { sendTemplateEmail } from '@/lib/email';
import {
  CONTACT_CATEGORY_LABELS,
  type ContactCategory,
} from '@/lib/contact-categories';
import { notificationRecipients } from '@/lib/contact-routing';

export interface ContactSubmissionForEmail {
  id: string;
  name: string;
  email: string;
  category: ContactCategory;
  screenname: string | null;
  isAuthenticated: boolean;
}

/**
 * Notify the staff who can answer a Contact Us submission. Category picks the
 * role address; unauthenticated `press` additionally fans out to every
 * ADMIN_EMAILS entry. See docs/CONTACT-ROADMAP.md, Phase 1.
 *
 * Best-effort and never throws: the submission is already committed by the time
 * this runs, so a mail failure must not turn a successful send into an error
 * the user would retry. Recipients are mailed independently (Promise.allSettled
 * over separate sends, not one multi-recipient send) so that one bad address
 * cannot suppress delivery to the others — and so admins are not exposed to
 * each other in a To: header.
 */
export async function notifyStaffOfContactSubmission(
  submission: ContactSubmissionForEmail
): Promise<void> {
  try {
    const recipients = notificationRecipients(
      submission.category,
      submission.isAuthenticated
    );
    if (recipients.length === 0) return;

    const queueUrl =
      (process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000') +
      '/account/admin/contactus';

    const params = {
      name: submission.name,
      email: submission.email,
      category: CONTACT_CATEGORY_LABELS[submission.category],
      submissionId: submission.id,
      screenname: submission.screenname,
      isAuthenticated: submission.isAuthenticated,
      queueUrl,
    };

    const results = await Promise.allSettled(
      recipients.map((to) =>
        sendTemplateEmail('admin.contact_submission', params, to, {
          // Reply goes to whoever wrote in, not to the shared sending address.
          replyTo: submission.email,
        })
      )
    );

    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        console.error(
          '[contact-notify] send failed to=%s submission=%s:',
          recipients[i],
          submission.id,
          result.reason
        );
      }
    }
  } catch (err) {
    console.error('[contact-notify] failed to notify staff:', err);
  }
}
