'use client';

import { useEffect, useState } from 'react';
import { assignmentsApi, classesApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { Plus, Trash2, X } from 'lucide-react';

type Assignment = {
  id: string;
  title: string;
  instructions?: string;
  fileUrls: string[];
  createdAt: string;
  class?: { id: string; name: string };
  author?: { fullName?: string };
};

export default function AssignmentsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState('');
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async (nextClassId = classId) => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const data = await assignmentsApi.list(schoolId, nextClassId || undefined) as any;
      const list = (data.data ?? data) as Assignment[];
      setRows(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!schoolId) return;
    classesApi.list(schoolId).then((data: any) => {
      const list = (data.data ?? data) as { id: string; name: string }[];
      const items = Array.isArray(list) ? list : [];
      setClasses(items);
      if (items[0] && !classId) setClassId(items[0].id);
    }).catch(() => setClasses([]));
  }, [schoolId]);

  useEffect(() => { load(classId); }, [schoolId, classId]);

  const remove = async (id: string) => {
    if (!confirm('Να διαγραφεί η εργασία από την εφαρμογή των γονέων;')) return;
    await assignmentsApi.remove(schoolId, id);
    await load();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Εργασίες</h1>
          <p className="mt-1 text-sm text-gray-500">Οδηγίες και JPG ή PDF για εκτύπωση, ανά τάξη. Οι γονείς τα βλέπουν στο παιδί.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-[#77328D] px-4 py-2 text-sm font-medium text-white hover:bg-[#642678]">
          <Plus className="h-4 w-4" /> Νέα εργασία
        </button>
      </div>
      <select value={classId} onChange={(event) => setClassId(event.target.value)} className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2">
        {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {loading ? <p className="py-16 text-center text-gray-400">Φόρτωση...</p> : rows.length === 0 ? (
        <p className="py-16 text-center text-gray-500">Δεν υπάρχουν εργασίες για αυτή την τάξη.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-extrabold text-[#2c2422]">{row.title}</h2>
                  <p className="text-xs text-gray-500">{row.class?.name} · {row.author?.fullName}</p>
                </div>
                <button onClick={() => remove(row.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
              {row.instructions && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{row.instructions}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {row.fileUrls?.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-lg bg-[#f3e8f7] px-3 py-1 text-sm font-semibold text-[#642678]">
                    {url.toLowerCase().includes('.pdf') || url.includes('/raw/upload/') ? 'PDF' : 'Εικόνα'}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {open && (
        <Composer
          schoolId={schoolId}
          classId={classId}
          onClose={() => setOpen(false)}
          onSaved={async () => { setOpen(false); await load(); }}
        />
      )}
    </div>
  );
}

function Composer({ schoolId, classId, onClose, onSaved }: { schoolId: string; classId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!classId || !title.trim()) {
      setError('Διάλεξε τάξη και γράψε τίτλο.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const urls: string[] = [];
      for (const file of files) {
        const uploaded = await assignmentsApi.uploadMedia(schoolId, file) as any;
        const url = uploaded?.data?.url ?? uploaded?.url ?? '';
        if (!url) throw new Error('upload');
        urls.push(url);
      }
      await assignmentsApi.create(schoolId, { classId, title: title.trim(), instructions: instructions.trim(), fileUrls: urls });
      onSaved();
    } catch {
      setError('Η αποστολή δεν ολοκληρώθηκε.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Νέα εργασία</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Τίτλος" className="w-full rounded-xl border border-gray-200 px-3 py-2" />
          <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Οδηγίες για τους γονείς" rows={4} className="w-full rounded-xl border border-gray-200 px-3 py-2" />
          <input type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={saving} onClick={save} className="w-full rounded-xl bg-[#77328D] py-2 font-semibold text-white disabled:opacity-60">
            {saving ? 'Αποστολή...' : 'Αποστολή στους γονείς'}
          </button>
        </div>
      </div>
    </div>
  );
}
