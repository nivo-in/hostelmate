'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';

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
  const base = 'text-xs px-2.5 py-1 rounded-full font-medium';
  switch (status) {
    case 'paid':
      return <span className={`${base} bg-green-50 text-green-700`}>Paid</span>;
    case 'pending':
      return <span className={`${base} bg-yellow-50 text-yellow-700`}>Pending</span>;
    case 'processing':
      return <span className={`${base} bg-blue-50 text-blue-700`}>Processing</span>;
    case 'failed':
      return <span className={`${base} bg-red-50 text-red-700`}>Failed</span>;
    default:
      return <span className={`${base} bg-gray-100 text-gray-600`}>{status}</span>;
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

  const fetchPayments = useCallback(async (currentPage = 1) => {
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
          setPayments(prev => [...prev, ...res.data.payments]);
        }
        setSummary(res.data.summary);
        setHasNext(res.pagination?.hasNext || false);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }, [apiGet, filterStatus, filterFeeType, filterBilling, filterPeriod]);

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

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-6xl mx-auto">
      <PageHeader title="Fee Management" showBack onSignOut={handleSignOut} />

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex justify-between">
          {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 border border-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors font-medium ${tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stats + Reminders header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
              <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
                <p className="text-xs text-gray-400 mb-1">Total Collected</p>
                <p className="text-2xl font-medium text-green-600">
                  {fmt(summary?.total_collected ?? 0)}
                </p>
              </div>
              <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
                <p className="text-xs text-gray-400 mb-1">Total Pending</p>
                <p className="text-2xl font-medium text-red-500">
                  {fmt(summary?.total_pending ?? 0)}
                </p>
              </div>
              <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
                <p className="text-xs text-gray-400 mb-1">Paid</p>
                <p className="text-2xl font-medium text-gray-900">{summary?.paid_count ?? 0}</p>
              </div>
              <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
                <p className="text-xs text-gray-400 mb-1">Pending</p>
                <p className="text-2xl font-medium text-gray-900">{summary?.pending_count ?? 0}</p>
              </div>
            </div>
            <div className="text-right">
              <button
                onClick={handleSendReminders}
                disabled={sendingReminders}
                className="border border-gray-200 text-gray-600 rounded-lg px-4 py-2.5 text-sm hover:border-gray-400 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {sendingReminders ? 'Sending...' : '🔔 Send Due Reminders'}
              </button>
              {lastReminder && (
                <p className="text-xs text-gray-400 mt-1">
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
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none focus:border-gray-400"
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
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none focus:border-gray-400"
            >
              <option value="">All Fee Types</option>
              <option value="combined">Hostel + Mess</option>
              <option value="hostel">Hostel</option>
              <option value="mess">Mess</option>
            </select>
            <select
              value={filterBilling}
              onChange={(e) => setFilterBilling(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none focus:border-gray-400"
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
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 w-44"
            />
            <button
              onClick={() => {
                setPage(1);
                fetchPayments(1);
              }}
              className="border border-gray-200 text-gray-600 rounded-lg px-4 py-2.5 text-sm hover:border-gray-400 transition-colors"
            >
              Apply
            </button>
          </div>

          {/* Table */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">
                      Student
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">
                      Fee Plan
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">
                      Amount
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">
                      Period
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">
                      Due Date
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">
                      Method
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                        No payments found
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr
                        key={p.id}
                        className={`border-b transition-colors ${p.is_overdue ? 'bg-red-50 border-red-100' : 'border-gray-50 hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-gray-900 font-medium">
                            {p.students?.profiles?.full_name || '—'}
                          </div>
                          <div className="text-xs text-gray-400">{p.students?.roll_number}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{p.fee_structures?.name}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{fmt(p.amount)}</td>
                        <td className="px-4 py-3 text-gray-500">{p.period_label}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(p.due_date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3">{statusBadge(p.status)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 capitalize">
                          {p.payment_method || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {p.status === 'pending' || p.status === 'processing' ? (
                            <button
                              onClick={() => handleMarkPaid(p.id)}
                              disabled={markingId === p.id}
                              className="border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 text-xs hover:border-gray-400 transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              {markingId === p.id ? '...' : 'Mark Paid (Cash)'}
                            </button>
                          ) : p.receipt_number ? (
                            <span className="text-xs text-gray-400 font-mono">
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
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  fetchPayments(nextPage);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Generate Bills ── */}
      {tab === 'generate' && (
        <div className="space-y-6 max-w-xl">
          <div>
            <h2 className="text-sm font-medium text-gray-900 mb-1">
              Generate Fee Bills for Students
            </h2>
            <p className="text-xs text-gray-400">
              Creates a pending payment record for every active student.
            </p>
          </div>

          <div className="space-y-4">
            {/* Step 1 */}
            <div className="border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Step 1 — Select Fee Structure
              </p>
              <select
                value={selectedStructureId}
                onChange={(e) => setSelectedStructureId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 w-full"
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
            <div className="border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Step 2 — Period Label
              </p>
              <input
                type="text"
                placeholder={
                  selectedStructure?.billing_period === 'monthly' ? 'May-2025' : '2025-26'
                }
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 w-full"
              />
              <p className="text-xs text-gray-400 mt-1">
                {selectedStructure?.billing_period === 'monthly'
                  ? 'Format: May-2025'
                  : 'Format: 2025-26'}
              </p>
            </div>

            {/* Step 3 */}
            <div className="border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Step 3 — Due Date
              </p>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 w-full"
              />
            </div>

            {/* Step 4: Target Students */}
            <div className="border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex justify-between">
                <span>Step 4 — Target Students (Optional)</span>
                {targetStudents.length > 0 && (
                  <span className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">
                    {targetStudents.length} selected
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400 mb-3">
                If none selected, bills are generated for ALL students.
              </p>

              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Search students to target..."
                  value={studentSearchText}
                  onChange={(e) => setStudentSearchText(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 w-full mb-1"
                />

                <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-2 space-y-1">
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
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setTargetStudents([...targetStudents, s.id!]);
                              else setTargetStudents(targetStudents.filter((id) => id !== s.id));
                            }}
                            className="rounded border-gray-300"
                          />
                          <div className="text-sm">
                            <p className="font-medium text-gray-900">{s.profiles?.full_name}</p>
                            <p className="text-xs text-gray-400">{s.roll_number}</p>
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
              className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors w-full disabled:opacity-50"
            >
              {generating
                ? 'Generating...'
                : `Generate Bills ${targetStudents.length > 0 ? `(${targetStudents.length} students)` : '(All students)'}`}
            </button>

            {genResult && (
              <div className="border border-green-100 bg-green-50 rounded-xl p-4">
                <p className="text-sm text-green-700 font-medium">
                  Generated {genResult.generated} bills, Skipped {genResult.skipped} (already exist)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: Fee Structures ── */}
      {tab === 'structures' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-900">Fee Structures</h2>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              {showAddForm ? 'Cancel' : '+ Add Structure'}
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <form
              onSubmit={handleAddStructure}
              className="border border-gray-100 rounded-xl p-6 space-y-4"
            >
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                New Fee Structure
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    required
                    min={1}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fee Type</label>
                  <select
                    value={newFeeType}
                    onChange={(e) => setNewFeeType(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 w-full"
                  >
                    <option value="combined">Hostel + Mess</option>
                    <option value="hostel">Hostel</option>
                    <option value="mess">Mess</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Billing Period</label>
                  <select
                    value={newBilling}
                    onChange={(e) => setNewBilling(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 w-full"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one_time">One Time</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIncludesHostel}
                    onChange={(e) => setNewIncludesHostel(e.target.checked)}
                    className="rounded"
                  />
                  Includes Hostel
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIncludesMess}
                    onChange={(e) => setNewIncludesMess(e.target.checked)}
                    className="rounded"
                  />
                  Includes Mess
                </label>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400 w-full"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Fee Structure'}
              </button>
            </form>
          )}

          {/* List */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Period</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {feeStructures.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                      No fee structures yet
                    </td>
                  </tr>
                ) : (
                  feeStructures.map((f) => (
                    <tr
                      key={f.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{f.name}</div>
                        {f.description && (
                          <div className="text-xs text-gray-400">{f.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-600">{f.fee_type}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{fmt(f.amount)}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{f.billing_period}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${f.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                        >
                          {f.is_active ? 'Active' : 'Inactive'}
                        </span>
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
  );
}
