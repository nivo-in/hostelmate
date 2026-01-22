'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation'

// ─── Razorpay window type ────────────────────────────────

interface RazorpayInstance { 
  open(): void; 
  on(_event: string, _handler: (..._args: unknown[]) => void): void; 
}
interface RazorpayConstructor { new (_options: Record<string, unknown>): RazorpayInstance; }
type RazorpayWindow = Window & typeof globalThis & { Razorpay: RazorpayConstructor };

// ─── Types ───────────────────────────────────────────────

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

interface ParentProfile { full_name: string; email: string; }

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

const statusBadge = (status: string, isOverdue: boolean) => {
  const base = 'text-xs px-2.5 py-1 rounded-full font-medium';
  if (isOverdue) return <span className={`${base} bg-red-100 text-red-700`}>OVERDUE</span>;
  switch (status) {
    case 'paid':       return <span className={`${base} bg-green-50 text-green-700`}>Paid</span>;
    case 'pending':    return <span className={`${base} bg-yellow-50 text-yellow-700`}>Pending</span>;
    case 'processing': return <span className={`${base} bg-blue-50 text-blue-700`}>Processing</span>;
    default:           return <span className={`${base} bg-gray-100 text-gray-600`}>{status}</span>;
  }
};

const typeBadge = (type: string) => {
  const base = 'text-xs px-2.5 py-1 rounded-full font-medium';
  switch (type) {
    case 'combined': return <span className={`${base} bg-indigo-50 text-indigo-700`}>Hostel + Mess</span>;
    case 'hostel':   return <span className={`${base} bg-orange-50 text-orange-700`}>Hostel</span>;
    case 'mess':     return <span className={`${base} bg-teal-50 text-teal-700`}>Mess</span>;
    default:         return <span className={`${base} bg-gray-100 text-gray-600`}>{type}</span>;
  }
};

export default function ParentPaymentsPage() {
  const router = useRouter()
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
      const res = await apiGet('/api/payments/my');
      if (res.success) setPaymentsData(res.data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }, [apiGet]);

  useEffect(() => {
    fetchPayments();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase.from('profiles').select('full_name, email')
          .eq('id', session.user.id).single()
          .then(({ data }) => { if (data) setParentProfile(data); });
      }
    });
  }, []);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const handlePay = async (payment: FeePayment) => {
    setError('');
    setLoading(true);
    try {
      const orderRes = await apiPost('/api/payments/create-order', { fee_payment_id: payment.id });
      if (!orderRes.success) throw new Error(orderRes.error || 'Failed to create order');
      const orderData = orderRes.data;
      const studentName = paymentsData?.student_name || 'Ward';

      const options = {
        key: orderData.key_id,
        amount: orderData.amount * 100,
        currency: 'INR',
        name: 'HostelMate by Nivo',
        description: payment.fee_structures?.name || 'Fee Payment',
        order_id: orderData.order_id,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const result = await apiPost('/api/payments/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            fee_payment_id: payment.id,
          });
          if (result.success) {
            setSuccess(`Payment made successfully for ${studentName}! Receipt: ${result.receipt_number}`);
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
              await apiPost('/api/payments/cancel', { fee_payment_id: payment.id });
            } finally {
              fetchPayments();
            }
          }
        },
      };
      const rzp = new (window as RazorpayWindow).Razorpay(options);
      rzp.on('payment.failed', async (response: unknown) => {
        const errResponse = response as { error: { description: string } };
        setError(`Payment failed: ${errResponse.error.description}`);
        try {
          await apiPost('/api/payments/cancel', { fee_payment_id: payment.id });
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
      await apiPost('/api/payments/cancel', { fee_payment_id: paymentId });
      fetchPayments();
    } catch (e) {
      setError((e as Error).message || 'Failed to cancel payment');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReceipt = async (paymentId: string) => {
    try {
      const res = await apiGet(`/api/payments/receipt/${paymentId}`);
      if (res.success) setReceiptModal(res.data);
    } catch (e) { setError((e as Error).message); }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const totals = paymentsData?.totals;

  const pendingPayments = paymentsData?.payments.pending || [];
  const paidPayments = paymentsData?.payments.paid || [];
  const studentName = paymentsData?.student_name || 'Ward';

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <PageHeader title="Fee Payments" showBack onSignOut={handleSignOut} />

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex justify-between">
          {error} <button onClick={() => setError('')}>✕</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">{success}</div>
      )}

      {/* Ward label */}
      <div className="mb-6">
        <p className="text-xs text-gray-400">Fee status for</p>
        <p className="text-lg font-medium text-gray-900">{studentName}</p>
      </div>

      {/* SECTION 1 — Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
          <p className="text-xs text-gray-400 mb-1">Total Paid</p>
          <p className="text-2xl font-medium text-green-600">{fmt(totals?.total_paid ?? 0)}</p>
        </div>
        <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
          <p className="text-xs text-gray-400 mb-1">Total Pending</p>
          <p className={`text-2xl font-medium ${(totals?.total_pending ?? 0) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
            {fmt(totals?.total_pending ?? 0)}
          </p>
        </div>
        <div className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
          <p className="text-xs text-gray-400 mb-1">Next Due</p>
          <p className="text-2xl font-medium text-yellow-600">
            {totals?.next_due ? new Date(totals.next_due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
          </p>
        </div>
      </div>

      {/* SECTION 2 — Pending / Pay on behalf */}
      {pendingPayments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-900 mb-4">
            Pending Payments
            <span className="ml-2 text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium">{pendingPayments.length} due</span>
          </h2>
          <div className="space-y-3">
            {pendingPayments.map(payment => (
              <div key={payment.id} className={`border rounded-xl p-6 transition-colors ${payment.is_overdue ? 'border-red-200 bg-red-50' : 'border-gray-100 hover:border-gray-300'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-sm font-medium text-gray-900">{payment.fee_structures?.name}</span>
                      {typeBadge(payment.fee_structures?.fee_type)}
                      {statusBadge(payment.status, payment.is_overdue)}
                    </div>
                    <p className="text-xl font-medium text-gray-900 mb-1">{fmt(payment.amount)}</p>
                    <p className="text-xs text-gray-500">Period: <span className="font-medium">{payment.period_label}</span></p>
                    <p className="text-xs text-gray-400">Due: {new Date(payment.due_date).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => handlePay(payment)}
                      disabled={loading}
                      className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      Pay on behalf {fmt(payment.amount)}
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3 — Payment History */}
      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-4">Payment History</h2>
        {paidPayments.length === 0 ? (
          <div className="border border-gray-100 rounded-xl p-12 text-center">
            <p className="text-gray-400 text-sm">No payments made yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paidPayments.map(payment => (
              <div key={payment.id} className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-sm font-medium text-gray-900">{payment.fee_structures?.name}</span>
                      {typeBadge(payment.fee_structures?.fee_type)}
                      {statusBadge(payment.status, false)}
                    </div>
                    <p className="text-xl font-medium text-gray-900 mb-1">{fmt(payment.amount)}</p>
                    <p className="text-xs text-gray-500">Period: <span className="font-medium">{payment.period_label}</span></p>
                    <div className="flex gap-4 text-xs text-gray-400 mt-1">
                      {payment.paid_at && <span>Paid: {new Date(payment.paid_at).toLocaleDateString('en-IN')}</span>}
                    </div>
                    {payment.receipt_number && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">{payment.receipt_number}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleViewReceipt(payment.id)}
                    className="border border-gray-200 text-gray-600 rounded-lg px-4 py-2.5 text-sm hover:border-gray-400 transition-colors whitespace-nowrap"
                  >
                    View Receipt
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Payment Receipt</h3>
                <p className="text-xs text-gray-400 font-mono mt-1">{receiptModal.receipt_number}</p>
              </div>
              <button onClick={() => setReceiptModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Student</span>
                <span className="text-gray-900 font-medium">{receiptModal.students?.profiles?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Roll No.</span>
                <span className="text-gray-900">{receiptModal.students?.roll_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fee Plan</span>
                <span className="text-gray-900">{receiptModal.fee_structures?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Period</span>
                <span className="text-gray-900">{receiptModal.period_label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Method</span>
                <span className="text-gray-900 capitalize">{receiptModal.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Paid on</span>
                <span className="text-gray-900">{new Date(receiptModal.paid_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-100">
                <span className="text-gray-900 font-medium">Amount Paid</span>
                <span className="text-xl font-medium text-gray-900">{fmt(receiptModal.amount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
