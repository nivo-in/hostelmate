'use client';
import { AlertTriangle, Home, UtensilsCrossed } from 'lucide-react';

import { useEffect, useState, useCallback } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { container } from '@/lib/ui';

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

// ─── Theme tokens ────────────────────────────────────────

const ORANGE = '#fb923c';
const ORANGE_SOFT = 'rgba(251,146,60,0.12)';
const ORANGE_BORDER = 'rgba(251,146,60,0.35)';
const GREEN = '#4ade80';
const AMBER = '#fbbf24';
const RED = '#f87171';
const BLUE = '#60a5fa';

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
};

const tileStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '0.5px solid rgba(255,255,255,0.12)',
  borderRadius: '14px',
  padding: '18px 20px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
};

const errorBox: React.CSSProperties = {
  marginBottom: '16px',
  background: 'rgba(248,113,113,0.08)',
  border: '0.5px solid rgba(248,113,113,0.25)',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  color: RED,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
};

const successBox: React.CSSProperties = {
  marginBottom: '16px',
  background: 'rgba(74,222,128,0.08)',
  border: '0.5px solid rgba(74,222,128,0.25)',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  color: GREEN,
};

const pill: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.3px',
  padding: '3px 9px',
  borderRadius: '999px',
  display: 'inline-block',
};

// ─── Helpers ─────────────────────────────────────────────

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

const statusBadge = (status: string, isOverdue?: boolean) => {
  const make = (color: string, label: string) => (
    <span
      style={{
        ...pill,
        color,
        background: `${color}1f`,
        border: `0.5px solid ${color}40`,
      }}
    >
      {label}
    </span>
  );
  if (isOverdue) {return make(RED, 'OVERDUE');}
  switch (status) {
    case 'paid':
      return make(GREEN, 'Paid');
    case 'pending':
      return make(AMBER, 'Pending');
    case 'processing':
      return make(BLUE, 'Processing');
    case 'failed':
      return make(RED, 'Failed');
    case 'refunded':
      return make('rgba(255,255,255,0.5)', 'Refunded');
    default:
      return null;
  }
};

const typeBadge = (type: string) => {
  switch (type) {
    case 'combined':
      return (
        <span style={{ ...pill, color: '#a5b4fc', background: 'rgba(165,180,252,0.12)', border: '0.5px solid rgba(165,180,252,0.25)' }}>
          Hostel + Mess
        </span>
      );
    case 'hostel':
      return (
        <span style={{ ...pill, color: ORANGE, background: ORANGE_SOFT, border: `0.5px solid ${ORANGE_BORDER}` }}>
          Hostel
        </span>
      );
    case 'mess':
      return (
        <span style={{ ...pill, color: '#5eead4', background: 'rgba(94,234,212,0.12)', border: '0.5px solid rgba(94,234,212,0.25)' }}>
          Mess
        </span>
      );
    default:
      return (
        <span style={{ ...pill, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)' }}>
          {type}
        </span>
      );
  }
};

const methodBadge = (method: string | null) => {
  if (!method) {return null;}
  const labels: Record<string, string> = {
    razorpay: 'Online',
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    dd: 'DD',
  };
  return (
    <span style={{ ...pill, fontWeight: 500, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)' }}>
      {labels[method] || method}
    </span>
  );
};

// ─── Plan config (static pricing) ────────────────────────

const PLANS = {
  combined: {
    icon: <Home size={20} />,
    label: 'Hostel + Mess',
    subtitle: 'Complete package — best value',
    recommended: true,
    yearly: { amount: 245000, note: 'Save ₹10,000 vs separate' },
    monthly: { amount: 20417, note: null },
    feeType: 'combined' as const,
  },
  hostel: {
    icon: <Home size={20} />,
    label: 'Hostel Only',
    subtitle: 'Room rent only, self-arrangement for meals',
    recommended: false,
    yearly: { amount: 135000, note: '₹10,000/year extra vs combined plan' },
    monthly: { amount: 11417, note: '₹1,000/month extra vs combined' },
    feeType: 'hostel' as const,
  },
  mess: {
    icon: <UtensilsCrossed size={20} />,
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
      if (res.success) {setPaymentsData(res.data);}
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }, [apiGet]);

  const fetchFeeStructures = useCallback(async () => {
    try {
      const res = await apiGet('/api/v1/payments/fee-structures');
      if (res.success) {setFeeStructures(res.data);}
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
            if (data) {setProfile(data);}
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
      if (!orderRes.success) {throw new Error(orderRes.error || 'Failed to create order');}

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
    if (!selectedPlan || !selectedFreq || !feeStructures) {return;}
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
    <PageShell spotlight="rgba(251,146,60,0.12)">
      <PageHeader title="Fee Payments" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {/* ── Alerts ── */}
        {error && (
          <div style={errorBox}>
            <p className="text-red-500" style={{ margin: 0, flex: 1 }}>{error}</p>
            <button
              type="button"
              onClick={() => setError('')}
              style={{ background: 'transparent', border: 'none', color: RED, cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        )}
        {success && <div style={successBox}>{success}</div>}

        {/* ── SECTION 1: Summary tiles ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            marginBottom: '32px',
          }}
        >
          <div style={tileStyle}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Total Paid</p>
            <p style={{ fontSize: '26px', fontWeight: 600, color: GREEN, margin: 0 }}>{fmt(totals?.total_paid ?? 0)}</p>
          </div>
          <div style={tileStyle}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Total Pending</p>
            <p
              style={{
                fontSize: '26px',
                fontWeight: 600,
                margin: 0,
                color: (totals?.total_pending ?? 0) > 0 ? AMBER : 'rgba(255,255,255,0.35)',
              }}
            >
              {fmt(totals?.total_pending ?? 0)}
            </p>
          </div>
          <div style={tileStyle}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Next Due</p>
            <p style={{ fontSize: '26px', fontWeight: 600, color: ORANGE, margin: 0 }}>
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
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', margin: 0 }}>Choose Your Fee Plan</h2>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                Select what you want to pay for and how often
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPlanSelector((v) => !v);
                setSelectedPlan(null);
                setSelectedFreq(null);
              }}
              style={{
                border: '0.5px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)',
                background: 'transparent',
                borderRadius: '10px',
                padding: '9px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {showPlanSelector ? 'Cancel' : '+ Select Plan'}
            </button>
          </div>

          {showPlanSelector && (
            <div style={{ ...panelStyle, padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Step 1 — plan type */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                  Step 1 — What do you want to pay for?
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {(Object.keys(PLANS) as PlanKey[]).map((key) => {
                    const plan = PLANS[key];
                    const isSelected = selectedPlan === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => {
                          setSelectedPlan(key);
                          setSelectedFreq(null);
                        }}
                        style={{
                          textAlign: 'left',
                          borderRadius: '14px',
                          padding: '18px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: isSelected ? `1px solid ${ORANGE_BORDER}` : '0.5px solid rgba(255,255,255,0.1)',
                          background: isSelected ? ORANGE_SOFT : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center' }}>{plan.icon}</span>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{plan.label}</span>
                          {plan.recommended && (
                            <span style={{ ...pill, color: '#1a0f04', background: ORANGE, border: 'none' }}>Best</span>
                          )}
                        </div>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginBottom: '12px' }}>{plan.subtitle}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                            Yearly: <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{fmt(plan.yearly.amount)}</span>
                          </p>
                          {plan.yearly.note && <p style={{ fontSize: '12px', color: GREEN, margin: 0 }}>{plan.yearly.note}</p>}
                          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '4px', marginBottom: 0 }}>
                            Monthly:{' '}
                            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{fmt(plan.monthly.amount)}/mo</span>
                          </p>
                          {plan.monthly.note && <p style={{ fontSize: '12px', color: ORANGE, margin: 0 }}>{plan.monthly.note}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2 — frequency */}
              {selectedPlan && (
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                    Step 2 — Payment Frequency
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                    {/* Yearly card */}
                    <button
                      type="button"
                      onClick={() => setSelectedFreq('yearly')}
                      style={{
                        textAlign: 'left',
                        borderRadius: '14px',
                        padding: '18px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: selectedFreq === 'yearly' ? `1px solid ${ORANGE_BORDER}` : '0.5px solid rgba(255,255,255,0.1)',
                        background: selectedFreq === 'yearly' ? ORANGE_SOFT : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Pay Yearly</p>
                      <p style={{ fontSize: '28px', fontWeight: 600, color: 'rgba(255,255,255,0.95)', marginBottom: '4px' }}>
                        {fmt(PLANS[selectedPlan].yearly.amount)}
                      </p>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginBottom: '8px' }}>Pay once, save more</p>
                      {selectedPlan === 'combined' && (
                        <p style={{ fontSize: '12px', color: GREEN, margin: 0 }}>
                          Save{' '}
                          {fmt(
                            PLANS[selectedPlan].monthly.amount * 12 -
                              PLANS[selectedPlan].yearly.amount
                          )}{' '}
                          vs monthly
                        </p>
                      )}
                      {PLANS[selectedPlan].yearly.note && (
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                          {PLANS[selectedPlan].yearly.note}
                        </p>
                      )}
                    </button>

                    {/* Monthly card */}
                    <button
                      type="button"
                      onClick={() => setSelectedFreq('monthly')}
                      style={{
                        textAlign: 'left',
                        borderRadius: '14px',
                        padding: '18px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: selectedFreq === 'monthly' ? `1px solid ${ORANGE_BORDER}` : '0.5px solid rgba(255,255,255,0.1)',
                        background: selectedFreq === 'monthly' ? ORANGE_SOFT : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Pay Monthly</p>
                      <p style={{ fontSize: '28px', fontWeight: 600, color: 'rgba(255,255,255,0.95)', marginBottom: '4px' }}>
                        {fmt(PLANS[selectedPlan].monthly.amount)}
                        <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)' }}>/mo</span>
                      </p>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginBottom: '8px' }}>Spread across 12 months</p>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                        Total yearly: {fmt(PLANS[selectedPlan].monthly.amount * 12)}
                      </p>
                      {PLANS[selectedPlan].monthly.note && (
                        <p style={{ fontSize: '12px', color: ORANGE, marginTop: '4px' }}>
                          {PLANS[selectedPlan].monthly.note}
                        </p>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmation */}
              {selectedPlan && selectedFreq && (
                <div style={{ ...tileStyle, padding: '18px 20px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: '4px' }}>
                    You selected: {PLANS[selectedPlan].label} (
                    {selectedFreq === 'yearly' ? 'Yearly' : 'Monthly'})
                  </p>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                    Amount:{' '}
                    <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>
                      {fmt(PLANS[selectedPlan][selectedFreq].amount)}
                      {selectedFreq === 'monthly' ? '/month' : '/year'}
                    </span>
                  </p>
                  {matchedStructure ? (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>{matchedStructure.description}</p>
                  ) : (
                    <p style={{ fontSize: '12px', color: ORANGE, marginBottom: '16px' }}>
                      Fee structure not found — ask warden to configure fees first.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handlePayNewPlan}
                    disabled={loading}
                    style={{
                      background: ORANGE,
                      color: '#1a0f04',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '9px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
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
          <h2 style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Payment History
            {hasPending && (
              <span style={{ ...pill, color: RED, background: 'rgba(248,113,113,0.12)', border: '0.5px solid rgba(248,113,113,0.25)' }}>
                {pendingPayments.length} due
              </span>
            )}
          </h2>

          {allPayments.length === 0 ? (
            <div style={{ ...panelStyle, padding: '48px', textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', margin: 0 }}>No fee payments yet.</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>Your warden will generate bills for you.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {allPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="glass-card"
                  style={{
                    ...panelStyle,
                    padding: '20px 24px',
                    border: payment.is_overdue ? '0.5px solid rgba(248,113,113,0.3)' : '0.5px solid rgba(255,255,255,0.07)',
                    background: payment.is_overdue ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
                          {payment.fee_structures?.name}
                        </span>
                        {typeBadge(payment.fee_structures?.fee_type)}
                        {statusBadge(payment.status, payment.is_overdue)}
                        {methodBadge(payment.payment_method)}
                      </div>
                      <p style={{ fontSize: '20px', fontWeight: 600, color: 'rgba(255,255,255,0.95)', marginBottom: '4px' }}>{fmt(payment.amount)}</p>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                        Period: <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{payment.period_label}</span>
                      </p>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', flexWrap: 'wrap' }}>
                        <span>Due: {new Date(payment.due_date).toLocaleDateString('en-IN')}</span>
                        {payment.paid_at && (
                          <span>Paid: {new Date(payment.paid_at).toLocaleDateString('en-IN')}</span>
                        )}
                      </div>
                      {payment.receipt_number && (
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', fontFamily: 'monospace' }}>
                          {payment.receipt_number}
                        </p>
                      )}
                    </div>

                    {(payment.status === 'pending' || payment.status === 'processing') && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handlePay(payment)}
                          disabled={loading}
                          style={{
                            borderRadius: '10px',
                            padding: '9px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.5 : 1,
                            transition: 'all 0.2s',
                            border: 'none',
                            background: payment.is_overdue ? RED : ORANGE,
                            color: payment.is_overdue ? '#fff' : '#1a0f04',
                          }}
                        >
                          {payment.is_overdue ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={14} strokeWidth={2.5} /> Pay Overdue </span> : 'Pay Now '}
                          {fmt(payment.amount)}
                        </button>
                        {payment.status === 'processing' && (
                          <button
                            type="button"
                            onClick={() => handleCancelPayment(payment.id)}
                            disabled={loading}
                            style={{
                              fontSize: '12px',
                              color: RED,
                              background: 'transparent',
                              border: 'none',
                              textDecoration: 'underline',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              opacity: loading ? 0.5 : 1,
                            }}
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
    </PageShell>
  );
}
