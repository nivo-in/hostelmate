'use client';
import { Banknote, ClipboardList, Bell } from 'lucide-react';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { ui, panel, panelElevated, input, buttonPrimary, buttonGhost, container, label } from '@/lib/ui';

// ─── Types ───────────────────────────────────────────────

interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  fee_type: string;
  billing_period: string;
  includes_hostel: boolean;
  includes_mess: boolean;
  is_active: boolean;
  description: string;
}

interface StudentInfo {
  id?: string;
  roll_number: string;
  profiles: { full_name: string; email?: string };
}

interface FeePayment {
  id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  due_date: string;
  paid_at: string | null;
  billing_period: string;
  period_label: string;
  receipt_number: string | null;
  notes: string | null;
  is_overdue: boolean;
  fee_structures: { name: string; fee_type: string };
  students: StudentInfo;
}

interface Summary {
  total_collected: number;
  total_pending: number;
  paid_count: number;
  pending_count: number;
}

// ─── Helpers ─────────────────────────────────────────────

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

const statusBadge = (status: string) => {
  switch (status) {
    case 'paid':
      return <Badge variant="success">Paid</Badge>;
    case 'pending':
      return <Badge variant="warning">Pending</Badge>;
    case 'processing':
      return <Badge variant="info">Processing</Badge>;
    case 'failed':
      return <Badge variant="danger">Failed</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
};

// --- Fuzzy Search Helpers ---
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return matrix[b.length][a.length];
}

function fuzzyMatch(query: string, target: string, maxDistance: number = 2): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();

  if (!q) return true;
  if (t.includes(q)) return true;

  const words = t.split(/[\s-]+/);
  for (const word of words) {
    if (Math.abs(word.length - q.length) <= maxDistance) {
      if (levenshteinDistance(q, word) <= maxDistance) {
        return true;
      }
    }
  }
  return false;
}
// ----------------------------

// ─── Main Component ───────────────────────────────────────

export default function WardenPaymentsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'generate' | 'structures'>('overview');

  // Overview state
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFeeType, setFilterFeeType] = useState('');
  const [filterBilling, setFilterBilling] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [markingId, setMarkingId] = useState('');
  const [sendingReminders, setSendingReminders] = useState(false);
  const [lastReminder, setLastReminder] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  // Generate bills state
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [genResult, setGenResult] = useState<{ generated: number; skipped: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [targetStudents, setTargetStudents] = useState<string[]>([]);
  const [studentSearchText, setStudentSearchText] = useState('');
  const debouncedStudentSearch = useDebounce(studentSearchText, 300);
  const [allStudents, setAllStudents] = useState<StudentInfo[]>([]);

  // Fee structures state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newFeeType, setNewFeeType] = useState('combined');
  const [newBilling, setNewBilling] = useState('monthly');
  const [newIncludesHostel, setNewIncludesHostel] = useState(false);
  const [newIncludesMess, setNewIncludesMess] = useState(false);
  const [newDesc, setNewDesc] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { apiGet, apiPost, apiPatch } = useApi();
  const supabase = createClient();

  // ── Fetch ──

  const fetchPayments = useCallback(
    async (currentPage = 1) => {
      try {
        const params = new URLSearchParams();
        if (filterStatus) params.set('status', filterStatus);
        if (filterFeeType) params.set('fee_type', filterFeeType);
        if (filterBilling) params.set('billing_period', filterBilling);
        if (filterPeriod) params.set('period_label', filterPeriod);
        params.set('page', currentPage.toString());
        params.set('limit', '20');
        const res = await apiGet(`/api/v1/payments/all?${params.toString()}`);
        if (res.success) {
          if (currentPage === 1) {
            setPayments(res.data.payments);
          } else {
            setPayments((prev) => [...prev, ...res.data.payments]);
          }
          setSummary(res.data.summary);
          setHasNext(res.pagination?.hasNext || false);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    },
    [apiGet, filterStatus, filterFeeType, filterBilling, filterPeriod]
  );

  const fetchStructures = useCallback(async () => {
    try {
      const res = await apiGet('/api/v1/payments/fee-structures');
      if (res.success) {
        const all = [
          ...(res.data.yearly || []),
          ...(res.data.monthly || []),
          ...(res.data.one_time || []),
        ];
        setFeeStructures(all);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }, [apiGet]);

  const fetchStudentsList = useCallback(async () => {
    try {
      const res = await apiGet('/api/v1/payments/students-list');
      if (res.success) setAllStudents(res.data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }, [apiGet]);

  useEffect(() => {
    setPage(1);
    fetchPayments(1);
  }, [filterStatus, filterFeeType, filterBilling, filterPeriod, fetchPayments]);
  useEffect(() => {
    fetchStructures();
    fetchStudentsList();
    // Fetch last reminder timestamp
    apiGet('/api/v1/payments/last-reminder')
      .then((res) => {
        if (res.success && res.last_reminder) setLastReminder(res.last_reminder);
      })
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // ── Mark paid ──
  const handleMarkPaid = async (id: string) => {
    setMarkingId(id);
    try {
      const res = await apiPatch(`/api/v1/payments/${id}/mark-paid`, { payment_method: 'cash' });
      if (res.success) {
        setSuccess('Payment marked as paid (cash)');
        setTimeout(() => setSuccess(''), 4000);
        fetchPayments();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMarkingId('');
    }
  };

  // ── Send reminders ──
  const handleSendReminders = async () => {
    setSendingReminders(true);
    setError('');
    try {
      const res = await apiPost('/api/v1/payments/send-reminders', {});
      if (res.success) {
        setLastReminder(new Date().toISOString());
        setSuccess(`Sent ${res.reminders_sent} reminders to students and parents`);
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSendingReminders(false);
    }
  };

  // ── Generate bills ──
  const handleGenerateBills = async () => {
    if (!selectedStructureId || !periodLabel || !dueDate) {
      setError('Fill in all fields');
      return;
    }
    setGenerating(true);
    setGenResult(null);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        fee_structure_id: selectedStructureId,
        period_label: periodLabel,
        due_date: dueDate,
      };
      if (targetStudents.length > 0) {
        payload.student_ids = targetStudents;
      }

      const res = await apiPost('/api/v1/payments/generate-bills', payload);
      if (res.success) {
        setGenResult({ generated: res.generated, skipped: res.skipped });
        setSuccess(`Done! Generated ${res.generated} bills, skipped ${res.skipped}.`);
        setTimeout(() => setSuccess(''), 5000);
        setTargetStudents([]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Add fee structure ──
  const handleAddStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiPost('/api/v1/payments/fee-structures', {
        name: newName,
        amount: parseInt(newAmount, 10),
        fee_type: newFeeType,
        billing_period: newBilling,
        includes_hostel: newIncludesHostel,
        includes_mess: newIncludesMess,
        description: newDesc,
      });
      if (res.success) {
        setSuccess('Fee structure created');
        setShowAddForm(false);
        setNewName('');
        setNewAmount('');
        setNewDesc('');
        fetchStructures();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectedStructure = feeStructures.find((f) => f.id === selectedStructureId);

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'generate', label: 'Generate Bills' },
    { key: 'structures', label: 'Fee Structures' },
  ] as const;

  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: '11px',
    fontWeight: 500,
    color: ui.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = { padding: '12px 16px' };
  const stepLabel: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 500,
    color: ui.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    marginBottom: '12px',
  };

  return (
    <PageShell>
      <PageHeader title="Fee Management" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {/* Alerts */}
        {error && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.25)', borderRadius: ui.radiusXs, fontSize: '13px', color: ui.red, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {error}
            <button onClick={() => setError('')} style={{ background: 'transparent', border: 'none', color: ui.red, cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {success && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(74,222,128,0.1)', border: '0.5px solid rgba(74,222,128,0.25)', borderRadius: ui.radiusXs, fontSize: '13px', color: ui.green, fontWeight: 500 }}>
            {success}
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', ...panel, padding: '4px', width: 'fit-content', borderRadius: ui.radiusXs }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: 'none',
                  background: active ? ui.accent : 'transparent',
                  color: active ? '#fff' : ui.textMuted,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: Overview ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Stats + Reminders header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', flex: 1 }} className="pay-stats">
                <div style={{ ...panelElevated, padding: '18px 20px' }}>
                  <p style={{ ...label, marginBottom: '8px' }}>Total Collected</p>
                  <p style={{ fontSize: '26px', fontWeight: 500, color: ui.green, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(summary?.total_collected ?? 0)}
                  </p>
                </div>
                <div style={{ ...panelElevated, padding: '18px 20px' }}>
                  <p style={{ ...label, marginBottom: '8px' }}>Total Pending</p>
                  <p style={{ fontSize: '26px', fontWeight: 500, color: ui.red, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(summary?.total_pending ?? 0)}
                  </p>
                </div>
                <div style={{ ...panelElevated, padding: '18px 20px' }}>
                  <p style={{ ...label, marginBottom: '8px' }}>Paid</p>
                  <p style={{ fontSize: '26px', fontWeight: 500, color: ui.text, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{summary?.paid_count ?? 0}</p>
                </div>
                <div style={{ ...panelElevated, padding: '18px 20px' }}>
                  <p style={{ ...label, marginBottom: '8px' }}>Pending</p>
                  <p style={{ fontSize: '26px', fontWeight: 500, color: ui.text, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{summary?.pending_count ?? 0}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={handleSendReminders}
                  disabled={sendingReminders}
                  className="btn-ghost"
                  style={{ ...buttonGhost, whiteSpace: 'nowrap', opacity: sendingReminders ? 0.5 : 1 }}
                >
                  {sendingReminders ? 'Sending...' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Bell size={14} /> Send Due Reminders</span>}
                </button>
                {lastReminder && (
                  <p style={{ fontSize: '11px', color: ui.textMuted, marginTop: '4px' }}>
                    Last sent:{' '}
                    {new Date(lastReminder).toLocaleString('en-IN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="hm-input"
                style={{ ...input, width: 'auto', colorScheme: 'dark' }}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={filterFeeType}
                onChange={(e) => setFilterFeeType(e.target.value)}
                className="hm-input"
                style={{ ...input, width: 'auto', colorScheme: 'dark' }}
              >
                <option value="">All Fee Types</option>
                <option value="combined">Hostel + Mess</option>
                <option value="hostel">Hostel</option>
                <option value="mess">Mess</option>
              </select>
              <select
                value={filterBilling}
                onChange={(e) => setFilterBilling(e.target.value)}
                className="hm-input"
                style={{ ...input, width: 'auto', colorScheme: 'dark' }}
              >
                <option value="">All Billing</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <input
                type="text"
                placeholder="Period (e.g. 2025-26)"
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="hm-input"
                style={{ ...input, width: '176px' }}
              />
              <button
                onClick={() => {
                  setPage(1);
                  fetchPayments(1);
                }}
                className="btn-ghost"
                style={buttonGhost}
              >
                Apply
              </button>
            </div>

            {/* Table */}
            <div style={{ ...panel, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: ui.border }}>
                      <th style={th}>Student</th>
                      <th style={th}>Fee Plan</th>
                      <th style={th}>Amount</th>
                      <th style={th}>Period</th>
                      <th style={th}>Due Date</th>
                      <th style={th}>Status</th>
                      <th style={th}>Method</th>
                      <th style={th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <EmptyState message="No payments found" icon={<Banknote strokeWidth={1.5} />} />
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr
                          key={p.id}
                          className="row-hover"
                          style={{
                            borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                            background: p.is_overdue ? 'rgba(248,113,113,0.07)' : undefined,
                          }}
                        >
                          <td style={td}>
                            <div style={{ color: ui.text, fontWeight: 500 }}>
                              {p.students?.profiles?.full_name || '—'}
                            </div>
                            <div style={{ fontSize: '11px', color: ui.textMuted }}>{p.students?.roll_number}</div>
                          </td>
                          <td style={{ ...td, color: ui.textSoft }}>{p.fee_structures?.name}</td>
                          <td style={{ ...td, fontWeight: 500, color: ui.text }}>{fmt(p.amount)}</td>
                          <td style={{ ...td, color: ui.textMuted }}>{p.period_label}</td>
                          <td style={{ ...td, color: ui.textMuted }}>
                            {new Date(p.due_date).toLocaleDateString('en-IN')}
                          </td>
                          <td style={td}>{statusBadge(p.status)}</td>
                          <td style={{ ...td, fontSize: '12px', color: ui.textMuted, textTransform: 'capitalize' }}>
                            {p.payment_method || '—'}
                          </td>
                          <td style={td}>
                            {p.status === 'pending' || p.status === 'processing' ? (
                              <button
                                onClick={() => handleMarkPaid(p.id)}
                                disabled={markingId === p.id}
                                className="btn-ghost"
                                style={{ ...buttonGhost, padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', opacity: markingId === p.id ? 0.5 : 1 }}
                              >
                                {markingId === p.id ? '...' : 'Mark Paid (Cash)'}
                              </button>
                            ) : p.receipt_number ? (
                              <span style={{ fontSize: '11px', color: ui.textMuted, fontFamily: 'monospace' }}>
                                {p.receipt_number}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {hasNext && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchPayments(nextPage);
                  }}
                  className="btn-ghost"
                  style={buttonGhost}
                >
                  Load more
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Generate Bills ── */}
        {tab === 'generate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '576px' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 500, color: ui.text, margin: '0 0 4px' }}>
                Generate Fee Bills for Students
              </h2>
              <p style={{ fontSize: '12px', color: ui.textMuted, margin: 0 }}>
                Creates a pending payment record for every active student.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Step 1 */}
              <div style={{ ...panel, padding: '20px' }}>
                <p style={stepLabel}>Step 1 — Select Fee Structure</p>
                <select
                  value={selectedStructureId}
                  onChange={(e) => setSelectedStructureId(e.target.value)}
                  className="hm-input"
                  style={{ ...input, colorScheme: 'dark' }}
                >
                  <option value="">Choose a fee structure...</option>
                  {feeStructures.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} — {fmt(f.amount)} ({f.billing_period})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2 */}
              <div style={{ ...panel, padding: '20px' }}>
                <p style={stepLabel}>Step 2 — Period Label</p>
                <input
                  type="text"
                  placeholder={
                    selectedStructure?.billing_period === 'monthly' ? 'May-2025' : '2025-26'
                  }
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  className="hm-input"
                  style={input}
                />
                <p style={{ fontSize: '11px', color: ui.textMuted, marginTop: '6px' }}>
                  {selectedStructure?.billing_period === 'monthly'
                    ? 'Format: May-2025'
                    : 'Format: 2025-26'}
                </p>
              </div>

              {/* Step 3 */}
              <div style={{ ...panel, padding: '20px' }}>
                <p style={stepLabel}>Step 3 — Due Date</p>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="hm-input"
                  style={{ ...input, colorScheme: 'dark' }}
                />
              </div>

              {/* Step 4: Target Students */}
              <div style={{ ...panel, padding: '20px' }}>
                <p style={{ ...stepLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Step 4 — Target Students (Optional)</span>
                  {targetStudents.length > 0 && (
                    <span style={{ color: ui.text, background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '6px', textTransform: 'none', letterSpacing: 0 }}>
                      {targetStudents.length} selected
                    </span>
                  )}
                </p>
                <p style={{ fontSize: '11px', color: ui.textMuted, marginBottom: '12px' }}>
                  If none selected, bills are generated for ALL students.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search students to target..."
                    value={studentSearchText}
                    onChange={(e) => setStudentSearchText(e.target.value)}
                    className="hm-input"
                    style={{ ...input, marginBottom: '4px' }}
                  />

                  <div style={{ maxHeight: '160px', overflowY: 'auto', border: ui.border, borderRadius: ui.radiusXs, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {allStudents
                      .filter(
                        (s) =>
                          !debouncedStudentSearch ||
                          fuzzyMatch(debouncedStudentSearch, s.profiles?.full_name || '') ||
                          fuzzyMatch(debouncedStudentSearch, s.roll_number || '')
                      )
                      .map((s) => {
                        const isSelected = targetStudents.includes(s.id!);
                        return (
                          <label
                            key={s.id}
                            className="row-hover"
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setTargetStudents([...targetStudents, s.id!]);
                                else setTargetStudents(targetStudents.filter((id) => id !== s.id));
                              }}
                              style={{ accentColor: ui.accent }}
                            />
                            <div style={{ fontSize: '13px' }}>
                              <p style={{ fontWeight: 500, color: ui.text, margin: 0 }}>{s.profiles?.full_name}</p>
                              <p style={{ fontSize: '11px', color: ui.textMuted, margin: 0 }}>{s.roll_number}</p>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>

              <button
                onClick={handleGenerateBills}
                disabled={generating}
                className="btn-primary"
                style={{ ...buttonPrimary, width: '100%', opacity: generating ? 0.5 : 1 }}
              >
                {generating
                  ? 'Generating...'
                  : `Generate Bills ${targetStudents.length > 0 ? `(${targetStudents.length} students)` : '(All students)'}`}
              </button>

              {genResult && (
                <div style={{ background: 'rgba(74,222,128,0.1)', border: '0.5px solid rgba(74,222,128,0.25)', borderRadius: ui.radius, padding: '16px' }}>
                  <p style={{ fontSize: '13px', color: ui.green, fontWeight: 500, margin: 0 }}>
                    Generated {genResult.generated} bills, Skipped {genResult.skipped} (already exist)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: Fee Structures ── */}
        {tab === 'structures' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 500, color: ui.text, margin: 0 }}>Fee Structures</h2>
              <button onClick={() => setShowAddForm((v) => !v)} className="btn-primary" style={buttonPrimary}>
                {showAddForm ? 'Cancel' : '+ Add Structure'}
              </button>
            </div>

            {/* Add form */}
            {showAddForm && (
              <form onSubmit={handleAddStructure} style={{ ...panel, padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ ...stepLabel, marginBottom: 0 }}>New Fee Structure</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }} className="struct-form-grid">
                  <div>
                    <label style={{ ...label, display: 'block' }}>Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      className="hm-input"
                      style={input}
                    />
                  </div>
                  <div>
                    <label style={{ ...label, display: 'block' }}>Amount (₹)</label>
                    <input
                      type="number"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      required
                      min={1}
                      className="hm-input"
                      style={input}
                    />
                  </div>
                  <div>
                    <label style={{ ...label, display: 'block' }}>Fee Type</label>
                    <select
                      value={newFeeType}
                      onChange={(e) => setNewFeeType(e.target.value)}
                      className="hm-input"
                      style={{ ...input, colorScheme: 'dark' }}
                    >
                      <option value="combined">Hostel + Mess</option>
                      <option value="hostel">Hostel</option>
                      <option value="mess">Mess</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ ...label, display: 'block' }}>Billing Period</label>
                    <select
                      value={newBilling}
                      onChange={(e) => setNewBilling(e.target.value)}
                      className="hm-input"
                      style={{ ...input, colorScheme: 'dark' }}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="one_time">One Time</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: ui.textSoft, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newIncludesHostel}
                      onChange={(e) => setNewIncludesHostel(e.target.checked)}
                      style={{ accentColor: ui.accent }}
                    />
                    Includes Hostel
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: ui.textSoft, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newIncludesMess}
                      onChange={(e) => setNewIncludesMess(e.target.checked)}
                      style={{ accentColor: ui.accent }}
                    />
                    Includes Mess
                  </label>
                </div>
                <div>
                  <label style={{ ...label, display: 'block' }}>Description</label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="hm-input"
                    style={input}
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary" style={{ ...buttonPrimary, alignSelf: 'flex-start', opacity: loading ? 0.5 : 1 }}>
                  {loading ? 'Creating...' : 'Create Fee Structure'}
                </button>
              </form>
            )}

            {/* List */}
            <div style={{ ...panel, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: ui.border }}>
                    <th style={th}>Name</th>
                    <th style={th}>Type</th>
                    <th style={th}>Amount</th>
                    <th style={th}>Period</th>
                    <th style={th}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {feeStructures.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState message="No fee structures yet" icon={<ClipboardList strokeWidth={1.5} />} />
                      </td>
                    </tr>
                  ) : (
                    feeStructures.map((f) => (
                      <tr key={f.id} className="row-hover" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                        <td style={td}>
                          <div style={{ fontWeight: 500, color: ui.text }}>{f.name}</div>
                          {f.description && (
                            <div style={{ fontSize: '11px', color: ui.textMuted }}>{f.description}</div>
                          )}
                        </td>
                        <td style={{ ...td, textTransform: 'capitalize', color: ui.textSoft }}>{f.fee_type}</td>
                        <td style={{ ...td, fontWeight: 500, color: ui.text }}>{fmt(f.amount)}</td>
                        <td style={{ ...td, color: ui.textMuted, textTransform: 'capitalize' }}>{f.billing_period}</td>
                        <td style={td}>
                          <Badge variant={f.is_active ? 'success' : 'default'}>{f.is_active ? 'Active' : 'Inactive'}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 860px) {
          .pay-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .struct-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PageShell>
  );
}
