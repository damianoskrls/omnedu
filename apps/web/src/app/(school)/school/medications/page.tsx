'use client';

import { useEffect, useState } from 'react';
import { medicationRequestsApi, studentsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  Pill, Plus, X, Save, CheckCircle2, Clock, XCircle, ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: 'Εκκρεμεί',  color: 'text-amber-600 bg-amber-50 border-amber-200',  icon: Clock },
  approved:  { label: 'Εγκρίθηκε', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  completed: { label: 'Ολοκληρώθηκε', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: CheckCircle2 },
  rejected:  { label: 'Απορρίφθηκε', color: 'text-red-600 bg-red-50 border-red-200',   icon: XCircle },
};

export default function MedicationsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const isAdmin = user?.role === 'school_admin' || user?.role === 'teacher';

  const [requests, setRequests] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  // New request form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    studentId: '',
    medicationName: '',
    dose: '',
    frequency: '',
    startDate: '',
    endDate: '',
    reason: '',
    doctorNotes: '',
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        medicationRequestsApi.list(schoolId, filterStatus ? { status: filterStatus } : {}) as Promise<any[]>,
        studentsApi.list(schoolId) as Promise<any[]>,
      ]);
      setRequests(Array.isArray(r) ? r : []);
      setStudents(Array.isArray(s) ? s : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolId, filterStatus]);

  const submitRequest = async () => {
    if (!form.studentId || !form.medicationName || !form.dose || !form.frequency || !form.startDate) return;
    setSaving(true);
    try {
      await medicationRequestsApi.create(schoolId, {
        ...form,
        endDate: form.endDate || undefined,
      });
      setShowForm(false);
      setForm({ studentId: '', medicationName: '', dose: '', frequency: '', startDate: '', endDate: '', reason: '', doctorNotes: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const acknowledge = async (id: string) => {
    await medicationRequestsApi.acknowledge(schoolId, id);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await medicationRequestsApi.updateStatus(schoolId, id, status);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Διαγραφή αιτήματος;')) return;
    await medicationRequestsApi.remove(schoolId, id);
    load();
  };

  const pending = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Pill className="text-rose-500" size={24} />
            Χορήγηση Φαρμάκων
          </h1>
          <p className="text-sm text-gray-500 mt-1">Αιτήματα γονέων για χορήγηση φαρμάκου στο σχολείο</p>
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <span className="bg-amber-100 text-amber-700 text-sm font-semibold px-3 py-1.5 rounded-full">
              {pending} εκκρεμή
            </span>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus size={16} /> Νέο Αίτημα
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['', 'pending', 'approved', 'completed', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filterStatus === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {s === '' ? 'Όλα' : STATUS_META[s]?.label ?? s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Pill size={40} className="mx-auto mb-3 opacity-30" />
          <p>Δεν υπάρχουν αιτήματα</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const meta = STATUS_META[req.status] ?? STATUS_META.pending;
            const StatusIcon = meta.icon;
            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {req.student?.fullName?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{req.student?.fullName}</p>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${meta.color}`}>
                          <StatusIcon size={11} />
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-700 mt-1">{req.medicationName}</p>
                      <p className="text-xs text-gray-500">
                        {req.dose} · {req.frequency}
                        {req.startDate && ` · από ${format(new Date(req.startDate), 'd MMM', { locale: el })}`}
                        {req.endDate && ` έως ${format(new Date(req.endDate), 'd MMM', { locale: el })}`}
                      </p>
                      {req.reason && <p className="text-xs text-gray-400 mt-0.5">Αιτία: {req.reason}</p>}
                      {req.doctorNotes && (
                        <p className="text-xs text-blue-600 mt-0.5">Οδηγίες γιατρού: {req.doctorNotes}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Αίτημα από {req.requestedBy?.fullName} · {format(new Date(req.createdAt), 'd MMM yyyy', { locale: el })}
                      </p>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {req.status === 'pending' && (
                        <button
                          onClick={() => acknowledge(req.id)}
                          className="text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium"
                        >
                          Αποδοχή
                        </button>
                      )}
                      {req.status === 'approved' && (
                        <button
                          onClick={() => updateStatus(req.id, 'completed')}
                          className="text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium"
                        >
                          Ολοκλήρωση
                        </button>
                      )}
                      <button
                        onClick={() => remove(req.id)}
                        className="p-1.5 text-gray-300 hover:text-red-400"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New request modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-6">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Αίτημα Χορήγησης Φαρμάκου</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Μαθητής *</label>
                <select
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Επιλογή μαθητή —</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Φάρμακο *</label>
                <input
                  value={form.medicationName}
                  onChange={(e) => setForm({ ...form, medicationName: e.target.value })}
                  placeholder="πχ. Depon syrup, Augmentin"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Δόση *</label>
                  <input
                    value={form.dose}
                    onChange={(e) => setForm({ ...form, dose: e.target.value })}
                    placeholder="πχ. 5ml, 1 δισκίο"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Συχνότητα *</label>
                  <input
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    placeholder="πχ. 1x ημερησίως στις 12:00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Από *</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Έως</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Αιτία</label>
                <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="πχ. Λοίμωξη αναπνευστικού"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Οδηγίες γιατρού / σημειώσεις</label>
                <textarea value={form.doctorNotes} onChange={(e) => setForm({ ...form, doctorNotes: e.target.value })}
                  rows={2} placeholder="πχ. Να δίνεται μετά το φαγητό, να μη συνδυάζεται με..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-50">
                Άκυρο
              </button>
              <button onClick={submitRequest} disabled={saving || !form.studentId || !form.medicationName || !form.dose || !form.frequency || !form.startDate}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14} />
                {saving ? 'Αποστολή...' : 'Αποστολή Αιτήματος'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
