'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTenant } from '../../../providers/TenantContext';
import { api } from '@/lib/api';
import {
  CreditCard,
  CheckCircle,
  Download,
  AlertTriangle,
  RefreshCw,
  Check,
  Receipt,
  Clock,
  Shield,
  Zap,
  ChevronRight,
  Banknote,
  Sparkles,
} from 'lucide-react';

// ─── Pricing Configuration (Updated to ₹1 for 6 months & ₹2 for 12 months) ────
const PLAN_PRICING: Record<string, Record<number, number>> = {
  BASIC: { 6: 1, 12: 2 }
};

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function SubscriptionPage() {
  const { subscription, refresh, schoolName } = useTenant();

  const [loading, setLoading] = useState(true);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [billingMonths, setBillingMonths] = useState<6 | 12>(12);

  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{ transactionId: string; message: string } | null>(null);
  const [paymentError, setPaymentError] = useState('');

  const [payments, setPayments] = useState<any[]>([]);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  const basePrice = PLAN_PRICING.BASIC[billingMonths] ?? 2;

  // Fetch Payment History
  const fetchSubscriptionHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/subscription/history');
      if (Array.isArray(res.data)) {
        setPayments(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionHistory();
  }, [subscription?.status]);

  const openCheckoutWithMonths = (months: 6 | 12) => {
    setBillingMonths(months);
    setPaymentError('');
    setPaymentSuccess(null);
    setShowCheckoutModal(true);
  };

  // PDF Download Handler
  const handleDownloadInvoicePDF = async (inv: any) => {
    try {
      setDownloadingPdfId(inv.id);

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const amount = Number(inv.amount || (inv.duration?.includes('12') ? 2 : 1));
      const invNumber = inv.id ? `INV-SUB-${inv.id.slice(-6).toUpperCase()}` : 'INV-SUB-001';

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '800px';
      container.style.backgroundColor = '#ffffff';
      container.style.color = '#1e293b';
      container.style.fontFamily = 'Inter, system-ui, sans-serif';
      container.style.padding = '40px';

      container.innerHTML = `
        <div style="border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          <div style="background-color: #0f172a; color: #ffffff; padding: 32px; border-bottom: 5px solid #2563eb; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; color: #ffffff;">EduTrack SaaS Platform</h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; font-weight: 600;">Official Subscription Tax Receipt</p>
            </div>
            <div style="text-align: right;">
              <div style="background-color: #059669; color: #ffffff; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; display: inline-block; text-transform: uppercase;">${inv.status || 'SUCCESS'}</div>
              <div style="font-size: 11px; color: #cbd5e1; margin-top: 6px; font-family: monospace;">Date: ${new Date(inv.paidDate || inv.createdAt || Date.now()).toLocaleDateString('en-IN')}</div>
            </div>
          </div>
          <div style="padding: 32px;">
            <table style="width: 100%; font-size: 13px; margin-bottom: 24px; border-collapse: collapse; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
              <tbody>
                <tr>
                  <td style="padding: 6px 0;"><strong>Receipt No:</strong> <span style="font-family: monospace; font-weight: 700; color: #0f172a;">${invNumber}</span></td>
                  <td style="padding: 6px 0; text-align: right;"><strong>Payment Method:</strong> <span style="font-weight: 700; color: #0f172a;">Razorpay Subscription</span></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;"><strong>School Tenant:</strong> <span style="font-weight: 700; color: #0f172a;">${schoolName || 'School Admin'}</span></td>
                  <td style="padding: 6px 0; text-align: right;"><strong>Currency:</strong> <span style="font-weight: 700; color: #0f172a;">INR (₹)</span></td>
                </tr>
              </tbody>
            </table>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <thead>
                <tr style="background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
                  <th style="padding: 12px 16px; text-align: left;">Plan Description</th>
                  <th style="padding: 12px 16px; text-align: center;">Billing Cycle</th>
                  <th style="padding: 12px 16px; text-align: right;">Total Amount</th>
                </tr>
              </thead>
              <tbody style="font-size: 13px;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 16px; font-weight: 700; color: #0f172a;">${inv.planName || 'EduTrack Basic Plan'}</td>
                  <td style="padding: 16px; text-align: center; color: #475569;">${inv.duration || '12 Months'}</td>
                  <td style="padding: 16px; text-align: right; font-weight: 800; color: #059669; font-family: monospace;">₹${amount.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; color: #64748b; font-weight: 500; max-width: 400px; line-height: 1.4;">
              Computer generated tax invoice issued by EduTrack SaaS Platforms. No physical signature is required.
            </div>
            <div style="background-color: #0f172a; color: #ffffff; border-radius: 10px; padding: 14px 24px; text-align: right;">
              <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Grand Total Paid</div>
              <div style="font-size: 20px; font-weight: 900; font-family: monospace; color: #34d399;">₹${amount.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);
      await new Promise((resolve) => setTimeout(resolve, 250));

      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${invNumber}.pdf`);
    } catch (err: any) {
      console.error('PDF download error:', err);
      alert('Failed to generate PDF invoice download.');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  // Razorpay SaaS Subscription Payment Handler
  const handleProceedToPayment = async () => {
    setPaymentError('');
    setPaymentProcessing(true);

    const planCode = billingMonths === 6 ? 'BASIC_6_MONTH' : 'BASIC_12_MONTH';

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setPaymentError('Could not load Razorpay SDK. Please check internet connection.');
        setPaymentProcessing(false);
        return;
      }

      // 1. Create order on backend with server-side price enforcement
      const orderRes = await api.post('/subscription/create-order', { planCode });
      const orderData = orderRes.data;

      if (!orderData || !orderData.orderId) {
        throw new Error('Failed to generate subscription order.');
      }

      // 2. Open Razorpay Checkout modal
      const options = {
        key: orderData.keyId || 'rzp_test_TRzAGmaPvw7hNM',
        amount: orderData.amountInPaise,
        currency: orderData.currency || 'INR',
        order_id: orderData.orderId,
        name: 'EduTrack SaaS Platform',
        description: `${orderData.planName || 'EduTrack Basic Plan'} (${billingMonths} Months)`,
        handler: async (response: any) => {
          try {
            // 3. Verify signature server-side
            const verifyRes = await api.post('/subscription/verify', {
              razorpayOrderId: response.razorpay_order_id || orderData.orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              planCode,
            });

            setPaymentSuccess({
              transactionId: response.razorpay_payment_id || 'pay_success',
              message: verifyRes.data?.message || 'Subscription activated successfully!',
            });
            setShowCheckoutModal(false);
            await refresh();
            await fetchSubscriptionHistory();
          } catch (err: any) {
            setPaymentError(err.response?.data?.message || 'Payment verification failed.');
          } finally {
            setPaymentProcessing(false);
          }
        },
        prefill: {
          name: schoolName || 'School Admin',
        },
        theme: { color: '#2563EB' },
        modal: {
          ondismiss: () => {
            setPaymentProcessing(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error('Subscription checkout error:', err);
      setPaymentError(err.response?.data?.message || err.message || 'Failed to initiate payment.');
      setPaymentProcessing(false);
    }
  };

  const currentStatus = subscription?.status || 'ACTIVE';
  const isExpired = currentStatus === 'EXPIRED' || currentStatus === 'SUSPENDED';
  const expiryDate = subscription?.expiryDate ? new Date(subscription.expiryDate) : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* ── Top Banner ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight">Subscription & Billing Console</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isExpired ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              {currentStatus}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Real-time Razorpay checkout, automated invoicing, and instant approval workflows.</p>
        </div>

        <button
          onClick={() => openCheckoutWithMonths(12)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Renew / Upgrade Subscription</span>
        </button>
      </div>

      {paymentSuccess && (
        <div className="p-6 bg-emerald-950/70 border border-emerald-800/80 rounded-3xl flex items-start gap-4 text-emerald-200 shadow-xl">
          <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-emerald-300">✓ Subscription Active</h3>
            <p className="text-xs text-emerald-200/90 mt-1 leading-relaxed">{paymentSuccess.message}</p>
            <p className="text-[11px] font-mono text-emerald-400 mt-2">Payment ID: {paymentSuccess.transactionId}</p>
          </div>
        </div>
      )}

      {/* ── Status Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Current Plan', value: subscription?.plan || 'BASIC', sub: 'Standard tier' },
          { label: 'Expiry Date', value: expiryDate.toLocaleDateString('en-IN'), sub: `${daysRemaining} days remaining` },
          { label: 'Billing Cycle', value: (subscription as any)?.billingCycle || (billingMonths === 6 ? '6 Months' : '12 Months'), sub: 'Auto-renewal enabled' },
          { label: 'Grace Period', value: 'Active', sub: '14-day grace window', green: true },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{card.label}</span>
            <div className={`text-xl font-black mt-2 ${card.green ? 'text-emerald-600' : 'text-slate-900'}`}>{card.value}</div>
            <span className="text-xs text-slate-500 mt-1 block">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* ── SIDE-BY-SIDE BASIC PLAN CARDS ───────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Available Subscription Plans</h2>
          <p className="text-xs text-slate-500 mt-0.5">Select a billing duration to proceed with secure Razorpay checkout.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── CARD 1: 6 MONTHS ──────────────────────────────────────────────── */}
          <div
            onClick={() => setBillingMonths(6)}
            className={`bg-white border-2 rounded-3xl p-6 transition-all duration-200 flex flex-col justify-between cursor-pointer relative overflow-hidden ${
              billingMonths === 6
                ? 'border-blue-600 shadow-2xl bg-gradient-to-b from-blue-50/50 to-white ring-2 ring-blue-600/20'
                : 'border-slate-200 hover:border-blue-300 shadow-md hover:shadow-lg'
            }`}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${billingMonths === 6 ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-100 px-2.5 py-0.5 rounded-full">Half-Yearly</span>
                    <h3 className="text-lg font-black text-slate-900 mt-0.5">BASIC PLAN</h3>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${billingMonths === 6 ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                  {billingMonths === 6 && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Billing Duration: 6 Months</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-slate-900">₹1</span>
                  <span className="text-xs text-slate-400 font-medium">/ 6 months</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Includes all core school management modules</p>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Plan Features:</p>
                <ul className="space-y-2 text-xs text-slate-600">
                  {[
                    'Unlimited Students & Staff Profiles',
                    'Attendance, Fees & Timetable Management',
                    'Exams, Grading & Progress Reports',
                    'Parent Portal & In-App Notifications',
                    'Transport & Bus GPS Tracking',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                openCheckoutWithMonths(6);
              }}
              className="mt-6 w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-extrabold text-sm transition-all shadow-lg shadow-blue-600/30 cursor-pointer flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>Proceed to Payment (₹1)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* ── CARD 2: 12 MONTHS ─────────────────────────────────────────────── */}
          <div
            onClick={() => setBillingMonths(12)}
            className={`bg-white border-2 rounded-3xl p-6 transition-all duration-200 flex flex-col justify-between cursor-pointer relative overflow-hidden ${
              billingMonths === 12
                ? 'border-blue-600 shadow-2xl bg-gradient-to-b from-blue-50/50 to-white ring-2 ring-blue-600/20'
                : 'border-slate-200 hover:border-blue-300 shadow-md hover:shadow-lg'
            }`}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${billingMonths === 12 ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">Annual Plan</span>
                    <h3 className="text-lg font-black text-slate-900 mt-0.5">BASIC PLAN</h3>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${billingMonths === 12 ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                  {billingMonths === 12 && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Billing Duration: 12 Months</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-slate-900">₹2</span>
                  <span className="text-xs text-slate-400 font-medium">/ 12 months</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Best value annual plan for full academic year support</p>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Plan Features:</p>
                <ul className="space-y-2 text-xs text-slate-600">
                  {[
                    'Unlimited Students & Staff Profiles',
                    'Attendance, Fees & Timetable Management',
                    'Exams, Grading & Progress Reports',
                    'Parent Portal & In-App Notifications',
                    'Transport & Bus GPS Tracking',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                openCheckoutWithMonths(12);
              }}
              className="mt-6 w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-extrabold text-sm transition-all shadow-lg shadow-blue-600/30 cursor-pointer flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>Proceed to Payment (₹2)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Subscription Payment History ────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Banknote className="w-5 h-5 text-emerald-600" />
          Subscription Payment History
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <th className="p-3">Date</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Razorpay Payment ID</th>
                <th className="p-3">Order ID</th>
                <th className="p-3">Status</th>
                <th className="p-3">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {payments.length > 0 ? payments.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 text-slate-500">{p.paidDate ? new Date(p.paidDate).toLocaleDateString('en-IN') : (p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : '—')}</td>
                  <td className="p-3 font-semibold">{p.planName || 'EduTrack Basic'}</td>
                  <td className="p-3">{p.duration || '12 Months'}</td>
                  <td className="p-3 font-mono font-bold text-emerald-600">₹{Number(p.amount || (p.duration?.includes('12') ? 2 : 1)).toLocaleString('en-IN')}</td>
                  <td className="p-3 font-mono text-slate-600">{p.paymentId || p.id || '—'}</td>
                  <td className="p-3 font-mono text-slate-600">{p.orderId || '—'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      p.status === 'SUCCESS' || p.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>{p.status || 'SUCCESS'}</span>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoicePDF(p)}
                      disabled={downloadingPdfId === p.id}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold cursor-pointer transition-all disabled:opacity-50"
                    >
                      {downloadingPdfId === p.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Receipt PDF
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="p-5 text-center text-slate-400">No subscription payment records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Checkout Modal ──────────────────────────────────────────────────── */}
      {showCheckoutModal && (
        <div className="fixed inset-0 top-0 left-0 w-screen h-screen bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md space-y-5 text-white shadow-2xl my-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black">EduTrack Basic Plan ({billingMonths} Months)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Dedicated SaaS Subscription Gateway</p>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-white text-2xl leading-none cursor-pointer">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Selected Duration</label>
              <div className="grid grid-cols-2 gap-3">
                {([6, 12] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setBillingMonths(m)}
                    className={`border-2 rounded-2xl p-3 text-left cursor-pointer transition-all ${billingMonths === m ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-600'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${billingMonths === m ? 'border-blue-400' : 'border-slate-600'}`}>
                        {billingMonths === m && <div className="w-2 h-2 bg-blue-400 rounded-full" />}
                      </div>
                      <span className="text-xs font-bold text-slate-300">{m} Months</span>
                    </div>
                    <div className="text-lg font-black text-white mt-1">₹{PLAN_PRICING.BASIC[m]}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Plan Duration:</span>
                <span>{billingMonths} Months</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-bold text-white">
                <span>Total Amount Due:</span>
                <span className="text-emerald-400">₹{basePrice} INR</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
              <Shield className="w-4 h-4 text-blue-400 shrink-0" />
              <p className="text-[11px] text-slate-400">EduTrack SaaS Subscription Gateway (UPI, Cards, Net Banking)</p>
            </div>

            {paymentError && (
              <div className="bg-rose-950/60 border border-rose-700/50 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-300">{paymentError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-2xl font-bold text-xs cursor-pointer hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToPayment}
                disabled={paymentProcessing}
                className="flex-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl font-extrabold text-xs shadow-lg shadow-blue-600/30 cursor-pointer transition-all flex items-center gap-2"
              >
                {paymentProcessing ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  <><CreditCard className="w-4 h-4" /> Proceed to Payment (₹{basePrice})</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
