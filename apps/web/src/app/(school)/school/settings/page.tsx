'use client';

import { useEffect, useState } from 'react';
import { useStoredUser, storeTokens } from '@/lib/auth';
import { usersApi } from '@/lib/api';
import { User, Bell, Check, KeyRound } from 'lucide-react';

function messageOf(error: unknown) {
  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && message !== 'Internal server error' ? message : '';
}

export default function SchoolSettingsPage() {
  const user = useStoredUser();
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user?.fullName) setName(user.fullName);
  }, [user?.fullName]);

  const saveName = async () => {
    const fullName = name.trim();
    if (fullName.length < 2) {
      setNameError('Γράψε το ονοματεπώνυμο.');
      return;
    }
    setSavingName(true);
    setNameError('');
    try {
      const saved = await usersApi.updateMe({ fullName }) as { accessToken?: string; refreshToken?: string };
      if (saved?.accessToken && saved?.refreshToken) storeTokens(saved.accessToken, saved.refreshToken);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (error) {
      setNameError(messageOf(error) || 'Το όνομα δεν αποθηκεύτηκε.');
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    if (newPassword !== repeatPassword) {
      setPasswordError('Οι νέοι κωδικοί δεν είναι ίδιοι.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setPasswordError('Ο νέος κωδικός χρειάζεται τουλάχιστον 6 χαρακτήρες.');
      return;
    }
    setSavingPassword(true);
    setPasswordError('');
    try {
      await usersApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (error) {
      setPasswordError(messageOf(error) || 'Ο κωδικός δεν άλλαξε.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Ρυθμίσεις</h1>
        <p className="text-gray-500 text-sm mt-1">Όνομα, email και κωδικός του λογαριασμού</p>
      </div>

      <div className="space-y-6">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Προφίλ</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Όνομα</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">{user?.email}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ρόλος</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700 capitalize">
                {user?.role?.replace('_', ' ')}
              </div>
            </div>
          </div>
          {nameError && <p className="mt-3 text-sm text-red-600">{nameError}</p>}
          <button
            onClick={saveName}
            disabled={savingName}
            className="mt-4 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {nameSaved ? <Check size={15} /> : null}
            {nameSaved ? 'Αποθηκεύτηκε' : savingName ? 'Αποθήκευση...' : 'Αποθήκευση ονόματος'}
          </button>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Κωδικός</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Τρέχων κωδικός</label>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Νέος κωδικός</label>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Επανάληψη</label>
              <input type="password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          {passwordError && <p className="mt-3 text-sm text-red-600">{passwordError}</p>}
          <button
            onClick={savePassword}
            disabled={savingPassword || !currentPassword || !newPassword}
            className="mt-4 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {passwordSaved ? <Check size={15} /> : null}
            {passwordSaved ? 'Ο κωδικός άλλαξε' : savingPassword ? 'Αποθήκευση...' : 'Αλλαγή κωδικού'}
          </button>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Ειδοποιήσεις</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Ημερήσιο σημείωμα', desc: 'Ειδοποίηση όταν ο δάσκαλος συμπληρώσει σημείωμα' },
              { label: 'Νέο μήνυμα', desc: 'Ειδοποίηση για νέα μηνύματα' },
              { label: 'Εκπρόθεσμη πληρωμή', desc: 'Ειδοποίηση για εκπρόθεσμα τιμολόγια' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-gray-800">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.desc}</div>
                </div>
                <div className="h-5 w-9 bg-indigo-600 rounded-full relative cursor-pointer">
                  <div className="absolute right-0.5 top-0.5 h-4 w-4 bg-white rounded-full shadow" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
