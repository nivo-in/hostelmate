/**
 * @file apps/client/app/(dashboard)/warden/curfew/page.tsx
 * Warden portal curfew administrative page rendering statistics and actions.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { useApi } from '@/hooks/useApi';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ui, panel, input, buttonPrimary, container, label, sectionTitle } from '@/lib/ui';

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
  <div style={{ ...panel, padding: '24px' }}>
    <div
      style={{
        height: '16px',
        width: '33%',
        marginBottom: '10px',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.06)',
        animation: 'curfewPulse 1.4s ease-in-out infinite',
      }}
    />
    <div
      style={{
        height: '12px',
        width: '66%',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.06)',
        animation: 'curfewPulse 1.4s ease-in-out infinite',
      }}
    />
  </div>
);

export default function WardenCurfewPage() {
  const router = useRouter();
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
  useEffect(() => {
    apiGetRef.current = apiGet;
  });
  useEffect(() => {
    apiPostRef.current = apiPost;
  });
  useEffect(() => {
    apiPatchRef.current = apiPatch;
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // fetchData has stable [] deps — uses ref so it never causes re-render loop
  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, violationsRes] = await Promise.all([
        apiGetRef.current('/api/v1/curfew/settings'),
        apiGetRef.current('/api/v1/curfew/violations'),
      ]);

      if (settingsRes.success && settingsRes.data) {
        setSettings(settingsRes.data);
      }
      if (violationsRes.success && violationsRes.data) {
        setViolations(violationsRes.data);
        const alreadyNotifiedIds = violationsRes.data
          .filter((v: { parent_notified: boolean; student_id: string }) => v.parent_notified)
          .map((v: { parent_notified: boolean; student_id: string }) => v.student_id);
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
      const res = await apiPatchRef.current('/api/v1/curfew/settings', settings);
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
    setNotifyingIds((prev) => [...prev, ...studentIds]);
    try {
      const res = await apiPostRef.current('/api/v1/curfew/notify', { student_ids: studentIds });
      if (res.success) {
        setNotifiedIds((prev) => [...prev, ...studentIds]);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Notify error:', err);
    } finally {
      setNotifyingIds((prev) => prev.filter((id) => !studentIds.includes(id)));
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
    <PageShell>
      <PageHeader title="Curfew Management" showBack={true} onSignOut={handleSignOut} />

      <div style={container}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Status Card */}
            <div style={{ ...panel, padding: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '24px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: ui.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '1.5px',
                      marginBottom: '6px',
                    }}
                  >
                    Current Time
                  </div>
                  <div
                    style={{
                      fontSize: '32px',
                      fontWeight: 500,
                      color: ui.text,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {mounted ? displayTime : '——:——'}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: ui.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '1.5px',
                      marginBottom: '6px',
                    }}
                  >
                    Curfew Time
                  </div>
                  <div style={{ fontSize: '20px', color: ui.textSoft, fontVariantNumeric: 'tabular-nums' }}>
                    {settings.curfew_time}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Badge variant={isAfterCurfew ? 'danger' : 'success'}>
                    {isAfterCurfew ? 'After Curfew' : 'Before Curfew'}
                  </Badge>
                  {mounted && (
                    <div style={{ fontSize: '13px', color: ui.textMuted, marginTop: '8px' }}>{statusText}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Settings Card */}
            <div style={{ ...panel, padding: '24px' }}>
              <h2 style={{ ...sectionTitle, fontSize: '13px', marginBottom: '20px' }}>Curfew Settings</h2>
              <div
                style={{
                  display: 'flex',
                  gap: '24px',
                  alignItems: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Custom Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      role="switch"
                      aria-checked={settings.enabled}
                      onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        height: '24px',
                        width: '44px',
                        alignItems: 'center',
                        borderRadius: '9999px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        background: settings.enabled ? ui.accent : 'rgba(255,255,255,0.12)',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          height: '16px',
                          width: '16px',
                          borderRadius: '9999px',
                          background: '#fff',
                          transition: 'transform 0.2s',
                          transform: settings.enabled ? 'translateX(24px)' : 'translateX(4px)',
                        }}
                      />
                    </button>
                    <span style={{ fontSize: '13px', color: ui.textSoft }}>Enable curfew system</span>
                  </div>

                  <div>
                    <label style={label}>Curfew Time</label>
                    <input
                      type="time"
                      value={settings.curfew_time}
                      onChange={(e) => setSettings((s) => ({ ...s, curfew_time: e.target.value }))}
                      className="hm-input"
                      style={{ ...input, colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="btn-primary"
                  style={{ ...buttonPrimary, whiteSpace: 'nowrap', opacity: savingSettings ? 0.5 : 1 }}
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
              {settingsMessage && (
                <div
                  style={{
                    marginTop: '12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: settingsMessage.includes('Failed') ? ui.red : ui.green,
                  }}
                >
                  {settingsMessage}
                </div>
              )}
            </div>

            {/* Violations Card */}
            <div style={{ ...panel, padding: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  gap: '12px',
                }}
              >
                <h2 style={{ ...sectionTitle, fontSize: '13px' }}>Tonight&apos;s Violations</h2>
                {violations.length > 0 && (
                  <button
                    onClick={() => handleNotify(violations.map((v) => v.student_id))}
                    disabled={notifyingIds.length > 0}
                    className="btn-primary"
                    style={{ ...buttonPrimary, opacity: notifyingIds.length > 0 ? 0.5 : 1 }}
                  >
                    {notifyingIds.length > 0 ? 'Notifying...' : 'Notify All Parents'}
                  </button>
                )}
              </div>

              {violations.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    background: 'rgba(74,222,128,0.08)',
                    border: '0.5px solid rgba(74,222,128,0.25)',
                    borderRadius: ui.radiusSm,
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      background: 'rgba(74,222,128,0.15)',
                      borderRadius: '9999px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      style={{ width: '16px', height: '16px', color: ui.green }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: ui.green }}>All students checked in</div>
                    <div style={{ fontSize: '12px', color: 'rgba(74,222,128,0.7)' }}>No curfew violations tonight</div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '16px',
                      background: 'rgba(248,113,113,0.08)',
                      border: '0.5px solid rgba(248,113,113,0.25)',
                      borderRadius: ui.radiusSm,
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 500, color: ui.red }}>
                      {violations.length} student{violations.length === 1 ? '' : 's'} not checked in
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(248,113,113,0.7)', marginTop: '2px' }}>
                      Notify parents to alert them of the violation
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {violations.map((v) => {
                      const isNotified = notifiedIds.includes(v.student_id);
                      const isNotifying = notifyingIds.includes(v.student_id);

                      return (
                        <div
                          key={v.student_id}
                          className="glass-card"
                          style={{
                            ...panel,
                            padding: '14px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: ui.text }}>{v.full_name}</div>
                            <div style={{ fontSize: '12px', color: ui.textMuted, marginTop: '2px' }}>
                              {v.roll_number} · Room {v.room_number || 'Unassigned'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleNotify([v.student_id])}
                            disabled={isNotified || isNotifying}
                            style={{
                              borderRadius: ui.radiusXs,
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: isNotified || isNotifying ? 'default' : 'pointer',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap',
                              border: isNotified
                                ? '0.5px solid rgba(74,222,128,0.25)'
                                : '0.5px solid rgba(255,255,255,0.1)',
                              background: isNotified ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)',
                              color: isNotified ? ui.green : ui.textSoft,
                              opacity: isNotifying ? 0.6 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (!isNotified && !isNotifying) {
                                e.currentTarget.style.color = ui.text;
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isNotified && !isNotifying) {
                                e.currentTarget.style.color = ui.textSoft;
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                              }
                            }}
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

      <style>{`
        @keyframes curfewPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </PageShell>
  );
}
