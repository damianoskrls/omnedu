'use client';

import { useStoredUser } from '@/lib/auth';
import { Settings, Bell, Globe, Shield } from 'lucide-react';

export default function SuperAdminSettingsPage() {
  const user = useStoredUser();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Platform-level configuration</p>
      </div>

      <div className="space-y-6">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Account</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">{user?.fullName}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">{user?.email}</div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Platform</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span>Platform Name</span>
              <span className="font-medium text-gray-900">Ονειροχώρα</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span>API Version</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">v1</span>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Security</h2>
          </div>
          <p className="text-sm text-gray-500">JWT access tokens expire after 15 minutes. Refresh tokens rotate on use and expire after 7 days.</p>
        </section>
      </div>
    </div>
  );
}
