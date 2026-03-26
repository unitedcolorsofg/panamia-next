/**
 * GHL REST API client for the main app.
 *
 * Used by the privacy portal routes (app/api/crm/*).
 * Reads credentials from process.env; returns null from `create()` if
 * GHL_API_KEY is not configured so callers can degrade gracefully.
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
      throw new Error(`GHL API ${res.status} — ${method} ${path}`);
    }
    return res.json() as Promise<T>;
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

  /** Set DND on all channels — effectively unsubscribes the contact from all marketing. */
  async setDndAll(id: string): Promise<void> {
    const dnd: Record<string, { status: GhlDndStatus }> = {
      email: { status: 'active' },
      sms: { status: 'active' },
      whatsapp: { status: 'active' },
      calls: { status: 'active' },
    };
    await this.request<void>('PUT', `/contacts/${id}/dnd`, dnd);
  }
}
