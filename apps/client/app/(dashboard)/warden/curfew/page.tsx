'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useApi } from '@/hooks/useApi';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation'

type Violation = {
  student_id: string;
  full_name: string;
  roll_number: string;
  room_number: string;
};

type CurfewSettings = {
  enabled: boolean;
  curfew_time: string; // '22:00'
};

const SkeletonCard = () => (
  <div className="border border-gray-100 rounded-xl p-6 animate-pulse">
    <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
    <div className="h-3 bg-gray-100 rounded w-2/3" />
  </div>
);

export default function WardenCurfewPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<CurfewSettings>({ enabled: true, curfew_time: '22:00' });
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [notifyingIds, setNotifyingIds] = useState<string[]>([]);
  const [notifiedIds, setNotifiedIds] = useState<string[]>([]);

  // Hydration-safe time state
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const { apiGet, apiPost, apiPatch } = useApi();
  const supabase = createClient();

  // Store API functions in refs so fetchData never needs them as deps
  const apiGetRef = useRef(apiGet);
  const apiPostRef = useRef(apiPost);
  const apiPatchRef = useRef(apiPatch);
  useEffect(() => { apiGetRef.current = apiGet; });
  useEffect(() => { apiPostRef.current = apiPost; });
  useEffect(() => { apiPatchRef.current = apiPatch; });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // fetchData has stable [] deps — uses ref so it never causes re-render loop
  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, violationsRes] = await Promise.all([
        apiGetRef.current('/api/curfew/settings'),
        apiGetRef.current('/api/curfew/violations')
      ]);

      if (settingsRes.success && settingsRes.data) {
        setSettings(settingsRes.data);
      }
      if (violationsRes.success && violationsRes.data) {
        setViolations(violationsRes.data);
        const alreadyNotifiedIds = violationsRes.data.filter((v: { parent_notified: boolean, student_id: string }) => v.parent_notified).map((v: { parent_notified: boolean, student_id: string }) => v.student_id);
        setNotifiedIds(alreadyNotifiedIds);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Curfew fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []); // stable — reads from ref, not closure

  // Mount-only effect: set client-side state once
  useEffect(() => {
    setMounted(true);
    setNow(new Date());
  }, []);

  // Data fetch effect: runs once on mount, then on interval
  useEffect(() => {
    fetchData();
    const dataInterval = setInterval(fetchData, 5 * 60 * 1000); // 5 min
    const timeInterval = setInterval(() => setNow(new Date()), 60000); // 1 min
    return () => {
      clearInterval(dataInterval);
      clearInterval(timeInterval);
    };
  }, [fetchData]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMessage('');
    try {
      const res = await apiPatchRef.current('/api/curfew/settings', settings);
      if (res.success) {
        setSettingsMessage('Settings saved');
        await fetchData();
      } else {
        setSettingsMessage('Failed to save settings');
      }
    } catch {
      setSettingsMessage('Failed to save settings');
    } finally {
      setSavingSettings(false);
      setTimeout(() => setSettingsMessage(''), 3000);
    }
  };

  const handleNotify = async (studentIds: string[]) => {
    setNotifyingIds(prev => [...prev, ...studentIds]);
    try {
      const res = await apiPostRef.current('/api/curfew/notify', { student_ids: studentIds });
      if (res.success) {
        setNotifiedIds(prev => [...prev, ...studentIds]);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Notify error:', err);
    } finally {
      setNotifyingIds(prev => prev.filter(id => !studentIds.includes(id)));
    }
  };

  // Status calculation — only run client-side
  let isAfterCurfew = false;
  let statusText = '';
  let displayTime = '';

  if (mounted && now) {
    const [curfewHour, curfewMinute] = settings.curfew_time.split(':').map(Number);
    const curfewDate = new Date(now);
    curfewDate.setHours(curfewHour, curfewMinute, 0, 0);

    // If curfew is early morning and it's evening, bump to next day
    if (curfewHour < 12 && now.getHours() >= 12) {
      curfewDate.setDate(curfewDate.getDate() + 1);
    }

    const diffMs = curfewDate.getTime() - now.getTime();
    isAfterCurfew = diffMs < 0;

    const absDiffMins = Math.abs(Math.floor(diffMs / 60000));
    const diffHours = Math.floor(absDiffMins / 60);
    const diffMins = absDiffMins % 60;

    statusText = isAfterCurfew
      ? `Curfew was ${diffHours > 0 ? `${diffHours}h ` : ''}${diffMins}m ago`
      : `Curfew in ${diffHours > 0 ? `${diffHours}h ` : ''}${diffMins}m`;

    displayTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Curfew Management" showBack={true} onSignOut={handleSignOut} />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status Card */}
          <div className="border border-gray-100 rounded-xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Current Time</div>
                <div className="text-3xl font-medium text-gray-900">
                  {mounted ? displayTime : '——:——'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Curfew Time</div>
                <div className="text-xl text-gray-500">{settings.curfew_time}</div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium border ${
                  isAfterCurfew
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-green-50 text-green-700 border-green-200'
                }`}>
                  {isAfterCurfew ? 'After Curfew' : 'Before Curfew'}
                </span>
                {mounted && (
                  <div className="text-sm text-gray-500 mt-1.5">{statusText}</div>
                )}
              </div>
            </div>
          </div>

          {/* Settings Card */}
          <div className="border border-gray-100 rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-900 mb-5">Curfew Settings</h2>
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end">
              <div className="flex-1 space-y-4">
                {/* Custom Toggle */}
                <div className="flex items-center gap-3">
                  <button
                    role="switch"
                    aria-checked={settings.enabled}
                    onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      settings.enabled ? 'bg-gray-900' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                  <span className="text-sm text-gray-700">Enable curfew system</span>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Curfew Time</label>
                  <input
                    type="time"
                    value={settings.curfew_time}
                    onChange={e => setSettings(s => ({ ...s, curfew_time: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
            {settingsMessage && (
              <div className={`mt-3 text-xs font-medium ${settingsMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                {settingsMessage}
              </div>
            )}
          </div>

          {/* Violations Card */}
          <div className="border border-gray-100 rounded-xl p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-sm font-medium text-gray-900">Tonight&apos;s Violations</h2>
              {violations.length > 0 && (
                <button
                  onClick={() => handleNotify(violations.map(v => v.student_id))}
                  disabled={notifyingIds.length > 0}
                  className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {notifyingIds.length > 0 ? 'Notifying...' : 'Notify All Parents'}
                </button>
              )}
            </div>

            {violations.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-green-700">All students checked in</div>
                  <div className="text-xs text-green-600">No curfew violations tonight</div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="text-sm font-medium text-red-700">
                    {violations.length} student{violations.length === 1 ? '' : 's'} not checked in
                  </div>
                  <div className="text-xs text-red-500 mt-0.5">Notify parents to alert them of the violation</div>
                </div>

                <div className="space-y-3">
                  {violations.map(v => {
                    const isNotified = notifiedIds.includes(v.student_id);
                    const isNotifying = notifyingIds.includes(v.student_id);

                    return (
                      <div key={v.student_id} className="border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:border-gray-300 transition-colors">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{v.full_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {v.roll_number} · Room {v.room_number || 'Unassigned'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleNotify([v.student_id])}
                          disabled={isNotified || isNotifying}
                          className={`border rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            isNotified
                              ? 'border-green-200 text-green-600 bg-green-50'
                              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {isNotifying ? 'Notifying...' : isNotified ? 'Notified ✓' : 'Notify Parent'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
