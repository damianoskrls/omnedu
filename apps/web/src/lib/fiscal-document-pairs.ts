/** Bundle an original receipt/invoice with its credit notes for UI grouping. */
export type FiscalDocPair = {
  key: string;
  /** Original receipt/invoice, or an orphan credit if the parent is missing from the list. */
  primary: any;
  credits: any[];
};

function isCreditKind(kind: string) {
  return kind === 'retail_credit_note' || kind === 'service_credit_note';
}

function issueTime(doc: any): number {
  const raw = doc?.issueDate || doc?.createdAt;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Groups each απόδειξη/τιμολόγιο with its πιστωτικά so they render as one framed unit.
 * Credits whose parent is not in `docs` appear as their own bundle.
 */
export function pairFiscalDocuments(docs: any[]): FiscalDocPair[] {
  const list = Array.isArray(docs) ? docs : [];
  const byId = new Map(list.map((d) => [d.id, d]));
  const creditsByParent = new Map<string, any[]>();
  const orphans: any[] = [];

  for (const doc of list) {
    if (!isCreditKind(doc.documentKind)) continue;
    const parentId = doc.relatedDocumentId;
    if (parentId && byId.has(parentId)) {
      const arr = creditsByParent.get(parentId) || [];
      arr.push(doc);
      creditsByParent.set(parentId, arr);
    } else {
      orphans.push(doc);
    }
  }

  for (const arr of creditsByParent.values()) {
    arr.sort((a, b) => issueTime(b) - issueTime(a));
  }

  const pairs: FiscalDocPair[] = [];
  for (const doc of list) {
    if (isCreditKind(doc.documentKind)) continue;
    pairs.push({
      key: doc.id,
      primary: doc,
      credits: creditsByParent.get(doc.id) || [],
    });
  }
  for (const credit of orphans) {
    pairs.push({ key: `orphan-${credit.id}`, primary: credit, credits: [] });
  }

  pairs.sort((a, b) => {
    const aTime = Math.max(issueTime(a.primary), ...a.credits.map(issueTime));
    const bTime = Math.max(issueTime(b.primary), ...b.credits.map(issueTime));
    return bTime - aTime;
  });

  return pairs;
}

export function fiscalDocNetGross(doc: any): number {
  const gross = Number(doc?.grossValue) || 0;
  return isCreditKind(String(doc?.documentKind || '')) ? -gross : gross;
}
