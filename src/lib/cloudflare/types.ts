/**
 * Cloudflare service-layer types. Shared by `client.ts` and every per-TLD
 * route handler under `src/app/api/dns/[tldId]/`.
 */

export type CFRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";

export interface CFDnsRecord {
  id: string;
  type: CFRecordType;
  name: string;
  content: string;
  ttl: number;
  priority?: number;
  proxied?: boolean;
  zone_id: string;
  created_on: string;
  modified_on: string;
}

export interface CFZone {
  id: string;
  name: string;
  status: string;
  name_servers: string[];
}

export interface CreateDnsInput {
  type: CFRecordType;
  name: string;
  content: string;
  ttl: number;
  priority?: number;
  proxied?: boolean;
}

export type UpdateDnsInput = Partial<CreateDnsInput>;

export interface CFApiError {
  code: number;
  message: string;
}

export class CloudflareError extends Error {
  readonly tldId: string;
  readonly status: number;
  readonly errors: CFApiError[];

  constructor(
    tldId: string,
    status: number,
    errors: CFApiError[],
    message: string,
  ) {
    super(message);
    this.name = "CloudflareError";
    this.tldId = tldId;
    this.status = status;
    this.errors = errors;
  }
}

export interface ListDnsRecordsOpts {
  name?: string;
  type?: CFRecordType;
  per_page?: number;
  page?: number;
}

export interface PurgeOpts {
  keepTypes?: CFRecordType[];
  keepTxtWithNameMatching?: RegExp;
}

export interface CloudflareClient {
  readonly tldId: string;
  readonly zoneId: string;
  readonly zoneName: string;

  listDnsRecords(opts?: ListDnsRecordsOpts): Promise<CFDnsRecord[]>;
  getDnsRecord(id: string): Promise<CFDnsRecord>;
  createDnsRecord(input: CreateDnsInput): Promise<CFDnsRecord>;
  updateDnsRecord(id: string, input: UpdateDnsInput): Promise<CFDnsRecord>;
  deleteDnsRecord(id: string): Promise<{ id: string }>;
  purgeRecordsBySubdomain(
    fullDomain: string,
    opts?: PurgeOpts,
  ): Promise<{ deletedIds: string[] }>;
  getZoneInfo(): Promise<CFZone>;
  listSubdomainRecords(subdomain: string): Promise<CFDnsRecord[]>;
}
