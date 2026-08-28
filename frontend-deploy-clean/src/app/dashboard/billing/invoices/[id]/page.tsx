'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { PDFService } from '@/lib/pdf';
import { PDFLayout } from '@/components/PDFLayout';
import { PDFTable } from '@/components/PDFTable';
import { Download } from 'lucide-react';

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
  className: string;
  sectionName: string;
  studentDob: string;
  addressVillage: string;
  totalAmount: number;
  totalFeeAmount?: number;
  totalDiscount?: number;
  previouslyPaid?: number;
  currentPayment?: number;
  remainingBalance?: number;
  paidAmount?: number;
  items: {
    particulars: string;
    totalAmount?: number;
    previouslyPaid?: number;
    currentPayment?: number;
    remainingBalance?: number;
    amount: number;
  }[];
}

export default function InvoicePrintPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [invoiceData, setInvoiceData] = useState<InvoicePDFData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoicePDF = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/billing/invoices/${id}/pdf`);
        setInvoiceData(res.data);
      } catch (err: any) {
        console.error('Failed to load invoice details for PDF rendering', err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch invoice details.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvoicePDF();
  }, [id]);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handlePrint = () => {
    PDFService.print();
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('invoice-pdf-element');
    if (!element || !invoiceData) return;

    setIsGeneratingPDF(true);
    try {
      const safeInvoiceNo = invoiceData.invoiceNo.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Invoice_${safeInvoiceNo}`;

      await PDFService.export({
        element,
        filename,
        documentType: 'receipt',
        metadata: {
          title: `Fee Receipt - ${invoiceData.invoiceNo}`,
          author: invoiceData.schoolName,
          subject: 'Student Fee Payment Invoice Receipt',
          keywords: 'Invoice, Fee Receipt, Student, Billing',
        },
      });
    } catch (err) {
      console.error('Failed to export invoice PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-medium text-xs text-slate-400">
        Loading printable invoice receipt data...
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4">
        <div className="text-rose-600 font-bold text-sm">Error: {error || 'Invoice not found.'}</div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:p-0 p-3 sm:p-6 flex flex-col items-center">

      {/* ── Top Action Bar (hidden during print) ── */}
      <div className="w-full max-w-[800px] mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-0 bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm print:hidden">
        <button
          onClick={() => router.back()}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Billing
        </button>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handlePrint}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print (Browser)
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isGeneratingPDF}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Invoice Sheet (A4-styled) ── */}
      <div id="invoice-pdf-element" className="fee-receipt-sheet w-full max-w-[800px] border print:border-none shadow-lg print:shadow-none print:min-h-0 relative font-sans print:m-0 flex flex-col print:block" style={{ backgroundColor: '#ffffff', color: '#2d3748', borderColor: '#e2e8f0', colorScheme: 'light' }}>
        <PDFLayout
          schoolLogo={invoiceData.schoolLogo}
          schoolName={invoiceData.schoolName}
          schoolSubtitle={invoiceData.schoolSubtitle}
          reportTitle="Official Student Fee Receipt"
          documentType="receipt"
          metadata={[
            { label: 'Receipt No', value: invoiceData.invoiceNo },
            { label: 'Academic Year', value: invoiceData.academicYear },
            { label: 'Receipt Date', value: invoiceData.invoiceDate },
            { label: 'Admission Ref', value: invoiceData.admissionRef },
            { label: 'Student Name', value: invoiceData.studentName },
            { label: 'Class & Section', value: `${invoiceData.className} - ${invoiceData.sectionName}` },
            { label: 'Date of Birth', value: invoiceData.studentDob || '15 May 2012' },
            { label: 'Father Name', value: invoiceData.fatherName }
          ]}
          footerText="This is a computer generated fee receipt. No physical signature is required. For verification query, contact the accounting department."
        >
          {/* ── Fee Summary Section ── */}
          <div className="mt-4 mb-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-slate-50 p-3.5 border border-slate-200 rounded-xl text-xs font-semibold">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Fee Amount</span>
              <span className="text-sm font-bold font-mono text-slate-800">
                ₹{(invoiceData.totalFeeAmount || 15000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Discount</span>
              <span className="text-sm font-bold font-mono text-slate-500">
                ₹{(invoiceData.totalDiscount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Previously Paid</span>
              <span className="text-sm font-bold font-mono text-emerald-600">
                ₹{(invoiceData.previouslyPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Current Payment</span>
              <span className="text-sm font-bold font-mono text-blue-600">
                ₹{(invoiceData.currentPayment || invoiceData.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-rose-50 border border-rose-150 p-2 rounded-lg">
              <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider block">Remaining Balance</span>
              <span className="text-sm font-black font-mono text-rose-700">
                ₹{(invoiceData.remainingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* ── Detailed Fee Particulars Table ── */}
          <PDFTable
            items={invoiceData.items}
            columns={[
              {
                header: 'Sl. No',
                width: '8%',
                align: 'left',
                render: (_, idx) => <span>{idx + 1}</span>,
              },
              {
                header: 'Fee Particular',
                width: '32%',
                align: 'left',
                render: (item) => <span className="font-semibold">{item.particulars}</span>,
              },
              {
                header: 'Total Amount',
                width: '20%',
                align: 'right',
                render: (item) => (
                  <span className="font-mono text-slate-700">
                    ₹{(item.totalAmount || item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                ),
              },
              {
                header: 'Previously Paid',
                width: '20%',
                align: 'right',
                render: (item) => (
                  <span className="font-mono text-emerald-600 font-semibold">
                    ₹{(item.previouslyPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                ),
              },
              {
                header: 'Current Payment',
                width: '20%',
                align: 'right',
                render: (item) => (
                  <span className="font-mono font-bold text-blue-700">
                    ₹{(item.currentPayment !== undefined ? item.currentPayment : item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                ),
              },
            ]}
          />

          {/* ── Grand Settlement Footer ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', breakInside: 'avoid' }}>
            <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '0.5rem', padding: '0.75rem 1.25rem' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#c53030', display: 'block' }}>Outstanding Balance Remaining</span>
              <span style={{ fontSize: '16px', fontWeight: 900, fontFamily: 'monospace', color: '#9b2c2c' }}>
                ₹{(invoiceData.remainingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ backgroundColor: '#1a365d', color: '#ffffff', borderRadius: '0.5rem', padding: '0.75rem 1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1' }}>Current Receipt Total</span>
              <span style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'monospace', color: '#ffffff' }}>
                ₹{(invoiceData.currentPayment || invoiceData.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </PDFLayout>
      </div>
    </div>
  );
}
