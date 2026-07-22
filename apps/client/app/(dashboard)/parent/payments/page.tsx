'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { Reveal } from '@/components/ui/Reveal';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { FileText } from 'lucide-react';

interface RazorpayInstance {
  open(): void;
  on(_event: string, _handler: (..._args: unknown[]) => void): void;
}
interface RazorpayConstructor {
  new (_options: Record<string, unknown>): RazorpayInstance;
}
type RazorpayWindow = Window & typeof globalThis & { Razorpay: RazorpayConstructor };

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
  is_overdue: boolean;
  fee_structures: { name: string; fee_type: string; billing_period: string };
}

interface PaymentsData {
  payments: { pending: FeePayment[]; paid: FeePayment[]; failed: FeePayment[]; all: FeePayment[] };
  totals: { total_paid: number; total_pending: number; next_due: string | null };
  student_name: string | null;
}

interface ReceiptData {
  id: string;
  amount: number;
  receipt_number: string;
  paid_at: string;
  period_label: string;
  payment_method: string;
  fee_structures: { name: string; fee_type: string; billing_period: string };
  students: { roll_number: string; profiles: { full_name: string; email: string } };
}

interface ParentProfile {
  full_name: string;
  email: string;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

export default function ParentPaymentsPage() {
  const [paymentsData, setPaymentsData] = useState<PaymentsData | null>(null);
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
  const [receiptModal, setReceiptModal] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { apiGet, apiPost } = useApi();
  const supabase = createClient();

  const fetchPayments = useCallback(async () => {
    try {
      const res = await apiGet('/api/v1/payments/my');
      if (res.success) {
        setPaymentsData(res.data);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }, [apiGet]);

  useEffect(() => {
    fetchPayments();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) {setParentProfile(data);}
          });
      }
    });
  }, [fetchPayments, supabase]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handlePay = async (payment: FeePayment) => {
    setError('');
    setLoading(true);
    try {
      const orderRes = await apiPost('/api/v1/payments/create-order', {
        fee_payment_id: payment.id,
      });
      if (!orderRes.success) {throw new Error(orderRes.error || 'Failed to create order');}
      const orderData = orderRes.data;
      const studentName = paymentsData?.student_name || 'Ward';

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
          const result = await apiPost('/api/v1/payments/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            fee_payment_id: payment.id,
          });
          if (result.success) {
            setSuccess(
              `Payment made successfully for ${studentName}! Receipt: ${result.receipt_number}`
            );
            setTimeout(() => setSuccess(''), 6000);
            fetchPayments();
          } else {
            setError('Payment verification failed. Contact support.');
          }
        },
        prefill: { name: parentProfile?.full_name, email: parentProfile?.email },
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
    } catch (e) {
      setError((e as Error).message || 'Payment failed');
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

  const handleViewReceipt = async (paymentId: string) => {
    try {
      const res = await apiGet(`/api/v1/payments/receipt/${paymentId}`);
      if (res.success) {setReceiptModal(res.data);}
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const totals = paymentsData?.totals;
  const pendingPayments = paymentsData?.payments.pending || [];
  const paidPayments = paymentsData?.payments.paid || [];
  const studentName = paymentsData?.student_name || 'Ward';

  return (
    <PageShell title="Fee Payments" subtitle={`Fee status for ${studentName}`}>
      {/* Alerts */}
      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.3)', borderRadius: '12px', fontSize: '13px', color: '#f87171', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      {success && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(74,222,128,0.1)', border: '0.5px solid rgba(74,222,128,0.3)', borderRadius: '12px', fontSize: '13px', color: '#4ade80' }}>
          {success}
        </div>
      )}

      {/* Summary Cards */}
      <Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '18px 20px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Total Paid</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#4ade80' }}>{fmt(totals?.total_paid ?? 0)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '18px 20px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Total Pending</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: (totals?.total_pending ?? 0) > 0 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
              {fmt(totals?.total_pending ?? 0)}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '18px 20px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Next Due</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#fb923c' }}>
              {totals?.next_due
                ? new Date(totals.next_due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : '—'}
            </div>
          </div>
        </div>
      </Reveal>

      {/* Pending Payments */}
      {pendingPayments.length > 0 && (
        <Reveal delay={40}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff', margin: 0 }}>Pending Payments</h2>
              <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.25)', borderRadius: '6px', padding: '2px 8px', fontWeight: 500 }}>
                {pendingPayments.length} due
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingPayments.map((payment) => (
                <div
                  key={payment.id}
                  style={{
                    background: payment.is_overdue ? 'rgba(248,113,113,0.04)' : 'rgba(255,255,255,0.03)',
                    border: payment.is_overdue ? '0.5px solid rgba(248,113,113,0.3)' : '0.5px solid rgba(255,255,255,0.07)',
                    borderRadius: '16px', padding: '20px 22px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>{payment.fee_structures?.name}</span>
                      {payment.is_overdue && (
                        <span style={{ fontSize: '10px', color: '#f87171', background: 'rgba(248,113,113,0.15)', border: '0.5px solid rgba(248,113,113,0.3)', borderRadius: '4px', padding: '2px 6px', fontWeight: 600 }}>OVERDUE</span>
                      )}
                    </div>
                    <p style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', margin: '0 0 4px 0' }}>{fmt(payment.amount)}</p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                      Period: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{payment.period_label}</span> · Due: {new Date(payment.due_date).toLocaleDateString('en-IN')}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <button
                      onClick={() => handlePay(payment)}
                      disabled={loading}
                      style={{
                        padding: '9px 18px', borderRadius: '10px', background: '#fb923c', color: '#000000',
                        fontWeight: 600, fontSize: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      Pay on behalf {fmt(payment.amount)}
                    </button>
                    {payment.status === 'processing' && (
                      <button
                        onClick={() => handleCancelPayment(payment.id)}
                        disabled={loading}
                        style={{ fontSize: '11px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Cancel process
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* Payment History */}
      <Reveal delay={80}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff', marginBottom: '14px' }}>Payment History</h2>
          {paidPayments.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '40px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
              No payments completed yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {paidPayments.map((payment) => (
                <div
                  key={payment.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)',
                    borderRadius: '16px', padding: '18px 22px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>{payment.fee_structures?.name}</span>
                      <span style={{ fontSize: '10px', color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '0.5px solid rgba(74,222,128,0.25)', borderRadius: '4px', padding: '2px 6px', fontWeight: 600 }}>PAID</span>
                    </div>
                    <p style={{ fontSize: '18px', fontWeight: 600, color: '#4ade80', margin: '0 0 4px 0' }}>{fmt(payment.amount)}</p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                      Period: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{payment.period_label}</span>
                      {payment.paid_at && <span> · Paid on {new Date(payment.paid_at).toLocaleDateString('en-IN')}</span>}
                    </p>
                  </div>

                  <button
                    onClick={() => handleViewReceipt(payment.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.8)', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                  >
                    <FileText size={14} color="#60a5fa" />
                    View Receipt
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      {/* Receipt Modal */}
      {receiptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ background: '#0d0d18', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '28px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: 0 }}>Payment Receipt</h3>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', margin: '4px 0 0 0' }}>
                  {receiptModal.receipt_number}
                </p>
              </div>
              <button
                onClick={() => setReceiptModal(null)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', width: '28px', height: '28px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Student</span>
                <span style={{ color: '#ffffff', fontWeight: 500 }}>{receiptModal.students?.profiles?.full_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Roll No.</span>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{receiptModal.students?.roll_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Fee Plan</span>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{receiptModal.fee_structures?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Period</span>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{receiptModal.period_label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Method</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize' }}>{receiptModal.payment_method}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Paid On</span>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{new Date(receiptModal.paid_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '14px', borderTop: '0.5px solid rgba(255,255,255,0.1)', marginTop: '4px' }}>
                <span style={{ color: '#ffffff', fontWeight: 500 }}>Amount Paid</span>
                <span style={{ fontSize: '20px', fontWeight: 600, color: '#4ade80' }}>{fmt(receiptModal.amount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
