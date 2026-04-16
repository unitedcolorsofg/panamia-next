/**
 * GHL REST API client for the main app.
 *
 * Used by the privacy portal routes (app/api/crm/*).
 * Reads credentials from process.env; returns null from `create()` if
 * GHL_API_KEY is not configured so callers can degrade gracefully.
 */

// LeadConnector API — the endpoint Private Integration Tokens (pit-*) hit.
// The legacy base rest.gohighlevel.com/v1 only accepts legacy API keys and
// rejects PITs with 401 "Api key is invalid."
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

export interface GhlContactFields {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  locationId?: string;
  customField?: Record<string, string>;
  tags?: string[];
}

export interface GhlContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: string;
  dateAdded?: string;
  tags?: string[];
  customField?: Array<{ id: string; value: string }>;
  dnd?: boolean;
  dndSettings?: {
    email?: { status: string };
    sms?: { status: string };
    whatsapp?: { status: string };
    calls?: { status: string };
  };
}

export type GhlDndStatus = 'active' | 'inactive';

export class GhlClient {
  private readonly apiKey: string;
  readonly locationId: string;

  private constructor(apiKey: string, locationId: string) {
    this.apiKey = apiKey;
    this.locationId = locationId;
  }

  /** Returns a GhlClient if credentials are configured, otherwise null. */
  static create(): GhlClient | null {
    const apiKey = process.env.GHL_API_KEY;
    const locationId = process.env.GHL_LOCATION_ID;
    if (!apiKey || !locationId) return null;
    return new GhlClient(apiKey, locationId);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Version: GHL_API_VERSION,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${GHL_API_BASE}${path}`, {
      method,
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `GHL API ${res.status} — ${method} ${path}${detail ? ` — ${detail.slice(0, 200)}` : ''}`
      );
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  /** Get a contact by ID. */
  async getContactById(id: string): Promise<GhlContact> {
    const data = await this.request<{ contact: GhlContact }>(
      'GET',
      `/contacts/${id}`
    );
    return data.contact;
  }

  /** Search for a contact by email. Returns null if not found. */
  async findByEmail(email: string): Promise<GhlContact | null> {
    const data = await this.request<{ contacts: GhlContact[] }>(
      'GET',
      `/contacts/search?email=${encodeURIComponent(email)}&locationId=${encodeURIComponent(this.locationId)}`
    );
    return data.contacts?.[0] ?? null;
  }

  /** Delete a contact by ID. */
  async deleteContact(id: string): Promise<void> {
    await this.request<void>('DELETE', `/contacts/${id}`);
  }

  /** Enroll a contact in a workflow by ID. */
  async enrollInWorkflow(contactId: string, workflowId: string): Promise<void> {
    await this.request<void>(
      'POST',
      `/contacts/${contactId}/workflow/${workflowId}`
    );
  }

  /**
   * Set DND on all channels — effectively unsubscribes the contact from all marketing.
   *
   * LeadConnector v2 has no dedicated DND endpoint; DND is updated via the
   * standard contact update with `dnd: true` (top-level switch covering all
   * channels) and explicit per-channel `dndSettings` for completeness.
   */
  async setDndAll(id: string): Promise<void> {
    await this.request<unknown>('PUT', `/contacts/${id}`, {
      dnd: true,
      dndSettings: {
        Email: { status: 'active' as GhlDndStatus, code: 'user_unsubscribe' },
        SMS: { status: 'active' as GhlDndStatus, code: 'user_unsubscribe' },
        WhatsApp: {
          status: 'active' as GhlDndStatus,
          code: 'user_unsubscribe',
        },
        Call: { status: 'active' as GhlDndStatus, code: 'user_unsubscribe' },
      },
    });
  }

  /**
   * Clear DND on all channels — re-subscribes the contact to marketing.
   *
   * Mirror of setDndAll: PUT /contacts/{id} with `dnd: false` and per-channel
   * `dndSettings` reset to inactive. Contact must already exist; this does
   * not undo a deleted record.
   */
  async clearDndAll(id: string): Promise<void> {
    await this.request<unknown>('PUT', `/contacts/${id}`, {
      dnd: false,
      dndSettings: {
        Email: { status: 'inactive' as GhlDndStatus, code: 'user_resubscribe' },
        SMS: { status: 'inactive' as GhlDndStatus, code: 'user_resubscribe' },
        WhatsApp: {
          status: 'inactive' as GhlDndStatus,
          code: 'user_resubscribe',
        },
        Call: { status: 'inactive' as GhlDndStatus, code: 'user_resubscribe' },
      },
    });
  }
}
