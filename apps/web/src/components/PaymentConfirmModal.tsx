'use client';

import { useEffect, useState } from 'react';
import { broadcastsApi, studentsApi } from '@/lib/api';
import { PAY_METHODS, PaymentInfo } from '@/lib/payment-note';
import { createReceiptFile, downloadFile } from '@/lib/receipt-pdf';

export type PaymentPrompt = {
  title: string;
  detail?: string;
  studentName: string;
  studentId: string;
  schoolId: string;
  parents?: { id: string; name: string }[];
  schoolName: string;
  logoUrl?: string;
  chargeAmount: number;
  lockPaidAmount?: boolean;
  run: (info: PaymentInfo) => Promise<void>;
};

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function moneyInput(value: number) {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2);
}

export function PaymentConfirmModal({
  prompt,
  onClose,
}: {
  prompt: PaymentPrompt | null;
  onClose: () => void;
}) {
  const [paidAmount, setPaidAmount] = useState('');
  const [paidAt, setPaidAt] = useState(todayInput());
  const [payerName, setPayerName] = useState('');
  const [payerMode, setPayerMode] = useState<'parent' | 'other'>('parent');
  const [addresseeName, setAddresseeName] = useState('');
  const [method, setMethod] = useState('cash');
  const [sendReceipt, setSendReceipt] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptTouched, setReceiptTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!prompt) return;
    const parent = prompt.parents?.[0]?.name ?? '';
    setPaidAmount(moneyInput(prompt.chargeAmount));
    setPaidAt(todayInput());
    setPayerMode(parent ? 'parent' : 'other');
    setPayerName(parent);
    setAddresseeName(parent);
    setMethod('cash');
    setSendReceipt(false);
    setReceiptAmount(moneyInput(prompt.chargeAmount));
    setReceiptTouched(false);
    setSaving(false);
    setError('');
    setNotice('');
  }, [prompt]);

  if (!prompt) return null;

  const submit = async () => {
    const paid = Number(paidAmount);
    const receipt = Number(receiptAmount);
    if (!payerName.trim()) {
      setError('Γράψε από ποιον έγινε η πληρωμή.');
      return;
    }
    if (!paidAt) {
      setError('Διάλεξε την ημερομηνία.');
      return;
    }
    if (!Number.isFinite(paid) || paid <= 0) {
      setError('Το ποσό της πληρωμής πρέπει να είναι μεγαλύτερο από το μηδέν.');
      return;
    }
    if (sendReceipt && (!Number.isFinite(receipt) || receipt <= 0)) {
      setError('Γράψε το ποσό που θα αναγράφει η απόδειξη.');
      return;
    }
    const info: PaymentInfo = {
      paidAmount: paid,
      paidAt,
      payerName: payerName.trim(),
      addresseeName: (addresseeName || payerName).trim(),
      method,
      sendReceipt,
      receiptAmount: sendReceipt ? receipt : paid,
    };
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await prompt.run(info);
      if (sendReceipt) {
        try {
          const file = await createReceiptFile({
            schoolName: prompt.schoolName,
            logoUrl: prompt.logoUrl,
            studentName: prompt.studentName,
            addresseeName: info.addresseeName,
            payerName: info.payerName,
            title: prompt.detail ? `${prompt.title} · ${prompt.detail}` : prompt.title,
            paidAt: info.paidAt,
            method: info.method,
            receiptAmount: info.receiptAmount,
          });
          downloadFile(file);
          try {
            const doc: any = await studentsApi.uploadDocument(prompt.schoolId, prompt.studentId, file, {
              title: `Απόδειξη ${info.receiptAmount.toFixed(2)}€ · ${prompt.title}`,
              category: 'receipt',
              notes: `Προς ${info.addresseeName}`,
            });
            const url = doc?.fileUrl ?? '';
            await broadcastsApi.send(prompt.schoolId, {
              title: `Απόδειξη · ${prompt.title}`,
              body: `Εκδόθηκε απόδειξη ${info.receiptAmount.toFixed(2)} € για ${prompt.studentName}, προς ${info.addresseeName}.${url ? ` ${url}` : ''}`,
              targetType: 'student',
              targetStudentId: prompt.studentId,
            });
          } catch {
            setNotice('Η πληρωμή καταχωρίστηκε και η απόδειξη κατέβηκε. Η αποστολή στον γονέα δεν ολοκληρώθηκε.');
            setSaving(false);
            return;
          }
        } catch {
          setNotice('Η πληρωμή καταχωρίστηκε. Η απόδειξη δεν δημιουργήθηκε.');
          setSaving(false);
          return;
        }
      }
      onClose();
    } catch {
      setError('Η καταχώριση δεν ολοκληρώθηκε. Δοκίμασε ξανά.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Καταχώρηση πληρωμής</h3>
          <p className="text-sm text-gray-500 mt-1">
            {prompt.studentName} · {prompt.title}
            {prompt.detail ? ` · ${prompt.detail}` : ''}
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Ποσό που καταβλήθηκε (€)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paidAmount}
              disabled={prompt.lockPaidAmount}
              onChange={e => {
                setPaidAmount(e.target.value);
                if (!receiptTouched) setReceiptAmount(e.target.value);
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:bg-gray-50"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Πότε έγινε</span>
            <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
          </label>
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Από ποιον έγινε</span>
            <p className="text-xs text-gray-500 mb-2">Διάλεξε γονέα ή γράψε όποιον άλλον πλήρωσε.</p>
            {!!prompt.parents?.length && (
              <div className="flex flex-wrap gap-2 mb-2">
                {prompt.parents.map(parent => (
                  <button
                    key={parent.id}
                    type="button"
                    onClick={() => {
                      setPayerMode('parent');
                      setPayerName(parent.name);
                      setAddresseeName(parent.name);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm ${payerMode === 'parent' && payerName === parent.name ? 'border-[#77328D] bg-[#faf5fc] font-semibold text-[#642678]' : 'border-gray-200 text-gray-700'}`}
                  >
                    {parent.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPayerMode('other');
                    setPayerName('');
                  }}
                  className={`rounded-full border px-3 py-1.5 text-sm ${payerMode === 'other' ? 'border-[#77328D] bg-[#faf5fc] font-semibold text-[#642678]' : 'border-gray-200 text-gray-700'}`}
                >
                  Άλλος
                </button>
              </div>
            )}
            {(payerMode === 'other' || !prompt.parents?.length) && (
              <input
                value={payerName}
                onChange={e => setPayerName(e.target.value)}
                placeholder="Όνομα όποιου πλήρωσε"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              />
            )}
          </div>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Τρόπος</span>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
              {PAY_METHODS.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={sendReceipt}
              onChange={e => setSendReceipt(e.target.checked)}
              className="mt-1"
            />
            <span>Να σταλεί απόδειξη στον γονέα</span>
          </label>
          {sendReceipt && (
            <div className="rounded-xl border border-[#e6d0ee] bg-[#faf6fb] p-4 space-y-3">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Προς</span>
                <input
                  value={addresseeName}
                  onChange={e => setAddresseeName(e.target.value)}
                  placeholder="Όνομα γονέα"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Ποσό απόδειξης (€)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={receiptAmount}
                  onChange={e => {
                    setReceiptTouched(true);
                    setReceiptAmount(e.target.value);
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                />
                <span className="block text-xs text-gray-500 mt-1">Μπορεί να είναι μικρότερο από την οφειλή, για παράδειγμα 100€.</span>
              </label>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="text-sm text-amber-700">{notice}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Ακύρωση</button>
          {notice ? (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[#77328D] text-white text-sm font-semibold">Κλείσιμο</button>
          ) : (
            <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#77328D] text-white text-sm font-semibold disabled:opacity-50">
              {saving ? 'Αποθήκευση...' : 'Καταχώρηση'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
