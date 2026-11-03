import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Wire payload for POST /v1_0/invoice/ (snake_case per Elorus Fuse OpenAPI). */
export type FuseCreateInvoicePayload = {
  issuer_vat_number: string;
  invoice_type: string;
  number: string;
  issue_date: string;
  series?: string;
  lines: Array<{
    net_value: string;
    vat_category: number;
    vat_amount: string;
    description?: string;
    vat_exemption_category?: number;
  }>;
  total_net_value: string;
  total_vat_amount: string;
  total_gross_value: string;
  cp_vat_number?: string;
  cp_name?: string;
  cp_country?: string;
  cp_address?: {
    street?: string;
    number?: string;
    postal_code?: string;
    city?: string;
  };
  payment_methods?: Array<{ type: number; amount: string }>;
};

export type FuseInvoiceResult = {
  uid?: string;
  mark?: string | number | null;
  authentication_code?: string | null;
  authenticationCode?: string | null;
  qr_url?: string | null;
  qrUrl?: string | null;
  verification_url?: string | null;
  verificationUrl?: string | null;
  mydata_status?: string | null;
  mydataStatus?: string | null;
  series?: string;
  number?: string;
  [key: string]: unknown;
};

export class ElorusFuseApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ElorusFuseApiError';
  }
}

@Injectable()
export class ElorusFuseClient {
  private readonly logger = new Logger(ElorusFuseClient.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return String(this.config.get<string>('elorusFuse.baseUrl') || 'https://api.fuse-staging.gr').replace(/\/$/, '');
  }

  private apiToken(): string {
    return String(this.config.get<string>('elorusFuse.apiToken') || '').trim();
  }

  isConfigured(): boolean {
    return Boolean(this.apiToken());
  }

  private headers(organizationVat?: string): Record<string, string> {
    const token = this.apiToken();
    if (!token) {
      throw new ElorusFuseApiError('Elorus Fuse API token is not configured (ELORUS_FUSE_API_TOKEN)', 503, null);
    }
    const headers: Record<string, string> = {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (organizationVat) headers['X-Organization'] = organizationVat;
    return headers;
  }

  async createInvoice(organizationVat: string, payload: FuseCreateInvoicePayload): Promise<FuseInvoiceResult> {
    const url = `${this.baseUrl()}/v1_0/invoice/`;
    return this.request<FuseInvoiceResult>('POST', url, organizationVat, payload);
  }

  async listInvoices(
    organizationVat: string,
    params: { series?: string; number?: string; page?: number; page_size?: number } = {},
  ): Promise<{ count?: number; results?: FuseInvoiceResult[]; next?: string | null; previous?: string | null }> {
    const qs = new URLSearchParams();
    if (params.series) qs.set('series', params.series);
    if (params.number) qs.set('number', params.number);
    if (params.page) qs.set('page', String(params.page));
    if (params.page_size) qs.set('page_size', String(params.page_size));
    const q = qs.toString();
    const url = `${this.baseUrl()}/v1_0/invoice/list/${q ? `?${q}` : ''}`;
    return this.request('GET', url, organizationVat);
  }

  async getInvoice(organizationVat: string, uid: string): Promise<FuseInvoiceResult | null> {
    const url = `${this.baseUrl()}/v1_0/invoice/${encodeURIComponent(uid)}/`;
    try {
      return await this.request<FuseInvoiceResult>('GET', url, organizationVat);
    } catch (err) {
      if (err instanceof ElorusFuseApiError && err.statusCode === 404) return null;
      throw err;
    }
  }

  private async request<T>(
    method: string,
    url: string,
    organizationVat: string,
    body?: unknown,
  ): Promise<T> {
    const headers = this.headers(organizationVat);
    this.logger.log(`${method} ${url}`);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err: any) {
      throw new ElorusFuseApiError(
        `Elorus Fuse network error: ${err?.message || 'request failed'}`,
        0,
        null,
      );
    }

    const text = await res.text();
    let parsed: any = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const detail =
        (parsed && (parsed.detail || parsed.message || parsed.error)) ||
        (typeof parsed === 'string' ? parsed : JSON.stringify(parsed));
      throw new ElorusFuseApiError(
        `Elorus Fuse error ${res.status}: ${detail || res.statusText}`,
        res.status,
        parsed,
      );
    }

    return parsed as T;
  }
}
