import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ElorusFuseApiError,
  ElorusFuseClient,
  FuseCreateInvoicePayload,
  FuseInvoiceResult,
} from './elorus-fuse.client';

export type IssueFiscalDocumentDto = {
  studentId?: string;
  monthlyChargeId?: string;
  oneTimeChargeId?: string;
  documentKind: 'retail_receipt' | 'service_invoice';
  description: string;
  /** Gross amount in EUR the admin wants on the document. */
  grossAmount: number;
  issueDate?: string;
  series?: string;
  paymentMethodType?: number;
  /** Override school VAT defaults. */
  vatCategory?: number;
  vatExemptionCategory?: number | null;
  counterparty?: {
    vatNumber?: string;
    name?: string;
    country?: string;
    street?: string;
    number?: string;
    postalCode?: string;
    city?: string;
  };
};

function money(n: number): string {
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

function decimal(n: number | string): Prisma.Decimal {
  return new Prisma.Decimal(typeof n === 'number' ? money(n) : n);
}

function vatRateForCategory(category: number): number {
  // myDATA VAT category codes commonly used: 1=24%, 2=13%, 3=6%, 4=17%, 5=9%, 6=4%, 7=0%, 8=exempt
  switch (category) {
    case 1: return 0.24;
    case 2: return 0.13;
    case 3: return 0.06;
    case 4: return 0.17;
    case 5: return 0.09;
    case 6: return 0.04;
    case 7:
    case 8:
      return 0;
    default:
      return 0.24;
  }
}

function normalizeStatus(raw: FuseInvoiceResult | null | undefined): string | null {
  if (!raw) return null;
  const s = (raw.mydataStatus ?? raw.mydata_status ?? null) as string | null;
  return s ? String(s) : null;
}

function pickField(raw: FuseInvoiceResult | null | undefined, camel: string, snake: string): string | null {
  if (!raw) return null;
  const v = (raw as any)[camel] ?? (raw as any)[snake];
  if (v === undefined || v === null || v === '') return null;
  return String(v);
}

@Injectable()
export class ElorusFuseService {
  private readonly logger = new Logger(ElorusFuseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ElorusFuseClient,
    private readonly notifications: NotificationsService,
  ) {}

  async getFiscalSettings(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        vatNumber: true,
        fiscalRetailSeries: true,
        fiscalInvoiceSeries: true,
        fiscalVatCategory: true,
        fiscalVatExemptionCategory: true,
      },
    });
    if (!school) throw new NotFoundException('School not found');
    return {
      ...school,
      fuseConfigured: this.client.isConfigured(),
      fuseBaseUrl: this.client.baseUrlPublic(),
    };
  }

  async updateFiscalSettings(schoolId: string, data: {
    vatNumber?: string | null;
    fiscalRetailSeries?: string | null;
    fiscalInvoiceSeries?: string | null;
    fiscalVatCategory?: number | null;
    fiscalVatExemptionCategory?: number | null;
  }) {
    const allowed = [
      'vatNumber',
      'fiscalRetailSeries',
      'fiscalInvoiceSeries',
      'fiscalVatCategory',
      'fiscalVatExemptionCategory',
    ] as const;
    const payload: Record<string, unknown> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string') {
          const trimmed = String(data[key]).trim();
          payload[key] = trimmed === '' ? null : trimmed;
        } else {
          payload[key] = data[key];
        }
      }
    }
    return this.prisma.school.update({
      where: { id: schoolId },
      data: payload,
      select: {
        id: true,
        vatNumber: true,
        fiscalRetailSeries: true,
        fiscalInvoiceSeries: true,
        fiscalVatCategory: true,
        fiscalVatExemptionCategory: true,
      },
    });
  }

  async listDocuments(schoolId: string, studentId?: string) {
    return this.prisma.fiscalDocument.findMany({
      where: {
        schoolId,
        ...(studentId ? { studentId } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            enrollments: {
              where: { academicYear: { isCurrent: true } },
              include: {
                class: {
                  select: {
                    id: true,
                    name: true,
                    level: { select: { id: true, name: true } },
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** Parent-facing list: pending/issued docs for their children (failed hidden). */
  async listDocumentsForParent(schoolId: string, parentUserId: string) {
    // Include inactive students — fiscal history must remain visible after archive.
    const children = await this.prisma.student.findMany({
      where: { schoolId, parents: { some: { userId: parentUserId } } },
      select: { id: true, fullName: true },
    });
    if (!children.length) return [];
    const names = new Map(children.map((c) => [c.id, c.fullName]));
    const docs = await this.prisma.fiscalDocument.findMany({
      where: {
        schoolId,
        status: { in: ['pending', 'issued'] },
        studentId: { in: children.map((c) => c.id) },
      },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    });
    return docs.map((doc) => ({
      id: doc.id,
      kind: 'fiscal',
      documentKind: doc.documentKind,
      invoiceType: doc.invoiceType,
      series: doc.series,
      number: doc.number,
      title: `${doc.documentKind === 'service_invoice' ? 'Τιμολόγιο' : 'Απόδειξη'} ${doc.series}-${doc.number}`,
      description: doc.description,
      // Decimal → number so mobile always gets a plain JSON number
      grossValue: Number(doc.grossValue),
      issueDate: doc.issueDate instanceof Date
        ? doc.issueDate.toISOString().slice(0, 10)
        : doc.issueDate,
      mark: doc.mark,
      fuseUid: doc.fuseUid,
      qrUrl: doc.qrUrl,
      verificationUrl: doc.verificationUrl || doc.qrUrl || null,
      studentId: doc.studentId,
      studentName: doc.studentId ? (names.get(doc.studentId) ?? '') : '',
      status: doc.status,
      mydataStatus: doc.mydataStatus,
      createdAt: doc.createdAt,
      fileUrl: doc.verificationUrl || doc.qrUrl || null,
      uploadedAt: doc.issueDate instanceof Date
        ? doc.issueDate.toISOString()
        : (doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt),
    }));
  }

  async getDocumentForParent(schoolId: string, parentUserId: string, id: string) {
    const rows = await this.listDocumentsForParent(schoolId, parentUserId);
    const doc = rows.find((r) => r.id === id);
    if (!doc) throw new NotFoundException('Το παραστατικό δεν βρέθηκε');
    return doc;
  }

  /** Parent may refresh their own child's document to pick up verification URL / MARK. */
  async refreshForParent(schoolId: string, parentUserId: string, id: string) {
    await this.getDocumentForParent(schoolId, parentUserId, id);
    await this.refresh(schoolId, id);
    return this.getDocumentForParent(schoolId, parentUserId, id);
  }

  async getDocument(schoolId: string, id: string) {
    const doc = await this.prisma.fiscalDocument.findFirst({ where: { id, schoolId } });
    if (!doc) throw new NotFoundException('Fiscal document not found');
    return doc;
  }

  private async nextNumber(schoolId: string, series: string): Promise<string> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.fiscalSeriesCounter.findUnique({
        where: { schoolId_series: { schoolId, series } },
      });
      if (!existing) {
        return tx.fiscalSeriesCounter.create({
          data: { schoolId, series, lastNumber: 1 },
        });
      }
      return tx.fiscalSeriesCounter.update({
        where: { id: existing.id },
        data: { lastNumber: { increment: 1 } },
      });
    });
    return String(row.lastNumber);
  }

  async issue(schoolId: string, dto: IssueFiscalDocumentDto) {
    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException(
        'Elorus Fuse δεν είναι ρυθμισμένο. Ορίστε ELORUS_FUSE_API_TOKEN στο API env.',
      );
    }

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    const issuerVat = String(school.vatNumber || '').trim();
    if (!issuerVat) {
      throw new BadRequestException('Λείπει το ΑΦΜ σχολείου. Συμπλήρωσέ το στις ρυθμίσεις οικονομικών.');
    }

    const kind = dto.documentKind;
    if (kind !== 'retail_receipt' && kind !== 'service_invoice') {
      throw new BadRequestException('Άκυρος τύπος παραστατικού');
    }

    const invoiceType = kind === 'retail_receipt' ? '11.2' : '2.1';
    const defaultSeries =
      kind === 'retail_receipt'
        ? (school.fiscalRetailSeries || 'ΑΠ')
        : (school.fiscalInvoiceSeries || 'ΤΙΜ');
    const series = String(dto.series || defaultSeries).trim();
    if (!series) throw new BadRequestException('Λείπει η σειρά παραστατικού');

    const gross = Number(dto.grossAmount);
    if (!Number.isFinite(gross) || gross <= 0) {
      throw new BadRequestException('Το ποσό πρέπει να είναι θετικός αριθμός');
    }

    const description = String(dto.description || '').trim();
    if (!description) throw new BadRequestException('Λείπει η περιγραφή');

    if (dto.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: dto.studentId, schoolId },
        select: { id: true },
      });
      if (!student) throw new BadRequestException('Ο μαθητής δεν βρέθηκε');
    }

    const vatCategory =
      dto.vatCategory ??
      school.fiscalVatCategory ??
      1;
    const vatExemptionCategory =
      dto.vatExemptionCategory !== undefined
        ? dto.vatExemptionCategory
        : school.fiscalVatExemptionCategory;

    const rate = vatExemptionCategory != null || vatCategory === 7 || vatCategory === 8
      ? 0
      : vatRateForCategory(vatCategory);
    const net = rate > 0 ? gross / (1 + rate) : gross;
    const vatAmount = gross - net;

    // Counterparty = πελάτης (γονέας). Required for invoices; recommended for
    // service receipts so the printed/Fuse document matches classic school APYs.
    let counterparty = dto.counterparty;
    const cpName = String(counterparty?.name || '').trim();
    const cpVat = String(counterparty?.vatNumber || '').trim();
    if (kind === 'service_invoice') {
      if (!cpVat || !cpName) {
        throw new BadRequestException('Για τιμολόγιο απαιτούνται ΑΦΜ και επωνυμία πελάτη (γονέα)');
      }
    }
    if (cpName) {
      counterparty = {
        ...counterparty,
        vatNumber: cpVat || undefined,
        name: cpName,
        country: String(counterparty?.country || 'GR').trim() || 'GR',
      };
    } else {
      counterparty = undefined;
    }

    const issueDate = dto.issueDate
      ? new Date(dto.issueDate)
      : new Date();
    if (Number.isNaN(issueDate.getTime())) {
      throw new BadRequestException('Άκυρη ημερομηνία έκδοσης');
    }
    const issueDateStr = issueDate.toISOString().slice(0, 10);

    const paymentMethodType = dto.paymentMethodType ?? 3; // cash default

    const number = await this.nextNumber(schoolId, series);

    const pending = await this.prisma.fiscalDocument.create({
      data: {
        schoolId,
        studentId: dto.studentId || null,
        monthlyChargeId: dto.monthlyChargeId || null,
        oneTimeChargeId: dto.oneTimeChargeId || null,
        documentKind: kind,
        invoiceType,
        series,
        number,
        issueDate: new Date(`${issueDateStr}T00:00:00.000Z`),
        description,
        netValue: decimal(net),
        vatCategory,
        vatExemptionCategory: vatExemptionCategory ?? null,
        vatAmount: decimal(vatAmount),
        grossValue: decimal(gross),
        paymentMethodType,
        cpVatNumber: counterparty?.vatNumber || null,
        cpName: counterparty?.name || null,
        cpCountry: counterparty?.country || null,
        cpStreet: counterparty?.street || null,
        cpNumber: counterparty?.number || null,
        cpPostalCode: counterparty?.postalCode || null,
        cpCity: counterparty?.city || null,
        status: 'pending',
      },
    });

    const line: FuseCreateInvoicePayload['lines'][number] = {
      net_value: money(net),
      vat_category: vatCategory,
      vat_amount: money(vatAmount),
      description,
    };
    if (vatExemptionCategory != null) {
      line.vat_exemption_category = vatExemptionCategory;
    }

    const payload: FuseCreateInvoicePayload = {
      issuer_vat_number: issuerVat,
      invoice_type: invoiceType,
      number,
      issue_date: issueDateStr,
      series,
      lines: [line],
      total_net_value: money(net),
      total_vat_amount: money(vatAmount),
      total_gross_value: money(gross),
      payment_methods: [{ type: paymentMethodType, amount: money(gross) }],
    };

    if (counterparty) {
      payload.cp_vat_number = counterparty.vatNumber;
      payload.cp_name = counterparty.name;
      payload.cp_country = counterparty.country || 'GR';
      if (counterparty.street || counterparty.city || counterparty.postalCode) {
        payload.cp_address = {
          street: counterparty.street || undefined,
          number: counterparty.number || undefined,
          postal_code: counterparty.postalCode || undefined,
          city: counterparty.city || undefined,
        };
      }
    }

    try {
      const result = await this.client.createInvoice(issuerVat, payload);
      const saved = await this.persistFuseSuccess(pending.id, result);
      await this.notifyParentsOfIssue(schoolId, saved);
      return saved;
    } catch (err) {
      if (err instanceof ElorusFuseApiError && err.statusCode === 0) {
        // Indeterminate: try to recover by series/number lookup before marking failed.
        try {
          const found = await this.client.listInvoices(issuerVat, { series, number, page_size: 5 });
          const match = (found.results || []).find(
            (r) => String((r as any).series || '') === series && String((r as any).number || '') === number,
          ) || (found.results || [])[0];
          if (match && (match.uid || (match as any).id)) {
            this.logger.warn(`Recovered Fuse invoice after transport error for ${series}-${number}`);
            return this.persistFuseSuccess(pending.id, match);
          }
        } catch (lookupErr) {
          this.logger.warn(`Fuse recovery lookup failed: ${(lookupErr as Error).message}`);
        }
      }

      const message = err instanceof Error ? err.message : 'Άγνωστο σφάλμα Elorus Fuse';
      this.logger.error(`Issue failed for ${series}-${number}: ${message}`);
      return this.prisma.fiscalDocument.update({
        where: { id: pending.id },
        data: {
          status: 'failed',
          errorMessage: message,
          rawResponse: err instanceof ElorusFuseApiError ? JSON.stringify(err.body) : null,
        },
      });
    }
  }

  private async persistFuseSuccess(id: string, result: FuseInvoiceResult) {
    const uid = pickField(result, 'uid', 'uid');
    const mark = pickField(result, 'mark', 'mark');
    const authenticationCode = pickField(result, 'authenticationCode', 'authentication_code');
    const qrUrl = pickField(result, 'qrUrl', 'qr_url');
    const verificationUrl = pickField(result, 'verificationUrl', 'verification_url');
    const mydataStatus = normalizeStatus(result);

    return this.prisma.fiscalDocument.update({
      where: { id },
      data: {
        fuseUid: uid,
        mark,
        authenticationCode,
        qrUrl,
        verificationUrl,
        mydataStatus,
        status: 'issued',
        errorMessage: null,
        rawResponse: JSON.stringify(result),
      },
      include: {
        student: { select: { id: true, fullName: true } },
      },
    });
  }

  async resendToParents(schoolId: string, id: string) {
    const doc = await this.prisma.fiscalDocument.findFirst({
      where: { id, schoolId },
      include: { student: { select: { id: true, fullName: true } } },
    });
    if (!doc) throw new NotFoundException('Fiscal document not found');
    if (!doc.studentId) {
      throw new BadRequestException('Το παραστατικό δεν συνδέεται με μαθητή — δεν υπάρχει γονέας για αποστολή');
    }
    await this.notifyParentsOfIssue(schoolId, doc);
    return { ok: true, id: doc.id };
  }

  async notifyParentsOfIssue(schoolId: string, doc: {
    id: string;
    studentId: string | null;
    documentKind: string;
    series: string;
    number: string;
    description: string;
    grossValue: any;
    fuseUid: string | null;
    verificationUrl: string | null;
    qrUrl: string | null;
    student?: { id: string; fullName: string } | null;
  }) {
    if (!doc.studentId) return;
    const kindLabel = doc.documentKind === 'service_invoice' ? 'Τιμολόγιο' : 'Απόδειξη';
    const title = `${kindLabel} ${doc.series}-${doc.number}`;
    const amount = Number(doc.grossValue || 0).toFixed(2);
    const body = `Εκδόθηκε ${kindLabel.toLowerCase()} €${amount} — ${doc.description}`;
    try {
      const openUrl = String(doc.verificationUrl || doc.qrUrl || '').trim();
      await this.notifications.notifyStudentParents(schoolId, doc.studentId, {
        event: 'receipt',
        type: 'fiscal_document',
        title,
        body,
        data: {
          fiscalDocumentId: doc.id,
          series: doc.series,
          number: doc.number,
          screen: 'receipts',
          ...(openUrl ? { verificationUrl: openUrl } : {}),
          grossValue: amount,
          description: doc.description || '',
        },
      });
    } catch (err) {
      this.logger.warn(`Parent notify failed for fiscal ${doc.id}: ${(err as Error).message}`);
    }

    // Best-effort: email official Fuse document to parent emails when UID exists.
    if (!doc.fuseUid) return;
    try {
      const school = await this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { vatNumber: true },
      });
      const issuerVat = String(school?.vatNumber || '').trim();
      if (!issuerVat) return;
      const parents = await this.prisma.studentParent.findMany({
        where: { studentId: doc.studentId },
        include: { user: { select: { email: true } } },
      });
      const emails = [...new Set(
        parents.map((p) => String(p.user?.email || '').trim()).filter((e) => e.includes('@')),
      )];
      for (const email of emails.slice(0, 3)) {
        try {
          await this.client.emailInvoice(issuerVat, doc.fuseUid, email);
        } catch (emailErr) {
          this.logger.warn(`Fuse email to ${email} failed: ${(emailErr as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Fuse parent email skipped: ${(err as Error).message}`);
    }
  }

  async refresh(schoolId: string, id: string) {
    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException('Elorus Fuse δεν είναι ρυθμισμένο');
    }
    const doc = await this.getDocument(schoolId, id);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    const issuerVat = String(school?.vatNumber || '').trim();
    if (!issuerVat) throw new BadRequestException('Λείπει το ΑΦΜ σχολείου');

    try {
      let latest: FuseInvoiceResult | null = null;
      if (doc.fuseUid) {
        latest = await this.client.getInvoice(issuerVat, doc.fuseUid);
      }
      if (!latest) {
        latest = await this.client.findBySeriesNumber(issuerVat, doc.series, doc.number);
      }
      if (!latest) {
        // Document may already be issued locally with QR/verification; don't scare the admin.
        if (doc.status === 'issued' && (doc.verificationUrl || doc.qrUrl || doc.mark)) {
          return doc;
        }
        throw new NotFoundException('Δεν βρέθηκε ακόμα στο Elorus Fuse — δοκίμασε σε λίγο');
      }
      return this.persistFuseSuccess(doc.id, latest);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Αποτυχία refresh');
    }
  }
}
