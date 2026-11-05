'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStoredUser } from '@/lib/auth';
import { studentsApi } from '@/lib/api';
import { FiscalIssueForm, type FiscalIssuePrefill } from '@/components/FiscalIssueForm';

function FiscalIssuePageInner() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();

  const studentId = searchParams.get('studentId') || undefined;
  const monthlyChargeId = searchParams.get('monthlyChargeId') || undefined;
  const oneTimeChargeId = searchParams.get('oneTimeChargeId') || undefined;
  const amountRaw = searchParams.get('amount');
  const description = searchParams.get('description') || undefined;
  const kindParam = searchParams.get('kind');
  const manual = searchParams.get('manual') === '1';
  const picker = searchParams.get('picker') === '1' || !studentId;
  const returnTo = searchParams.get('returnTo') || undefined;

  const amount = useMemo(() => {
    if (amountRaw == null || amountRaw === '') return undefined;
    const n = Number(amountRaw);
    return Number.isFinite(n) ? n : undefined;
  }, [amountRaw]);

  const defaultKind =
    kindParam === 'service_invoice' || kindParam === 'retail_receipt'
      ? kindParam
      : undefined;

  const [prefill, setPrefill] = useState<FiscalIssuePrefill | null>(null);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const base: FiscalIssuePrefill = {
        studentId,
        monthlyChargeId,
        oneTimeChargeId,
        grossAmount: amount,
        description,
        manualRecipient: manual,
        defaultKind,
      };

      if (!studentId || !schoolId) {
        if (!cancelled) {
          setPrefill(base);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setLoadError('');
      try {
        const s: any = await studentsApi.get(schoolId, studentId);
        if (cancelled) return;
        setPrefill({
          ...base,
          studentId: s?.id || studentId,
          studentName: s?.fullName || undefined,
          studentAddress: s?.address || null,
          parents: (s?.parents || [])
            .map((p: any) => ({
              userId: p.userId || p.user?.id,
              fullName: p.user?.fullName || '',
              vatNumber: p.user?.vatNumber || null,
              profession: p.user?.profession || null,
              taxOffice: p.user?.taxOffice || null,
              billingStreet: p.user?.billingStreet || null,
              billingNumber: p.user?.billingNumber || null,
              billingPostalCode: p.user?.billingPostalCode || null,
              billingCity: p.user?.billingCity || null,
              isPrimary: Boolean(p.isPrimary),
              relation: p.relation || null,
            }))
            .filter((p: any) => p.userId && p.fullName),
        });
      } catch (err: any) {
        if (cancelled) return;
        setLoadError(err?.response?.data?.message || err?.message || 'Αποτυχία φόρτωσης μαθητή');
        setPrefill(base);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [
    schoolId,
    studentId,
    monthlyChargeId,
    oneTimeChargeId,
    amount,
    description,
    manual,
    defaultKind,
  ]);

  function goBack() {
    if (returnTo) {
      router.push(returnTo);
      return;
    }
    if (studentId) {
      router.push(`/school/students/${studentId}?tab=billing`);
      return;
    }
    router.push('/school/billing?tab=fiscal');
  }

  if (!schoolId) {
    return (
      <div className="p-6 text-sm text-gray-500">Φόρτωση σχολείου...</div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="h-10 w-64 bg-gray-100 rounded-lg animate-pulse mb-4" />
        <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {loadError && (
        <div className="mx-auto mb-4 max-w-3xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}
        </div>
      )}
      <FiscalIssueForm
        schoolId={schoolId}
        prefill={prefill}
        allowStudentPicker={picker}
        onCancel={goBack}
        onIssued={() => goBack()}
      />
    </div>
  );
}

export default function FiscalIssuePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-3xl mx-auto">
          <div className="h-10 w-64 bg-gray-100 rounded-lg animate-pulse mb-4" />
          <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      }
    >
      <FiscalIssuePageInner />
    </Suspense>
  );
}
