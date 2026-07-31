/**
 * GHL REST API client (v1).
 *
 * Typed wrapper around the GoHighLevel contact API.
 * All calls include Authorization: Bearer {GHL_API_KEY} and Version headers.
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

export interface GhlContact extends GhlContactFields {
  id: string;
  dateAdded?: string;
  source?: string;
}

/**
 * Per-channel DND settings.
 *
 * The key casing is load-bearing and verified: `PUT /contacts/{id}` accepts
 * `Email`/`SMS`/`WhatsApp`/`Call` and rejects the lowercase spelling with 422
 * ("dndSettings.property email should not exist"). The lowercase form appears
 * in GHL's create-contact v3 schema, which is a different endpoint.
 */
export interface GhlDndSettings {
  Email?: { status: 'active' | 'inactive'; code?: string };
  SMS?: { status: 'active' | 'inactive'; code?: string };
  WhatsApp?: { status: 'active' | 'inactive'; code?: string };
  Call?: { status: 'active' | 'inactive'; code?: string };
}

export class GhlClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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
      throw new Error(
        `GHL API error: ${res.status} ${res.statusText} — ${path}`
      );
    }
    return res.json() as Promise<T>;
  }

  /** Search for a contact by email. Returns null if not found. */
  async getContact(email: string): Promise<GhlContact | null> {
    const data = await this.request<{ contacts: GhlContact[] }>(
      'GET',
      `/contacts/search?email=${encodeURIComponent(email)}`
    );
    return data.contacts?.[0] ?? null;
  }

  /** Create or update a contact (upsert by email). */
  async upsertContact(fields: GhlContactFields): Promise<GhlContact> {
    const data = await this.request<{ contact: GhlContact }>(
      'POST',
      '/contacts/upsert',
      fields
    );
    return data.contact;
  }

  /** Update fields on an existing contact by ID. */
  async updateContact(
    id: string,
    fields: GhlContactFields
  ): Promise<GhlContact> {
    const data = await this.request<{ contact: GhlContact }>(
      'PUT',
      `/contacts/${id}`,
      fields
    );
    return data.contact;
  }

  /** Delete a contact by ID. */
  async deleteContact(id: string): Promise<void> {
    await this.request<void>('DELETE', `/contacts/${id}`);
  }

  /** Add a tag to a contact. */
  async addTag(id: string, tag: string): Promise<void> {
    await this.request<void>('POST', `/contacts/${id}/tags`, { tags: [tag] });
  }

  /** Remove a tag from a contact. */
  async removeTag(id: string, tag: string): Promise<void> {
    await this.request<void>('DELETE', `/contacts/${id}/tags`, { tags: [tag] });
  }

  /**
   * Set DND (Do Not Disturb) per channel — suppresses marketing to the contact.
   *
   * This previously called `PUT /contacts/{id}/dnd`, which does not exist:
   * verified 2026-07-31, it answers 404 "Cannot PUT /contacts/{id}/dnd". DND is
   * written through the ordinary contact update instead, with the top-level
   * `dnd` flag derived from whether any channel is being suppressed.
   *
   * Nothing in the worker calls this today — the bug was latent, not live, and
   * `inactive-sweep` only uses `addTag`. Corrected so the next caller inherits
   * a working method rather than a 404.
   */
  async updateDnd(id: string, settings: GhlDndSettings): Promise<void> {
    const anyActive = Object.values(settings).some(
      (channel) => channel?.status === 'active'
    );
    await this.request<unknown>('PUT', `/contacts/${id}`, {
      dnd: anyActive,
      dndSettings: settings,
    });
  }
}
