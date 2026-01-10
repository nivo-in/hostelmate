'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useApi } from '@/hooks/useApi';
import { createClient } from '@/lib/supabase/client';

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

export default function WardenCurfewPage() {
  const [settings, setSettings] = useState<CurfewSettings>({ enabled: true, curfew_time: '22:00' });
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [notifyingIds, setNotifyingIds] = useState<string[]>([]);
  const [notifiedIds, setNotifiedIds] = useState<string[]>([]);
  
  // Current time state
  const [now, setNow] = useState(new Date());

  const { apiGet, apiPost, apiPatch } = useApi();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const fetchData = async () => {
    try {
      const [settingsRes, violationsRes] = await Promise.all([
        apiGet('/api/curfew/settings'),
        apiGet('/api/curfew/violations')
      ]);

      if (settingsRes.success && settingsRes.data) {
        setSettings(settingsRes.data);
      }
      if (violationsRes.success && violationsRes.data) {
        setViolations(violationsRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000); // 5 minutes
    
    const timeInterval = setInterval(() => {
      setNow(new Date());
    }, 60000); // 1 minute

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMessage('');
    const res = await apiPatch('/api/curfew/settings', settings);
    if (res.success) {
      setSettingsMessage('Settings saved');
      fetchData(); // re-fetch to ensure sync
    } else {
      setSettingsMessage('Failed to save settings');
    }
    setSavingSettings(false);
    setTimeout(() => setSettingsMessage(''), 3000);
  };

  const handleNotify = async (studentIds: string[]) => {
    setNotifyingIds(prev => [...prev, ...studentIds]);
    const res = await apiPost('/api/curfew/notify', { student_ids: studentIds });
    
    setNotifyingIds(prev => prev.filter(id => !studentIds.includes(id)));
    if (res.success) {
      setNotifiedIds(prev => [...prev, ...studentIds]);
    }
  };

  // Status calculation
  const [curfewHour, curfewMinute] = settings.curfew_time.split(':').map(Number);
  const curfewDate = new Date();
  curfewDate.setHours(curfewHour, curfewMinute, 0, 0);
  
  // If curfew time is early morning and it's evening now, it's next day
  if (curfewHour < 12 && now.getHours() >= 12) {
    curfewDate.setDate(curfewDate.getDate() + 1);
  }
  
  const diffMs = curfewDate.getTime() - now.getTime();
  const isAfterCurfew = diffMs < 0;
  
  const absDiffMins = Math.abs(Math.floor(diffMs / 60000));
  const diffHours = Math.floor(absDiffMins / 60);
  const diffMins = absDiffMins % 60;
  
  const statusText = isAfterCurfew
    ? `Curfew was ${diffHours > 0 ? `${diffHours} hours ` : ''}${diffMins} minutes ago`
    : `Curfew in ${diffHours > 0 ? `${diffHours} hours ` : ''}${diffMins} minutes`;

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Curfew Management" showBack={true} onSignOut={handleSignOut} />

      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 3: Curfew Status */}
          <div className="border border-gray-100 rounded-xl p-6 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Current Time</div>
              <div className="text-xl font-medium text-gray-900">
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Curfew Time</div>
              <div className="text-xl font-medium text-gray-900">
                {settings.curfew_time}
              </div>
            </div>
            <div className="text-right">
              <span className={`text-[10px] px-2 py-1 rounded-full font-medium inline-block mb-1 ${
                isAfterCurfew ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}>
                {isAfterCurfew ? 'After Curfew' : 'Before Curfew'}
              </span>
              <div className="text-xs text-gray-500">{statusText}</div>
            </div>
          </div>

          {/* SECTION 1: Settings */}
          <div className="border border-gray-100 rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-900 mb-4">Curfew Settings</h2>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={e => setSettings({ ...settings, enabled: e.target.checked })}
                    className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-700">Enable curfew system</span>
                </label>
                <label className="block text-xs text-gray-500 mb-1">Curfew Time</label>
                <input
                  type="time"
                  value={settings.curfew_time}
                  onChange={e => setSettings({ ...settings, curfew_time: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-500 w-full"
                />
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
              <div className="mt-3 text-xs text-green-600 font-medium">{settingsMessage}</div>
            )}
          </div>

          {/* SECTION 2: Tonight's Violations */}
          <div className="border border-gray-100 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-sm font-medium text-gray-900 mb-1">Tonight's Violations</h2>
                <div className={`text-xs font-medium ${violations.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {violations.length} {violations.length === 1 ? 'student' : 'students'} not checked in
                </div>
              </div>
              {violations.length > 0 && (
                <button
                  onClick={() => handleNotify(violations.map(v => v.student_id))}
                  disabled={notifyingIds.length > 0}
                  className="bg-red-50 text-red-600 border border-red-100 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  Notify All Parents
                </button>
              )}
            </div>

            {violations.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">All students are checked in.</div>
            ) : (
              <div className="space-y-3">
                {violations.map(v => {
                  const isNotified = notifiedIds.includes(v.student_id);
                  const isNotifying = notifyingIds.includes(v.student_id);
                  
                  return (
                    <div key={v.student_id} className="border border-gray-100 rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900 mb-1">{v.full_name}</div>
                        <div className="text-xs text-gray-500">
                          {v.roll_number} • Room {v.room_number || 'Unassigned'}
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
                        {isNotifying ? 'Notifying...' : isNotified ? 'Parents notified ✓' : 'Notify'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
