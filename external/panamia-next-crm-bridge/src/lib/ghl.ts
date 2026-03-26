/**
 * GHL REST API client (v1).
 *
 * Typed wrapper around the GoHighLevel contact API.
 * All calls include Authorization: Bearer {GHL_API_KEY} and Version headers.
 */

const GHL_API_BASE = 'https://rest.gohighlevel.com/v1';
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

export interface GhlDndSettings {
  email?: { status: 'active' | 'inactive' };
  sms?: { status: 'active' | 'inactive' };
  whatsapp?: { status: 'active' | 'inactive' };
  calls?: { status: 'active' | 'inactive' };
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

  /** Set DND (Do Not Disturb) on all channels — effectively unsubscribes the contact. */
  async updateDnd(id: string, dnd: GhlDndSettings): Promise<void> {
    await this.request<void>('PUT', `/contacts/${id}/dnd`, dnd);
  }
}
