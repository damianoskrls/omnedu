'use client';

import { useEffect, useRef, useState } from 'react';
import { schoolPostsApi, classesApi, levelsApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import {
  Plus, X, Pencil, Trash2, Image as ImageIcon, CalendarDays,
  Newspaper, Upload, Users,
} from 'lucide-react';
import { AudienceSelector, AudienceValue, audienceLabel } from '@/components/AudienceSelector';

// ─── Types ──────────────────────────────────────────────────────────────────

type PostType = 'general' | 'excursion' | 'theater' | 'event';

type Post = {
  id: string;
  title: string;
  content?: string;
  postType: PostType;
  mediaUrls: string[];
  publishedAt?: string;
  createdAt: string;
  author?: { fullName?: string };
  audienceType?: string;
  audienceIds?: string;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const TYPE_META: Record<PostType, { label: string; bg: string; text: string; border: string }> = {
  general:   { label: 'Γενικό',    bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  excursion: { label: 'Εκδρομή',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  theater:   { label: 'Θέατρο',    bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  event:     { label: 'Εκδήλωση',  bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
};

const TABS: { key: PostType | 'all'; label: string }[] = [
  { key: 'all',       label: 'Όλα' },
  { key: 'excursion', label: 'Εκδρομές' },
  { key: 'theater',   label: 'Θέατρο' },
  { key: 'event',     label: 'Εκδηλώσεις' },
  { key: 'general',   label: 'Γενικά' },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PostsPage() {
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PostType | 'all'>('all');
  const [modal, setModal] = useState<Partial<Post> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);

  const load = async (type?: PostType | 'all') => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await schoolPostsApi.list(schoolId, type === 'all' ? undefined : type) as any;
      setPosts((res.data ?? res) as Post[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!schoolId) return;
    load(activeTab);
    Promise.all([
      classesApi.list(schoolId) as Promise<any>,
      levelsApi.list(schoolId) as Promise<any>,
    ]).then(([c, l]) => {
      setClasses(Array.isArray(c) ? c : []);
      setLevels(Array.isArray(l) ? l : []);
    });
  }, [schoolId, activeTab]);

  const openNew = () => setModal({
    postType: 'excursion',
    title: '',
    content: '',
    mediaUrls: [],
    publishedAt: new Date().toISOString().slice(0, 10),
    audienceType: 'all',
    audienceIds: '[]',
  });

  const openEdit = (post: Post) => setModal({
    ...post,
    publishedAt: post.publishedAt ? post.publishedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    audienceType: post.audienceType ?? 'all',
    audienceIds: post.audienceIds ?? '[]',
  });

  const save = async () => {
    if (!modal?.title?.trim() || !schoolId) return;
    setSaving(true);
    try {
      const audienceIds: string[] = (() => { try { return JSON.parse(modal.audienceIds ?? '[]'); } catch { return []; } })();
      const payload = {
        title: modal.title,
        content: modal.content || undefined,
        postType: modal.postType ?? 'general',
        mediaUrls: modal.mediaUrls ?? [],
        publishedAt: modal.publishedAt ? new Date(modal.publishedAt).toISOString() : undefined,
        audienceType: modal.audienceType ?? 'all',
        audienceIds,
      };
      if (modal.id) {
        await schoolPostsApi.update(schoolId, modal.id, payload);
      } else {
        await schoolPostsApi.create(schoolId, payload);
      }
      setModal(null);
      await load(activeTab);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Να διαγραφεί οριστικά αυτή η ανάρτηση;')) return;
    await schoolPostsApi.remove(schoolId, id);
    await load(activeTab);
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const res = await schoolPostsApi.uploadMedia(schoolId, file) as any;
      const url: string = res.data?.url ?? res.url;
      setModal(prev => prev ? { ...prev, mediaUrls: [...(prev.mediaUrls ?? []), url] } : prev);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setModal(prev => prev ? { ...prev, mediaUrls: (prev.mediaUrls ?? []).filter((_, i) => i !== idx) } : prev);
  };

  const filtered = posts;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Νέα & Εκδηλώσεις</h1>
          <p className="text-sm text-gray-500 mt-1">Εκδρομές, παραστάσεις, εκδηλώσεις σχολείου</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Νέα Ανάρτηση
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Φόρτωση...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500 mb-1">Δεν υπάρχουν αναρτήσεις</p>
          <p className="text-sm">Προσθέστε την πρώτη ανάρτηση για τους γονείς</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(post => (
            <PostCard key={post.id} post={post} onEdit={openEdit} onDelete={remove} classes={classes} levels={levels} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <PostModal
          post={modal}
          onChange={setModal}
          onSave={save}
          onClose={() => setModal(null)}
          saving={saving}
          uploading={uploading}
          onUploadImage={uploadImage}
          onRemoveImage={removeImage}
          classes={classes}
          levels={levels}
        />
      )}
    </div>
  );
}

// ─── PostCard ────────────────────────────────────────────────────────────────

function PostCard({
  post, onEdit, onDelete,
  classes, levels,
}: {
  post: Post;
  onEdit: (p: Post) => void;
  onDelete: (id: string) => void;
  classes: { id: string; name: string }[];
  levels: { id: string; name: string }[];
}) {
  const meta = TYPE_META[post.postType] ?? TYPE_META.general;
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const audience = audienceLabel(post.audienceType ?? 'all', post.audienceIds ?? '[]', classes, levels);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {post.mediaUrls.length > 0 ? (
        <div className="relative h-44 bg-gray-100 overflow-hidden">
          <img src={post.mediaUrls[0]} alt="" className="w-full h-full object-cover" />
          {post.mediaUrls.length > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> +{post.mediaUrls.length - 1}
            </span>
          )}
        </div>
      ) : (
        <div className="h-28 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-gray-300" />
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
          {date && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />{date}
            </span>
          )}
        </div>
        <p className="font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">{post.title}</p>
        {post.content && (
          <p className="text-xs text-gray-500 line-clamp-2 flex-1">{post.content}</p>
        )}
        <div className="flex items-center gap-1 mt-2">
          <Users className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-400 truncate">{audience}</span>
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => onEdit(post)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-600 rounded-lg hover:bg-gray-100 border border-gray-200"
          >
            <Pencil className="w-3 h-3" /> Επεξεργασία
          </button>
          <button
            onClick={() => onDelete(post.id)}
            className="py-1.5 px-3 text-xs text-red-500 rounded-lg hover:bg-red-50 border border-red-100"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PostModal ───────────────────────────────────────────────────────────────

function PostModal({
  post, onChange, onSave, onClose, saving, uploading, onUploadImage, onRemoveImage, classes, levels,
}: {
  post: Partial<Post>;
  onChange: (p: Partial<Post>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  uploading: boolean;
  onUploadImage: (f: File) => void;
  onRemoveImage: (idx: number) => void;
  classes: { id: string; name: string }[];
  levels: { id: string; name: string }[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    files.forEach(onUploadImage);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">{post.id ? 'Επεξεργασία Ανάρτησης' : 'Νέα Ανάρτηση'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Τύπος</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(TYPE_META) as [PostType, typeof TYPE_META[PostType]][]).map(([key, m]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ ...post, postType: key })}
                  className={`py-2 px-3 text-xs rounded-xl border-2 font-semibold transition-colors ${
                    post.postType === key
                      ? `${m.border} ${m.bg} ${m.text}`
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Τίτλος *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={post.title ?? ''}
              onChange={e => onChange({ ...post, title: e.target.value })}
              placeholder="π.χ. Εκδρομή στην Ακρόπολη"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ημερομηνία</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={post.publishedAt ?? ''}
              onChange={e => onChange({ ...post, publishedAt: e.target.value })}
            />
          </div>

          {/* Audience */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Απευθύνεται σε</label>
            <AudienceSelector
              value={{
                audienceType: (post.audienceType ?? 'all') as any,
                audienceIds: (() => { try { return JSON.parse(post.audienceIds ?? '[]'); } catch { return []; } })(),
              }}
              onChange={v => onChange({ ...post, audienceType: v.audienceType, audienceIds: JSON.stringify(v.audienceIds) })}
              classes={classes}
              levels={levels}
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Περιγραφή</label>
            <textarea
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              value={post.content ?? ''}
              onChange={e => onChange({ ...post, content: e.target.value })}
              placeholder="Πληροφορίες για την εκδρομή, ώρες αναχώρησης, τι να φέρουν τα παιδιά..."
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Φωτογραφίες ({(post.mediaUrls ?? []).length})
            </label>

            {/* Existing images */}
            {(post.mediaUrls ?? []).length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                {(post.mediaUrls ?? []).map((url, i) => (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => onRemoveImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload area */}
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => {
                  Array.from(e.target.files ?? []).forEach(onUploadImage);
                  e.target.value = '';
                }}
              />
              {uploading ? (
                <p className="text-sm text-indigo-600 font-medium">Ανέβασμα...</p>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Σύρτε φωτογραφίες εδώ ή <span className="text-indigo-600 font-medium">κλικ για επιλογή</span></p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP έως 10MB</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Ακύρωση</button>
          <button
            onClick={onSave}
            disabled={saving || !post.title?.trim()}
            className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Αποθήκευση...' : post.id ? 'Αποθήκευση' : 'Δημοσίευση'}
          </button>
        </div>
      </div>
    </div>
  );
}
