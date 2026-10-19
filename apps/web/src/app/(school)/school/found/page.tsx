'use client';

import { useEffect, useRef, useState } from 'react';
import { schoolPostsApi, broadcastsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { Bell, CheckCircle, Plus, Shirt, Trash2, Upload, X } from 'lucide-react';

type FoundPost = {
  id: string;
  title: string;
  content?: string;
  mediaUrls: string[];
  publishedAt?: string;
  author?: { fullName?: string };
};

function foundLetter(item: string) {
  const name = item.trim() || 'ζακέτα';
  const phrase = name.toLowerCase() === 'ζακέτα' ? 'η ζακέτα της φωτογραφίας' : `το «${name}» της φωτογραφίας`;
  const pronoun = name.toLowerCase() === 'ζακέτα' ? 'την' : 'το';
  return `Αγαπητοί μας γονείς,\nέχει ξεχαστεί στο χώρο του νηπιαγωγείου ${phrase}. Παρακαλούμε επικοινωνήστε με τη γραμματεία του σχολείου σε περίπτωση που ${pronoun} έχει ξεχάσει το παιδάκι σας.\nΜε εκτίμηση,\nαπό τη γραμματεία του σχολείου`;
}

export default function FoundItemsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const [posts, setPosts] = useState<FoundPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<FoundPost | null>(null);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await schoolPostsApi.list(schoolId, 'found') as any;
      const rows = (res.data ?? res) as FoundPost[];
      setPosts(Array.isArray(rows) ? rows : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolId]);

  const remove = async (id: string) => {
    if (!confirm('Να διαγραφεί αυτή η ενημέρωση από την εφαρμογή των γονέων;')) return;
    await schoolPostsApi.remove(schoolId, id);
    await load();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ευρήματα</h1>
          <p className="text-sm text-gray-500 mt-1">Ανέβασε φωτογραφία και η ενημέρωση φεύγει σε όλους τους γονείς.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#77328D] text-white rounded-lg text-sm font-medium hover:bg-[#642678]"
        >
          <Plus className="w-4 h-4" /> Νέο εύρημα
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Φόρτωση...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Shirt className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500 mb-1">Δεν υπάρχουν ευρήματα</p>
          <p className="text-sm">Όταν βρεθεί ζακέτα, μπουφάν ή άλλο αντικείμενο, οι γονείς το βλέπουν στις Ενημερώσεις.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <article
              key={post.id}
              onClick={() => setDetail(post)}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm cursor-pointer hover:shadow-md hover:border-[#E9D5F2] transition-all"
            >
              {post.mediaUrls?.[0] ? (
                <img src={post.mediaUrls[0]} alt="" className="h-48 w-full object-cover" />
              ) : (
                <div className="h-48 bg-[#FFF1EA] flex items-center justify-center text-[#E95926]">
                  <Shirt className="w-10 h-10" />
                </div>
              )}
              <div className="p-4">
                <h2 className="font-semibold text-gray-900">{post.title}</h2>
                {post.content && <p className="mt-2 text-sm text-gray-600 whitespace-pre-line line-clamp-3">{post.content}</p>}
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span>{post.author?.fullName || 'Γραμματεία'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(post.id); }}
                    className="inline-flex items-center gap-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Διαγραφή
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {detail && (
        <FoundDetailModal
          post={detail}
          schoolId={schoolId}
          onClose={() => setDetail(null)}
          onRemoved={async () => { setDetail(null); await load(); }}
        />
      )}

      {open && (
        <FoundModal
          schoolId={schoolId}
          onClose={() => setOpen(false)}
          onSaved={async () => { setOpen(false); await load(); }}
        />
      )}
    </div>
  );
}

function FoundDetailModal({
  post,
  schoolId,
  onClose,
  onRemoved,
}: {
  post: FoundPost;
  schoolId: string;
  onClose: () => void;
  onRemoved: () => Promise<void>;
}) {
  const [marking, setMarking] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const markFound = async () => {
    setMarking(true);
    setError('');
    try {
      await schoolPostsApi.remove(schoolId, post.id);
      await onRemoved();
    } catch {
      setError('Σφάλμα. Δοκίμασε ξανά.');
      setMarking(false);
    }
  };

  const resend = async () => {
    setSending(true);
    setSent(false);
    setError('');
    try {
      await broadcastsApi.send(schoolId, {
        title: post.title,
        body: post.content ?? post.title,
        imageUrl: post.mediaUrls?.[0],
        targetType: 'all',
        appScreen: 'found',
      });
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch {
      setError('Η υπενθύμιση δεν εστάλη. Δοκίμασε ξανά.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 truncate pr-4">{post.title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Large image */}
        {post.mediaUrls?.[0] && (
          <div className="bg-gray-50 flex items-center justify-center overflow-hidden max-h-72">
            <img
              src={post.mediaUrls[0]}
              alt=""
              className="w-full max-h-72 object-contain"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0">
          {post.content && (
            <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{post.content}</p>
          )}
          <p className="text-xs text-gray-400 mt-4">
            {post.author?.fullName || 'Γραμματεία'}
            {post.publishedAt && (
              <> · {new Date(post.publishedAt).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}</>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          {error && <p className="text-sm text-red-600 mb-1">{error}</p>}

          <button
            onClick={markFound}
            disabled={marking}
            className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            {marking ? 'Αφαίρεση...' : 'Βρέθηκε ο ιδιοκτήτης — Αφαίρεση από λίστα'}
          </button>

          <button
            onClick={resend}
            disabled={sending || sent}
            className="w-full py-2.5 rounded-xl border border-[#E9D5F2] text-[#77328D] text-sm font-semibold hover:bg-[#F9F3FC] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {sent ? '✓ Η υπενθύμιση εστάλη!' : sending ? 'Αποστολή...' : 'Αποστολή υπενθύμισης στους γονείς'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FoundModal({ schoolId, onClose, onSaved }: { schoolId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [item, setItem] = useState('ζακέτα');
  const [letter, setLetter] = useState(foundLetter('ζακέτα'));
  const [edited, setEdited] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const changeItem = (value: string) => {
    setItem(value);
    if (!edited) setLetter(foundLetter(value));
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const res = await schoolPostsApi.uploadMedia(schoolId, file) as any;
      const url: string = res.data?.url ?? res.url;
      if (!url) throw new Error('Η φωτογραφία δεν ανέβηκε.');
      setPhotos((current) => [...current, url].slice(0, 6));
    } catch (err: any) {
      const message = err?.message;
      setError(Array.isArray(message) ? message.join(' ') : message || 'Η φωτογραφία δεν ανέβηκε.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!item.trim() || !letter.trim()) {
      setError('Συμπλήρωσε τι βρέθηκε και το κείμενο.');
      return;
    }
    if (photos.length === 0) {
      setError('Πρόσθεσε φωτογραφία του αντικειμένου.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await schoolPostsApi.create(schoolId, {
        title: `Βρέθηκε ${item.trim()}`,
        content: letter.trim(),
        postType: 'found',
        mediaUrls: photos,
        audienceType: 'all',
        audienceIds: [],
      });
      await onSaved();
    } catch (err: any) {
      const message = err?.message;
      setError(Array.isArray(message) ? message.join(' ') : message || 'Η αποστολή δεν ολοκληρώθηκε.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Νέο εύρημα</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-sm text-gray-500">Η φωτογραφία και το κείμενο φεύγουν ως ενημέρωση σε όλους τους γονείς.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Τι βρέθηκε</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#77328D]"
              value={item}
              onChange={(event) => changeItem(event.target.value)}
              placeholder="ζακέτα, μπουφάν, κασκόλ"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Κείμενο για τους γονείς</label>
            <textarea
              rows={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#77328D]"
              value={letter}
              onChange={(event) => { setEdited(true); setLetter(event.target.value); }}
            />
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) upload(file);
            }} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E9D5F2] text-sm text-[#77328D]"
            >
              <Upload className="w-4 h-4" /> {uploading ? 'Ανέβασμα...' : 'Φωτογραφία'}
            </button>
            {photos.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {photos.map((url, index) => (
                  <div key={url} className="relative">
                    <img src={url} alt="" className="h-20 w-20 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                      className="absolute -top-2 -right-2 bg-white rounded-full shadow p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={save}
            disabled={saving || uploading}
            className="px-4 py-2 rounded-lg bg-[#E95926] text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? 'Αποστολή...' : 'Αποστολή σε όλους τους γονείς'}
          </button>
        </div>
      </div>
    </div>
  );
}
