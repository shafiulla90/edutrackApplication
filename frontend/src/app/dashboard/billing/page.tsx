'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { dispatchSchoolSetupUpdated } from '@/lib/events';
import { useTenant } from '@/app/providers/TenantContext';
import { formatDateDDMMYYYY } from '@/lib/date';
import { 
  Receipt, Search, CreditCard, Sparkles, X, CheckCircle2, 
  QrCode, User, ArrowRight, CornerDownRight, RotateCcw,
  BookOpen, Calendar, Printer, ShieldCheck, AlertCircle
} from 'lucide-react';

interface StagedInvoice {
  id: string;
  name: string;
  rollNo: string;
  dateStr: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
}

interface InvoicePDFData {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolLogo: string;
  schoolSubtitle: string;
  invoiceNo: string;
  invoiceDate: string;
  academicYear: string;
  admissionRef: string;
  studentName: string;
  fatherName: string;
  motherName: string;
  parentPhone?: string | null;
  fatherPhone?: string | null;
  motherPhone?: string | null;
  className: string;
  sectionName: string;
  studentDob: string;
  addressVillage: string;
  totalAmount: number;
  items: { particulars: string; amount: number }[];
}

const fmt = (val: any) => {
  if (val === null || val === undefined || isNaN(Number(val))) return '0';
  return Number(val).toLocaleString('en-IN');
};

const normalizePhoneNumber = (rawPhone?: string): string | null => {
  if (!rawPhone || rawPhone === 'N/A') return null;
  let cleaned = String(rawPhone).replace(/[\s\+\-\(\)\.]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = `91${cleaned}`;
  }
  if (/^\d{11,15}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
};

export default function FeesBillingPage() {
  const { setupStats, currentUser } = useTenant();
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [academicYears, setAcademicYears] = useState<{ label: string; value: string }[]>([]);

  // Fee particulars checklist states
  const [feeItems, setFeeItems] = useState<any[]>([]);

  // Payment Channels
  const paymentChannels = [
    { value: 'RAZORPAY', label: 'Razorpay Online', icon: '⚡' },
    { value: 'GPAY_UPI', label: 'GPay UPI', icon: '📱' },
    { value: 'PHONEPE_UPI', label: 'PhonePe UPI', icon: '📱' },
    { value: 'CASH', label: 'Physical Cash', icon: '💵' },
    { value: 'NET_BANKING', label: 'Net Banking', icon: '🏦' }
  ];
  const [selectedChannel, setSelectedChannel] = useState('GPAY_UPI');

  // Net Banking Form
  const [bankName, setBankName] = useState('HDFC Bank');
  const [ifscCode, setIfscCode] = useState('HDFC0000120');
  const [accountNo, setAccountNo] = useState('50100239485729');

  // History logs
  const [transactions, setTransactions] = useState<StagedInvoice[]>([]);
  const [matchingStudents, setMatchingStudents] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successInvoiceId, setSuccessInvoiceId] = useState<string | null>(null);
  const [lastPaidStudentName, setLastPaidStudentName] = useState('');
  const [lastPaidParentPhone, setLastPaidParentPhone] = useState<string | null>(null);
  const [lastPaidAmount, setLastPaidAmount] = useState(0);

  // Payment Confirmation states
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [successRemainingBalance, setSuccessRemainingBalance] = useState(0);
  const [successPaymentDate, setSuccessPaymentDate] = useState('');

  // Load initial options & recent invoices
  useEffect(() => {
    const fetchInit = async () => {
      try {
        const [yRes, txRes] = await Promise.all([
          api.get('/billing/options/years'),
          api.get('/billing/invoices/recent')
        ]);
        setAcademicYears(yRes.data);
        if (yRes.data.length > 0) {
          setSelectedYear(yRes.data[0].value);
        }
        setTransactions(txRes.data);
      } catch (err) {
        console.error('Failed to fetch initial billing data', err);
      }
    };
    fetchInit();
  }, []);

  // Search students
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (search.trim().length >= 2) {
        try {
          let res;
          try {
            res = await api.get(`/billing/students/search`, {
              params: { searchTerm: search }
            });
          } catch (err: any) {
            if (err.response?.status === 404) {
              res = await api.get(`/billing/search`, {
                params: { searchTerm: search }
              });
            } else {
              throw err;
            }
          }
          setMatchingStudents(res.data || []);
        } catch (err) {
          console.error('Error searching students', err);
        }
      } else {
        setMatchingStudents([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [search]);

  const loadUnpaidFees = async (oppId: string) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/billing/unpaid-fees/${oppId}`);
      setFeeItems(res.data.map((item: any) => ({
        id: item.oliId,
        name: item.productName,
        total: item.totalAmount,
        discount: item.discountAmount,
        paid: item.paidAmount,
        balance: item.balanceDue,
        input: item.balanceDue,
        isSelected: item.balanceDue > 0,
        productId: item.productId,
        discountPercent: item.discountPercent
      })));
    } catch (err) {
      console.error('Failed to load unpaid fees', err);
    } finally {
      setIsLoading(false);
    }
  };

  const [loadedBillingKey, setLoadedBillingKey] = useState('');

  const handleSelectStudent = async (student: any) => {
    try {
      setIsLoading(true);
      const studentId = student?.account?.id || student?.id || student?.studentId;
      const res = await api.get(`/billing/students/${studentId}`);
      const openOpp = res.data?.account?.opportunities?.[0] || { id: studentId, academicYearId: 'ay-2026' };
      
      const key = `${studentId}-${openOpp?.academicYearId || ''}`;
      setLoadedBillingKey(key);
      
      setSelectedStudent(res.data);
      setSearch('');
      setMatchingStudents([]);
      
      if (openOpp) {
        setSelectedYear(openOpp.academicYearId);
        await loadUnpaidFees(openOpp.id);
      } else {
        setFeeItems([]);
      }
    } catch (err) {
      console.error('Failed to select student billing profile', err);
      // Fallback
      setSelectedStudent(student);
      setSearch('');
      setMatchingStudents([]);
      await loadUnpaidFees(student.id || 'std-1');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStudent && selectedYear) {
      const key = `${selectedStudent.account.id}-${selectedYear}`;
      if (loadedBillingKey === key) return;

      const reloadBillingData = async () => {
        try {
          setIsLoading(true);
          const res = await api.get(`/billing/students/${selectedStudent.account.id}`, {
            params: { academicYearId: selectedYear }
          });
          setSelectedStudent(res.data);
          setLoadedBillingKey(key);
          
          const openOpp = res.data.account.opportunities?.[0];
          if (openOpp) {
            await loadUnpaidFees(openOpp.id);
          } else {
            setFeeItems([]);
          }
        } catch (err) {
          console.error('Failed to reload billing data', err);
        } finally {
          setIsLoading(false);
        }
      };
      reloadBillingData();
    }
  }, [selectedYear, selectedStudent]);

  const handleCheckboxToggle = (id: string) => {
    setFeeItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextState = !item.isSelected;
        return {
          ...item,
          isSelected: nextState,
          input: nextState ? item.balance : 0
        };
      }
      return item;
    }));
  };

  const handleSelectAllToggle = () => {
    const allUnpaidSelected = feeItems.filter(f => f.balance > 0).every(f => f.isSelected);
    setFeeItems(prev => prev.map(item => {
      if (item.balance <= 0) return item;
      return { ...item, isSelected: !allUnpaidSelected, input: !allUnpaidSelected ? item.balance : 0 };
    }));
  };

  const unpaidItems = feeItems.filter(f => f.balance > 0);
  const isAllSelected = unpaidItems.length > 0 && unpaidItems.every(f => f.isSelected);

  const handleInputChange = (id: string, val: number) => {
    setFeeItems(prev => prev.map(item => {
      if (item.id === id) {
        const clampedVal = Math.min(item.balance, Math.max(0, val));
        return {
          ...item,
          input: clampedVal,
          isSelected: clampedVal > 0
        };
      }
      return item;
    }));
  };

  // Calculation total
  const billingTotal = feeItems.reduce((sum, item) => {
    return sum + (item.isSelected ? item.input : 0);
  }, 0);

  const handleOpenConfirmModal = () => {
    if (!selectedStudent) return;

    // 1. Ensure at least one fee product is selected
    const selectedItemsCount = feeItems.filter(item => item.isSelected).length;
    if (selectedItemsCount === 0) {
      alert('Error: Please select at least one fee product before processing payment.');
      return;
    }

    // 2. Ensure the payment amount is greater than zero
    if (billingTotal <= 0) {
      alert('Error: Payment amount must be greater than zero.');
      return;
    }

    // 3. Ensure payment amount does not exceed the outstanding balance
    const pendingBal = Number(selectedStudent.totalPendingBalance ?? selectedStudent.outstandingAmount ?? selectedStudent.totalDue ?? 0);
    if (billingTotal > pendingBal && pendingBal > 0) {
      alert(`Error: Payment amount (₹${fmt(billingTotal)}) cannot exceed the outstanding balance (₹${fmt(pendingBal)}).`);
      return;
    }

    // 4. Validate payment method selection
    const isValidMethod = paymentChannels.some(c => c.value === selectedChannel);
    if (!isValidMethod) {
      alert('Error: Please select a valid payment method.');
      return;
    }

    setConfirmModalOpen(true);
  };

  const loadRazorpayScript = (): Promise<boolean> => {
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
  };

  const handleFinalizePayment = async () => {
    if (!selectedStudent || billingTotal <= 0 || isSubmittingPayment) return;

    const studentId = selectedStudent.account?.id || selectedStudent.id || selectedStudent.studentId || 'student-active';
    const openOppId = selectedStudent.account?.opportunities?.[0]?.id || studentId;

    const itemsToPay = feeItems
      .filter(item => item.isSelected && item.input > 0)
      .map(item => ({
        oliId: item.id || item.oliId || `oli-${item.productId}`,
        productId: item.productId,
        amount: item.input
      }));

    // Handle Real-Time Razorpay Gateway Payment
    if (selectedChannel === 'RAZORPAY') {
      try {
        setIsSubmittingPayment(true);
        setIsLoading(true);

        const loaded = await loadRazorpayScript();
        if (!loaded) {
          alert('Razorpay SDK failed to load. Please check your internet connection.');
          setIsSubmittingPayment(false);
          setIsLoading(false);
          return;
        }

        // 1. Create Razorpay order on backend
        const orderRes = await api.post('/payments/razorpay/create-order', {
          studentId: studentId,
          invoiceId: openOppId,
          itemAmounts: itemsToPay,
          requestedAmount: billingTotal,
        });

        const orderData = orderRes.data;
        if (!orderData || !orderData.orderId) {
          throw new Error('Failed to generate Razorpay order from server.');
        }

        // 2. Open Razorpay Checkout modal
        const options = {
          key: orderData.keyId,
          amount: orderData.amountInPaise,
          currency: orderData.currency || 'INR',
          name: orderData.schoolName || 'EduTrack SaaS School',
          description: `Fee Payment - ${orderData.invoiceNumber || openOppId}`,
          order_id: orderData.orderId,
          handler: async function (response: any) {
            setIsLoading(true);
            try {
              // 3. Cryptographic Signature Verification on Backend
              const verifyRes = await api.post('/payments/razorpay/verify', {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                invoiceId: openOppId,
                studentId: studentId,
                transactionId: orderData.transactionId,
              });

              const currentPending = Number(selectedStudent.totalPendingBalance ?? selectedStudent.outstandingAmount ?? 0);
              const nextBalance = Math.max(0, currentPending - billingTotal);
              const studentName = selectedStudent.account?.name || selectedStudent.name || 'Student';

              setLastPaidStudentName(studentName);
              setLastPaidAmount(billingTotal);
              setSuccessInvoiceId(verifyRes.data?.paymentReceiptId || String(openOppId));
              setSuccessRemainingBalance(nextBalance);
              setSuccessPaymentDate(new Date().toLocaleString('en-IN'));

              setConfirmModalOpen(false);
              setSuccessModalOpen(true);

              setToastMessage(`✓ Razorpay Payment Verified: ₹${fmt(billingTotal)} captured for ${studentName}.`);
              dispatchSchoolSetupUpdated();

              setSelectedStudent(null);
              setFeeItems([]);
              setNotes('');

              const txRes = await api.get('/billing/invoices/recent');
              if (txRes.data) setTransactions(txRes.data);
            } catch (vErr: any) {
              console.error('Razorpay signature verification failed:', vErr);
              alert(vErr.response?.data?.message || 'Payment signature verification failed.');
            } finally {
              setIsSubmittingPayment(false);
              setIsLoading(false);
            }
          },
          prefill: {
            name: selectedStudent.name || 'Student',
            email: selectedStudent.email || '',
            contact: selectedStudent.phone || '',
          },
          theme: { color: '#2E5BFF' },
          modal: {
            ondismiss: function () {
              setIsSubmittingPayment(false);
              setIsLoading(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } catch (err: any) {
        console.error('Razorpay checkout error:', err);
        alert(err.response?.data?.message || err.message || 'Failed to initialize Razorpay checkout.');
        setIsSubmittingPayment(false);
        setIsLoading(false);
      }
      return;
    }

    // Manual Collection Channel Flow (Cash, GPay UPI, PhonePe UPI, Net Banking)
    try {
      setIsSubmittingPayment(true);
      setIsLoading(true);
      const res = await api.post('/billing/invoices', {
        opportunityId: openOppId,
        studentId: studentId,
        items: itemsToPay,
        paymentMethod: selectedChannel,
        bankDetails: selectedChannel === 'NET_BANKING' ? {
          bankName,
          bankIfsc: ifscCode,
          bankAccountNumber: accountNo,
          bankBranch: 'Main Branch'
        } : null
      });

      const createdInvoiceId = typeof res.data === 'string' ? res.data : (res.data?.id || `INV-${Date.now().toString().slice(-6)}`);
      const currentPending = Number(selectedStudent.totalPendingBalance ?? selectedStudent.outstandingAmount ?? 0);
      const nextBalance = Math.max(0, currentPending - billingTotal);
      const studentName = selectedStudent.account?.name || selectedStudent.name || 'Student';
      const pPhone = selectedStudent?.parentPhone || selectedStudent?.fatherPhone || selectedStudent?.motherPhone || selectedStudent?.account?.parentPhone || selectedStudent?.account?.fatherPhone || selectedStudent?.account?.motherPhone || selectedStudent?.account?.phone || selectedStudent?.phone || null;
      
      setLastPaidStudentName(studentName);
      setLastPaidParentPhone(pPhone);
      setLastPaidAmount(billingTotal);
      setSuccessInvoiceId(String(createdInvoiceId));
      setSuccessRemainingBalance(nextBalance);
      setSuccessPaymentDate(new Date().toLocaleString('en-IN'));
      
      setConfirmModalOpen(false);
      setSuccessModalOpen(true);

      setToastMessage(`Success: Payment of ₹${fmt(billingTotal)} logged for ${studentName}.`);
      
      // Dispatch event to refresh dashboard in real-time
      dispatchSchoolSetupUpdated();

      // Clear select & reload history
      setSelectedStudent(null);
      setFeeItems([]);
      setNotes('');
      
      const txRes = await api.get('/billing/invoices/recent');
      if (txRes.data) setTransactions(txRes.data);

      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Payment submitting failed:', err);
      setErrorMessage(err.response?.data?.message || 'Payment recording failed. Please try again.');
      setErrorModalOpen(true);
    } finally {
      setIsSubmittingPayment(false);
      setIsLoading(false);
    }
  };

  const generateInvoicePDFFile = async (invoiceId: string): Promise<{ file: File; pdfData: InvoicePDFData; pdfBlob: Blob }> => {
    const res = await api.get(`/billing/invoices/${invoiceId}/pdf`);
    const data: InvoicePDFData = res.data;

    if (data.schoolLogo) {
      await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = resolve;
        img.onerror = resolve;
        img.src = data.schoolLogo;
      });
    }

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '800px';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#2d3748';
    container.style.fontFamily = 'sans-serif';
    container.style.padding = '40px';
    
    container.innerHTML = `
      <div style="border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background-color: #1a365d; color: #ffffff; padding: 30px; border-bottom: 6px solid #ed8936; display: flex; align-items: center; gap: 20px;">
          <div style="width: 80px; height: 80px; background-color: #ffffff; border-radius: 50%; padding: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; shrink: 0;">
            ${data.schoolLogo ? `<img src="${data.schoolLogo}" style="width: 100%; height: 100%; object-fit: contain;" />` : `
              <svg style="width: 50px; height: 50px; stroke: #1a365d; stroke-width: 2; fill: none;" viewBox="0 0 24 24">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
              </svg>
            `}
          </div>
          <div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">${data.schoolName}</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #cbd5e1; font-style: italic; font-weight: 600;">${data.schoolSubtitle}</p>
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 40px; min-height: 400px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #1a365d;">Fee Receipt</h2>
          </div>

          <!-- Metadata Table -->
          <table style="width: 100%; font-size: 13px; margin-bottom: 25px; border-collapse: collapse; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px;">
            <tbody>
              <tr>
                <td style="padding: 6px 0;"><strong>Receipt No:</strong> <span style="font-family: monospace; font-weight: bold; color: #1e293b;">${data.invoiceNo}</span></td>
                <td style="padding: 6px 0; text-align: right;"><strong>Academic Year:</strong> <span style="font-weight: bold; color: #1e293b;">${data.academicYear}</span></td>
              </tr>
              <tr>
                <td style="padding: 6px 0;"><strong>Receipt Date:</strong> <span style="color: #1e293b;">${data.invoiceDate}</span></td>
                <td style="padding: 6px 0; text-align: right;"><strong>Admission Ref:</strong> <span style="font-family: monospace; color: #1e293b;">${data.admissionRef}</span></td>
              </tr>
            </tbody>
          </table>

          <!-- Student Card -->
          <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-left: 5px solid #1a365d; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="width: 35%; vertical-align: top;">
                    <div style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Student Name</div>
                    <div style="font-size: 15px; color: #1a365d; font-weight: bold; margin-top: 2px;">${data.studentName}</div>
                    
                    <div style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase; margin-top: 15px;">Parent Details</div>
                    <div style="color: #4b5563; margin-top: 4px; line-height: 1.5;">
                      Father: <span style="font-weight: 600; color: #1f2937;">${data.fatherName}</span><br/>
                      Mother: <span style="font-weight: 600; color: #1f2937;">${data.motherName}</span>
                    </div>
                  </td>
                  <td style="width: 30%; vertical-align: top; padding: 0 15px;">
                    <div style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Class & Section</div>
                    <div style="font-size: 14px; color: #1a365d; font-weight: bold; margin-top: 2px;">${data.className} - ${data.sectionName}</div>
                    
                    <div style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase; margin-top: 15px;">Date of Birth</div>
                    <div style="font-size: 13px; color: #1f2937; font-weight: 500; margin-top: 2px;">${data.studentDob || '15 May 2012'}</div>
                  </td>
                  <td style="width: 35%; vertical-align: top;">
                    <div style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Mailing Address</div>
                    <div style="font-weight: 600; line-height: 1.5; margin-top: 4px; font-size: 12px; color: #1f2937;">
                      ${data.addressVillage || 'Plot No. 12, Vikas Nagar,'}<br/>
                      New Delhi - 110009,<br/>
                      Delhi, India.
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Particulars Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background-color: #ebf8ff; color: #1a365d; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 12px 16px; text-align: left; width: 15%;">Sl. No</th>
                <th style="padding: 12px 16px; text-align: left; width: 55%;">Particulars Description</th>
                <th style="padding: 12px 16px; text-align: right; width: 30%;">Amount Paid</th>
              </tr>
            </thead>
            <tbody style="font-size: 13px;">
              ${data.items.map((item, index) => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 14px 16px; color: #64748b; font-weight: 500;">${index + 1}</td>
                  <td style="padding: 14px 16px; font-weight: 600; color: #1e293b;">${item.particulars}</td>
                  <td style="padding: 14px 16px; text-align: right; font-weight: bold; color: ${item.amount < 0 ? '#059669' : '#1e293b'};">
                    ${item.amount < 0 ? '-' : ''}₹${Math.abs(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Footer Grand Total -->
        <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 600; line-height: 1.5; max-width: 350px;">
            This is a computer generated fee receipt. No physical signature is required. For verification query, contact the accounting department.
          </div>
          <div style="background-color: #1a365d; color: #ffffff; border-radius: 8px; padding: 15px 25px; display: flex; align-items: center; gap: 30px; shrink: 0;">
            <span style="font-size: 12px; font-weight: 500; text-transform: uppercase; color: #cbd5e1;">Grand Total Paid</span>
            <span style="font-size: 20px; font-weight: 900; font-family: monospace;">₹${data.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    await new Promise(resolve => setTimeout(resolve, 300));

    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff'
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const pdfBlob = pdf.output('blob');
    const fileName = `fee_receipt_${data.invoiceNo || invoiceId}.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

    return { file: pdfFile, pdfBlob, pdfData: data };
  };

  const downloadInvoicePDF = async (invoiceId: string) => {
    try {
      setIsLoading(true);
      const { pdfBlob, pdfData } = await generateInvoicePDFFile(invoiceId);
      const fileName = `fee_receipt_${pdfData.invoiceNo || invoiceId}.pdf`;
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to generate PDF download:', err);
      alert('Failed to generate PDF. Opening print page instead.');
      window.open(`/dashboard/billing/invoices/${invoiceId}`, '_blank');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhatsAppShare = async (invoiceId: string) => {
    if (!invoiceId) return;

    try {
      setIsLoading(true);
      const { file, pdfBlob, pdfData } = await generateInvoicePDFFile(invoiceId);

      const rawPhone = 
        pdfData?.parentPhone ||
        pdfData?.fatherPhone ||
        pdfData?.motherPhone ||
        lastPaidParentPhone ||
        selectedStudent?.account?.parentPhone ||
        selectedStudent?.account?.fatherPhone ||
        selectedStudent?.account?.motherPhone ||
        selectedStudent?.parentPhone ||
        selectedStudent?.fatherPhone ||
        selectedStudent?.motherPhone ||
        selectedStudent?.account?.phone ||
        selectedStudent?.phone;

      const normalizedPhone = normalizePhoneNumber(rawPhone);
      const studentName = pdfData?.studentName || lastPaidStudentName || selectedStudent?.account?.name || selectedStudent?.name || 'Student';

      if (!normalizedPhone) {
        alert(`No parent WhatsApp mobile number was found in the database for ${studentName}. Please update the student profile with a parent contact number.`);
        setIsLoading(false);
        return;
      }

      const messageText = `Dear Parent, your fee payment receipt for ${studentName} has been generated successfully.\n\nReceipt Number: ${pdfData?.invoiceNo || successInvoiceId || invoiceId}\nAmount Paid: ₹${fmt(pdfData?.totalAmount || lastPaidAmount)}\n\nThank you for choosing ${pdfData?.schoolName || 'our school'}.`;

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Fee Receipt - ${pdfData.invoiceNo || invoiceId}`,
            text: messageText,
            files: [file]
          });
          setIsLoading(false);
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            setIsLoading(false);
            return;
          }
          console.warn('Web share failed, proceeding to WhatsApp web fallback:', shareErr);
        }
      }

      // Desktop / Web Fallback: Download PDF + open WhatsApp chat
      const fileName = `fee_receipt_${pdfData.invoiceNo || invoiceId}.pdf`;
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const waUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(messageText)}`;
      window.open(waUrl, '_blank');

      alert(`PDF receipt "${fileName}" downloaded.\nOpening WhatsApp for +${normalizedPhone}... Please attach the downloaded PDF receipt to complete sharing.`);
    } catch (err: any) {
      console.error('Failed to process WhatsApp share', err);
      alert(`Unable to share receipt via WhatsApp: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRollback = async (id: string) => {
    if (!confirm('Are you sure you want to void this invoice payment?')) return;
    try {
      setIsLoading(true);
      await api.post(`/billing/invoices/${id}/void`);
      // Dispatch event to refresh dashboard in real-time
      dispatchSchoolSetupUpdated();
      alert(`Rollback: Transaction invoice voided successfully.`);
      
      const txRes = await api.get('/billing/invoices/recent');
      setTransactions(txRes.data);
    } catch (err: any) {
      console.error('Voiding failed', err);
      alert(`Failed to void invoice: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const showCommandCenter = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'SCHOOL_ADMIN';

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-[28px] font-bold text-slate-900 leading-none">
            Fee Management & Invoicing
          </h2>
          <p className="text-slate-500 text-[13px] font-medium mt-2">
            Collect school tuition fees, issue transaction logs, and generate invoice bills.
          </p>
        </div>
        {showCommandCenter && (
          <Link
            href="/dashboard/billing/financial-command-center"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-750 text-white rounded-xl shadow-md shadow-blue-500/10 text-xs font-bold transition-all shrink-0 select-none hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            Financial Command Center
          </Link>
        )}
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-3 text-sm animate-pulse">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="font-semibold">{toastMessage} Ledger balances updated.</div>
        </div>
      )}

      {/* QUICK STUDENT SEARCH */}
      <div className="space-y-2 relative max-w-lg">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Quick Student Search</label>
        <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus-within:border-[#2E5BFF] transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            type="text"
            placeholder="Type student name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none text-[13px] font-semibold text-slate-800 outline-none w-full placeholder-slate-400"
          />
        </div>

        {/* Autocomplete Dropdown list */}
        {matchingStudents.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {matchingStudents.map((s, idx) => {
              const accountId = s.account?.id || s.id || `student-${idx}`;
              const name = s.account?.name || s.name || s.studentName || 'Student Record';
              const rollNo = s.account?.rollNo || s.rollNo || 'N/A';
              const cls = s.account?.className || s.className || s.class || '';
              const sec = s.account?.sectionName || s.sectionName || s.section || '';
              const pending = s.totalPendingBalance ?? s.outstandingAmount ?? s.totalDue ?? 0;

              return (
                <div
                  key={accountId}
                  onClick={() => handleSelectStudent(s)}
                  className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs font-medium"
                >
                  <div>
                    <span className="font-bold text-slate-800 block">{name}</span>
                    <span className="text-slate-400 text-[10px]">{cls} {sec} · Roll: {rollNo}</span>
                  </div>
                  <span className="text-amber-600 font-bold font-mono">Due: ₹{Number(pending || 0).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTIVE BILLING SUITE PANEL */}
      {selectedStudent ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-850 text-base flex items-center gap-1.5">
                <User className="w-5 h-5 text-blue-500 shrink-0" />
                Ledger: <span className="text-blue-600 font-black">{selectedStudent.account?.name || selectedStudent.name || 'Student Ledger'}</span>
              </h3>
              <p className="text-[11px] text-slate-450 mt-1 font-semibold">
                Roll: {selectedStudent.account?.rollNo || selectedStudent.rollNo || 'N/A'} · {selectedStudent.account?.className || selectedStudent.className || 'Class 1'} {selectedStudent.account?.sectionName || selectedStudent.sectionName || 'A'}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-bold bg-white"
              >
                {academicYears.map(ay => (
                  <option key={ay.value} value={ay.value}>{ay.label}</option>
                ))}
              </select>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-xs font-bold font-mono">
                PENDING: ₹{Number(selectedStudent.totalPendingBalance ?? selectedStudent.outstandingAmount ?? 0).toLocaleString()}
              </span>
            </div>
          </div>

          {(() => {
            const previousYearDue = Number(selectedStudent.previousYearDue ?? selectedStudent.feeSummary?.overall?.totalPreviousYearDue ?? 0);
            const currentYearDue = Number(selectedStudent.outstandingAmount ?? selectedStudent.totalPendingBalance ?? selectedStudent.feeSummary?.currentYear?.pendingAmount ?? 0);
            const totalDue = previousYearDue + currentYearDue;

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                {/* Card 1: Previous Year Due */}
                <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Previous Year Due</span>
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Carried Over</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-600">
                    ₹{fmt(previousYearDue)}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Unpaid balance from past academic sessions</span>
                </div>

                {/* Card 2: Current Year Due */}
                <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Current Year Due ({selectedYear || '2026-2027'})</span>
                    <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">Pending</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-rose-600">
                    ₹{fmt(currentYearDue)}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Outstanding for current academic year</span>
                </div>

                {/* Card 3: Total Due */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 rounded-2xl shadow-md space-y-2 flex flex-col justify-between border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Due</span>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50">Grand Total</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-white">
                    ₹{fmt(totalDue)}
                  </div>
                  <span className="text-[11px] text-slate-300 font-medium">Combined total outstanding payable</span>
                </div>
              </div>
            );
          })()}

          {isLoading ? (
            <div className="py-12 text-center text-slate-400 font-medium text-xs animate-pulse">
              Processing fees query...
            </div>
          ) : feeItems.length === 0 ? (
            <div className="py-8 text-center text-slate-400 bg-slate-50 border border-slate-250 border-dashed rounded-xl text-xs font-medium">
              No outstanding fee structures or open opportunities found for this student.
            </div>
          ) : (
            <>
              {/* ── Fee Table: Desktop (sm and above) ── */}
              <div className="hidden sm:block overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <th className="px-4 py-3" style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          disabled={unpaidItems.length === 0}
                          onChange={handleSelectAllToggle}
                          className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3">Fee Particulars</th>
                      <th className="px-4 py-3 text-right">Total Amt</th>
                      <th className="px-4 py-3 text-right">Discount</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3 text-right" style={{ width: '130px' }}>Payment Input</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-650 font-semibold">
                    {feeItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                          No fee products assigned to this student.
                        </td>
                      </tr>
                    ) : (
                      feeItems.map((fee) => {
                      const isPaid = fee.balance <= 0;
                      return (
                        <tr key={fee.id} className={`${fee.isSelected ? 'bg-blue-50/10' : ''}`}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={fee.isSelected}
                              disabled={isPaid}
                              onChange={() => handleCheckboxToggle(fee.id)}
                              className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span>{fee.name}</span>
                              {isPaid && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  ✓ PAID
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">₹{fmt(fee.total)}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">₹{fmt(fee.discount)} ({fee.discountPercent || 0}%)</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">₹{fmt(fee.paid)}</td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${isPaid ? 'text-emerald-600' : 'text-rose-600'}`}>
                            ₹{fmt(fee.balance)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isPaid ? (
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded inline-block">N/A</span>
                            ) : (
                              <input
                                type="number"
                                value={fee.isSelected ? fee.input : 0}
                                disabled={!fee.isSelected || isPaid}
                                onChange={(e) => handleInputChange(fee.id, Number(e.target.value))}
                                className="w-24 bg-white border border-slate-200 rounded px-2 py-1 text-right font-mono text-slate-800 font-bold outline-none"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>

              {/* ── Fee Cards: Mobile only (below sm) ── */}
              <div className="sm:hidden space-y-2.5">
                {feeItems.map((fee) => {
                  const isPaid = fee.balance <= 0;
                  return (
                    <div
                      key={fee.id}
                      className={`border rounded-xl p-3 space-y-2.5 transition-all ${
                        fee.isSelected
                          ? 'bg-blue-50/40 border-blue-200'
                          : 'bg-white border-slate-200'
                      } ${isPaid ? 'opacity-60' : ''}`}
                    >
                      {/* Primary row: Checkbox + Name + Total */}
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={fee.isSelected}
                          disabled={isPaid}
                          onChange={() => handleCheckboxToggle(fee.id)}
                          className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-slate-800 text-[13px] block leading-tight">{fee.name}</span>
                          {isPaid && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 mt-0.5 inline-block">
                              ✓ Fully Paid
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[13px] font-bold text-slate-700 font-mono">₹{fmt(fee.total)}</span>
                          <span className="text-[9px] text-slate-400 font-medium block">Total</span>
                        </div>
                      </div>

                      {/* Secondary row: Balance + Payment input */}
                      <div className="flex items-end justify-between gap-3 pl-8">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide block">Balance Due</span>
                          <span className={`text-sm font-bold font-mono ${fee.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ₹{fmt(fee.balance)}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Pay Now</span>
                          <input
                            type="number"
                            value={fee.isSelected ? fee.input : 0}
                            disabled={!fee.isSelected || isPaid}
                            onChange={(e) => handleInputChange(fee.id, Number(e.target.value))}
                            className="w-28 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-right font-mono text-slate-800 font-bold text-sm outline-none focus:border-blue-400 disabled:opacity-50 disabled:bg-slate-50"
                          />
                        </div>
                      </div>

                      {/* Tertiary row: Discount + Paid (collapsed info) */}
                      <div className="flex gap-4 pl-8 text-[10px] text-slate-400 font-medium border-t border-slate-100 pt-2">
                        <span>Disc: <span className="text-slate-600 font-semibold">₹{fmt(fee.discount)} ({fee.discountPercent || 0}%)</span></span>
                        <span>Paid: <span className="text-slate-600 font-semibold">₹{fmt(fee.paid)}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Total Summary Banner ── */}
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl px-4 py-3.5 shadow-md shadow-blue-500/20">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">Total Settlement</span>
                  <span className="text-2xl font-black font-mono">₹{fmt(billingTotal)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-blue-200 block">{feeItems.filter(f => f.isSelected).length} fee(s) selected</span>
                  <span className="text-xs font-bold text-blue-100">Ready to collect</span>
                </div>
              </div>

              {/* Payment Method selector */}
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Choose Collection Channel</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {paymentChannels.map((c) => {
                    const isSelected = selectedChannel === c.value;
                    return (
                      <div
                        key={c.value}
                        onClick={() => setSelectedChannel(c.value)}
                        className={`p-3 sm:p-4 border rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1 transition-all ${
                          isSelected 
                            ? 'bg-blue-50 border-[#2E5BFF] text-[#2E5BFF] font-bold shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold'
                        }`}
                      >
                        <span className="text-xl">{c.icon}</span>
                        <span className="text-xs text-center leading-tight">{c.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic details for Razorpay, UPI and Bank */}
              {selectedChannel === 'RAZORPAY' && (
                <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-2xl max-w-md mx-auto text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-[#2E5BFF]">
                    <Sparkles className="w-5 h-5" />
                    <span className="text-xs font-extrabold uppercase tracking-wider">Razorpay Real-Time Gateway</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    Complete <strong>₹{fmt(billingTotal)}</strong> online payment via Razorpay Checkout overlay (UPI QR Code, Cards, Net Banking, Wallets).
                  </p>
                  <div className="p-2.5 bg-white border border-blue-100 rounded-xl text-[11px] text-slate-500 font-medium">
                    🔒 Status becomes <strong className="text-emerald-600">✓ PAID</strong> only after backend cryptographic signature verification.
                  </div>
                </div>
              )}

              {selectedChannel.includes('UPI') && selectedChannel !== 'RAZORPAY' && (() => {
                const tenant = setupStats?.setup?.tenant;
                const merchantName = setupStats?.setup?.schoolName || tenant?.name || 'School Merchant';
                let activeUpiId = '';
                if (selectedChannel === 'GPAY_UPI') {
                  activeUpiId = tenant?.googlePayId || '';
                } else if (selectedChannel === 'PHONEPE_UPI') {
                  activeUpiId = tenant?.phonePeId || '';
                }
                if (!activeUpiId) {
                  activeUpiId = tenant?.upiQrId || '';
                }
                const isMockUpi = !activeUpiId;
                const displayUpiId = activeUpiId || 'gpay-vikas-edu@okaxis';

                // UPI standard transaction payload format
                const upiLink = `upi://pay?pa=${encodeURIComponent(displayUpiId)}&pn=${encodeURIComponent(merchantName)}&am=${billingTotal}&cu=INR`;
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;

                return (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl max-w-sm mx-auto flex flex-col items-center text-center space-y-3">
                    <span className="text-xs font-bold text-slate-650 uppercase tracking-wider">Scan Standee QR</span>
                    <div className="w-36 h-36 bg-white p-2 border border-slate-200 rounded-xl shadow-sm flex items-center justify-center overflow-hidden">
                      <img 
                        src={qrCodeUrl} 
                        alt="UPI Payment QR Code" 
                        className="w-32 h-32 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 font-mono block">
                        UPI ID: <span className="font-bold text-slate-800">{displayUpiId}</span>
                      </span>
                      {isMockUpi && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 block">
                          ⚠️ Demo Mode: Configure your merchant UPI ID in Settings
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-blue-600 font-bold bg-blue-50/50 px-3 py-1 rounded-full border border-blue-100">
                      Scan to complete physical ₹{billingTotal.toLocaleString()} collection
                    </p>
                  </div>
                );
              })()}

              {selectedChannel === 'NET_BANKING' && (
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-3 text-xs">
                  <h4 className="font-bold text-slate-700">Net Banking Settlement details:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-semibold">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Bank Name</span>
                      <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5" />
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">IFSC Code</span>
                      <input type="text" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5" />
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block mb-0.5">Account Number</span>
                      <input type="text" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5" />
                    </div>
                  </div>
                </div>
              )}

              {/* Footer action buttons */}
              <div className="border-t border-slate-100 pt-4 flex gap-2">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm bg-white hover:bg-slate-50"
                >
                  Cancel
                </button>
                {selectedChannel === 'RAZORPAY' ? (
                  <button
                    onClick={handleFinalizePayment}
                    disabled={isSubmittingPayment}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold text-sm shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Pay ₹{fmt(billingTotal)} with Razorpay</span>
                  </button>
                ) : (
                  <button
                    onClick={handleOpenConfirmModal}
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    ✓ Finalize Payment
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="p-8 text-center bg-white border border-slate-200 border-dashed rounded-2xl space-y-2 max-w-lg">
          <span className="text-2xl block">🔎</span>
          <h4 className="text-sm font-bold text-slate-700">Find a Student to begin</h4>
          <p className="text-xs text-slate-450 font-light">
            Type at least 2 characters in the quick search input to find outstanding records.
          </p>
        </div>
      )}

      {/* RECENT TRANSACTION HISTORY */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <h3 className="font-extrabold text-slate-850 text-base">Recent Transaction History</h3>
        
        {transactions.length === 0 ? (
          <div className="py-8 text-center text-slate-400 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-xs font-semibold">
            No recent payment transactions recorded.
          </div>
        ) : (
          <>
            {/* ── Transactions Table: Desktop ── */}
            <div className="hidden sm:block overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-4 py-3">Invoice ID</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Management Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-650 font-semibold">
                  {transactions.map((t) => {
                    const isCancelled = t.status === 'Cancelled';
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{t.id.slice(0, 8)}...</td>
                        <td className="px-4 py-3">
                          <div>{t.name}</div>
                          <div className="text-[10px] text-slate-400">Roll: {t.rollNo || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-450">{t.dateStr}</td>
                        <td className="px-4 py-3 font-bold text-slate-800 font-mono">₹{fmt(t.totalAmount)}</td>
                        <td className="px-4 py-3 text-slate-500">{t.paymentMethod}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            isCancelled 
                              ? 'bg-rose-50 text-rose-600 border-rose-100'
                              : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/dashboard/billing/invoices/${t.id}`}
                              className="px-2.5 py-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-[10px] font-bold border border-slate-200 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" /> Print
                            </Link>
                            {!isCancelled && (
                              <button
                                onClick={() => handleRollback(t.id)}
                                className="px-2.5 py-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100/30 text-[10px] font-bold border border-rose-100 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" /> Rollback
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Transaction Cards: Mobile ── */}
            <div className="sm:hidden space-y-2.5">
              {transactions.map((t) => {
                const isCancelled = t.status === 'Cancelled';
                return (
                  <div key={t.id} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
                    {/* Row 1: Student + Amount */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 text-[13px] block truncate">{t.name}</span>
                        <span className="text-[10px] text-slate-400">Roll: {t.rollNo || 'N/A'}</span>
                      </div>
                      <span className="font-bold text-slate-800 font-mono text-sm shrink-0">₹{fmt(t.totalAmount)}</span>
                    </div>

                    {/* Row 2: Invoice ID, Date, Channel, Status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        #{t.id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] text-slate-400">{t.dateStr}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{t.paymentMethod}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        isCancelled 
                          ? 'bg-rose-50 text-rose-600 border-rose-100'
                          : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    {/* Row 3: Full-width action buttons */}
                    <div className="flex gap-2 pt-0.5">
                      <Link
                        href={`/dashboard/billing/invoices/${t.id}`}
                        className="flex-1 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 inline-flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Invoice
                      </Link>
                      {!isCancelled && (
                        <button
                          onClick={() => handleRollback(t.id)}
                          className="flex-1 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100/50 text-xs font-bold border border-rose-100 inline-flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Rollback
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      {/* Success Modal Popup */}
      {successModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Payment Successful!
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Transaction processed successfully and registered in student ledger.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-650 space-y-1.5 text-left border border-slate-100">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Student:</span>
                <span className="font-bold text-slate-800">{lastPaidStudentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Receipt Number:</span>
                <span className="font-mono text-slate-800 font-bold">{successInvoiceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Transaction ID:</span>
                <span className="font-mono text-slate-800">{successInvoiceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Amount Paid:</span>
                <span className="font-extrabold text-slate-900">₹{fmt(lastPaidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Payment Method:</span>
                <span className="font-semibold text-slate-800">
                  {paymentChannels.find(c => c.value === selectedChannel)?.label || selectedChannel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Payment Date &amp; Time:</span>
                <span className="font-mono text-slate-700 font-semibold">{successPaymentDate}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-1.5">
                <span className="font-bold text-slate-500">Remaining Balance:</span>
                <span className="font-black text-rose-600 font-mono">₹{fmt(successRemainingBalance)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (successInvoiceId) {
                    downloadInvoicePDF(successInvoiceId);
                  }
                }}
                className="w-full sm:w-auto flex-1 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer border-none"
              >
                <Printer className="w-4 h-4" /> Save / Print PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  if (successInvoiceId) {
                    handleWhatsAppShare(successInvoiceId);
                  }
                }}
                className="w-full sm:w-auto flex-1 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/10 cursor-pointer border-none"
              >
                <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setSuccessModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {confirmModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Confirm Payment Details
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Please review the transaction summary carefully before confirming.
              </p>
            </div>

            {/* Student details */}
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 grid grid-cols-2 gap-4 text-xs font-semibold text-slate-650">
              <div>
                <span className="text-slate-400 block mb-0.5">Student Name</span>
                <span className="text-slate-800 font-bold block">{selectedStudent.account?.name || selectedStudent.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Roll/Admission Number</span>
                <span className="text-slate-800 font-bold block">{selectedStudent.account?.rollNo || selectedStudent.rollNo || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Class &amp; Section</span>
                <span className="text-slate-800 font-bold block">
                  {selectedStudent.account?.className || selectedStudent.className || selectedStudent.account?.class || 'Class 1'} {selectedStudent.account?.sectionName || selectedStudent.sectionName || selectedStudent.account?.section || 'A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Academic Session</span>
                <span className="text-slate-800 font-bold block">
                  {academicYears.find(y => y.value === selectedYear)?.label || selectedYear}
                </span>
              </div>
            </div>

            {/* Selected items list */}
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Selected Fee Products</span>
              <div className="max-h-36 overflow-y-auto border border-slate-150 rounded-2xl p-3 divide-y divide-slate-100 bg-white">
                {feeItems.filter(item => item.isSelected && item.input > 0).map((item) => (
                  <div key={item.id} className="flex justify-between py-2 text-xs font-semibold text-slate-600">
                    <div>
                      <span className="font-bold text-slate-800">{item.name}</span>
                      {item.discount > 0 && (
                        <span className="text-[10px] text-slate-400 ml-2">Discount: ₹{item.discount.toLocaleString()}</span>
                      )}
                    </div>
                    <span className="font-mono text-slate-800 font-bold">₹{item.input.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="border-t border-slate-100 pt-3 text-xs font-semibold text-slate-655 space-y-2">
              <div className="flex justify-between items-center">
                <span>Total Amount Being Paid:</span>
                <span className="font-mono text-blue-600 font-black text-base">₹{billingTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Collection Info */}
            <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-4 text-xs font-semibold text-slate-650">
              <div>
                <span className="text-slate-400 block mb-0.5">Payment Method</span>
                <span className="text-slate-800 font-bold block">
                  {paymentChannels.find(c => c.value === selectedChannel)?.label || selectedChannel}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Payment Date</span>
                <span className="text-slate-850 font-bold block">{formatDateDDMMYYYY(new Date())}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={isSubmittingPayment}
                className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalizePayment}
                disabled={isSubmittingPayment}
                className="flex-1 py-3 bg-[#00875A] hover:bg-green-750 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingPayment ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-t-white border-white/20 rounded-full animate-spin"></div>
                    Processing Payment...
                  </>
                ) : (
                  'Confirm Payment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Failed Modal */}
      {errorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Payment Failed
              </h3>
              <p className="text-xs text-rose-600 font-semibold mt-1">
                {errorMessage}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setErrorModalOpen(false);
                  setConfirmModalOpen(true);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all cursor-pointer border-none"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setErrorModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
