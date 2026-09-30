"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Wallet,
  CreditCard,
  RefreshCw,
  History,
  ShieldCheck,
  Plus,
  X,
  Upload,
  Paperclip,
  Printer,
  Download,
  FileText,
  Eye,
  Trash2,
  User,
  Calendar,
  Building,
  Check,
  Copy,
  FileCheck,
  Info,
} from 'lucide-react';
import NairaSign from '@/components/ui/NairaSign';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

function getUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hrms_user');
    if (raw) return JSON.parse(raw)?.id ?? null;
  } catch { /* ignore */ }
  return null;
}

function buildHeaders() {
  const uid = getUserId();
  return uid ? { 'X-User-Id': uid } : {};
}

function fmtN(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleDateString('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return str; }
}

function fmtMethod(m) {
  switch (m) {
    case 'bank_transfer': return 'Bank Transfer';
    case 'direct_deposit': return 'Direct Deposit';
    case 'cash': return 'Cash';
    case 'cheque': return 'Cheque';
    case 'salary_deduction': return 'Salary Deduction';
    default: return m ? m.replace('_', ' ').toUpperCase() : 'OTHER';
  }
}

export default function CoopSavingsTopUpPage() {
  // ── User Context & Permission State
  const [userCtx, setUserCtx] = useState({
    isPrivileged: false,
    isSuperAdmin: false,
    isAdminStaff: false,
    isFinanceStaff: false,
    currentEmployee: null,
  });
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Staff Search & Selection State
  const [searchText, setSearchText] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // ── Selected Staff Savings & Stats
  const [staffSavings, setStaffSavings] = useState(null);
  const [staffStats, setStaffStats] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // ── Top-Up Form State
  const [topUpAmount, setTopUpAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // ── Modals State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptModalData, setReceiptModalData] = useState(null);
  const [proofModalUrl, setProofModalUrl] = useState(null);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reversing, setReversing] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // ── History & Ledger State
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalAmount, setHistoryTotalAmount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethod, setHistoryMethod] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Toast Notification
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Fetch Staff List & Init User Context
  const loadStaffList = useCallback(async (query = '') => {
    setSearchLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-savings-top-up/staff-list`, {
        headers: buildHeaders(),
        params: { search: query }
      });
      if (res.data.status === 'success') {
        const data = res.data.data || [];
        setStaffList(data);
        setUserCtx({
          isPrivileged: res.data.isPrivileged,
          isSuperAdmin: res.data.isSuperAdmin,
          isAdminStaff: res.data.isAdminStaff,
          isFinanceStaff: res.data.isFinanceStaff,
          currentEmployee: res.data.currentEmployee,
        });

        // If regular non-privileged staff, auto-select their own profile
        if (!res.data.isPrivileged && data.length > 0 && !selectedStaff) {
          handleSelectStaff(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setSearchLoading(false);
      setInitialLoading(false);
    }
  }, [selectedStaff]);

  useEffect(() => {
    loadStaffList();
  }, []);

  // ── Debounced Staff Search
  useEffect(() => {
    if (!userCtx.isPrivileged) return;
    const timer = setTimeout(() => {
      if (searchText.trim().length >= 1) {
        loadStaffList(searchText.trim());
        setShowDropdown(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, userCtx.isPrivileged]);

  // ── Fetch Balances & Stats for Selected Staff
  const loadStaffBalance = useCallback(async (staffId) => {
    if (!staffId) return;
    setBalanceLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-savings-top-up/staff-balance/${staffId}`, {
        headers: buildHeaders(),
      });
      if (res.data.status === 'success') {
        setStaffSavings(res.data.savings);
        setStaffStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed to load staff balance:', err);
      showToast('Could not load current savings balance.', 'error');
    } finally {
      setBalanceLoading(false);
    }
  }, [showToast]);

  // ── Fetch Transaction History
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = {
        page: currentPage,
        perPage: perPage,
        search: historySearch.trim() || undefined,
        payment_method: historyMethod !== 'all' ? historyMethod : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      };

      // If a specific staff is selected, filter by that staff
      if (selectedStaff) {
        params.staffId = selectedStaff.staffId || selectedStaff.id;
      }

      const res = await axios.get(`${API_BASE}/payroll/coop-savings-top-up/history`, {
        headers: buildHeaders(),
        params: params,
      });

      if (res.data.status === 'success') {
        setHistory(res.data.data || []);
        setHistoryTotal(res.data.total || 0);
        setHistoryTotalAmount(res.data.total_amount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
      showToast('Could not load transaction history.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [currentPage, perPage, historySearch, historyMethod, dateFrom, dateTo, selectedStaff, showToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── Handle Staff Selection
  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setShowDropdown(false);
    setSearchText('');
    loadStaffBalance(staff.staffId || staff.id);
  };

  // ── Handle Quick Amount Chips
  const handleAddQuickAmount = (amt) => {
    const current = parseFloat(topUpAmount) || 0;
    setTopUpAmount(String(current + amt));
  };

  // ── File Upload Drag & Drop Handlers
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 5 * 1024 * 1024) {
        showToast('File size must not exceed 5MB.', 'error');
        return;
      }
      setProofFile(file);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        showToast('File size must not exceed 5MB.', 'error');
        return;
      }
      setProofFile(file);
    }
  };

  // ── Projected Balance Calculation
  const currentSavingsBalance = useMemo(() => {
    return staffSavings ? parseFloat(staffSavings.saving_balance) || 0 : 0;
  }, [staffSavings]);

  const parsedAmount = useMemo(() => {
    const val = parseFloat(topUpAmount);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [topUpAmount]);

  const projectedNewBalance = useMemo(() => {
    return currentSavingsBalance + parsedAmount;
  }, [currentSavingsBalance, parsedAmount]);

  // ── Open Confirm Modal
  const handleOpenConfirm = (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member first.', 'error');
      return;
    }
    if (parsedAmount <= 0) {
      showToast('Please enter a valid top-up amount greater than zero.', 'error');
      return;
    }
    if (!paymentDate) {
      showToast('Please select a payment date.', 'error');
      return;
    }
    setShowConfirmModal(true);
  };

  // ── Submit Top-Up Transaction
  const handleExecuteTopUp = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('staffId', selectedStaff.staffId || selectedStaff.id);
      formData.append('amount', parsedAmount);
      formData.append('payment_method', paymentMethod);
      if (paymentReference.trim()) {
        formData.append('payment_reference', paymentReference.trim());
      }
      formData.append('payment_date', paymentDate);
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }
      if (proofFile) {
        formData.append('proof_of_payment', proofFile);
      }

      const res = await axios.post(`${API_BASE}/payroll/coop-savings-top-up`, formData, {
        headers: {
          ...buildHeaders(),
          'Content-Type': 'multipart/form-data',
        }
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Cooperative savings successfully topped up!', 'success');
        setShowConfirmModal(false);

        // Reset inputs
        setTopUpAmount('');
        setPaymentReference('');
        setNotes('');
        setProofFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Refresh balance & history
        await loadStaffBalance(selectedStaff.staffId || selectedStaff.id);
        await loadHistory();

        // Automatically show printable receipt for the new transaction
        if (res.data.data?.id) {
          handleViewReceipt(res.data.data.id);
        }
      } else {
        showToast(res.data.message || 'Failed to process top-up.', 'error');
      }
    } catch (err) {
      console.error('Top-up error:', err);
      showToast(err.response?.data?.message || 'Server error processing top-up.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── View Receipt Modal
  const handleViewReceipt = async (id) => {
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-savings-top-up/receipt/${id}`, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success') {
        setReceiptModalData(res.data.data);
      }
    } catch (err) {
      showToast('Could not load receipt data.', 'error');
    }
  };

  // ── Reverse Top-Up (SuperAdmin only)
  const handleConfirmReverse = async () => {
    if (!reverseTarget) return;
    setReversing(true);
    try {
      const res = await axios.delete(`${API_BASE}/payroll/coop-savings-top-up/${reverseTarget.id}`, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Top-up transaction successfully reversed.', 'success');
        setReverseTarget(null);
        if (selectedStaff) {
          await loadStaffBalance(selectedStaff.staffId || selectedStaff.id);
        }
        await loadHistory();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reverse top-up.', 'error');
    } finally {
      setReversing(false);
    }
  };

  // ── Export CSV
  const handleExportCSV = () => {
    if (history.length === 0) {
      showToast('No records to export.', 'error');
      return;
    }
    const headers = ['Receipt Ref', 'Staff Name', 'Staff ID', 'Department', 'Payment Date', 'Method', 'Reference No', 'Amount (NGN)', 'Balance Before', 'Balance After', 'Processed By', 'Notes'];
    const rows = history.map(item => [
      item.top_up_reference,
      `"${item.staff_name || ''}"`,
      item.staffId || item.id || '',
      `"${item.department || ''}"`,
      item.payment_date,
      fmtMethod(item.payment_method),
      `"${item.payment_reference || ''}"`,
      item.amount,
      item.balance_before,
      item.balance_after,
      `"${item.processed_by_name || ''}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `coop_savings_topups_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Copy Reference to Clipboard
  const handleCopyRef = (refText) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(refText);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  // ── Number to Words converter for receipt
  const inWords = (num) => {
    const val = Math.floor(Math.abs(Number(num) || 0));
    if (val === 0) return 'ZERO NAIRA ONLY';

    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

    function convertGroup(n) {
      let str = '';
      if (n >= 100) {
        str += ones[Math.floor(n / 100)] + ' HUNDRED ';
        n %= 100;
        if (n > 0) str += 'AND ';
      }
      if (n >= 20) {
        str += tens[Math.floor(n / 10)] + ' ';
        n %= 10;
      }
      if (n > 0) {
        str += ones[n] + ' ';
      }
      return str.trim();
    }

    const billions = Math.floor(val / 1000000000);
    const millions = Math.floor((val % 1000000000) / 1000000);
    const thousands = Math.floor((val % 1000000) / 1000);
    const remainder = val % 1000;

    let result = '';
    if (billions > 0) result += convertGroup(billions) + ' BILLION ';
    if (millions > 0) result += convertGroup(millions) + ' MILLION ';
    if (thousands > 0) result += convertGroup(thousands) + ' THOUSAND ';
    if (remainder > 0) {
      if (result && remainder < 100) result += 'AND ';
      result += convertGroup(remainder) + ' ';
    }

    return result.trim() + ' NAIRA ONLY';
  };

  // ── Clean Single-Page Receipt Printer
  const handlePrintReceipt = () => {
    if (!receiptModalData) return;

    let iframe = document.getElementById('receipt-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cooperative Savings Top-Up Receipt - ${receiptModalData.top_up_reference}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 15mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              background: #ffffff;
              color: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              padding: 10px;
              margin: 0;
              height: 100%;
              overflow: hidden;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .receipt-card {
              max-width: 650px;
              margin: 0 auto;
              border: 1.5px solid #cbd5e1;
              border-radius: 12px;
              padding: 22px 26px;
              background: #ffffff;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .receipt-header {
              text-align: center;
              border-bottom: 2px dashed #cbd5e1;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .org-name {
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.01em;
              margin-bottom: 3px;
            }
            .coop-name {
              font-size: 13px;
              font-weight: 700;
              color: #059669;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
            }
            .doc-title {
              display: inline-block;
              background: #f1f5f9;
              color: #334155;
              font-size: 11px;
              font-weight: 700;
              padding: 4px 14px;
              border-radius: 20px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px 20px;
              margin-bottom: 16px;
              font-size: 13px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }
            .meta-label {
              font-size: 10px;
              color: #64748b;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.04em;
            }
            .meta-value {
              font-weight: 600;
              color: #0f172a;
            }
            .amount-box {
              background: #f0fdf4;
              border: 1.5px solid #86efac;
              border-radius: 10px;
              padding: 12px;
              text-align: center;
              margin-bottom: 16px;
            }
            .amount-label {
              font-size: 10px;
              font-weight: 700;
              color: #166534;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              margin-bottom: 2px;
            }
            .amount-val {
              font-size: 24px;
              font-weight: 800;
              color: #15803d;
            }
            .amount-words {
              font-size: 11px;
              color: #166534;
              font-weight: 700;
              margin-top: 3px;
            }
            .balance-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
              font-size: 13px;
            }
            .balance-table td {
              padding: 6px 0;
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
            }
            .balance-table td:last-child {
              text-align: right;
              font-weight: 700;
              color: #0f172a;
            }
            .balance-table tr.total-row td {
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
              font-weight: 800;
              font-size: 13px;
              color: #15803d;
            }
            .notes-box {
              font-size: 11px;
              color: #475569;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 7px 12px;
              margin-bottom: 16px;
            }
            .signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 20px;
              padding-top: 12px;
              border-top: 1px dashed #cbd5e1;
              font-size: 12px;
            }
            .sig-block {
              text-align: center;
              width: 180px;
            }
            .sig-name {
              font-weight: 600;
              color: #0f172a;
            }
            .sig-line {
              border-top: 1px solid #94a3b8;
              margin-top: 28px;
              padding-top: 4px;
              color: #475569;
              font-size: 11px;
            }
            .footer-audit {
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              margin-top: 14px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <div class="receipt-header">
              <div class="org-name">ISALU HOSPITALS LIMITED</div>
              <div class="coop-name">STAFF COOPERATIVE MULTIPURPOSE SOCIETY</div>
              <div class="doc-title">SAVINGS TOP-UP ACKNOWLEDGMENT RECEIPT</div>
            </div>

            <div class="meta-grid">
              <div class="meta-item">
                <span class="meta-label">Receipt Reference</span>
                <span class="meta-value" style="font-family: monospace;">${receiptModalData.top_up_reference}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Payment Date</span>
                <span class="meta-value">${fmtDate(receiptModalData.payment_date)}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Staff Member</span>
                <span class="meta-value">${receiptModalData.staff_name}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Staff ID / Dept</span>
                <span class="meta-value">Staff ID: ${receiptModalData.staffId || receiptModalData.id} • ${receiptModalData.department}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Payment Method</span>
                <span class="meta-value">${fmtMethod(receiptModalData.payment_method)}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Transaction Ref / Teller</span>
                <span class="meta-value" style="font-family: monospace;">${receiptModalData.payment_reference || '—'}</span>
              </div>
            </div>

            <div class="amount-box">
              <div class="amount-label">Amount Credited</div>
              <div class="amount-val">${fmtN(receiptModalData.amount)}</div>
              <div class="amount-words">${inWords(receiptModalData.amount)}</div>
            </div>

            <table class="balance-table">
              <tbody>
                <tr>
                  <td>Previous Cooperative Savings Balance</td>
                  <td>${fmtN(receiptModalData.balance_before)}</td>
                </tr>
                <tr>
                  <td>Amount Added / Top-Up Deposit</td>
                  <td style="color: #15803d;">+${fmtN(receiptModalData.amount)}</td>
                </tr>
                <tr class="total-row">
                  <td>New Cooperative Savings Balance</td>
                  <td>${fmtN(receiptModalData.balance_after)}</td>
                </tr>
              </tbody>
            </table>

            ${receiptModalData.notes ? `
              <div class="notes-box">
                <strong>Remarks:</strong> ${receiptModalData.notes}
              </div>
            ` : ''}

            <div class="signatures">
              <div class="sig-block">
                <div class="sig-name">${receiptModalData.staff_name}</div>
                <div class="sig-line">Staff Depositor Signature</div>
              </div>
              <div class="sig-block">
                <div class="sig-name">${receiptModalData.processed_by_name}</div>
                <div class="sig-line">Authorized Officer Stamp</div>
              </div>
            </div>

            <div class="footer-audit">
              Printed on ${new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • Official Isalu HRMS Cooperative Ledger
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(receiptHtml);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 300);
    } catch (e) {
      console.warn('Iframe print fallback to popup:', e);
      const printWindow = window.open('', '_blank', 'width=800,height=900');
      if (printWindow) {
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 300);
      } else {
        window.print();
      }
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-receipt,
          #printable-receipt * {
            visibility: visible !important;
          }
          #printable-receipt {
            position: absolute !important;
            left: 50% !important;
            top: 10px !important;
            transform: translateX(-50%) !important;
            width: 100% !important;
            max-width: 650px !important;
            margin: 0 !important;
            padding: 20px 24px !important;
            box-shadow: none !important;
            border: 1.5px solid #cbd5e1 !important;
            border-radius: 12px !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      ` }} />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={styles.container}
      >
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Cooperative Savings Top-Up</h1>
          <p>
            Credit additional savings deposits directly into staff cooperative accounts with verifiable audit trails, payment references, and digital receipts.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleExportCSV}
            disabled={history.length === 0}
            title="Export top-up transaction history to CSV"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => {
              if (selectedStaff) loadStaffBalance(selectedStaff.staffId || selectedStaff.id);
              loadHistory();
            }}
            title="Refresh current data"
          >
            <RefreshCw size={16} className={balanceLoading || historyLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Executive Stat Cards ── */}
      <div className={styles.statsGrid}>
        {/* Card 1: Current Savings Balance */}
        <div className={styles.statCard}>
          <div className={`${styles.statIconWrap} ${styles.statIconEmerald}`}>
            <Wallet size={26} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Current Savings Balance</div>
            <div className={styles.statValue}>
              {balanceLoading ? (
                <Loader2 size={20} className="animate-spin text-emerald-500" />
              ) : (
                fmtN(currentSavingsBalance)
              )}
            </div>
            <div className={styles.statMeta}>
              {selectedStaff ? `${selectedStaff.name}'s active balance` : 'Select a staff member'}
            </div>
          </div>
        </div>

        {/* Card 2: Monthly Deduction */}
        <div className={styles.statCard}>
          <div className={`${styles.statIconWrap} ${styles.statIconBlue}`}>
            <Calendar size={26} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Monthly Payroll Deduction</div>
            <div className={styles.statValue}>
              {balanceLoading ? (
                <Loader2 size={20} className="animate-spin text-blue-500" />
              ) : (
                fmtN(staffSavings?.monthly_saving || 0)
              )}
            </div>
            <div className={styles.statMeta}>Scheduled payroll savings deduction</div>
          </div>
        </div>

        {/* Card 3: Total Topped Up */}
        <div className={styles.statCard}>
          <div className={`${styles.statIconWrap} ${styles.statIconPurple}`}>
            <CreditCard size={26} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Total Top-Ups Deposited</div>
            <div className={styles.statValue}>
              {balanceLoading ? (
                <Loader2 size={20} className="animate-spin text-purple-500" />
              ) : (
                fmtN(staffStats?.total_topped_up || 0)
              )}
            </div>
            <div className={styles.statMeta}>Lifetime additional top-up deposits</div>
          </div>
        </div>

        {/* Card 4: Top-Up Count */}
        <div className={styles.statCard}>
          <div className={`${styles.statIconWrap} ${styles.statIconAmber}`}>
            <History size={26} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Completed Top-Ups</div>
            <div className={styles.statValue}>
              {balanceLoading ? (
                <Loader2 size={20} className="animate-spin text-amber-500" />
              ) : (
                staffStats?.top_up_count || 0
              )}
            </div>
            <div className={styles.statMeta}>
              {staffStats?.last_top_up ? `Last: ${fmtDate(staffStats.last_top_up.payment_date)}` : 'No prior top-up deposits'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Staff Selection Card ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <User size={18} className={styles.cardTitleIcon} />
            {userCtx.isPrivileged ? 'Select Staff Member' : 'My Cooperative Account'}
          </h2>
          {userCtx.isPrivileged && selectedStaff && (
            <button
              type="button"
              className={styles.btnChangeStaff}
              onClick={() => {
                setSelectedStaff(null);
                setStaffSavings(null);
                setStaffStats(null);
              }}
            >
              Select Different Staff
            </button>
          )}
        </div>

        {userCtx.isPrivileged && !selectedStaff && (
          <div className={styles.staffSearchWrap} ref={searchRef}>
            <div className={styles.searchInputWrap}>
              <span className={styles.searchIcon}>
                {searchLoading ? <Loader2 size={18} className="animate-spin text-emerald-500" /> : <Search size={18} />}
              </span>
              <input
                id="coop-staff-autocomplete"
                type="text"
                className={styles.searchInput}
                placeholder="Search staff by full name, staff ID, or department…"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                autoComplete="off"
              />
            </div>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={styles.staffDropdown}
                >
                  {staffList.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">
                      {searchLoading ? 'Searching staff directory…' : 'No matching staff members found.'}
                    </div>
                  ) : (
                    staffList.map((s) => (
                      <div
                        key={s.staffId || s.id}
                        className={styles.staffOption}
                        onClick={() => handleSelectStaff(s)}
                      >
                        <div className={styles.staffOptionLeft}>
                          <div className={styles.staffAvatar}>
                            {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <div className={styles.staffOptionName}>{s.name}</div>
                            <div className={styles.staffOptionMeta}>
                              {s.department || 'General'}
                            </div>
                          </div>
                        </div>
                        <div className={styles.staffOptionRight}>
                          <div className={styles.staffOptionBalance}>{fmtN(s.saving_balance || 0)}</div>
                          <span className={styles.staffOptionFile}>Staff ID: {s.staffId || s.id}</span>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {selectedStaff && (
          <div className={styles.selectedStaffBanner}>
            <div className={styles.selectedStaffDetails}>
              <div className={styles.selectedStaffAvatar}>
                {selectedStaff.name ? selectedStaff.name.charAt(0).toUpperCase() : 'S'}
              </div>
              <div>
                <div className={styles.selectedStaffName}>{selectedStaff.name}</div>
                <div className={styles.selectedStaffMeta}>
                  <span className={styles.badgeStaffId}>Staff ID: {selectedStaff.staffId || selectedStaff.id}</span>
                  <span>•</span>
                  <span>{selectedStaff.department || 'General Department'}</span>
                  <span>•</span>
                  {staffSavings && staffSavings.is_active === 1 ? (
                    <span className={styles.badgeActive}>
                      <CheckCircle2 size={12} /> Active Cooperative Member
                    </span>
                  ) : (
                    <span className={styles.badgeInactive}>
                      New / Pending Setup (Will be activated on top-up)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Current Balance
              </div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">
                {fmtN(currentSavingsBalance)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Top-Up Form Card (For Privileged Admins / Finance) ── */}
      {userCtx.isPrivileged ? (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <Plus size={18} className={styles.cardTitleIcon} />
              Record Cooperative Top-Up
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
              Instant Account Crediting
            </span>
          </div>

          <form onSubmit={handleOpenConfirm} className={styles.topUpForm}>
            <div className={styles.formGrid}>
              {/* Top-Up Amount */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="cst-amount">
                  Top-Up Amount (₦) <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputPrefix}>
                    <NairaSign size={16} />
                  </span>
                  <input
                    id="cst-amount"
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 50000"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className={`${styles.input} ${styles.inputPrefixed}`}
                  />
                </div>
                {/* Quick Amount Chips */}
                <div className={styles.quickAmounts}>
                  {[5000, 10000, 20000, 50000, 100000].map((chipAmt) => (
                    <button
                      key={chipAmt}
                      type="button"
                      className={styles.chip}
                      onClick={() => handleAddQuickAmount(chipAmt)}
                    >
                      +₦{chipAmt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="cst-method">
                  Payment Method <span className={styles.required}>*</span>
                </label>
                <select
                  id="cst-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="direct_deposit">Direct Bank Deposit</option>
                  <option value="cash">Cash Payment</option>
                  <option value="cheque">Cheque</option>
                  <option value="salary_deduction">Direct Salary Deduction</option>
                  <option value="other">Other / Special</option>
                </select>
              </div>

              {/* Payment Reference */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="cst-ref">
                  Payment Ref / Teller No / Transaction ID
                </label>
                <input
                  id="cst-ref"
                  type="text"
                  placeholder="e.g. FBN-TRF-98231405"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className={styles.input}
                />
              </div>

              {/* Payment Date */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="cst-date">
                  Payment Date <span className={styles.required}>*</span>
                </label>
                <input
                  id="cst-date"
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={styles.input}
                />
              </div>

              {/* Proof of Payment Upload */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Proof of Payment (Teller / Receipt / Screenshot)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/jpg,application/pdf"
                  style={{ display: 'none' }}
                />

                {!proofFile ? (
                  <div
                    className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                    onDragLeave={() => setIsDragActive(false)}
                    onDrop={handleFileDrop}
                  >
                    <Upload size={22} className={styles.dropzoneIcon} />
                    <div className={styles.dropzoneText}>Click or drag & drop payment proof</div>
                    <div className={styles.dropzoneSubtext}>JPG, PNG, or PDF up to 5MB</div>
                  </div>
                ) : (
                  <div className={styles.uploadedFileBar}>
                    <div className={styles.fileInfo}>
                      <FileCheck size={18} />
                      <span className="truncate max-w-[220px] font-medium">{proofFile.name}</span>
                      <span className="text-xs text-slate-400">
                        ({(proofFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.btnRemoveFile}
                      onClick={() => {
                        setProofFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      title="Remove file"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Notes / Description */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="cst-notes">
                  Remarks / Description (Optional)
                </label>
                <textarea
                  id="cst-notes"
                  placeholder="e.g. Voluntary cooperative savings top-up remittance"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={styles.textarea}
                  rows={2}
                />
              </div>
            </div>

            {/* Projected Balance Preview Banner */}
            <div className={styles.balancePreviewBox}>
              <div className={styles.balancePreviewItem}>
                <div className={styles.previewLabel}>Current Balance</div>
                <div className={styles.previewValueCurrent}>{fmtN(currentSavingsBalance)}</div>
              </div>
              <div className={styles.previewArrow}>
                <Plus size={20} />
              </div>
              <div className={styles.balancePreviewItem}>
                <div className={styles.previewLabel}>Top-Up Deposit</div>
                <div className={styles.previewValueAdded}>{fmtN(parsedAmount)}</div>
              </div>
              <div className={styles.previewArrow}>
                <ArrowRight size={22} />
              </div>
              <div className={styles.balancePreviewItem}>
                <div className={styles.previewLabel}>New Projected Balance</div>
                <div className={styles.previewValueNew}>{fmtN(projectedNewBalance)}</div>
              </div>
            </div>

            {/* Action Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={!selectedStaff || parsedAmount <= 0 || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing Top-Up…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Review & Credit Top-Up
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Regular Staff Self-Service Notice */
        <div className={styles.selfServiceNotice}>
          <Info size={24} className={styles.noticeIcon} />
          <div className={styles.noticeContent}>
            <h4>How to Top Up Your Cooperative Savings</h4>
            <p>
              Direct cooperative savings deposits and top-ups are officially processed through the Finance & Accounts Department to verify payments and issue authenticated receipts.
            </p>
            <ul className={styles.noticeList}>
              <li>
                <strong>Step 1:</strong> Remit your voluntary contribution to the Isalu Staff Cooperative Society bank account.
              </li>
              <li>
                <strong>Step 2:</strong> Use your <strong>Staff ID ({userCtx.currentEmployee?.id || userCtx.currentEmployee?.staffId || 'N/A'})</strong> as the payment description/narration.
              </li>
              <li>
                <strong>Step 3:</strong> Present your deposit teller, bank transaction receipt, or payment confirmation to the Finance Officer.
              </li>
              <li>
                <strong>Step 4:</strong> Once verified, your cooperative balance will be credited instantly and an official digital receipt will appear in your ledger below.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Transaction History / Ledger Card ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              <History size={18} className={styles.cardTitleIcon} />
              Top-Up Transaction Ledger
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Complete historical record of all authenticated cooperative savings deposits.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 font-medium">Filtered Total: </span>
            <span className="text-sm font-bold text-emerald-400">{fmtN(historyTotalAmount)}</span>
            <span className="text-xs text-slate-500 ml-1">({historyTotal} entries)</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <div className={styles.filterSearch}>
            <div className={styles.searchInputWrap}>
              <span className={styles.searchIcon}>
                <Search size={15} />
              </span>
              <input
                type="text"
                placeholder="Search by receipt #, ref, or staff name…"
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setCurrentPage(1);
                }}
                className={styles.searchInput}
              />
            </div>
          </div>

          <div className={styles.filterSelect}>
            <select
              value={historyMethod}
              onChange={(e) => {
                setHistoryMethod(e.target.value);
                setCurrentPage(1);
              }}
              className={styles.select}
            >
              <option value="all">All Payment Methods</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="direct_deposit">Direct Deposit</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="salary_deduction">Salary Deduction</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className={styles.input}
              title="From payment date"
            />
          </div>

          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className={styles.input}
              title="To payment date"
            />
          </div>

          {(historySearch || historyMethod !== 'all' || dateFrom || dateTo) && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                setHistorySearch('');
                setHistoryMethod('all');
                setDateFrom('');
                setDateTo('');
                setCurrentPage(1);
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Receipt Ref</th>
                <th>Staff Member</th>
                <th>Payment Date</th>
                <th>Method</th>
                <th>Payment Ref</th>
                <th className={styles.thRight}>Amount Credited</th>
                <th>Balance Progression</th>
                <th className={styles.thCenter}>Proof</th>
                <th>Processed By</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12">
                    <Loader2 size={24} className="animate-spin mx-auto text-emerald-500 mb-2" />
                    <span className="text-slate-400 text-sm">Loading transaction ledger…</span>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className={styles.emptyState}>
                      <Wallet size={36} className={styles.emptyIcon} />
                      <div className="font-semibold text-slate-300">No Top-Up Transactions Found</div>
                      <div className="text-xs text-slate-500">
                        {selectedStaff
                          ? 'This staff member has not recorded any cooperative top-up deposits yet.'
                          : 'No cooperative top-up records match the specified filters.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span
                        className={styles.refBadge}
                        title="Click to copy reference"
                        onClick={() => handleCopyRef(row.top_up_reference)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Copy size={11} />
                        {row.top_up_reference}
                      </span>
                    </td>
                    <td>
                      <div className={styles.staffCell}>
                        <div className={styles.staffAvatar}>
                          {(row.staff_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.staffInfo}>
                          <div className={styles.staffName} title={row.staff_name}>{row.staff_name}</div>
                          <div className={styles.staffMeta}>
                            <span className={styles.staffIdBadge}>ID: #{row.staffId || '—'}</span>
                            {row.department && (
                              <span className={styles.staffDeptBadge}>{row.department}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.dateCell}>{fmtDate(row.payment_date)}</td>
                    <td>
                      <span className={styles.methodBadge}>{fmtMethod(row.payment_method)}</span>
                    </td>
                    <td>
                      <span className={styles.payRefBadge}>
                        {row.payment_reference || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={styles.amountBadge}>
                        <span className={styles.amountSign}>+</span>
                        <span>{fmtN(row.amount)}</span>
                      </span>
                    </td>
                    <td>
                      <div className={styles.progressionCell}>
                        <div className={styles.progressionRow}>
                          <span className={styles.progressionLabel}>Before:</span>
                          <span className={styles.progressionBefore}>{fmtN(row.balance_before)}</span>
                        </div>
                        <div className={styles.progressionRow}>
                          <span className={styles.progressionLabelAfter}>After:</span>
                          <span className={styles.progressionAfter}>{fmtN(row.balance_after)}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.proof_of_payment ? (
                        <button
                          type="button"
                          className={styles.btnViewProof}
                          onClick={() => setProofModalUrl(row.proof_of_payment)}
                          title="View proof of payment attachment"
                        >
                          <Eye size={12} /> View Proof
                        </button>
                      ) : (
                        <span className={styles.noProofBadge}>—</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.processedByCell}>
                        <User size={12} className="text-slate-400 shrink-0" />
                        <span>{row.processed_by_name || 'Admin'}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className={styles.actionBtnGroup}>
                        <button
                          type="button"
                          className={`${styles.btnAction} ${styles.btnActionReceipt}`}
                          onClick={() => handleViewReceipt(row.id)}
                          title="View & Print Official Receipt"
                        >
                          <Printer size={13} /> Receipt
                        </button>

                        {userCtx.isSuperAdmin && (
                          <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnActionReverse}`}
                            onClick={() => setReverseTarget(row)}
                            title="Reverse top-up transaction (Super Admin only)"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {historyTotal > perPage && (
          <div className={styles.pagination}>
            <div className={styles.pageInfo}>
              Showing {Math.min((currentPage - 1) * perPage + 1, historyTotal)} to{' '}
              {Math.min(currentPage * perPage, historyTotal)} of {historyTotal} transactions
            </div>
            <div className={styles.pageButtons}>
              <button
                type="button"
                className={styles.btnPage}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="text-xs font-semibold px-2 text-slate-300">
                Page {currentPage} of {Math.ceil(historyTotal / perPage)}
              </span>
              <button
                type="button"
                className={styles.btnPage}
                disabled={currentPage >= Math.ceil(historyTotal / perPage)}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Confirmation Modal ── */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className={styles.modalBackdrop}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={styles.modalContent}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <ShieldCheck size={20} className="text-emerald-400" />
                  Confirm Cooperative Top-Up
                </h3>
                <button
                  type="button"
                  className={styles.btnCloseModal}
                  onClick={() => setShowConfirmModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <p className="text-sm text-slate-300 mb-4">
                  Please review the transaction details below. Confirming will immediately credit the employee&apos;s cooperative savings balance.
                </p>

                <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Staff Member:</span>
                    <span className="font-semibold text-slate-200">{selectedStaff?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Staff ID:</span>
                    <span className="font-mono text-slate-300">{selectedStaff?.staffId || selectedStaff?.id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Savings Balance:</span>
                    <span className="text-slate-300">{fmtN(currentSavingsBalance)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2">
                    <span className="text-emerald-400 font-semibold">Top-Up Amount:</span>
                    <span className="text-emerald-400 font-bold text-base">+{fmtN(parsedAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2">
                    <span className="text-slate-300 font-semibold">New Savings Balance:</span>
                    <span className="text-emerald-300 font-bold text-base">{fmtN(projectedNewBalance)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-xs">
                    <span className="text-slate-400">Payment Method:</span>
                    <span className="text-slate-300">{fmtMethod(paymentMethod)}</span>
                  </div>
                  {paymentReference && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Payment Reference:</span>
                      <span className="font-mono text-slate-300">{paymentReference}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Payment Date:</span>
                    <span className="text-slate-300">{fmtDate(paymentDate)}</span>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleExecuteTopUp}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Crediting…
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Confirm & Credit Account
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Official Printable Receipt Modal ── */}
      <AnimatePresence>
        {receiptModalData && (
          <div className={styles.modalBackdrop}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`${styles.modalContent} ${styles.receiptModal}`}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <Printer size={18} className="text-emerald-400" />
                  Official Transaction Receipt
                </h3>
                <button
                  type="button"
                  className={styles.btnCloseModal}
                  onClick={() => setReceiptModalData(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.receiptContainer} id="printable-receipt">
                  <div className={styles.receiptHeader}>
                    <div className={styles.receiptOrgName}>ISALU HOSPITALS LIMITED</div>
                    <div className={styles.receiptSubheader}>STAFF COOPERATIVE MULTIPURPOSE SOCIETY</div>
                    <div className={styles.receiptDocumentTitle}>SAVINGS TOP-UP ACKNOWLEDGMENT RECEIPT</div>
                  </div>

                  <div className={styles.receiptMetaGrid}>
                    <div className={styles.receiptMetaItem}>
                      <span className={styles.receiptMetaLabel}>Receipt Reference</span>
                      <span className={`${styles.receiptMetaValue} font-mono`}>
                        {receiptModalData.top_up_reference}
                      </span>
                    </div>
                    <div className={styles.receiptMetaItem}>
                      <span className={styles.receiptMetaLabel}>Payment Date</span>
                      <span className={styles.receiptMetaValue}>
                        {fmtDate(receiptModalData.payment_date)}
                      </span>
                    </div>
                    <div className={styles.receiptMetaItem}>
                      <span className={styles.receiptMetaLabel}>Staff Member</span>
                      <span className={styles.receiptMetaValue}>{receiptModalData.staff_name}</span>
                    </div>
                    <div className={styles.receiptMetaItem}>
                      <span className={styles.receiptMetaLabel}>Staff ID / Dept</span>
                      <span className={styles.receiptMetaValue}>
                        Staff ID: {receiptModalData.staffId || receiptModalData.id} • {receiptModalData.department}
                      </span>
                    </div>
                    <div className={styles.receiptMetaItem}>
                      <span className={styles.receiptMetaLabel}>Payment Method</span>
                      <span className={styles.receiptMetaValue}>
                        {fmtMethod(receiptModalData.payment_method)}
                      </span>
                    </div>
                    <div className={styles.receiptMetaItem}>
                      <span className={styles.receiptMetaLabel}>Transaction Ref / Teller</span>
                      <span className={`${styles.receiptMetaValue} font-mono`}>
                        {receiptModalData.payment_reference || '—'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.receiptAmountBox}>
                    <div className={styles.receiptAmountLabel}>Amount Credited</div>
                    <div className={styles.receiptAmountValue}>{fmtN(receiptModalData.amount)}</div>
                    <div className="text-xs text-emerald-800 font-semibold mt-1">
                      {inWords(receiptModalData.amount)}
                    </div>
                  </div>

                  <table className={styles.receiptBalanceTable}>
                    <tbody>
                      <tr>
                        <td>Previous Cooperative Savings Balance</td>
                        <td>{fmtN(receiptModalData.balance_before)}</td>
                      </tr>
                      <tr>
                        <td>Amount Added / Top-Up Deposit</td>
                        <td className="text-emerald-700">+{fmtN(receiptModalData.amount)}</td>
                      </tr>
                      <tr className={styles.totalRow}>
                        <td>New Cooperative Savings Balance</td>
                        <td>{fmtN(receiptModalData.balance_after)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {receiptModalData.notes && (
                    <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2 mb-4">
                      <strong>Remarks:</strong> {receiptModalData.notes}
                    </div>
                  )}

                  <div className={styles.receiptSignatures}>
                    <div className={styles.signatureBlock}>
                      <div className="font-semibold text-slate-800">{receiptModalData.staff_name}</div>
                      <div className={styles.signatureLine}>Staff Depositor Signature</div>
                    </div>
                    <div className={styles.signatureBlock}>
                      <div className="font-semibold text-slate-800">{receiptModalData.processed_by_name}</div>
                      <div className={styles.signatureLine}>Authorized Officer Stamp</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setReceiptModalData(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handlePrintReceipt}
                >
                  <Printer size={16} /> Print Official Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Proof of Payment Viewer Modal ── */}
      <AnimatePresence>
        {proofModalUrl && (
          <div className={styles.modalBackdrop}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={styles.modalContent}
              style={{ maxWidth: '750px' }}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <FileText size={18} className="text-emerald-400" />
                  Proof of Payment Document
                </h3>
                <button
                  type="button"
                  className={styles.btnCloseModal}
                  onClick={() => setProofModalUrl(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                {proofModalUrl.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={proofModalUrl}
                    className="w-full h-[500px] border border-slate-700 rounded-lg"
                    title="Proof of Payment PDF"
                  />
                ) : (
                  <div className="flex items-center justify-center p-2 bg-slate-900 rounded-lg max-h-[500px] overflow-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={proofModalUrl}
                      alt="Proof of Payment"
                      className="max-h-[480px] w-auto object-contain rounded"
                    />
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <a
                  href={proofModalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.btnSecondary}
                  download
                >
                  <Download size={15} /> Open in New Tab / Download
                </a>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => setProofModalUrl(null)}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Reverse Confirmation Modal (SuperAdmin) ── */}
      <AnimatePresence>
        {reverseTarget && (
          <div className={styles.modalBackdrop}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={styles.modalContent}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle} style={{ color: '#f87171' }}>
                  <AlertCircle size={20} />
                  Reverse Top-Up Transaction
                </h3>
                <button
                  type="button"
                  className={styles.btnCloseModal}
                  onClick={() => setReverseTarget(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <p className="text-sm text-slate-300 mb-3">
                  Are you sure you want to reverse this top-up? Reversing will permanently delete the transaction and{' '}
                  <strong className="text-rose-400">
                    deduct {fmtN(reverseTarget.amount)}
                  </strong>{' '}
                  from <strong>{reverseTarget.staff_name}</strong>&apos;s cooperative savings balance.
                </p>

                <div className="bg-rose-950/30 border border-rose-800/50 rounded-xl p-3 text-xs space-y-1 font-mono text-rose-300">
                  <div>Reference: {reverseTarget.top_up_reference}</div>
                  <div>Amount: {fmtN(reverseTarget.amount)}</div>
                  <div>Date: {fmtDate(reverseTarget.payment_date)}</div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setReverseTarget(null)}
                  disabled={reversing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.btnActionReverse}
                  onClick={handleConfirmReverse}
                  disabled={reversing}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '10px' }}
                >
                  {reversing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Confirm Reversal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Toast Notifications ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`${styles.toast} ${
              toast.type === 'error' ? styles.toastError : styles.toastSuccess
            }`}
          >
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </>
  );
}
