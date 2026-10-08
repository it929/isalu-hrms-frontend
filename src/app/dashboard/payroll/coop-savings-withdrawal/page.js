"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Wallet,
  ArrowUpRight,
  TrendingDown,
  ShieldAlert,
  Search,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Printer,
  X,
  Plus,
  RefreshCw,
  Download,
  Building2,
  CreditCard,
  Check,
  UserCheck,
  FileCheck,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  XCircle,
  Trash2
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
  const clean = typeof n === 'string' ? n.replace(/,/g, '') : n;
  const num = parseFloat(clean);
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function formatNumberWithCommas(val) {
  if (val === null || val === undefined || val === '') return '';
  const strVal = String(val).replace(/,/g, '');
  const parts = strVal.split('.');
  const integerPart = parts[0].replace(/\D/g, '');
  if (!integerPart && parts.length === 1) return '';

  const formattedInteger = integerPart ? Number(integerPart).toLocaleString('en-US') : '0';
  if (parts.length > 1) {
    const decimalPart = parts[1].replace(/\D/g, '').slice(0, 2);
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
}

function parseCleanNumber(val) {
  if (!val && val !== 0) return 0;
  const clean = String(val).replace(/,/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

// ── Number to Words converter (Western / Nigerian English)
function inWords(num) {
  const clean = typeof num === 'string' ? num.replace(/,/g, '') : num;
  const val = Math.floor(Math.abs(Number(clean) || 0));
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
}

export default function CoopSavingsWithdrawalPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // User privileges
  const [userCtx, setUserCtx] = useState({
    isSuperAdmin: false,
    isAdminStaff: false,
    isAuditStaff: false,
    isFinanceStaff: false,
    currentEmployee: null,
  });

  // Staff Search & Selection
  const [staffList, setStaffList] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffDetails, setStaffDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Application Form State
  const [showApplyDrawer, setShowApplyDrawer] = useState(false);
  const [withdrawalType, setWithdrawalType] = useState('partial'); // 'partial' | 'full'
  const [requestedAmount, setRequestedAmount] = useState('');
  const [reason, setReason] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [applying, setApplying] = useState(false);

  // Requests Table State
  const [requests, setRequests] = useState([]);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(15);
  const [statusFilter, setStatusFilter] = useState('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [stats, setStats] = useState({
    total_applications: 0,
    pending_count: 0,
    hr_review_count: 0,
    audit_review_count: 0,
    paid_count: 0,
    rejected_count: 0,
    total_paid_amount: 0,
  });

  // Action Modals State
  const [viewRequest, setViewRequest] = useState(null);
  const [hrReviewModal, setHrReviewModal] = useState(null);
  const [financePayoutModal, setFinancePayoutModal] = useState(null);
  const [voucherModalData, setVoucherModalData] = useState(null);
  const [actionProcessing, setActionProcessing] = useState(false);

  // Review Form Inputs
  const [reviewAction, setReviewAction] = useState('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [approvedAmountInput, setApprovedAmountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [proofFile, setProofFile] = useState(null);

  const staffDropdownRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Load Staff List
  const loadStaffList = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-savings-withdrawal/staff-list`, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success') {
        setStaffList(res.data.data || []);
        setUserCtx({
          isSuperAdmin: res.data.isSuperAdmin,
          isAdminStaff: res.data.isAdminStaff,
          isAuditStaff: res.data.isAuditStaff,
          isFinanceStaff: res.data.isFinanceStaff,
          currentEmployee: res.data.currentEmployee,
        });

        // If regular staff, auto-select their profile
        if (!res.data.isPrivileged && res.data.data && res.data.data.length === 1) {
          handleSelectStaff(res.data.data[0]);
        }
      }
    } catch (err) {
      console.error('Error loading staff list:', err);
    }
  }, []);

  // ── Load Staff Details (Balance, Loan Collateral, Bank Details)
  const loadStaffDetails = useCallback(async (staffId) => {
    if (!staffId) return;
    setDetailsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-savings-withdrawal/staff-details/${staffId}`, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success') {
        const d = res.data.data;
        setStaffDetails(d);
        setBankName(d.default_bank?.bank_name || '');
        setAccountNumber(d.default_bank?.account_number || '');
        setAccountName(d.default_bank?.account_name || d.name || '');
        if (withdrawalType === 'full') {
          setRequestedAmount(formatNumberWithCommas(d.saving_balance));
        }
      }
    } catch (err) {
      console.error('Error loading staff details:', err);
      showToast('Could not fetch staff cooperative details.', 'error');
    } finally {
      setDetailsLoading(false);
    }
  }, [withdrawalType, showToast]);

  const handleSelectStaff = (st) => {
    setSelectedStaff(st);
    setShowStaffDropdown(false);
    setStaffSearch('');
    loadStaffDetails(st.staffId || st.id);
  };

  // ── Load Requests Ledger
  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-savings-withdrawal/requests`, {
        headers: buildHeaders(),
        params: {
          page: currentPage,
          per_page: perPage,
          status: statusFilter,
          search: ledgerSearch,
        }
      });
      if (res.data.status === 'success') {
        setRequests(res.data.data || []);
        setRequestsTotal(res.data.total || 0);
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Error loading requests:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, statusFilter, ledgerSearch]);

  useEffect(() => {
    setMounted(true);
    loadStaffList();
    loadRequests();
  }, [loadStaffList, loadRequests]);

  // Click outside listener for staff dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(e.target)) {
        setShowStaffDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update requested amount when toggling withdrawal type
  useEffect(() => {
    if (withdrawalType === 'full' && staffDetails) {
      setRequestedAmount(formatNumberWithCommas(staffDetails.saving_balance));
    }
  }, [withdrawalType, staffDetails]);

  // ── Handle Withdrawal Application Submission
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }
    const cleanAmount = parseCleanNumber(requestedAmount);
    if (!cleanAmount || cleanAmount <= 0) {
      showToast('Please enter a valid withdrawal amount.', 'error');
      return;
    }
    if (!reason.trim()) {
      showToast('Please specify a reason for withdrawal.', 'error');
      return;
    }
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      showToast('Please provide complete bank account details for payout.', 'error');
      return;
    }

    setApplying(true);
    try {
      const res = await axios.post(`${API_BASE}/payroll/coop-savings-withdrawal/apply`, {
        staffId: selectedStaff.staffId || selectedStaff.id,
        withdrawal_type: withdrawalType,
        requested_amount: cleanAmount,
        reason: reason.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim(),
      }, { headers: buildHeaders() });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Withdrawal application submitted successfully.', 'success');
        setShowApplyDrawer(false);
        setRequestedAmount('');
        setReason('');
        loadRequests();
        if (selectedStaff) loadStaffDetails(selectedStaff.staffId || selectedStaff.id);
      } else {
        showToast(res.data.message || 'Application submission failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error submitting application.', 'error');
    } finally {
      setApplying(false);
    }
  };

  // ── Handle HR Head Review
  const handleHrReviewSubmit = async () => {
    if (!hrReviewModal) return;
    if (reviewAction === 'reject' && !reviewNotes.trim()) {
      showToast('Please provide a reason for HR rejection.', 'error');
      return;
    }

    const cleanApproved = parseCleanNumber(approvedAmountInput) || parseCleanNumber(hrReviewModal.requested_amount);

    setActionProcessing(true);
    try {
      const res = await axios.post(`${API_BASE}/payroll/coop-savings-withdrawal/hr-review/${hrReviewModal.id}`, {
        action: reviewAction,
        approved_amount: cleanApproved,
        notes: reviewNotes.trim(),
      }, { headers: buildHeaders() });

      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        setHrReviewModal(null);
        setReviewNotes('');
        loadRequests();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit HR review.', 'error');
    } finally {
      setActionProcessing(false);
    }
  };


  // ── Handle Finance Payout
  const handleFinancePayoutSubmit = async () => {
    if (!financePayoutModal) return;
    if (reviewAction === 'reject') {
      if (!reviewNotes.trim()) {
        showToast('Please provide a reason for Finance rejection.', 'error');
        return;
      }
      setActionProcessing(true);
      try {
        const res = await axios.post(`${API_BASE}/payroll/coop-savings-withdrawal/finance-payout/${financePayoutModal.id}`, {
          action: 'reject',
          notes: reviewNotes.trim(),
        }, { headers: buildHeaders() });
        if (res.data.status === 'success') {
          showToast(res.data.message, 'success');
          setFinancePayoutModal(null);
          loadRequests();
        }
      } catch (err) {
        showToast(err.response?.data?.message || 'Failed to reject payout.', 'error');
      } finally {
        setActionProcessing(false);
      }
      return;
    }

    // Payout execution
    if (!paymentDate) {
      showToast('Please select payment date.', 'error');
      return;
    }

    setActionProcessing(true);
    try {
      const formData = new FormData();
      formData.append('action', 'pay');
      formData.append('payment_method', paymentMethod);
      formData.append('payment_reference', paymentReference);
      formData.append('payment_date', paymentDate);
      formData.append('notes', reviewNotes.trim());
      if (proofFile) formData.append('proof_file', proofFile);

      const res = await axios.post(`${API_BASE}/payroll/coop-savings-withdrawal/finance-payout/${financePayoutModal.id}`, formData, {
        headers: {
          ...buildHeaders(),
          'Content-Type': 'multipart/form-data',
        }
      });

      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        setFinancePayoutModal(null);
        setReviewNotes('');
        setPaymentReference('');
        setProofFile(null);
        loadRequests();
        if (selectedStaff) loadStaffDetails(selectedStaff.staffId || selectedStaff.id);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to disburse payout.', 'error');
    } finally {
      setActionProcessing(false);
    }
  };

  // ── Cancel Pending Withdrawal
  const handleCancelRequest = async (id, ref) => {
    if (!confirm(`Are you sure you want to cancel withdrawal application ${ref}?`)) return;
    try {
      const res = await axios.delete(`${API_BASE}/payroll/coop-savings-withdrawal/${id}`, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        loadRequests();
        if (selectedStaff) loadStaffDetails(selectedStaff.staffId || selectedStaff.id);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not cancel application.', 'error');
    }
  };

  // ── Load Voucher Modal Data
  const handleOpenVoucher = async (id) => {
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-savings-withdrawal/voucher/${id}`, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success') {
        setVoucherModalData(res.data.data);
      }
    } catch (err) {
      showToast('Could not load payment voucher.', 'error');
    }
  };

  // ── Clean Single-Page Payment Voucher & Settlement Receipt Printer
  const handlePrintVoucher = (voucherData) => {
    const data = voucherData || voucherModalData;
    if (!data) return;

    let iframe = document.getElementById('csw-voucher-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'csw-voucher-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const voucherHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cooperative Savings Withdrawal Payment Voucher - ${data.withdrawal_reference}</title>
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
            .voucher-card {
              max-width: 660px;
              margin: 0 auto;
              border: 1.5px solid #cbd5e1;
              border-radius: 12px;
              padding: 22px 26px;
              background: #ffffff;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .header-section {
              text-align: center;
              border-bottom: 2px dashed #cbd5e1;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .org-title {
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.01em;
              margin-bottom: 3px;
            }
            .coop-title {
              font-size: 13px;
              font-weight: 700;
              color: #059669;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
            }
            .doc-badge {
              display: inline-block;
              background: #f1f5f9;
              color: #1e293b;
              font-size: 11px;
              font-weight: 800;
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
            .meta-val {
              font-weight: 600;
              color: #0f172a;
            }
            .payout-box {
              background: #f0fdf4;
              border: 1.5px solid #86efac;
              border-radius: 10px;
              padding: 12px;
              text-align: center;
              margin-bottom: 16px;
            }
            .payout-label {
              font-size: 10px;
              font-weight: 700;
              color: #166534;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              margin-bottom: 2px;
            }
            .payout-amount {
              font-size: 24px;
              font-weight: 800;
              color: #15803d;
            }
            .payout-words {
              font-size: 11px;
              color: #166534;
              font-weight: 700;
              margin-top: 3px;
            }
            .audit-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
              font-size: 13px;
            }
            .audit-table td {
              padding: 6px 0;
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
            }
            .audit-table td:last-child {
              text-align: right;
              font-weight: 700;
              color: #0f172a;
            }
            .audit-table tr.total-row td {
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
              font-weight: 800;
              font-size: 13px;
              color: #15803d;
            }
            .bank-box {
              font-size: 11px;
              color: #334155;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 8px 12px;
              margin-bottom: 16px;
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 8px;
            }
            .signatures-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
              margin-top: 18px;
              padding-top: 12px;
              border-top: 1px dashed #cbd5e1;
              font-size: 11px;
              text-align: center;
            }
            .sig-block {
              display: flex;
              flex-direction: column;
              justify-content: flex-end;
            }
            .sig-name {
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 24px;
            }
            .sig-line {
              border-top: 1px solid #94a3b8;
              padding-top: 4px;
              color: #475569;
              font-size: 10px;
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
          <div class="voucher-card">
            <div class="header-section">
              <div class="org-title">ISALU HOSPITALS LIMITED</div>
              <div class="coop-title">STAFF COOPERATIVE MULTIPURPOSE SOCIETY</div>
              <div class="doc-badge">SAVINGS WITHDRAWAL PAYMENT VOUCHER & SETTLEMENT</div>
            </div>

            <div class="meta-grid">
              <div class="meta-item">
                <span class="meta-label">Voucher Reference</span>
                <span class="meta-val" style="font-family: monospace;">${data.withdrawal_reference}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Payment Date</span>
                <span class="meta-val">${fmtDate(data.payment_date || data.updated_at)}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Staff Member</span>
                <span class="meta-val">${data.staff_name}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Staff ID / Department</span>
                <span class="meta-val">Staff ID: ${data.staffId} • ${data.department || 'General'}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Withdrawal Type</span>
                <span class="meta-val" style="text-transform: capitalize;">${data.withdrawal_type === 'full' ? 'Full Account Liquidation' : 'Partial Savings Withdrawal'}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Payment Method & Ref</span>
                <span class="meta-val">${data.payment_method ? data.payment_method.replace('_', ' ').toUpperCase() : 'BANK TRANSFER'} • ${data.payment_reference || '—'}</span>
              </div>
            </div>

            <div class="payout-box">
              <div class="payout-label">Total Amount Disbursed</div>
              <div class="payout-amount">${fmtN(data.approved_amount || data.requested_amount)}</div>
              <div class="payout-words">${inWords(data.approved_amount || data.requested_amount)}</div>
            </div>

            <div class="bank-box">
              <div><strong>Bank Name:</strong><br>${data.bank_name || '—'}</div>
              <div><strong>Account Number:</strong><br><span style="font-family: monospace;">${data.account_number || '—'}</span></div>
              <div><strong>Beneficiary Name:</strong><br>${data.account_name || data.staff_name}</div>
            </div>

            <table class="audit-table">
              <tbody>
                <tr>
                  <td>Cooperative Savings Balance (Before Payout)</td>
                  <td>${fmtN(data.balance_before_payout || data.current_savings_balance)}</td>
                </tr>
                <tr>
                  <td>Amount Withdrawn / Disbursed to Staff</td>
                  <td style="color: #dc2626;">-${fmtN(data.approved_amount || data.requested_amount)}</td>
                </tr>
                <tr class="total-row">
                  <td>Cooperative Savings Balance (After Payout)</td>
                  <td>${fmtN(data.balance_after_payout !== null && data.balance_after_payout !== undefined ? data.balance_after_payout : (data.current_savings_balance - (data.approved_amount || data.requested_amount)))}</td>
                </tr>
              </tbody>
            </table>

            <div class="signatures-grid">
              <div class="sig-block">
                <div class="sig-name">${data.staff_name}</div>
                <div class="sig-line">Staff Beneficiary</div>
              </div>
              <div class="sig-block">
                <div class="sig-name">${data.hr_reviewer_name || 'HR Head'}</div>
                <div class="sig-line">HR Head Approved</div>
              </div>
              <div class="sig-block">
                <div class="sig-name">${data.finance_payer_name || 'Finance Officer'}</div>
                <div class="sig-line">Finance Disbursed</div>
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
      doc.write(voucherHtml);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 300);
    } catch (e) {
      console.warn('Iframe print fallback to popup:', e);
      const printWindow = window.open('', '_blank', 'width=800,height=900');
      if (printWindow) {
        printWindow.document.write(voucherHtml);
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

  // ── CSV Export
  const handleExportCSV = () => {
    if (requests.length === 0) {
      showToast('No records to export.', 'error');
      return;
    }
    const headers = ['Voucher Ref', 'Staff ID', 'Staff Name', 'Department', 'Type', 'Requested (NGN)', 'Approved (NGN)', 'Status', 'Date', 'Bank', 'Account No', 'Payment Ref'];
    const rows = requests.map(r => [
      r.withdrawal_reference,
      r.staffId,
      `"${r.staff_name || ''}"`,
      `"${r.department || ''}"`,
      r.withdrawal_type,
      r.requested_amount,
      r.approved_amount || r.requested_amount,
      r.status,
      r.created_at ? r.created_at.slice(0, 10) : '',
      `"${r.bank_name || ''}"`,
      `"${r.account_number || ''}"`,
      `"${r.payment_reference || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `coop_savings_withdrawals_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!mounted) return null;

  // Filtered staff for dropdown autocomplete
  const filteredStaff = staffList.filter(s => {
    if (!staffSearch) return true;
    const q = staffSearch.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      String(s.staffId).includes(q) ||
      (s.department && s.department.toLowerCase().includes(q))
    );
  });

  const isPrivilegedUser = userCtx.isSuperAdmin || userCtx.isAdminStaff || userCtx.isFinanceStaff;

  return (
    <>
      <div className={styles.container}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1>Cooperative Savings Withdrawal</h1>
            <p>
              Staff portal for cooperative savings partial withdrawals and full account liquidations, featuring automated loan collateral verification, HR Head approval, and Finance disbursement.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setShowApplyDrawer(true)}
            >
              <Plus size={16} /> Apply for Withdrawal
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleExportCSV}
              disabled={requests.length === 0}
              title="Export ledger to CSV"
            >
              <Download size={16} /> Export CSV
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                loadRequests();
                if (selectedStaff) loadStaffDetails(selectedStaff.staffId || selectedStaff.id);
              }}
              title="Refresh ledger"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* ── Executive Stat Cards ── */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <Wallet size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Total Disbursed (Paid)</span>
              <span className={styles.statValue}>{fmtN(stats.total_paid_amount)}</span>
              <span className={styles.statSubtext}>{stats.paid_count} settlements completed</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Clock size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Pending HR Review</span>
              <span className={styles.statValue}>{stats.pending_count}</span>
              <span className={styles.statSubtext}>Awaiting HR Head action</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <NairaSign size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Awaiting Finance Payout</span>
              <span className={styles.statValue}>{stats.hr_review_count}</span>
              <span className={styles.statSubtext}>Approved by HR Head • Ready for Payout</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
              <XCircle size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Rejected / Cancelled</span>
              <span className={styles.statValue}>{stats.rejected_count}</span>
              <span className={styles.statSubtext}>Returned applications</span>
            </div>
          </div>
        </div>

        {/* ── Interactive Application Card (Collapsible) ── */}
        <AnimatePresence>
          {showApplyDrawer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={styles.mainCard}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  <ArrowUpRight size={20} className="text-emerald-400" />
                  New Cooperative Savings Withdrawal Application
                </div>
                <button
                  type="button"
                  className={styles.btnCloseModal}
                  onClick={() => setShowApplyDrawer(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleApplySubmit}>
                {/* Staff Selection (Privileged only, or display banner for regular staff) */}
                {isPrivilegedUser ? (
                  <div className="mb-4">
                    <label className={styles.label}>Select Staff Member</label>
                    <div className={styles.searchStaffWrapper} ref={staffDropdownRef}>
                      <Search size={16} className={styles.searchStaffIcon} />
                      <input
                        type="text"
                        placeholder="Search by Staff ID, Name, or Department..."
                        value={selectedStaff ? `Staff ID: ${selectedStaff.staffId || selectedStaff.id} — ${selectedStaff.name}` : staffSearch}
                        onChange={(e) => {
                          setStaffSearch(e.target.value);
                          setSelectedStaff(null);
                          setShowStaffDropdown(true);
                        }}
                        onFocus={() => setShowStaffDropdown(true)}
                        className={styles.searchStaffInput}
                      />
                      {showStaffDropdown && (
                        <div className={styles.staffDropdown}>
                          {filteredStaff.length === 0 ? (
                            <div className="p-3 text-xs text-slate-400 text-center">No staff found matching search.</div>
                          ) : (
                            filteredStaff.map((st) => (
                              <div
                                key={st.id}
                                className={styles.staffDropdownItem}
                                onClick={() => handleSelectStaff(st)}
                              >
                                <div>
                                  <div className={styles.staffDropdownName}>{st.name}</div>
                                  <div className={styles.staffDropdownMeta}>Staff ID: {st.staffId || st.id} • {st.department}</div>
                                </div>
                                <div className={styles.staffDropdownBalance}>{fmtN(st.saving_balance)}</div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  selectedStaff && (
                    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5 mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-400 uppercase font-semibold">Applying As Staff Member</div>
                        <div className="text-sm font-bold text-slate-100">{selectedStaff.name}</div>
                        <div className="text-xs text-slate-400">Staff ID: {selectedStaff.staffId || selectedStaff.id} • {selectedStaff.department}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400 uppercase font-semibold">Savings Balance</div>
                        <div className="text-base font-bold text-emerald-400">{fmtN(selectedStaff.saving_balance)}</div>
                      </div>
                    </div>
                  )
                )}

                {/* Live Balance & Collateral Breakdown */}
                {staffDetails && (
                  <>
                    <div className={styles.balanceBreakdownGrid}>
                      <div className={styles.breakdownItem}>
                        <span className={styles.breakdownLabel}>Total Savings Balance</span>
                        <span className={`${styles.breakdownValue} ${styles.valSavings}`}>{fmtN(staffDetails.saving_balance)}</span>
                      </div>
                      <div className={styles.breakdownItem}>
                        <span className={styles.breakdownLabel}>Active Loan Collateral</span>
                        <span className={`${styles.breakdownValue} ${styles.valLocked}`}>{fmtN(staffDetails.active_loan_balance)}</span>
                      </div>
                      <div className={styles.breakdownItem}>
                        <span className={styles.breakdownLabel}>Max Withdrawable</span>
                        <span className={`${styles.breakdownValue} ${styles.valWithdrawable}`}>{fmtN(staffDetails.max_withdrawable)}</span>
                      </div>
                      <div className={styles.breakdownItem}>
                        <span className={styles.breakdownLabel}>Balance After Payout</span>
                        <span className={`${styles.breakdownValue} ${styles.valProjected}`}>
                          {fmtN(Math.max(0, staffDetails.saving_balance - (parseCleanNumber(requestedAmount) || 0)))}
                        </span>
                      </div>
                    </div>

                    {/* Active Loan Collateral Warning */}
                    {staffDetails.active_loan_balance > 0 && (
                      <div className={styles.collateralWarningAlert}>
                        <ShieldAlert size={20} className="shrink-0 text-rose-400 mt-0.5" />
                        <div>
                          <strong>Active Loan Collateral Notice:</strong> This staff member has active cooperative loan deductions totaling{' '}
                          <span className="font-semibold text-rose-300">{fmtN(staffDetails.active_loan_balance)}</span>. In accordance with cooperative bylaws, this amount is locked as loan security. Partial withdrawals are strictly capped at{' '}
                          <span className="font-semibold text-emerald-300">{fmtN(staffDetails.max_withdrawable)}</span>, and full account liquidation is disallowed until the loan balance is cleared.
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Withdrawal Type Selection Tabs */}
                <div className={styles.typeSelector}>
                  <div
                    className={`${styles.typeCard} ${withdrawalType === 'partial' ? styles.typeCardActive : ''}`}
                    onClick={() => setWithdrawalType('partial')}
                  >
                    <div className={styles.typeCardTitle}>
                      <CreditCard size={17} className={withdrawalType === 'partial' ? 'text-emerald-400' : 'text-slate-400'} />
                      Partial Savings Withdrawal
                    </div>
                    <div className={styles.typeCardDesc}>
                      Withdraw a custom amount while maintaining active cooperative membership and monthly contributions.
                    </div>
                  </div>

                  <div
                    className={`${styles.typeCard} ${withdrawalType === 'full' ? styles.typeCardActive : ''}`}
                    onClick={() => {
                      if (staffDetails && staffDetails.active_loan_balance > 0) {
                        showToast(`Full liquidation disallowed: active loan of ${fmtN(staffDetails.active_loan_balance)} must be settled first.`, 'error');
                        return;
                      }
                      setWithdrawalType('full');
                    }}
                  >
                    <div className={styles.typeCardTitle}>
                      <Wallet size={17} className={withdrawalType === 'full' ? 'text-amber-400' : 'text-slate-400'} />
                      Full Account Liquidation
                    </div>
                    <div className={styles.typeCardDesc}>
                      Liquidate 100% of your accumulated savings balance. Account will close upon payout.
                    </div>
                  </div>
                </div>

                {/* Amount & Reason Form Grid */}
                <div className={styles.formGrid}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      Requested Withdrawal Amount (NGN) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={withdrawalType === 'full'}
                      placeholder="e.g. 20,000"
                      value={requestedAmount}
                      onChange={(e) => setRequestedAmount(formatNumberWithCommas(e.target.value))}
                      className={styles.input}
                      required
                    />
                    {parseCleanNumber(requestedAmount) > 0 && (
                      <div className={styles.amountHelper}>
                        {inWords(requestedAmount)}
                      </div>
                    )}

                    {/* Quick percentage buttons for partial withdrawal */}
                    {withdrawalType === 'partial' && staffDetails && staffDetails.max_withdrawable > 0 && (
                      <div className={styles.presetChips}>
                        <button
                          type="button"
                          className={styles.presetBtn}
                          onClick={() => setRequestedAmount(formatNumberWithCommas((staffDetails.max_withdrawable * 0.25).toFixed(2)))}
                        >
                          25%
                        </button>
                        <button
                          type="button"
                          className={styles.presetBtn}
                          onClick={() => setRequestedAmount(formatNumberWithCommas((staffDetails.max_withdrawable * 0.50).toFixed(2)))}
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          className={styles.presetBtn}
                          onClick={() => setRequestedAmount(formatNumberWithCommas((staffDetails.max_withdrawable * 0.75).toFixed(2)))}
                        >
                          75%
                        </button>
                        <button
                          type="button"
                          className={styles.presetBtn}
                          onClick={() => setRequestedAmount(formatNumberWithCommas(staffDetails.max_withdrawable.toFixed(2)))}
                        >
                          Max ({fmtN(staffDetails.max_withdrawable)})
                        </button>
                      </div>
                    )}
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      Purpose / Reason for Withdrawal <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      placeholder="State the purpose (e.g. medical emergency, school fees, property investment, personal project)..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className={styles.textarea}
                      required
                    />
                  </div>
                </div>

                {/* Verified Payout Bank Details */}
                <div className={styles.bankDetailsCard}>
                  <div className={styles.bankDetailsHeader}>
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-emerald-400" />
                      <span>Disbursement Bank Account Details</span>
                    </div>
                    <span className="text-xs text-slate-400">Funds will be transferred here upon Finance approval</span>
                  </div>

                  <div className={styles.bankInputsRow}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Bank Name <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        placeholder="e.g. Zenith Bank, GTBank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className={styles.input}
                        required
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Account Number <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        placeholder="10-digit NUBAN"
                        maxLength="12"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className={styles.input}
                        required
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Account Name <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        placeholder="Account holder name"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        className={styles.input}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setShowApplyDrawer(false)}
                    disabled={applying}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={applying || !selectedStaff || (staffDetails && staffDetails.max_withdrawable <= 0)}
                  >
                    {applying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Submit Application for HR Head Review
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filters & Search Controls ── */}
        <div className={styles.controlsSection}>
          <div className={styles.filterTabs}>
            <button
              type="button"
              className={`${styles.tabBtn} ${statusFilter === 'all' ? styles.tabBtnActive : ''}`}
              onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
            >
              All <span className={styles.tabBadge}>{stats.total_applications}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${statusFilter === 'pending' ? styles.tabBtnActive : ''}`}
              onClick={() => { setStatusFilter('pending'); setCurrentPage(1); }}
            >
              Pending HR <span className={styles.tabBadge}>{stats.pending_count}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${statusFilter === 'hr_approved' ? styles.tabBtnActive : ''}`}
              onClick={() => { setStatusFilter('hr_approved'); setCurrentPage(1); }}
            >
              Awaiting Payout <span className={styles.tabBadge}>{stats.hr_review_count}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${statusFilter === 'paid' ? styles.tabBtnActive : ''}`}
              onClick={() => { setStatusFilter('paid'); setCurrentPage(1); }}
            >
              Paid & Settled <span className={styles.tabBadge}>{stats.paid_count}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${statusFilter === 'rejected' ? styles.tabBtnActive : ''}`}
              onClick={() => { setStatusFilter('rejected'); setCurrentPage(1); }}
            >
              Rejected <span className={styles.tabBadge}>{stats.rejected_count}</span>
            </button>
          </div>

          <div className={styles.searchLedger}>
            <Search size={15} className={styles.searchLedgerIcon} />
            <input
              type="text"
              placeholder="Search reference, staff ID, or name..."
              value={ledgerSearch}
              onChange={(e) => {
                setLedgerSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* ── Applications Ledger Table ── */}
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Voucher Ref</th>
                <th>Staff ID & Name</th>
                <th>Department</th>
                <th className={styles.thCenter}>Type</th>
                <th className={styles.thRight}>Requested</th>
                <th className={styles.thRight}>Approved</th>
                <th>Workflow Status</th>
                <th>Date</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-12">
                    <Loader2 size={24} className="animate-spin text-emerald-400 mx-auto mb-2" />
                    <span className="text-xs text-slate-400">Loading cooperative withdrawal records...</span>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-slate-400 text-sm">
                    <FileText size={28} className="mx-auto text-slate-500 mb-2 opacity-50" />
                    <div>No cooperative withdrawal applications found matching your criteria.</div>
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const isPending = r.status === 'pending';
                  const isHrApproved = r.status === 'hr_approved';
                  const isAuditApproved = r.status === 'audit_approved';
                  const isPaid = r.status === 'paid';
                  const isRejected = ['hr_rejected', 'audit_rejected', 'finance_rejected'].includes(r.status);

                  return (
                    <tr key={r.id}>
                      <td>
                        <span className={styles.voucherRefBadge}>
                          {r.withdrawal_reference}
                        </span>
                      </td>
                      <td>
                        <div className={styles.staffCell}>
                          <div className={styles.staffAvatar}>
                            {(r.staff_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className={styles.staffInfo}>
                            <span className={styles.staffName} title={r.staff_name}>
                              {r.staff_name}
                            </span>
                            <div className={styles.staffMeta}>
                              <span className={styles.staffIdBadge}>ID: #{r.staffId}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.deptCell}>
                          <span className={styles.deptBadge}>{r.department || 'General'}</span>
                        </div>
                      </td>
                      <td className={styles.cellCenter}>
                        <span className={r.withdrawal_type === 'full' ? styles.badgeTypeFull : styles.badgeTypePartial}>
                          {r.withdrawal_type === 'full' ? 'Full Liquidation' : 'Partial'}
                        </span>
                      </td>
                      <td className={styles.cellRight}>
                        <span className={styles.amountRequested}>{fmtN(r.requested_amount)}</span>
                      </td>
                      <td className={styles.cellRight}>
                        <span className={styles.amountApproved}>{fmtN(r.approved_amount || r.requested_amount)}</span>
                      </td>
                      <td>
                        {/* Status Badge + Visual Progress Stepper */}
                        <div className={styles.workflowCell}>
                          <div>
                            {isPending && <span className={styles.badgePending}><Clock size={12} /> Pending HR Head</span>}
                            {(isHrApproved || isAuditApproved) && <span className={styles.badgeHrApproved}><UserCheck size={12} /> HR Head Approved</span>}
                            {isPaid && <span className={styles.badgePaid}><CheckCircle2 size={12} /> Disbursed (Paid)</span>}
                            {isRejected && <span className={styles.badgeRejected}><XCircle size={12} /> Rejected</span>}
                          </div>

                          {/* 3-segment progress bar */}
                          <div className={styles.workflowProgressBar} title={`Workflow Stage: ${r.status}`}>
                            <div
                              className={`${styles.progressSegment} ${styles.segmentPassed}`}
                              title="1. Application Submitted"
                            />
                            <div
                              className={`${styles.progressSegment} ${isHrApproved || isAuditApproved || isPaid ? styles.segmentPassed : (isPending ? styles.segmentActive : '')}`}
                              title="2. HR Head Approval"
                            />
                            <div
                              className={`${styles.progressSegment} ${isPaid ? styles.segmentPassed : ((isHrApproved || isAuditApproved) ? styles.segmentActive : '')}`}
                              title="3. Finance Payment Disbursed"
                            />
                          </div>
                        </div>
                      </td>
                      <td className={styles.dateCell}>
                        {fmtDate(r.created_at)}
                      </td>
                      <td className={styles.actionsCell}>
                        <div className={styles.actionBtnGroup}>
                          {/* View details modal button */}
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnView}`}
                            onClick={() => setViewRequest(r)}
                            title="View request timeline & audit details"
                          >
                            <FileText size={12} /> Details
                          </button>

                          {/* Stage 1: HR Head Review Button */}
                          {isPending && (userCtx.isSuperAdmin || userCtx.isAdminStaff) && (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnReview}`}
                              onClick={() => {
                                setHrReviewModal(r);
                                setApprovedAmountInput(formatNumberWithCommas(r.requested_amount));
                                setReviewAction('approve');
                                setReviewNotes('');
                              }}
                              title="HR Head review & recommendation"
                            >
                              <UserCheck size={12} /> HR Review
                            </button>
                          )}

                          {/* Stage 2: Finance Payout Button */}
                          {(isHrApproved || isAuditApproved) && (userCtx.isSuperAdmin || userCtx.isFinanceStaff) && (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnPay}`}
                              onClick={() => {
                                setFinancePayoutModal(r);
                                setReviewAction('pay');
                                setPaymentMethod('bank_transfer');
                                setPaymentReference('');
                                setReviewNotes('');
                              }}
                              title="Process finance payout & ledger settlement"
                            >
                              <NairaSign size={13} /> Disburse
                            </button>
                          )}

                          {/* Official Printable Voucher Button */}
                          {isPaid && (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnVoucher}`}
                              onClick={() => handleOpenVoucher(r.id)}
                              title="Print official payment voucher & settlement receipt"
                            >
                              <Printer size={12} /> Voucher
                            </button>
                          )}

                          {/* Staff cancel button for pending requests */}
                          {isPending && (userCtx.isSuperAdmin || (userCtx.currentEmployee && userCtx.currentEmployee.id === r.staffId)) && (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnCancel}`}
                              onClick={() => handleCancelRequest(r.id, r.withdrawal_reference)}
                              title="Cancel pending application"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {requestsTotal > perPage && (
          <div className={styles.pagination}>
            <div>
              Showing {Math.min((currentPage - 1) * perPage + 1, requestsTotal)} to {Math.min(currentPage * perPage, requestsTotal)} of {requestsTotal} records
            </div>
            <div className={styles.pageControls}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="px-2 font-semibold text-slate-300">
                Page {currentPage} of {Math.ceil(requestsTotal / perPage)}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage >= Math.ceil(requestsTotal / perPage)}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── View Request Timeline Details Modal ── */}
      <AnimatePresence>
        {viewRequest && (
          <div className={styles.modalBackdrop}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={styles.modalContent}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <FileText size={18} className="text-emerald-400" />
                  Withdrawal Application: {viewRequest.withdrawal_reference}
                </h3>
                <button type="button" className={styles.btnCloseModal} onClick={() => setViewRequest(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.modalInfoBox}>
                  <div className={styles.modalInfoRow}>
                    <span className={styles.modalInfoLabel}>Staff Member</span>
                    <span className={styles.modalInfoVal}>{viewRequest.staff_name} (Staff ID: {viewRequest.staffId})</span>
                  </div>
                  <div className={styles.modalInfoRow}>
                    <span className={styles.modalInfoLabel}>Department</span>
                    <span className={styles.modalInfoVal}>{viewRequest.department || 'General'}</span>
                  </div>
                  <div className={styles.modalInfoRow}>
                    <span className={styles.modalInfoLabel}>Withdrawal Type</span>
                    <span className={styles.modalInfoVal} style={{ textTransform: 'capitalize' }}>
                      {viewRequest.withdrawal_type === 'full' ? 'Full Liquidation' : 'Partial Withdrawal'}
                    </span>
                  </div>
                  <div className={styles.modalInfoRow}>
                    <span className={styles.modalInfoLabel}>Requested Amount</span>
                    <span className={styles.modalInfoVal} style={{ color: '#34d399', fontWeight: '800' }}>
                      {fmtN(viewRequest.requested_amount)}
                    </span>
                  </div>
                  <div className={styles.modalInfoRow}>
                    <span className={styles.modalInfoLabel}>Disbursement Bank</span>
                    <span className={styles.modalInfoVal} style={{ fontFamily: 'monospace' }}>
                      {viewRequest.bank_name} • {viewRequest.account_number} ({viewRequest.account_name})
                    </span>
                  </div>
                  <div className={styles.modalInfoRow}>
                    <span className={styles.modalInfoLabel}>Reason / Purpose</span>
                    <span className={styles.modalInfoVal} style={{ fontStyle: 'italic', fontWeight: 'normal', color: '#cbd5e1' }}>
                      {viewRequest.reason}
                    </span>
                  </div>
                </div>

                {/* Multi-Stage Workflow Progression Timeline */}
                <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">Workflow Progression</h4>
                <div className={styles.timeline}>
                  {/* Step 1: Submission */}
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineIcon} style={{ background: '#10b981', color: '#fff' }}>
                      <Check size={16} />
                    </div>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineTitle}>1. Application Submitted</div>
                      <div className={styles.timelineMeta}>{fmtDate(viewRequest.created_at)}</div>
                    </div>
                  </div>

                  {/* Step 2: HR Head Review */}
                  <div className={styles.timelineItem}>
                    <div
                      className={styles.timelineIcon}
                      style={{
                        background: viewRequest.hr_reviewed_at ? (viewRequest.status === 'hr_rejected' ? '#ef4444' : '#10b981') : '#334155',
                        color: '#fff'
                      }}
                    >
                      {viewRequest.hr_reviewed_at ? (viewRequest.status === 'hr_rejected' ? <X size={16} /> : <Check size={16} />) : <Clock size={16} />}
                    </div>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineTitle}>2. HR Head Approval</div>
                      <div className={styles.timelineMeta}>
                        {viewRequest.hr_reviewed_at ? `${fmtDate(viewRequest.hr_reviewed_at)} • Approved by ${viewRequest.hr_reviewer_name || 'HR Head'}` : 'Pending HR Head review'}
                      </div>
                      {viewRequest.hr_notes && <div className={styles.timelineNotes}>Remarks: {viewRequest.hr_notes}</div>}
                    </div>
                  </div>

                  {/* Step 3: Finance Disbursement */}
                  <div className={styles.timelineItem}>
                    <div
                      className={styles.timelineIcon}
                      style={{
                        background: viewRequest.finance_paid_at ? (viewRequest.status === 'finance_rejected' ? '#ef4444' : '#10b981') : '#334155',
                        color: '#fff'
                      }}
                    >
                      {viewRequest.finance_paid_at ? (viewRequest.status === 'finance_rejected' ? <X size={16} /> : <Check size={16} />) : <Clock size={16} />}
                    </div>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineTitle}>3. Finance Payout & Settlement</div>
                      <div className={styles.timelineMeta}>
                        {viewRequest.finance_paid_at ? `${fmtDate(viewRequest.payment_date || viewRequest.finance_paid_at)} • Disbursed by ${viewRequest.finance_payer_name || 'Finance Officer'}` : 'Awaiting Finance payment execution'}
                      </div>
                      {viewRequest.finance_notes && <div className={styles.timelineNotes}>Remarks: {viewRequest.finance_notes}</div>}
                      {viewRequest.payment_reference && (
                        <div className="text-xs text-emerald-400 font-mono mt-1">Payment Ref: {viewRequest.payment_reference}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setViewRequest(null)}>
                  Close
                </button>
                {viewRequest.status === 'paid' && (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => {
                      setViewRequest(null);
                      handleOpenVoucher(viewRequest.id);
                    }}
                  >
                    <Printer size={16} /> Print Voucher
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── HR Head Review Modal ── */}
      <AnimatePresence>
        {hrReviewModal && (
          <div className={styles.modalBackdrop}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <UserCheck size={18} className="text-blue-400" />
                  HR Head Review: {hrReviewModal.withdrawal_reference}
                </h3>
                <button type="button" className={styles.btnCloseModal} onClick={() => setHrReviewModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.modalInfoBox}>
                  <div className={styles.modalInfoRow}>
                    <span className={styles.modalInfoLabel}>Staff Member</span>
                    <span className={styles.modalInfoVal}>{hrReviewModal.staff_name} (Staff ID: {hrReviewModal.staffId})</span>
                  </div>
                  <div className={styles.modalInfoRow}>
                    <span className={styles.modalInfoLabel}>Requested Amount</span>
                    <span className={styles.modalInfoVal} style={{ color: '#34d399', fontWeight: '700' }}>
                      {fmtN(hrReviewModal.requested_amount)} ({hrReviewModal.withdrawal_type === 'full' ? 'Full Liquidation' : 'Partial'})
                    </span>
                  </div>
                  <div className={styles.modalInfoRow}>
                    <span className={styles.modalInfoLabel}>Reason / Purpose</span>
                    <span className={styles.modalInfoVal} style={{ fontStyle: 'italic', fontWeight: 'normal', color: '#cbd5e1' }}>
                      {hrReviewModal.reason}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className={styles.label}>HR Recommendation Decision</label>
                  <div className={styles.decisionGroup}>
                    <button
                      type="button"
                      className={`${styles.btnDecision} ${reviewAction === 'approve' ? styles.btnDecisionApproveActive : ''}`}
                      onClick={() => setReviewAction('approve')}
                    >
                      <Check size={16} /> Recommend & Approve
                    </button>
                    <button
                      type="button"
                      className={`${styles.btnDecision} ${reviewAction === 'reject' ? styles.btnDecisionRejectActive : ''}`}
                      onClick={() => setReviewAction('reject')}
                    >
                      <X size={16} /> Reject Application
                    </button>
                  </div>
                </div>

                {reviewAction === 'approve' && (
                  <div className="mb-4">
                    <label className={styles.label}>Approved Amount (NGN)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 20,000"
                      value={approvedAmountInput}
                      onChange={(e) => setApprovedAmountInput(formatNumberWithCommas(e.target.value))}
                      className={styles.input}
                    />
                    {parseCleanNumber(approvedAmountInput) > 0 && (
                      <div className={styles.amountHelper}>
                        {inWords(approvedAmountInput)}
                      </div>
                    )}
                  </div>
                )}

                <div className="mb-2">
                  <label className={styles.label}>HR Head Comments / Remarks</label>
                  <textarea
                    placeholder="Enter review remarks or reason for decision..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className={styles.textarea}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setHrReviewModal(null)} disabled={actionProcessing}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={reviewAction === 'approve' ? styles.btnPrimary : styles.btnSecondary}
                  style={reviewAction === 'reject' ? { borderColor: '#ef4444', color: '#f87171' } : {}}
                  onClick={handleHrReviewSubmit}
                  disabled={actionProcessing}
                >
                  {actionProcessing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Confirm HR Decision
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* ── Finance Payout Modal ── */}
      <AnimatePresence>
        {financePayoutModal && (
          <div className={styles.modalBackdrop}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <NairaSign size={18} className="text-emerald-400" />
                  Finance Payout & Settlement: {financePayoutModal.withdrawal_reference}
                </h3>
                <button type="button" className={styles.btnCloseModal} onClick={() => setFinancePayoutModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.payoutAlertBox}>
                  <div className={styles.payoutAmountHeader}>
                    Disbursing: {fmtN(financePayoutModal.approved_amount || financePayoutModal.requested_amount)}
                  </div>
                  <div className={styles.payoutDetailsRow}>
                    <strong>Beneficiary:</strong> {financePayoutModal.staff_name} (Staff ID: {financePayoutModal.staffId})
                  </div>
                  <div className={styles.payoutDetailsRow}>
                    <strong>Bank Account:</strong> {financePayoutModal.bank_name} • {financePayoutModal.account_number} ({financePayoutModal.account_name})
                  </div>
                  <div className={styles.payoutNotice}>
                    * Executing this payout will automatically debit the staff member&apos;s cooperative savings balance.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className={styles.select}
                    >
                      <option value="bank_transfer">Direct Bank Transfer</option>
                      <option value="cheque">Bank Cheque</option>
                      <option value="cash">Cash Voucher</option>
                    </select>
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Payment Date</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Payment Reference / Session ID</label>
                    <input
                      type="text"
                      placeholder="e.g. NIBSS-TRF-0987654"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Payment Receipt / Proof (Optional)</label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => setProofFile(e.target.files[0] || null)}
                      className="text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-emerald-400 hover:file:bg-slate-700"
                    />
                  </div>
                </div>

                <div className="mb-2">
                  <label className={styles.label}>Finance Officer Remarks</label>
                  <textarea
                    placeholder="Enter disbursement notes, bank session ref, or remarks..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className={styles.textarea}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setFinancePayoutModal(null)} disabled={actionProcessing}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleFinancePayoutSubmit}
                  disabled={actionProcessing}
                >
                  {actionProcessing ? <Loader2 size={16} className="animate-spin" /> : <NairaSign size={16} />}
                  Confirm Payment & Debit Savings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Official Printable Voucher Modal ── */}
      <AnimatePresence>
        {voucherModalData && (
          <div className={styles.modalBackdrop}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className={`${styles.modalContent} ${styles.voucherModal}`}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <Printer size={18} className="text-emerald-400" />
                  Official Payment Voucher & Settlement
                </h3>
                <button type="button" className={styles.btnCloseModal} onClick={() => setVoucherModalData(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.voucherContainer}>
                  <div className={styles.voucherHeader}>
                    <div className={styles.voucherOrgTitle}>ISALU HOSPITALS LIMITED</div>
                    <div className={styles.voucherCoopTitle}>STAFF COOPERATIVE MULTIPURPOSE SOCIETY</div>
                    <div className={styles.voucherBadge}>
                      SAVINGS WITHDRAWAL PAYMENT VOUCHER & SETTLEMENT
                    </div>
                  </div>

                  <div className={styles.voucherMetaGrid}>
                    <div className={styles.voucherMetaItem}>
                      <span className={styles.voucherMetaLabel}>Voucher Ref</span>
                      <span className={styles.voucherMetaVal} style={{ fontFamily: 'monospace' }}>{voucherModalData.withdrawal_reference}</span>
                    </div>
                    <div className={styles.voucherMetaItem}>
                      <span className={styles.voucherMetaLabel}>Payment Date</span>
                      <span className={styles.voucherMetaVal}>{fmtDate(voucherModalData.payment_date || voucherModalData.updated_at)}</span>
                    </div>
                    <div className={styles.voucherMetaItem}>
                      <span className={styles.voucherMetaLabel}>Staff Member</span>
                      <span className={styles.voucherMetaVal}>{voucherModalData.staff_name}</span>
                    </div>
                    <div className={styles.voucherMetaItem}>
                      <span className={styles.voucherMetaLabel}>Staff ID / Dept</span>
                      <span className={styles.voucherMetaVal}>Staff ID: {voucherModalData.staffId} • {voucherModalData.department || 'General'}</span>
                    </div>
                    <div className={styles.voucherMetaItem}>
                      <span className={styles.voucherMetaLabel}>Withdrawal Type</span>
                      <span className={styles.voucherMetaVal} style={{ textTransform: 'capitalize' }}>
                        {voucherModalData.withdrawal_type === 'full' ? 'Full Liquidation' : 'Partial Withdrawal'}
                      </span>
                    </div>
                    <div className={styles.voucherMetaItem}>
                      <span className={styles.voucherMetaLabel}>Payment Method & Ref</span>
                      <span className={styles.voucherMetaVal}>
                        {voucherModalData.payment_method ? voucherModalData.payment_method.replace('_', ' ').toUpperCase() : 'BANK TRANSFER'} • {voucherModalData.payment_reference || '—'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.voucherAmountBox}>
                    <div className={styles.voucherAmountLabel}>Total Amount Disbursed</div>
                    <div className={styles.voucherAmountVal}>{fmtN(voucherModalData.approved_amount || voucherModalData.requested_amount)}</div>
                    <div className={styles.voucherAmountWords}>{inWords(voucherModalData.approved_amount || voucherModalData.requested_amount)}</div>
                  </div>

                  <div className={styles.voucherBankBox}>
                    <div><strong style={{ display: 'block', color: '#64748b' }}>Bank Name:</strong>{voucherModalData.bank_name || '—'}</div>
                    <div><strong style={{ display: 'block', color: '#64748b' }}>Account No:</strong><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{voucherModalData.account_number || '—'}</span></div>
                    <div><strong style={{ display: 'block', color: '#64748b' }}>Beneficiary:</strong>{voucherModalData.account_name || voucherModalData.staff_name}</div>
                  </div>

                  <table className={styles.voucherTable}>
                    <tbody>
                      <tr>
                        <td>Cooperative Savings Balance (Before Payout)</td>
                        <td>{fmtN(voucherModalData.balance_before_payout || voucherModalData.current_savings_balance)}</td>
                      </tr>
                      <tr>
                        <td>Amount Withdrawn / Disbursed to Staff</td>
                        <td style={{ color: '#dc2626' }}>-{fmtN(voucherModalData.approved_amount || voucherModalData.requested_amount)}</td>
                      </tr>
                      <tr className={styles.totalRow}>
                        <td>Cooperative Savings Balance (After Payout)</td>
                        <td>{fmtN(voucherModalData.balance_after_payout !== null && voucherModalData.balance_after_payout !== undefined ? voucherModalData.balance_after_payout : (voucherModalData.current_savings_balance - (voucherModalData.approved_amount || voucherModalData.requested_amount)))}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className={styles.voucherSignatures}>
                    <div className={styles.voucherSigBlock}>
                      <div className={styles.voucherSigName}>{voucherModalData.staff_name}</div>
                      <div className={styles.voucherSigLine}>Staff Beneficiary</div>
                    </div>
                    <div className={styles.voucherSigBlock}>
                      <div className={styles.voucherSigName}>{voucherModalData.hr_reviewer_name || 'HR Head'}</div>
                      <div className={styles.voucherSigLine}>HR Head Approved</div>
                    </div>
                    <div className={styles.voucherSigBlock}>
                      <div className={styles.voucherSigName}>{voucherModalData.finance_payer_name || 'Finance Officer'}</div>
                      <div className={styles.voucherSigLine}>Finance Disbursed</div>
                    </div>
                  </div>

                  <div className={styles.voucherFooter}>
                    Printed on {new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • Official Isalu HRMS Cooperative Ledger
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setVoucherModalData(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => handlePrintVoucher(voucherModalData)}
                >
                  <Printer size={16} /> Print Voucher
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
            className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}
          >
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
