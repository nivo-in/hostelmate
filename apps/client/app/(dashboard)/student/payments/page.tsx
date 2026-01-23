'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';

// ─── Razorpay window type ────────────────────────────────

interface RazorpayInstance {
  open(): void;
  on(_event: string, _handler: (..._args: unknown[]) => void): void;
}

interface RazorpayConstructor {
  new (_options: Record<string, unknown>): RazorpayInstance;
}

type RazorpayWindow = Window &
  typeof globalThis & {
    Razorpay: RazorpayConstructor;
  };

// ─── Types ───────────────────────────────────────────────

interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  fee_type: 'mess' | 'hostel' | 'combined' | 'maintenance' | 'other';
  billing_period: 'monthly' | 'yearly' | 'one_time';
  includes_hostel: boolean;
  includes_mess: boolean;
  description: string;
}

interface FeeStructuresGrouped {
  yearly: FeeStructure[];
  monthly: FeeStructure[];
  one_time: FeeStructure[];
}

interface FeePayment {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
  payment_method: string | null;
  due_date: string;
  paid_at: string | null;
  billing_period: string;
  period_label: string;
  receipt_number: string | null;
  fee_structures: {
    name: string;
    fee_type: string;
    billing_period: string;
  };
  is_overdue: boolean;
}

interface PaymentTotals {
  total_paid: number;
  total_pending: number;
  next_due: string | null;
}

interface PaymentsData {
  payments: {
    pending: FeePayment[];
    paid: FeePayment[];
    failed: FeePayment[];
    all: FeePayment[];
  };
  totals: PaymentTotals;
}

interface UserProfile {
  full_name: string;
  email: string;
}

type PlanKey = 'combined' | 'hostel' | 'mess';
type FreqKey = 'yearly' | 'monthly';

// ─── Helpers ─────────────────────────────────────────────

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

const statusBadge = (status: string, isOverdue?: boolean) => {
  const base = 'text-xs px-2.5 py-1 rounded-full font-medium';
  if (isOverdue) return <span className={`${base} bg-red-100 text-red-700`}>OVERDUE</span>;
  switch (status) {
    case 'paid':
      return <span className={`${base} bg-green-50 text-green-700`}>Paid</span>;
    case 'pending':
      return <span className={`${base} bg-yellow-50 text-yellow-700`}>Pending</span>;
    case 'processing':
      return <span className={`${base} bg-blue-50 text-blue-700`}>Processing</span>;
    case 'failed':
      return <span className={`${base} bg-red-50 text-red-700`}>Failed</span>;
    case 'refunded':
      return <span className={`${base} bg-gray-100 text-gray-600`}>Refunded</span>;
    default:
      return null;
  }
};

const typeBadge = (type: string) => {
  const base = 'text-xs px-2.5 py-1 rounded-full font-medium';
  switch (type) {
    case 'combined':
      return <span className={`${base} bg-indigo-50 text-indigo-700`}>Hostel + Mess</span>;
    case 'hostel':
      return <span className={`${base} bg-orange-50 text-orange-700`}>Hostel</span>;
    case 'mess':
      return <span className={`${base} bg-teal-50 text-teal-700`}>Mess</span>;
    default:
      return <span className={`${base} bg-gray-100 text-gray-600`}>{type}</span>;
  }
};

const methodBadge = (method: string | null) => {
  if (!method) return null;
  const base = 'text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600';
  const labels: Record<string, string> = {
    razorpay: 'Online',
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    dd: 'DD',
  };
  return <span className={base}>{labels[method] || method}</span>;
};

// ─── Plan config (static pricing) ────────────────────────

const PLANS = {
  combined: {
    emoji: '🏠',
    label: 'Hostel + Mess',
    subtitle: 'Complete package — best value',
    recommended: true,
    yearly: { amount: 245000, note: 'Save ₹10,000 vs separate' },
    monthly: { amount: 20417, note: null },
    feeType: 'combined' as const,
  },
  hostel: {
    emoji: '🏠',
    label: 'Hostel Only',
    subtitle: 'Room rent only, self-arrangement for meals',
    recommended: false,
    yearly: { amount: 135000, note: '₹10,000/year extra vs combined plan' },
    monthly: { amount: 11417, note: '₹1,000/month extra vs combined' },
    feeType: 'hostel' as const,
  },
  mess: {
    emoji: '🍽',
    label: 'Mess Only',
    subtitle: 'Meals only, external accommodation',
    recommended: false,
    yearly: { amount: 140000, note: '₹10,000/year extra vs combined plan' },
    monthly: { amount: 11833, note: '₹1,000/month extra vs combined' },
    feeType: 'mess' as const,
  },
} as const;

// ─── Component ───────────────────────────────────────────

export default function StudentPaymentsPage() {
  const router = useRouter();
  const [paymentsData, setPaymentsData] = useState<PaymentsData | null>(null);
  const [feeStructures, setFeeStructures] = useState<FeeStructuresGrouped | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [selectedFreq, setSelectedFreq] = useState<FreqKey | null>(null);
  const [showPlanSelector, setShowPlanSelector] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { apiGet, apiPost } = useApi();
  const supabase = createClient();

  // ── Fetch data ──

  const fetchPayments = useCallback(async () => {
    try {
      const res = await apiGet('/api/v1/payments/my');
      if (res.success) setPaymentsData(res.data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }, [apiGet]);

  const fetchFeeStructures = useCallback(async () => {
    try {
      const res = await apiGet('/api/v1/payments/fee-structures');
      if (res.success) setFeeStructures(res.data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }, [apiGet]);

  useEffect(() => {
    fetchPayments();
    fetchFeeStructures();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      }
    });
  }, []);

  // ── Load Razorpay script ──
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // ── Pay existing pending payment ──
  const handlePay = async (payment: FeePayment) => {
    setError('');
    setLoading(true);
    try {
      const orderRes = await apiPost('/api/v1/payments/create-order', {
        fee_payment_id: payment.id,
      });
      if (!orderRes.success) throw new Error(orderRes.error || 'Failed to create order');

      const orderData = orderRes.data;
      const options = {
        key: orderData.key_id,
        amount: orderData.amount * 100,
        currency: 'INR',
        name: 'HostelMate by Nivo',
        description: payment.fee_structures?.name || 'Fee Payment',
        order_id: orderData.order_id,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const result = await apiPost('/api/v1/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              fee_payment_id: payment.id,
            });
            if (result.success) {
              setSuccess(`Payment successful! Receipt: ${result.receipt_number}`);
              setTimeout(() => setSuccess(''), 6000);
              fetchPayments();
            } else {
              setError('Payment verification failed. Contact support.');
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error verifying payment:', error);
            setError('Verification failed. Contact support.');
            setError('Verification failed. Contact support.');
          }
        },
        prefill: { name: profile?.full_name, email: profile?.email },
        theme: { color: '#111827' },
        modal: {
          ondismiss: async () => {
            setError('Payment window closed');
            try {
              await apiPost('/api/v1/payments/cancel', { fee_payment_id: payment.id });
            } finally {
              fetchPayments();
            }
          },
        },
      };
      const rzp = new (window as RazorpayWindow).Razorpay(options);
      rzp.on('payment.failed', async (response: unknown) => {
        const errResponse = response as { error: { description: string } };
        setError(`Payment failed: ${errResponse.error.description}`);
        try {
          await apiPost('/api/v1/payments/cancel', { fee_payment_id: payment.id });
        } finally {
          fetchPayments();
          setLoading(false);
        }
      });
      rzp.open();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error creating order:', error);
      setError('Failed to initiate payment');
      setError('Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPayment = async (paymentId: string) => {
    setLoading(true);
    try {
      await apiPost('/api/v1/payments/cancel', { fee_payment_id: paymentId });
      fetchPayments();
    } catch (e) {
      setError((e as Error).message || 'Failed to cancel payment');
    } finally {
      setLoading(false);
    }
  };

  // ── Pay new plan (from plan selector) ──
  const handlePayNewPlan = async () => {
    if (!selectedPlan || !selectedFreq || !feeStructures) return;
    const plan = PLANS[selectedPlan];
    const pool = selectedFreq === 'yearly' ? feeStructures.yearly : feeStructures.monthly;
    const structure = pool.find((f) => f.fee_type === plan.feeType);
    if (!structure) {
      setError('Fee structure not found. Ask warden to set up fee structures.');
      return;
    }

    // Ask warden to generate bill for this student first — or show instruction
    setError(
      'Please ask your warden to generate a bill for your selected plan. Then it will appear below to pay.'
    );
  };

  // ── Derived ──
  const totals = paymentsData?.totals;
  const allPayments = paymentsData?.payments.all || [];
  const pendingPayments = paymentsData?.payments.pending || [];
  const hasPending = pendingPayments.length > 0;

  const matchedStructure =
    selectedPlan && selectedFreq && feeStructures
      ? (selectedFreq === 'yearly' ? feeStructures.yearly : feeStructures.monthly).find(
          (f) => f.fee_type === PLANS[selectedPlan].feeType
        )
      : null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-5xl mx-auto">
      <PageHeader title="Fee Payments" showBack onSignOut={handleSignOut} />

      {/* ── Alerts ── */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
          {error}
          <button
            className="float-right text-red-400 hover:text-red-600"
            onClick={() => setError('')}
          >
            ✕
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
          {success}
        </div>
      )}

      {/* ── SECTION 1: Summary cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
          <p className="text-xs text-gray-400 mb-1">Total Paid</p>
          <p className="text-2xl font-medium text-green-600">{fmt(totals?.total_paid ?? 0)}</p>
        </div>
        <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
          <p className="text-xs text-gray-400 mb-1">Total Pending</p>
          <p
            className={`text-2xl font-medium ${(totals?.total_pending ?? 0) > 0 ? 'text-red-500' : 'text-gray-400'}`}
          >
            {fmt(totals?.total_pending ?? 0)}
          </p>
        </div>
        <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
          <p className="text-xs text-gray-400 mb-1">Next Due</p>
          <p className="text-2xl font-medium text-yellow-600">
            {totals?.next_due
              ? new Date(totals.next_due).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })
              : '—'}
          </p>
        </div>
      </div>

      {/* ── SECTION 2: Plan Selector ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Choose Your Fee Plan</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Select what you want to pay for and how often
            </p>
          </div>
          <button
            className="border border-gray-200 text-gray-600 rounded-lg px-4 py-2.5 text-sm hover:border-gray-400 transition-colors"
            onClick={() => {
              setShowPlanSelector((v) => !v);
              setSelectedPlan(null);
              setSelectedFreq(null);
            }}
          >
            {showPlanSelector ? 'Cancel' : '+ Select Plan'}
          </button>
        </div>

        {showPlanSelector && (
          <div className="border border-gray-100 rounded-xl p-6 space-y-6">
            {/* Step 1 — plan type */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Step 1 — What do you want to pay for?
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(Object.keys(PLANS) as PlanKey[]).map((key) => {
                  const plan = PLANS[key];
                  const isSelected = selectedPlan === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedPlan(key);
                        setSelectedFreq(null);
                      }}
                      className={`text-left border rounded-xl p-5 transition-colors ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{plan.emoji}</span>
                        <span className="text-sm font-medium text-gray-900">{plan.label}</span>
                        {plan.recommended && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-900 text-white font-medium">
                            Best
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-3">{plan.subtitle}</p>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-700">
                          Yearly: <span className="font-medium">{fmt(plan.yearly.amount)}</span>
                        </p>
                        {plan.yearly.note && (
                          <p className="text-xs text-green-600">{plan.yearly.note}</p>
                        )}
                        <p className="text-xs text-gray-700 mt-1">
                          Monthly:{' '}
                          <span className="font-medium">{fmt(plan.monthly.amount)}/mo</span>
                        </p>
                        {plan.monthly.note && (
                          <p className="text-xs text-orange-500">{plan.monthly.note}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2 — frequency */}
            {selectedPlan && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Step 2 — Payment Frequency
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Yearly card */}
                  <button
                    onClick={() => setSelectedFreq('yearly')}
                    className={`text-left border rounded-xl p-5 transition-colors ${selectedFreq === 'yearly' ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}
                  >
                    <p className="text-xs text-gray-400 mb-1">Pay Yearly</p>
                    <p className="text-3xl font-medium text-gray-900 mb-1">
                      {fmt(PLANS[selectedPlan].yearly.amount)}
                    </p>
                    <p className="text-xs text-gray-500 mb-2">Pay once, save more</p>
                    {selectedPlan === 'combined' && (
                      <p className="text-xs text-green-600">
                        Save{' '}
                        {fmt(
                          PLANS[selectedPlan].monthly.amount * 12 -
                            PLANS[selectedPlan].yearly.amount
                        )}{' '}
                        vs monthly
                      </p>
                    )}
                    {PLANS[selectedPlan].yearly.note && (
                      <p className="text-xs text-gray-400 mt-1">
                        {PLANS[selectedPlan].yearly.note}
                      </p>
                    )}
                  </button>

                  {/* Monthly card */}
                  <button
                    onClick={() => setSelectedFreq('monthly')}
                    className={`text-left border rounded-xl p-5 transition-colors ${selectedFreq === 'monthly' ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}
                  >
                    <p className="text-xs text-gray-400 mb-1">Pay Monthly</p>
                    <p className="text-3xl font-medium text-gray-900 mb-1">
                      {fmt(PLANS[selectedPlan].monthly.amount)}
                      <span className="text-base text-gray-400">/mo</span>
                    </p>
                    <p className="text-xs text-gray-500 mb-2">Spread across 12 months</p>
                    <p className="text-xs text-gray-400">
                      Total yearly: {fmt(PLANS[selectedPlan].monthly.amount * 12)}
                    </p>
                    {PLANS[selectedPlan].monthly.note && (
                      <p className="text-xs text-orange-500 mt-1">
                        {PLANS[selectedPlan].monthly.note}
                      </p>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation */}
            {selectedPlan && selectedFreq && (
              <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  You selected: {PLANS[selectedPlan].label} (
                  {selectedFreq === 'yearly' ? 'Yearly' : 'Monthly'})
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Amount:{' '}
                  <span className="font-medium text-gray-900">
                    {fmt(PLANS[selectedPlan][selectedFreq].amount)}
                    {selectedFreq === 'monthly' ? '/month' : '/year'}
                  </span>
                </p>
                {matchedStructure ? (
                  <p className="text-xs text-gray-400 mb-4">{matchedStructure.description}</p>
                ) : (
                  <p className="text-xs text-orange-500 mb-4">
                    Fee structure not found — ask warden to configure fees first.
                  </p>
                )}
                <button
                  onClick={handlePayNewPlan}
                  disabled={loading}
                  className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Proceed to Payment
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION 3: Payment History ── */}
      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-4">
          Payment History
          {hasPending && (
            <span className="ml-2 text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium">
              {pendingPayments.length} due
            </span>
          )}
        </h2>

        {allPayments.length === 0 ? (
          <div className="border border-gray-100 rounded-xl p-12 text-center">
            <p className="text-gray-400 text-sm">No fee payments yet.</p>
            <p className="text-gray-400 text-xs mt-1">Your warden will generate bills for you.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allPayments.map((payment) => (
              <div
                key={payment.id}
                className={`border rounded-xl p-6 transition-colors ${payment.is_overdue ? 'border-red-200 bg-red-50' : 'border-gray-100 hover:border-gray-300'}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {payment.fee_structures?.name}
                      </span>
                      {typeBadge(payment.fee_structures?.fee_type)}
                      {statusBadge(payment.status, payment.is_overdue)}
                      {methodBadge(payment.payment_method)}
                    </div>
                    <p className="text-xl font-medium text-gray-900 mb-1">{fmt(payment.amount)}</p>
                    <p className="text-xs text-gray-500 mb-1">
                      Period: <span className="font-medium">{payment.period_label}</span>
                    </p>
                    <div className="flex gap-4 text-xs text-gray-400">
                      <span>Due: {new Date(payment.due_date).toLocaleDateString('en-IN')}</span>
                      {payment.paid_at && (
                        <span>Paid: {new Date(payment.paid_at).toLocaleDateString('en-IN')}</span>
                      )}
                    </div>
                    {payment.receipt_number && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        {payment.receipt_number}
                      </p>
                    )}
                  </div>

                  {(payment.status === 'pending' || payment.status === 'processing') && (
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => handlePay(payment)}
                        disabled={loading}
                        className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50 ${payment.is_overdue ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-900 text-white hover:bg-gray-700'}`}
                      >
                        {payment.is_overdue ? '⚠️ Pay Overdue ' : 'Pay Now '}
                        {fmt(payment.amount)}
                      </button>
                      {payment.status === 'processing' && (
                        <button
                          onClick={() => handleCancelPayment(payment.id)}
                          disabled={loading}
                          className="text-xs text-red-600 hover:text-red-800 underline disabled:opacity-50"
                        >
                          Cancel process
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
