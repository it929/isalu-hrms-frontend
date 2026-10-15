'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  Users,
  Search,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Printer,
  Sparkles,
  Loader2,
  CreditCard,
  LogOut,
  Clock,
  Check,
  X,
  TrendingDown,
  Percent,
  ShieldCheck,
  Eye,
  ExternalLink,
  Mail,
  Download,
  Edit2,
  Save,
  Briefcase,
  FileText,
  Scale,
  Calculator,
  RotateCcw,
  ShieldAlert,
  Wallet
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
  const headers = {};
  if (uid) headers['X-User-Id'] = uid;
  try {
    const rawRole = localStorage.getItem('hrms_role');
    if (rawRole) {
      const parsed = JSON.parse(rawRole);
      const roleName = parsed?.rolename || parsed?.name || parsed?.role_name || '';
      if (roleName) {
        headers['X-User-Role'] = roleName;
      }
    }
  } catch { /* ignore */ }
  return headers;
}

function fmt(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month}, ${year}`;
  } catch {
    return dateStr;
  }
}

export default function ResignationSettlementPage() {
  // State
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Data
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({
    total_approved_resigned: 0,
    total_notice_earnings: 0,
    total_retention_refunds: 0,
    total_coop_savings_refunds: 0,
    total_deductions: 0,
    total_net_settlement: 0,
  });

  const [userPermissions, setUserPermissions] = useState({
    is_super_admin: false,
    is_hr_head: false,
    is_finance_head: false,
    is_admin_staff: false,
    is_audit_staff: false,
    is_finance_staff: false,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('all'); // all, payable, recoverable
  const [workflowFilter, setWorkflowFilter] = useState('all'); // all, pending_audit, ready_for_payment, paid

  // Modal Detailed Breakdown State
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [settlementData, setSettlementData] = useState(null);

  // Audit Action Dialog State
  const [auditDialog, setAuditDialog] = useState({
    open: false,
    record: null,
    remarks: '',
    loading: false,
  });

  // Finance Payment Dialog State
  const [financeDialog, setFinanceDialog] = useState({
    open: false,
    record: null,
    paymentReference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    remarks: '',
    loading: false,
  });

  // Edit Retention Months State
  const [retentionModal, setRetentionModal] = useState({
    open: false,
    staffId: null,
    staffName: '',
    resignationId: null,
    baseSalary: 0,
    monthlyRate: 0,
    months: 0,
    loading: false,
  });

  // Resubmit / Forward to Audit Dialog State (for HR Head & Finance Head)
  const [resubmitDialog, setResubmitDialog] = useState({
    open: false,
    record: null,
    remarks: '',
    loading: false,
  });

  // Edit Medical Loan Balance State
  const [medicalLoanModal, setMedicalLoanModal] = useState({
    open: false,
    staffId: null,
    staffName: '',
    resignationId: null,
    currentBalance: 0,
    newBalance: '',
    reason: '',
    loading: false,
  });

  // Edit Cooperative Loan Balance State
  const [coopLoanModal, setCoopLoanModal] = useState({
    open: false,
    staffId: null,
    staffName: '',
    resignationId: null,
    currentBalance: 0,
    newBalance: '',
    reason: '',
    loading: false,
  });

  // Payment in Lieu of Notice Modal State
  const [noticeInLieuModal, setNoticeInLieuModal] = useState({
    open: false,
    staffId: null,
    staffName: '',
    resignationId: null,
    monthlyGross: 0,
    dailyRate: 0,
    daysInMonth: 30,
    currentAmount: 0,
    currentDays: 0,
    calculationMode: 'days', // 'days' | 'amount'
    days: '',
    amount: '',
    deductionSource: 'general', // 'general' | 'retention' | 'salary' | 'coop_savings'
    reason: '',
    retentionAvailable: 0,
    salaryAvailable: 0,
    coopSavingsAvailable: 0,
    totalEarningsAvailable: 0,
    loading: false,
  });

  const getActiveRoleName = () => {
    if (typeof window === 'undefined') return '';
    try {
      const rawRole = localStorage.getItem('hrms_role');
      if (rawRole) {
        const parsed = JSON.parse(rawRole);
        return (parsed?.rolename || parsed?.name || parsed?.role_name || '').toLowerCase().trim();
      }
    } catch { /* ignore */ }
    return '';
  };

  const storedRoleName = getActiveRoleName();
  const isSuperAdminUser = Boolean(userPermissions.is_super_admin || ['super admin', 'super administrator', 'superadmin', 'admin', 'administrator'].includes(storedRoleName));
  const isHrHeadUser = Boolean(userPermissions.is_hr_head || ['hr head', 'head of hr'].includes(storedRoleName));
  const isFinanceHeadUser = Boolean(userPermissions.is_finance_head || ['finance head', 'head of finance'].includes(storedRoleName));

  const canManageRetention = userPermissions.is_super_admin || userPermissions.is_admin_staff || userPermissions.is_finance_staff;
  const canManageMedicalLoan = userPermissions.is_super_admin || userPermissions.is_admin_staff || userPermissions.is_finance_staff;
  const canManageCoopLoan = userPermissions.is_super_admin || userPermissions.is_admin_staff || userPermissions.is_finance_staff;
  
  // Payment in Lieu of Notice is strictly restricted to Super Admin, HR Head, and Finance Head alone
  const canManageNoticeInLieu = isSuperAdminUser || isHrHeadUser || isFinanceHeadUser;

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch Approved Resignations List
  const fetchApprovedRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const res = await axios.get(`${API_BASE}/payroll/resignations/approved`, {
        headers: buildHeaders(),
        params
      });

      if (res.data.status === 'success') {
        setRecords(res.data.data || []);
        if (res.data.summary) setSummary(res.data.summary);
        if (res.data.user_permissions) setUserPermissions(res.data.user_permissions);
      } else {
        showToast(res.data.message || 'Failed to fetch approved resignations.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error loading approved resignations.', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, fromDate, toDate]);

  useEffect(() => {
    if (mounted) {
      fetchApprovedRecords();
    }
  }, [mounted, fetchApprovedRecords]);

  // Fetch single detailed settlement breakdown
  const handleOpenBreakdown = async (recordId) => {
    setSelectedRecordId(recordId);
    setModalLoading(true);
    setSettlementData(null);
    try {
      const res = await axios.get(`${API_BASE}/payroll/resignations/settlement/${recordId}`, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success') {
        setSettlementData(res.data.data);
        if (res.data.data.user_permissions) {
          setUserPermissions(res.data.data.user_permissions);
        }
      } else {
        showToast(res.data.message || 'Failed to calculate settlement breakdown.', 'error');
        setSelectedRecordId(null);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error loading settlement details.', 'error');
      setSelectedRecordId(null);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedRecordId(null);
    setSettlementData(null);
  };

  // Open Audit Dialog
  const handleOpenAuditDialog = (rec, e) => {
    if (e) e.stopPropagation();
    if (!canAudit) {
      showToast('Permission denied: Only Audit Head and Super Admin can check and approve audit.', 'error');
      return;
    }
    setAuditDialog({
      open: true,
      record: rec,
      remarks: 'Audited and verified exit settlement calculations for payment clearance.',
      loading: false,
    });
  };

  // Submit Audit Approval
  const handleSubmitAuditApprove = async () => {
    if (!auditDialog.record) return;
    setAuditDialog((prev) => ({ ...prev, loading: true }));
    try {
      const res = await axios.post(
        `${API_BASE}/payroll/resignations/audit-approve/${auditDialog.record.id}`,
        { remarks: auditDialog.remarks },
        { headers: buildHeaders() }
      );
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Audited and approved for payment.');
        setAuditDialog({ open: false, record: null, remarks: '', loading: false });
        fetchApprovedRecords();
        if (selectedRecordId === auditDialog.record.id) {
          handleOpenBreakdown(auditDialog.record.id);
        }
      } else {
        showToast(res.data.message || 'Audit action failed.', 'error');
        setAuditDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Audit approval error.', 'error');
      setAuditDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Submit Audit Rejection / Query
  const handleSubmitAuditReject = async () => {
    if (!auditDialog.record) return;
    if (!auditDialog.remarks.trim()) {
      showToast('Please provide remarks/reason for audit query.', 'error');
      return;
    }
    setAuditDialog((prev) => ({ ...prev, loading: true }));
    try {
      const res = await axios.post(
        `${API_BASE}/payroll/resignations/audit-reject/${auditDialog.record.id}`,
        { remarks: auditDialog.remarks },
        { headers: buildHeaders() }
      );
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Exit settlement queried by Audit.');
        setAuditDialog({ open: false, record: null, remarks: '', loading: false });
        fetchApprovedRecords();
        if (selectedRecordId === auditDialog.record.id) {
          handleOpenBreakdown(auditDialog.record.id);
        }
      } else {
        showToast(res.data.message || 'Audit query failed.', 'error');
        setAuditDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Audit query error.', 'error');
      setAuditDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Finance Payment / Recovery Dialog
  const handleOpenFinanceDialog = (rec, e) => {
    if (e) e.stopPropagation();
    if (!canFinance) {
      showToast('Permission denied: Only Finance Head and Super Admin can mark exit settlement as paid.', 'error');
      return;
    }
    const isRecoverable = rec.settlement_type === 'recoverable' || parseFloat(rec.net_settlement) < 0;
    setFinanceDialog({
      open: true,
      record: rec,
      isRecoverable,
      paymentReference: '',
      paymentDate: new Date().toISOString().split('T')[0],
      remarks: isRecoverable
        ? 'Exit settlement debt recovered and confirmed by Finance.'
        : 'Exit settlement payment disbursed.',
      loading: false,
    });
  };

  // Submit Finance Payment / Recovery
  const handleSubmitFinancePayment = async () => {
    if (!financeDialog.record) return;
    setFinanceDialog((prev) => ({ ...prev, loading: true }));
    try {
      const res = await axios.post(
        `${API_BASE}/payroll/resignations/finance-pay/${financeDialog.record.id}`,
        {
          payment_reference: financeDialog.paymentReference,
          payment_date: financeDialog.paymentDate,
          remarks: financeDialog.remarks,
        },
        { headers: buildHeaders() }
      );
      if (res.data.status === 'success') {
        showToast(res.data.message || (financeDialog.isRecoverable ? 'Exit settlement debt marked as recovered & cleared.' : 'Exit settlement marked as paid.'));
        setFinanceDialog({ open: false, record: null, isRecoverable: false, paymentReference: '', paymentDate: '', remarks: '', loading: false });
        fetchApprovedRecords();
        if (selectedRecordId === financeDialog.record.id) {
          handleOpenBreakdown(financeDialog.record.id);
        }
      } else {
        showToast(res.data.message || 'Finance action failed.', 'error');
        setFinanceDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Finance action error.', 'error');
      setFinanceDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Resubmit / Forward to Audit Dialog (for HR Head or Finance Head)
  const handleOpenResubmitDialog = (rec, e) => {
    if (e) e.stopPropagation();
    setResubmitDialog({
      open: true,
      record: rec,
      remarks: 'Reviewed and corrected exit settlement calculations. Forwarded back for audit approval.',
      loading: false,
    });
  };

  // Submit Resubmission to Audit Head
  const handleSubmitResubmit = async () => {
    if (!resubmitDialog.record) return;
    setResubmitDialog((prev) => ({ ...prev, loading: true }));
    try {
      const res = await axios.post(
        `${API_BASE}/payroll/resignations/resubmit-audit/${resubmitDialog.record.id}`,
        { remarks: resubmitDialog.remarks },
        { headers: buildHeaders() }
      );
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Corrected and forwarded back to Audit Head for approval.');
        setResubmitDialog({ open: false, record: null, remarks: '', loading: false });
        fetchApprovedRecords();
        if (selectedRecordId === resubmitDialog.record.id) {
          handleOpenBreakdown(resubmitDialog.record.id);
        }
      } else {
        showToast(res.data.message || 'Action failed.', 'error');
        setResubmitDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error forwarding to Audit Head.', 'error');
      setResubmitDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const [emailSending, setEmailSending] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Send / Resend Settlement Breakdown Slip Email with PDF
  const handleSendEmailSlip = async () => {
    if (!selectedRecordId) return;
    setEmailSending(true);
    try {
      const res = await axios.post(
        `${API_BASE}/payroll/resignations/settlement/${selectedRecordId}/send-email`,
        {},
        { headers: buildHeaders() }
      );
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Exit settlement slip & PDF emailed successfully.');
      } else {
        showToast(res.data.message || 'Failed to email settlement slip.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error emailing settlement slip.', 'error');
    } finally {
      setEmailSending(false);
    }
  };

  // Direct Download Settlement Slip PDF
  const handleDownloadPdfSlip = async () => {
    if (!selectedRecordId) return;
    setDownloadingPdf(true);
    try {
      const res = await axios.get(
        `${API_BASE}/payroll/resignations/settlement/${selectedRecordId}/download-pdf`,
        {
          headers: buildHeaders(),
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const fileNo = settlementData?.staff?.file_no || selectedRecordId;
      link.setAttribute('download', `Exit_Settlement_Slip_${fileNo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Official Exit Settlement PDF slip downloaded successfully.');
    } catch (err) {
      showToast('Error downloading settlement PDF slip.', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Open Edit Retention Months Modal
  const handleOpenEditRetention = (data, e) => {
    e?.stopPropagation();

    if (!canManageRetention) {
      showToast('Permission denied: Only Super Administrators, HR Head, and Finance Head are authorized to edit retention months.', 'warning');
      return;
    }

    const staffId = data.staff?.id || data.staff_id || data.id;
    const staffName = data.staff?.name || data.name;
    const resignationId = data.resignation_id || data.id;

    // Load the existing deducted retention months
    const rawMonths = data.retention_refund?.months_deducted 
      ?? data.retention_months 
      ?? data.num_rente_months 
      ?? 0;

    const months = parseInt(rawMonths, 10) || 0;

    const baseSalary = data.retention_refund?.base_salary 
      ?? data.retention_base_salary 
      ?? data.salary_structure?.monthly_gross 
      ?? data.monthly_gross 
      ?? 0;

    const monthlyRate = data.retention_refund?.monthly_rate 
      ?? data.retention_monthly_rate 
      ?? (baseSalary * 0.05);

    setRetentionModal({
      open: true,
      staffId,
      staffName,
      resignationId,
      baseSalary,
      monthlyRate,
      months,
      loading: false,
    });
  };

  // Save Edited Retention Months
  const handleSaveRetentionMonths = async (e) => {
    e?.preventDefault();
    if (!retentionModal.staffId) return;

    if (!canManageRetention) {
      showToast('Permission denied: Only Super Administrators, HR Head, and Finance Head are authorized to edit retention months.', 'warning');
      return;
    }

    const monthsNum = parseInt(retentionModal.months, 10);
    if (isNaN(monthsNum) || monthsNum < 0 || monthsNum > 20) {
      showToast('Please enter a valid number of months between 0 and 20.', 'error');
      return;
    }

    setRetentionModal(prev => ({ ...prev, loading: true }));
    try {
      const headers = buildHeaders();
      const res = await axios.post(`${API_BASE}/payroll/resignation-settlement/update-retention-months`, {
        staff_id: retentionModal.staffId,
        num_rente_months: monthsNum,
        resignation_id: retentionModal.resignationId,
      }, { headers });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Retention deducted months updated successfully.');
        if (res.data.data?.settlement && selectedRecordId === retentionModal.resignationId) {
          setSettlementData(res.data.data.settlement);
        }
        setRetentionModal({ open: false, staffId: null, staffName: '', resignationId: null, baseSalary: 0, monthlyRate: 0, months: 0, loading: false });
        fetchApprovedRecords();
      } else {
        showToast(res.data.message || 'Failed to update retention months.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error updating retention months.', 'error');
    } finally {
      setRetentionModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Open Edit Medical Loan Modal
  const handleOpenEditMedicalLoan = (data, currentAmount, e) => {
    e?.stopPropagation();

    if (!canManageMedicalLoan) {
      showToast('Permission denied: Only Super Administrators, HR Head, and Finance Head are authorized to edit medical loan balance.', 'warning');
      return;
    }

    const staffId = data.staff?.id || data.staff_id || data.id;
    const staffName = data.staff?.name || data.name;
    const resignationId = data.resignation_id || data.id;
    const curBal = parseFloat(currentAmount) || 0;

    setMedicalLoanModal({
      open: true,
      staffId,
      staffName,
      resignationId,
      currentBalance: curBal,
      newBalance: curBal.toString(),
      reason: 'Exit clearance reconciliation',
      loading: false,
    });
  };

  // Save Edited Medical Loan Balance
  const handleSaveMedicalLoanBalance = async (e) => {
    e?.preventDefault();
    if (!medicalLoanModal.staffId) return;

    if (!canManageMedicalLoan) {
      showToast('Permission denied: Only Super Administrators, HR Head, and Finance Head are authorized to edit medical loan balance.', 'warning');
      return;
    }

    const balNum = parseFloat(medicalLoanModal.newBalance);
    if (isNaN(balNum) || balNum < 0) {
      showToast('Please enter a valid balance amount (greater than or equal to ₦0.00).', 'error');
      return;
    }

    setMedicalLoanModal(prev => ({ ...prev, loading: true }));
    try {
      const headers = buildHeaders();
      const res = await axios.post(`${API_BASE}/payroll/resignation-settlement/update-medical-loan-balance`, {
        staff_id: medicalLoanModal.staffId,
        balance: balNum,
        reason: medicalLoanModal.reason.trim(),
        resignation_id: medicalLoanModal.resignationId,
      }, { headers });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Medical loan balance updated successfully.');
        if (res.data.data?.settlement && selectedRecordId === medicalLoanModal.resignationId) {
          setSettlementData(res.data.data.settlement);
        }
        setMedicalLoanModal({ open: false, staffId: null, staffName: '', resignationId: null, currentBalance: 0, newBalance: '', reason: '', loading: false });
        fetchApprovedRecords();
      } else {
        showToast(res.data.message || 'Failed to update medical loan balance.', 'error');
        setMedicalLoanModal(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error updating medical loan balance.', 'error');
      setMedicalLoanModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Open Edit Cooperative Loan Modal
  const handleOpenEditCoopLoan = (data, currentAmount, e) => {
    e?.stopPropagation();

    if (!canManageCoopLoan) {
      showToast('Permission denied: Only Super Administrators, HR Head, and Finance Head are authorized to edit cooperative loan balance.', 'warning');
      return;
    }

    const staffId = data.staff?.id || data.staff_id || data.id;
    const staffName = data.staff?.name || data.name;
    const resignationId = data.resignation_id || data.id;
    const curBal = parseFloat(currentAmount) || 0;

    setCoopLoanModal({
      open: true,
      staffId,
      staffName,
      resignationId,
      currentBalance: curBal,
      newBalance: curBal.toString(),
      reason: 'Exit clearance reconciliation',
      loading: false,
    });
  };

  // Save Edited Cooperative Loan Balance
  const handleSaveCoopLoanBalance = async (e) => {
    e?.preventDefault();
    if (!coopLoanModal.staffId) return;

    if (!canManageCoopLoan) {
      showToast('Permission denied: Only Super Administrators, HR Head, and Finance Head are authorized to edit cooperative loan balance.', 'warning');
      return;
    }

    const balNum = parseFloat(coopLoanModal.newBalance);
    if (isNaN(balNum) || balNum < 0) {
      showToast('Please enter a valid balance amount (greater than or equal to ₦0.00).', 'error');
      return;
    }

    setCoopLoanModal(prev => ({ ...prev, loading: true }));
    try {
      const headers = buildHeaders();
      const res = await axios.post(`${API_BASE}/payroll/resignation-settlement/update-coop-loan-balance`, {
        staff_id: coopLoanModal.staffId,
        balance: balNum,
        reason: coopLoanModal.reason.trim(),
        resignation_id: coopLoanModal.resignationId,
      }, { headers });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Cooperative loan balance updated successfully.');
        if (res.data.data?.settlement && selectedRecordId === coopLoanModal.resignationId) {
          setSettlementData(res.data.data.settlement);
        }
        setCoopLoanModal({ open: false, staffId: null, staffName: '', resignationId: null, currentBalance: 0, newBalance: '', reason: '', loading: false });
        fetchApprovedRecords();
      } else {
        showToast(res.data.message || 'Failed to update cooperative loan balance.', 'error');
        setCoopLoanModal(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error updating cooperative loan balance.', 'error');
      setCoopLoanModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Open Payment in Lieu of Notice Modal
  const handleOpenNoticeInLieu = (data, e) => {
    e?.stopPropagation();

    if (!canManageNoticeInLieu) {
      showToast('Permission denied: Only Super Administrators, HR Head, and Finance Head are authorized to adjust Payment in Lieu of Notice.', 'warning');
      return;
    }

    const staffId = data.staff?.id || data.staff_id || data.id;
    const staffName = data.staff?.name || data.name;
    const resignationId = data.resignation_id || data.id;

    const monthlyGross = parseFloat(data.salary_structure?.monthly_gross || data.salary_structure?.declared_salary || data.monthly_gross || 0) || 0;
    
    // Find days in exit month or 30
    const noticeBreakdown = data.notice_earnings?.breakdown || [];
    const exitMonthItem = noticeBreakdown.find(b => !b.is_paid_via_payroll) || noticeBreakdown[0];
    const daysInMonth = exitMonthItem?.days_in_month || 30;
    const dailyRate = daysInMonth > 0 ? (monthlyGross / daysInMonth) : (monthlyGross / 30);

    const curAmount = parseFloat(data.payment_in_lieu_of_notice?.amount ?? 0) || 0;
    const curDays = parseInt(data.payment_in_lieu_of_notice?.days ?? 0, 10) || 0;
    const curMode = data.payment_in_lieu_of_notice?.mode || (curDays > 0 ? 'days' : 'amount');
    const curSource = data.payment_in_lieu_of_notice?.source || 'general';
    const curReason = data.payment_in_lieu_of_notice?.reason || '';

    const retentionAvailable = parseFloat(data.retention_refund?.total_refund_amount ?? 0) || 0;
    const salaryAvailable = parseFloat(data.notice_earnings?.total_notice_salary ?? 0) || 0;
    const coopSavingsAvailable = parseFloat(data.coop_savings_refund?.total_savings_balance ?? 0) || 0;
    const totalEarningsAvailable = parseFloat(data.settlement_summary?.total_final_earnings ?? 0) || 0;

    const defaultDays = curDays > 0 ? curDays.toString() : (curAmount > 0 && dailyRate > 0 ? Math.round(curAmount / dailyRate).toString() : '30');
    const defaultAmount = curAmount > 0 ? curAmount.toString() : (curDays > 0 && dailyRate > 0 ? (dailyRate * curDays).toFixed(2) : monthlyGross.toFixed(2));

    setNoticeInLieuModal({
      open: true,
      staffId,
      staffName,
      resignationId,
      monthlyGross,
      dailyRate,
      daysInMonth,
      currentAmount: curAmount,
      currentDays: curDays,
      calculationMode: curMode,
      days: defaultDays,
      amount: defaultAmount,
      deductionSource: curSource,
      reason: curReason || 'Staff failed to complete notice period agreement with company',
      retentionAvailable,
      salaryAvailable,
      coopSavingsAvailable,
      totalEarningsAvailable,
      loading: false,
    });
  };

  // Save Payment in Lieu of Notice Deduction
  const handleSaveNoticeInLieu = async (e) => {
    e?.preventDefault();
    if (!noticeInLieuModal.resignationId && !noticeInLieuModal.staffId) return;

    if (!canManageNoticeInLieu) {
      showToast('Permission denied: Only Super Administrators, HR Head, and Finance Head are authorized to adjust Payment in Lieu of Notice.', 'warning');
      return;
    }

    const amt = parseFloat(noticeInLieuModal.amount) || 0;
    const days = parseInt(noticeInLieuModal.days, 10) || 0;

    if (amt < 0) {
      showToast('Payment in Lieu of Notice amount cannot be negative.', 'error');
      return;
    }

    setNoticeInLieuModal(prev => ({ ...prev, loading: true }));
    try {
      const headers = buildHeaders();
      const res = await axios.post(`${API_BASE}/payroll/resignation-settlement/update-notice-in-lieu`, {
        resignation_id: noticeInLieuModal.resignationId,
        staff_id: noticeInLieuModal.staffId,
        amount: amt,
        days: days,
        calculation_mode: noticeInLieuModal.calculationMode,
        deduction_source: noticeInLieuModal.deductionSource,
        reason: noticeInLieuModal.reason.trim(),
      }, { headers });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Payment in Lieu of Notice updated successfully.');
        if (res.data.data?.settlement && selectedRecordId === noticeInLieuModal.resignationId) {
          setSettlementData(res.data.data.settlement);
        } else if (selectedRecordId) {
          handleOpenBreakdown(selectedRecordId);
        }
        setNoticeInLieuModal(prev => ({ ...prev, open: false, loading: false }));
        fetchApprovedRecords();
      } else {
        showToast(res.data.message || 'Failed to update Payment in Lieu of Notice.', 'error');
        setNoticeInLieuModal(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error updating Payment in Lieu of Notice.', 'error');
      setNoticeInLieuModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Active role from localStorage
  const activeRoleName = mounted && typeof window !== 'undefined' ? (() => {
    try {
      const role = JSON.parse(localStorage.getItem('hrms_role'));
      return String(role?.rolename || role?.name || role?.role_name || '').toLowerCase().trim();
    } catch {
      return '';
    }
  })() : '';

  const isStaffRole = activeRoleName === 'staff';

  const isPrivilegedUser = !isStaffRole && Boolean(
    (!isStaffRole && userPermissions.is_super_admin) ||
    userPermissions.is_admin_staff ||
    userPermissions.is_audit_staff ||
    userPermissions.is_finance_staff ||
    activeRoleName === 'super admin' ||
    activeRoleName === 'super administrator' ||
    activeRoleName === 'hr head' ||
    activeRoleName === 'head of hr' ||
    activeRoleName === 'finance head' ||
    activeRoleName === 'head of finance' ||
    activeRoleName === 'audit head' ||
    activeRoleName === 'head of audit'
  );

  const isHodUser = !isStaffRole && (userPermissions.is_hod || activeRoleName === 'hod');

  // Filtered Records (client-side filters)
  const filteredRecords = records.filter((r) => {
    // If not privileged (Super Admin, HR Head, Finance Head, Audit Head) and not HOD:
    // Regular staff strictly see their own record alone
    if (!isPrivilegedUser && !isHodUser) {
      const currentEmployee = userPermissions.employee;
      const empId = currentEmployee?.id;
      const fallbackStaffId = typeof window !== 'undefined' ? (() => {
        try {
          const u = JSON.parse(localStorage.getItem('hrms_user'));
          return u?.staff_id ?? u?.staffID ?? u?.employee_id ?? (u?.username && /^\d+$/.test(u.username) ? u.username : null);
        } catch { return null; }
      })() : null;

      const myStaffId = empId || fallbackStaffId;
      if (myStaffId && String(r.staff_id) !== String(myStaffId)) {
        return false;
      }
    }

    if (settlementFilter === 'payable' && r.settlement_type !== 'payable') return false;
    if (settlementFilter === 'recoverable' && r.settlement_type !== 'recoverable') return false;

    if (workflowFilter === 'pending_audit' && r.audit_status !== 0) return false;
    if (workflowFilter === 'audit_queried' && r.audit_status !== 2) return false;
    if (workflowFilter === 'ready_for_payment' && (r.audit_status !== 1 || r.finance_status === 1)) return false;
    if (workflowFilter === 'paid' && r.finance_status !== 1) return false;

    return true;
  });

  const handlePrintSlip = () => {
    window.print();
  };

  const isSuperAdmin = Boolean(
    userPermissions.is_super_admin ||
    activeRoleName === 'super admin' ||
    activeRoleName === 'super administrator' ||
    activeRoleName === 'administrator' ||
    activeRoleName === 'admin'
  );

  const isAuditHead = Boolean(
    userPermissions.is_audit_staff ||
    activeRoleName === 'audit head' ||
    activeRoleName === 'head of audit' ||
    activeRoleName === 'audit staff'
  );

  const isFinanceHead = Boolean(
    userPermissions.is_finance_staff ||
    activeRoleName === 'finance head' ||
    activeRoleName === 'head of finance' ||
    activeRoleName === 'finance staff'
  );

  // For AUDIT HEAD approve: only AUDIT HEAD AND SUPER ADMIN can perform the action
  const canAudit = !isStaffRole && (isSuperAdmin || isAuditHead);

  // For mark as paid: only FINANCE HEAD AND SUPER ADMIN can perform the action
  const canFinance = !isStaffRole && (isSuperAdmin || isFinanceHead);

  const canResubmitToAudit = isPrivilegedUser && (isSuperAdmin || userPermissions.is_admin_staff || isFinanceHead || activeRoleName === 'hr head' || activeRoleName === 'head of hr');

  if (!mounted) return null;

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={`${styles.header} ${styles.noPrint}`}>
        <div>
          <h1 className={styles.title}>Approved Resignations & Exit Settlement Registry</h1>
          <p className={styles.subtitle}>
            Multi-stage exit clearance registry: HR Head approval removes staff from payroll, Audit Head checks & approves calculations for payment, and Finance Head marks as paid.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            href="/dashboard/payroll/apply-resignation"
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            <LogOut size={16} style={{ color: '#ec4899' }} />
            <span>Apply for Resignation</span>
            <ExternalLink size={14} />
          </Link>
          <button
            type="button"
            onClick={fetchApprovedRecords}
            className={`${styles.btn} ${styles.btnSecondary}`}
            title="Refresh List"
          >
            <Clock size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className={`${styles.kpiGrid} ${styles.noPrint}`}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>
            <Users size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Approved Resignations</span>
            <span className={styles.kpiValue}>{summary.total_approved_resigned} Staff</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            <NairaSign size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Total Notice Earnings</span>
            <span className={styles.kpiValue}>
              <NairaSign size={16} /> {fmt(summary.total_notice_earnings)}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <Percent size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Retention & Savings Refunds</span>
            <span className={styles.kpiValue}>
              <NairaSign size={16} /> {fmt(summary.total_retention_refunds + (summary.total_coop_savings_refunds || 0))}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <TrendingDown size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Total Deductions Offset</span>
            <span className={styles.kpiValue}>
              <NairaSign size={16} /> {fmt(summary.total_deductions)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className={`${styles.card} ${styles.noPrint}`}>
        {/* Filter Toolbar */}
        <div className={styles.filterToolbar}>
          {/* Top Row: Search & Date Range */}
          <div className={styles.searchAndDateRow}>
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search staff name, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={styles.searchClearBtn}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className={styles.dateFilterBox}>
              <Calendar size={15} style={{ color: 'var(--text-secondary)' }} />
              <div className={styles.dateInputGroup}>
                <span className={styles.dateLabel}>From:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={styles.dateField}
                />
              </div>

              <div className={styles.dateInputGroup}>
                <span className={styles.dateLabel}>To:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className={styles.dateField}
                />
              </div>

              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  className={styles.clearDateBtn}
                  title="Clear Date Filters"
                >
                  <X size={13} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Tab Filters */}
          <div className={styles.filterTabsRow}>
            <div className={styles.tabGroup}>
              <span className={styles.tabGroupLabel}>Workflow State:</span>
              {[
                { id: 'all', label: 'All Records' },
                { id: 'pending_audit', label: '1. Pending Audit Review' },
                { id: 'audit_queried', label: 'Audit Queried' },
                { id: 'ready_for_payment', label: '2. Audited & Ready for Payment' },
                { id: 'paid', label: '3. Settlement Paid' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setWorkflowFilter(tab.id)}
                  className={`${styles.pillBtn} ${workflowFilter === tab.id ? styles.pillBtnActive : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className={styles.tabGroup}>
              <span className={styles.tabGroupLabel}>Settlement:</span>
              {['all', 'payable', 'recoverable'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSettlementFilter(type)}
                  className={`${styles.pillBtn} ${settlementFilter === type ? styles.pillBtnSecondaryActive : ''}`}
                  style={{ textTransform: 'capitalize' }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className={styles.emptyState}>
            <Loader2 size={36} className="animate-spin" style={{ color: '#ec4899', margin: '0 auto 0.75rem' }} />
            <p>Loading approved resignation settlement records...</p>
          </div>
        ) : filteredRecords.length > 0 ? (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Staff Information</th>
                  <th>Department</th>
                  <th>Service & Exit Timeline</th>
                  <th>Notice Salary</th>
                  <th>Total Deductions</th>
                  <th>Net Settlement</th>
                  <th>Audit Clearance</th>
                  <th>Payment Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => handleOpenBreakdown(r.id)}>
                    <td>
                      <div className={styles.staffCell}>
                        <span className={styles.staffName}>{r.name}</span>
                        <span className={styles.staffIdSub}>Staff ID: {r.staff_id}</span>
                      </div>
                    </td>
                    <td>{r.department || 'N/A'}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.78rem', minWidth: '165px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569' }} title="Staff Date of Appointment / Joining">
                          <Briefcase size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span><strong style={{ color: '#334155' }}>Appointed:</strong> {formatDate(r.appointment_date)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#0369a1' }} title="Resignation Notice Submission Date">
                          <FileText size={12} style={{ color: '#0284c7', flexShrink: 0 }} />
                          <span><strong style={{ color: '#0369a1' }}>Resigned:</strong> {formatDate(r.resignation_date)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#db2777' }} title="Effective Exit / Clearance Date">
                          <Calendar size={12} style={{ color: '#db2777', flexShrink: 0 }} />
                          <span><strong style={{ color: '#be185d' }}>Exit:</strong> {formatDate(r.exit_date)}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: '#3b82f6' }}>₦{fmt(r.notice_salary_total)}</div>
                      {r.resignation_rule === 'mid_late_month' ? (
                        <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 500 }} title="Current month full salary received via regular monthly payroll run">
                          Prorated: {r.next_month_days}/{r.days_in_next_month} days (M1 on Payroll)
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }} title="Full current month salary plus exit month notice days paid via Exit Settlement">
                          Full Month + {r.next_month_days}d (Day 1–10)
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#ef4444' }}>
                      ₦{fmt(r.total_deductions)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className={`${styles.badge} ${r.settlement_type === 'payable' ? styles.badgePayable : r.settlement_type === 'recoverable' ? styles.badgeRecoverable : styles.badgeBalanced}`}>
                        ₦{fmt(Math.abs(r.net_settlement))} {r.settlement_type === 'payable' ? '(Payable)' : r.settlement_type === 'recoverable' ? '(Recoverable)' : ''}
                      </span>
                    </td>
                    <td>
                      {r.audit_status === 1 ? (
                        <span className={`${styles.badge} ${styles.badgeAuditApproved}`} title={`Audited by ${r.audit_by_name || 'Audit Head'} on ${formatDate(r.audit_date)}`}>
                          <ShieldCheck size={12} />
                          Audited & Approved
                        </span>
                      ) : r.audit_status === 2 ? (
                        <span className={`${styles.badge} ${styles.badgeAuditRejected}`} title={r.audit_remarks || 'Queried by Audit'}>
                          <X size={12} />
                          Audit Queried
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeAuditPending}`}>
                          <Clock size={12} />
                          Pending Audit Review
                        </span>
                      )}
                    </td>
                    <td>
                      {r.finance_status === 1 ? (
                        r.settlement_type === 'recoverable' ? (
                          <span className={`${styles.badge} ${styles.badgeFinanceRecovered}`} title={`Debt recovered on ${formatDate(r.finance_date)} by ${r.finance_by_name || 'Finance Head'} - Receipt Ref: ${r.payment_reference || 'N/A'}`}>
                            <CheckCircle2 size={12} />
                            Debt Recovered
                          </span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeFinancePaid}`} title={`Paid on ${formatDate(r.finance_date)} by ${r.finance_by_name || 'Finance Head'} - Ref: ${r.payment_reference || 'N/A'}`}>
                            <CheckCircle2 size={12} />
                            Paid
                          </span>
                        )
                      ) : (
                        r.settlement_type === 'recoverable' ? (
                          <span className={`${styles.badge} ${styles.badgeFinanceRecoverPending}`}>
                            <Clock size={12} />
                            Pending Recovery
                          </span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeFinancePending}`}>
                            <Clock size={12} />
                            Pending Payment
                          </span>
                        )
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => handleOpenBreakdown(r.id)}
                          title="View Comprehensive Settlement Breakdown"
                        >
                          <Eye size={14} />
                          <span>Breakdown</span>
                        </button>

                        {/* Retention Months Edit Button for Super Admin & HR Head */}
                        {canManageRetention && (
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={(e) => handleOpenEditRetention(r, e)}
                            title="Edit retention deducted months for this staff member"
                          >
                            <Edit2 size={13} />
                            <span>Retention</span>
                          </button>
                        )}

                        {/* Audit Approve Action Button */}
                        {canAudit && r.audit_status === 0 && (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.btnAudit}`}
                            onClick={(e) => handleOpenAuditDialog(r, e)}
                            title="Audit Head & Super Admin: Check & Approve for Payment / Recovery"
                          >
                            <ShieldCheck size={14} />
                            <span>Audit</span>
                          </button>
                        )}

                        {/* Forward to Audit Action Button for HR Head / Finance Head when audit_status === 2 */}
                        {canResubmitToAudit && r.audit_status === 2 && (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.btnResubmit}`}
                            onClick={(e) => handleOpenResubmitDialog(r, e)}
                            title="Audit Queried: Click to review query and forward back to Audit Head for approval"
                          >
                            <ShieldCheck size={14} />
                            <span>Forward to Audit</span>
                          </button>
                        )}

                        {/* Finance Action: Pay or Recover */}
                        {canFinance && r.audit_status === 1 && r.finance_status === 0 && (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${r.settlement_type === 'recoverable' ? styles.btnRecover : styles.btnFinance}`}
                            onClick={(e) => handleOpenFinanceDialog(r, e)}
                            title={r.settlement_type === 'recoverable' ? 'Finance Head & Super Admin: Record Debt Recovery from Staff' : 'Finance Head & Super Admin: Mark as Paid'}
                          >
                            <CreditCard size={14} />
                            <span>{r.settlement_type === 'recoverable' ? 'Recover' : 'Pay'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <LogOut size={36} className={styles.emptyIcon} />
            <p style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>No approved resignation settlement records found</p>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
              Resignations approved by the HR Head on the Apply for Resignation page will automatically appear here for Audit verification and Finance payment.
            </p>
          </div>
        )}
      </div>

      {/* ── Settlement Breakdown Modal ────────────────────────────────────── */}
      {selectedRecordId && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            {modalLoading ? (
              <div style={{ padding: '4rem', textAlign: 'center' }}>
                <Loader2 size={40} className="animate-spin" style={{ color: '#ec4899', margin: '0 auto 1rem' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Calculating Comprehensive Exit Settlement...</p>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Prorating notice period salaries, computing 100% retention fund refund, and aggregating loan offsets.</p>
              </div>
            ) : settlementData ? (
              <>
                <div className={styles.modalHeader}>
                  <h3 className={styles.modalTitle}>
                    <Sparkles size={20} style={{ color: '#ec4899' }} />
                    Exit Settlement Breakdown & Clearance
                  </h3>
                  <button type="button" className={styles.modalCloseBtn} onClick={handleCloseModal}>
                    <X size={20} />
                  </button>
                </div>

                <div className={styles.modalBody}>
                  {/* Multi-Stage Workflow Pipeline Tracker */}
                  <div className={styles.workflowPipeline}>
                    {/* Stage 1: HR Head Approval */}
                    <div className={styles.workflowStep}>
                      <div className={styles.workflowStepTitle} style={{ color: '#3b82f6' }}>
                        <CheckCircle2 size={16} />
                        <span>1. HR Head Approval</span>
                      </div>
                      <div className={styles.workflowStepDesc}>
                        Approved by {settlementData.clearance_workflow?.hr_approval?.approved_by || 'HR Head'} on {formatDate(settlementData.clearance_workflow?.hr_approval?.approved_at)}
                      </div>
                    </div>

                    {/* Stage 2: Audit Head Review */}
                    <div className={styles.workflowStep}>
                      <div className={styles.workflowStepTitle} style={{
                        color: settlementData.clearance_workflow?.audit_approval?.status === 1 ? '#10b981' : settlementData.clearance_workflow?.audit_approval?.status === 2 ? '#ef4444' : '#b45309'
                      }}>
                        {settlementData.clearance_workflow?.audit_approval?.status === 1 ? (
                          <CheckCircle2 size={16} />
                        ) : settlementData.clearance_workflow?.audit_approval?.status === 2 ? (
                          <AlertCircle size={16} />
                        ) : (
                          <Clock size={16} />
                        )}
                        <span>2. Audit Head Review</span>
                      </div>
                      <div className={styles.workflowStepDesc}>
                        {settlementData.clearance_workflow?.audit_approval?.status === 1 ? (
                          <>Audited & Approved by {settlementData.clearance_workflow.audit_approval.audited_by} on {formatDate(settlementData.clearance_workflow.audit_approval.audited_at)}</>
                        ) : settlementData.clearance_workflow?.audit_approval?.status === 2 ? (
                          <>Queried by {settlementData.clearance_workflow.audit_approval.audited_by}: {settlementData.clearance_workflow.audit_approval.remarks}</>
                        ) : (
                          <>Pending Audit Verification & Payment Clearance</>
                        )}
                      </div>
                    </div>

                    {/* Stage 3: Finance Head Payment / Recovery */}
                    <div className={styles.workflowStep}>
                      <div className={styles.workflowStepTitle} style={{
                        color: settlementData.clearance_workflow?.finance_payment?.status === 1 ? '#10b981' : '#64748b'
                      }}>
                        {settlementData.clearance_workflow?.finance_payment?.status === 1 ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <Clock size={16} />
                        )}
                        <span>
                          {settlementData.settlement_summary.settlement_type === 'recoverable'
                            ? '3. Finance Debt Recovery'
                            : '3. Finance Head Payment'}
                        </span>
                      </div>
                      <div className={styles.workflowStepDesc}>
                        {settlementData.clearance_workflow?.finance_payment?.status === 1 ? (
                          settlementData.settlement_summary.settlement_type === 'recoverable' ? (
                            <>Debt recovered on {formatDate(settlementData.clearance_workflow.finance_payment.paid_at)} by {settlementData.clearance_workflow.finance_payment.paid_by} (Receipt Ref: {settlementData.clearance_workflow.finance_payment.payment_reference || 'N/A'})</>
                          ) : (
                            <>Paid on {formatDate(settlementData.clearance_workflow.finance_payment.paid_at)} by {settlementData.clearance_workflow.finance_payment.paid_by} (Ref: {settlementData.clearance_workflow.finance_payment.payment_reference || 'N/A'})</>
                          )
                        ) : (
                          settlementData.settlement_summary.settlement_type === 'recoverable' ? (
                            <>Pending Debt Recovery from Staff</>
                          ) : (
                            <>Pending Payment Disbursement</>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Audit Query Alert Banner */}
                  {settlementData.clearance_workflow?.audit_approval?.status === 2 && (
                    <div style={{
                      margin: '0 0 1.25rem 0',
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#b91c1c',
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                          <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                          <span>Audit Head Query / Clearance Held</span>
                        </div>
                        {canResubmitToAudit && (
                          <button
                            type="button"
                            onClick={() => handleOpenResubmitDialog({
                              id: selectedRecordId,
                              name: settlementData.staff.name,
                              audit_remarks: settlementData.clearance_workflow?.audit_approval?.remarks
                            })}
                            className={`${styles.btn} ${styles.btnResubmit}`}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                          >
                            <ShieldCheck size={14} />
                            <span>Forward to Audit Head</span>
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#991b1b', whiteSpace: 'pre-wrap' }}>
                        <strong>Query / Remarks:</strong> {settlementData.clearance_workflow?.audit_approval?.remarks || 'Audit calculation review requested.'}
                      </div>
                    </div>
                  )}

                  {/* Resignation Notice Rule Banner */}
                  {settlementData.timeline?.rule_description && (
                    <div style={{
                      margin: '0 0 1.25rem 0',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: settlementData.timeline.resignation_rule === 'mid_late_month' ? '#eff6ff' : '#f0fdf4',
                      border: `1px solid ${settlementData.timeline.resignation_rule === 'mid_late_month' ? '#bfdbfe' : '#bbf7d0'}`,
                      color: settlementData.timeline.resignation_rule === 'mid_late_month' ? '#1e40af' : '#166534',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Sparkles size={16} style={{ flexShrink: 0 }} />
                      <span>{settlementData.timeline.rule_description}</span>
                    </div>
                  )}

                  {/* Staff Metadata Summary Box */}
                  <div className={styles.staffMetaBox}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Staff Name:</span>
                      <span className={styles.metaValue}>{settlementData.staff.name}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Staff ID:</span>
                      <span className={styles.metaValue}>{settlementData.staff.id}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Department:</span>
                      <span className={styles.metaValue}>{settlementData.staff.department}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Bank & Account:</span>
                      <span className={styles.metaValue}>{settlementData.staff.bank_name} — {settlementData.staff.account_no}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Date of Appointment:</span>
                      <span className={styles.metaValue} style={{ color: '#0f172a', fontWeight: 600 }}>
                        {formatDate(settlementData.staff?.appointment_date || settlementData.timeline?.appointment_date)}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Notice Submission Date:</span>
                      <span className={styles.metaValue}>{formatDate(settlementData.timeline.resignation_date)} (1 Month Notice)</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Effective Exit Date:</span>
                      <span className={styles.metaValue} style={{ color: '#ec4899', fontWeight: 700 }}>{formatDate(settlementData.timeline.exit_date)}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Payroll Status:</span>
                      <span className={styles.metaValue} style={{ color: settlementData.timeline?.resignation_rule === 'mid_late_month' ? '#059669' : '#d97706' }}>
                        {settlementData.timeline?.resignation_rule === 'mid_late_month'
                          ? 'Current Month Active on Regular Payroll'
                          : 'Removed from Active Payroll'}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Gross Salary:</span>
                      <span className={styles.metaValue} style={{ color: '#3b82f6' }}>₦{fmt(settlementData.salary_structure?.monthly_gross || settlementData.salary_structure?.declared_salary)}</span>
                    </div>
                  </div>

                  {/* Dual Column Side-by-Side Breakdown Grid */}
                  <div className={styles.sheetGrid}>
                    {/* Left Column: Earnings & Allowances */}
                    <div className={styles.sheetSection}>
                      <div className={styles.sheetSectionHeader} style={{ minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                            EARNINGS & REFUNDS (ASSETS)
                          </span>
                        </div>
                        <span style={{ whiteSpace: 'nowrap', fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                          AMOUNT (₦)
                        </span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Basic Salary</span>
                        <span>{fmt(settlementData.salary_structure.basic_salary)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Housing Allowance</span>
                        <span>{fmt(settlementData.salary_structure.housing_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Transport Allowance</span>
                        <span>{fmt(settlementData.salary_structure.transport_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Medical Allowance</span>
                        <span>{fmt(settlementData.salary_structure.medical_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Utility Allowance</span>
                        <span>{fmt(settlementData.salary_structure.utility_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Meal Allowance</span>
                        <span>{fmt(settlementData.salary_structure.meal_allowance)}</span>
                      </div>

                      {/* Notice Period Proration Rows */}
                      {settlementData.notice_earnings.breakdown.map((b, idx) => (
                        <div key={idx} className={styles.sheetRow} style={{ background: b.is_paid_via_payroll ? 'rgba(16, 185, 129, 0.05)' : 'rgba(59, 130, 246, 0.03)' }}>
                          <span>
                            {b.is_paid_via_payroll ? `Salary: ${b.month_name}` : `Notice Salary: ${b.month_name}`}
                            <span className={styles.sheetRowNote}>
                              {b.is_paid_via_payroll
                                ? ' (Paid via Regular Monthly Payroll)'
                                : ` (${b.days_worked}/${b.days_in_month} days${b.payroll_note ? ` — ${b.payroll_note}` : ''})`}
                            </span>
                          </span>
                          <span style={{ color: b.is_paid_via_payroll ? '#059669' : '#3b82f6', fontWeight: b.is_paid_via_payroll ? 600 : 400 }}>
                            {b.is_paid_via_payroll ? 'Paid on Payroll (₦0.00)' : `₦${fmt(b.earned_salary)}`}
                          </span>
                        </div>
                      ))}

                      {/* Retention Fund 100% Refund */}
                      <div className={styles.sheetRow} style={{ background: 'rgba(16, 185, 129, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div>
                            <span>Retention Savings (100% Refund)</span>
                            <span className={styles.sheetRowNote} style={{ display: 'block' }}>
                              ({settlementData.retention_refund.months_deducted} mos @ ₦{fmt(settlementData.retention_refund.monthly_rate)})
                            </span>
                          </div>
                          {canManageRetention && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditRetention(settlementData, e)}
                              className={styles.btnEditRetentionBadge}
                              title="Edit retention deducted months"
                            >
                              <Edit2 size={11} />
                              Edit Months
                            </button>
                          )}
                        </div>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>+{fmt(settlementData.retention_refund.total_refund_amount)}</span>
                      </div>

                      {/* Cooperative Savings Accumulated Refund (Asset) */}
                      {settlementData.coop_savings_refund?.total_savings_balance > 0 && (
                        <div className={styles.sheetRow} style={{ background: 'rgba(16, 185, 129, 0.06)' }}>
                          <span>
                            Cooperative Savings (Total Accumulated Refund)
                            <span className={styles.sheetRowNote}>
                              (Staff Total Saved Balance)
                            </span>
                          </span>
                          <span style={{ color: '#10b981' }}>+{fmt(settlementData.coop_savings_refund.total_savings_balance)}</span>
                        </div>
                      )}

                      {/* Active Bonuses & Special Allowances */}
                      {settlementData.bonuses_and_allowances?.total_amount > 0 && (
                        <div className={styles.sheetRow} style={{ background: 'rgba(245, 158, 11, 0.04)' }}>
                          <span>
                            Bonuses & Special Allowances
                            {settlementData.bonuses_and_allowances.items?.length > 0 && (
                              <span className={styles.sheetRowNote}>
                                ({settlementData.bonuses_and_allowances.items.map(i => i.title).join(', ')})
                              </span>
                            )}
                          </span>
                          <span style={{ color: '#f59e0b' }}>+{fmt(settlementData.bonuses_and_allowances.total_amount)}</span>
                        </div>
                      )}

                      {/* Left Total: Total Final Earnings */}
                      <div className={`${styles.sheetRow} ${styles.sheetTotalRow}`}>
                        <span>TOTAL FINAL EARNINGS & REFUNDS</span>
                        <span>₦{fmt(settlementData.settlement_summary.total_final_earnings)}</span>
                      </div>
                    </div>

                    {/* Right Column: Itemized Deductions & Liabilities */}
                    <div className={styles.sheetSection}>
                      <div
                        className={styles.sheetSectionHeader}
                        style={{
                          background: 'linear-gradient(to right, rgba(239, 68, 68, 0.08), rgba(254, 242, 242, 0.45))',
                          borderBottom: '1px solid rgba(239, 68, 68, 0.18)',
                          color: '#991c1c',
                          minHeight: '38px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.55rem 0.9rem',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            Itemized Deductions
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {canManageNoticeInLieu && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenNoticeInLieu(settlementData, e)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2.5px 8px',
                                background: settlementData.payment_in_lieu_of_notice?.amount > 0 ? '#dc2626' : '#ffffff',
                                color: settlementData.payment_in_lieu_of_notice?.amount > 0 ? '#ffffff' : '#b91c1c',
                                border: `1px solid ${settlementData.payment_in_lieu_of_notice?.amount > 0 ? '#b91c1c' : '#fca5a5'}`,
                                borderRadius: '9999px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                boxShadow: '0 1px 2px rgba(220, 38, 38, 0.08)',
                                transition: 'all 0.15s ease',
                                lineHeight: '1.4',
                              }}
                              title="Deduct or adjust Payment in Lieu of Notice for unserved notice period"
                            >
                              <TrendingDown size={11} style={{ color: settlementData.payment_in_lieu_of_notice?.amount > 0 ? '#ffffff' : '#dc2626' }} />
                              <span>{settlementData.payment_in_lieu_of_notice?.amount > 0 ? 'Edit Lieu of Notice' : '+ Lieu of Notice'}</span>
                            </button>
                          )}
                          <span style={{ whiteSpace: 'nowrap', fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            AMOUNT (₦)
                          </span>
                        </div>
                      </div>

                      {settlementData.deductions?.itemized_deductions ? (
                        settlementData.deductions.itemized_deductions.map((d, i) => (
                          <div
                            key={i}
                            className={styles.sheetRow}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              ...(d.name.includes('Payment in Lieu') && d.amount > 0 ? {
                                background: 'rgba(239, 68, 68, 0.04)',
                                borderLeft: '3px solid #dc2626',
                              } : {})
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div>
                                <span>
                                  {d.name}
                                  {d.name.includes('Retention') && (
                                    <span className={styles.sheetRowNote} style={{ color: '#10b981' }}> (Refunded)</span>
                                  )}
                                  {d.name === 'PAYE Tax' && d.amount === 0 && (
                                    <span className={styles.sheetRowNote} style={{ color: '#64748b' }}> (Exempt ≤₦800k)</span>
                                  )}
                                  {d.name.includes('Pension') && d.amount === 0 && (
                                    <span className={styles.sheetRowNote} style={{ color: '#64748b' }}> (Not Enrolled)</span>
                                  )}
                                  {d.name.includes('Savings') && (
                                    <span className={styles.sheetRowNote} style={{ color: '#10b981' }}> (Refunded under Earnings)</span>
                                  )}
                                  {d.name.includes('Leave of Absence') && d.amount > 0 && d.note && d.note !== 'Nil' && (
                                    <span className={styles.sheetRowNote} style={{ color: '#ef4444' }}> ({d.note})</span>
                                  )}
                                  {d.name.includes('Payment in Lieu') && d.amount > 0 && d.note && d.note !== 'Nil' && (
                                    <span className={styles.sheetRowNote} style={{ color: '#dc2626', fontWeight: 600 }}> ({d.note})</span>
                                  )}
                                  {d.name.includes('Payment in Lieu') && d.amount === 0 && (
                                    <span className={styles.sheetRowNote} style={{ color: '#64748b' }}> (Notice served / not applied)</span>
                                  )}
                                </span>
                              </div>
                              {d.name.includes('Medical Loan') && canManageMedicalLoan && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenEditMedicalLoan(settlementData, d.amount, e)}
                                  className={styles.btnEditRetentionBadge}
                                  style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }}
                                  title="Edit or reconcile staff medical loan balance"
                                >
                                  <Edit2 size={11} />
                                  Edit Balance
                                </button>
                              )}
                              {d.name === 'Cooperative Loan' && canManageCoopLoan && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenEditCoopLoan(settlementData, d.amount, e)}
                                  className={styles.btnEditRetentionBadge}
                                  style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#b45309' }}
                                  title="Edit or reconcile staff cooperative loan balance"
                                >
                                  <Edit2 size={11} />
                                  Edit Balance
                                </button>
                              )}
                              {d.name.includes('Payment in Lieu') && canManageNoticeInLieu && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenNoticeInLieu(settlementData, e)}
                                  className={styles.btnEditRetentionBadge}
                                  style={{
                                    background: d.amount > 0 ? '#fef2f2' : '#f8fafc',
                                    borderColor: d.amount > 0 ? '#f87171' : '#cbd5e1',
                                    color: d.amount > 0 ? '#b91c1c' : '#475569',
                                    fontWeight: 600,
                                  }}
                                  title="Edit or apply Payment in Lieu of Notice deduction"
                                >
                                  <Edit2 size={11} />
                                  {d.amount > 0 ? 'Edit Lieu of Notice' : 'Set Lieu of Notice'}
                                </button>
                              )}
                            </div>
                            <span style={d.amount > 0 ? { color: '#ef4444', fontWeight: 700 } : { color: '#94a3b8' }}>
                              {fmt(d.amount)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.sheetRow}><span>PAYE Tax</span><span style={{ color: '#94a3b8' }}>0.00</span></div>
                      )}

                      {/* Right Total: Total Deductions */}
                      <div className={`${styles.sheetRow} ${styles.sheetTotalRow}`} style={{ color: '#ef4444' }}>
                        <span>TOTAL DEDUCTIONS & LIABILITIES</span>
                        <span>- ₦{fmt(settlementData.settlement_summary.total_final_deductions)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Estimated Net Take-Home Pay / Net Settlement Banner */}
                  <div className={`${styles.netTakeHomeBanner} ${settlementData.settlement_summary.settlement_type === 'recoverable' ? styles.netTakeHomeBannerRecoverable : ''}`}>
                    <div>
                      <div className={styles.netTakeHomeLabel} style={{ color: settlementData.settlement_summary.settlement_type === 'payable' ? '#10b981' : '#ef4444' }}>
                        {settlementData.settlement_summary.settlement_type === 'payable'
                          ? 'FINAL NET PAYABLE TO STAFF'
                          : 'FINAL NET RECOVERABLE FROM STAFF'}
                      </div>
                      <div className={styles.netTakeHomeSub}>
                        Total Final Earnings & Refunds minus Total Itemized Deductions & Liabilities
                      </div>
                    </div>

                    <div className={styles.netTakeHomeAmount} style={{ color: settlementData.settlement_summary.settlement_type === 'payable' ? '#10b981' : '#ef4444' }}>
                      <NairaSign size={24} />
                      {fmt(Math.abs(settlementData.settlement_summary.net_settlement_amount))}
                    </div>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  {/* Audit Review Actions inside Modal */}
                  {canAudit && settlementData.clearance_workflow?.audit_approval?.status === 0 && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnAudit}`}
                      onClick={() => handleOpenAuditDialog({ id: selectedRecordId, name: settlementData.staff.name })}
                    >
                      <ShieldCheck size={16} />
                      <span>Audit & Approve for Payment</span>
                    </button>
                  )}

                  {/* Forward to Audit inside Modal when audit_status === 2 */}
                  {canResubmitToAudit && settlementData.clearance_workflow?.audit_approval?.status === 2 && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnResubmit}`}
                      onClick={() => handleOpenResubmitDialog({
                        id: selectedRecordId,
                        name: settlementData.staff.name,
                        audit_remarks: settlementData.clearance_workflow?.audit_approval?.remarks,
                      })}
                    >
                      <ShieldCheck size={16} />
                      <span>Forward to Audit Head</span>
                    </button>
                  )}

                  {/* Finance Action (Pay or Recover) inside Modal */}
                  {canFinance && settlementData.clearance_workflow?.audit_approval?.status === 1 && settlementData.clearance_workflow?.finance_payment?.status === 0 && (
                    <button
                      type="button"
                      className={`${styles.btn} ${settlementData.settlement_summary.settlement_type === 'recoverable' ? styles.btnRecover : styles.btnFinance}`}
                      onClick={() => handleOpenFinanceDialog({
                        id: selectedRecordId,
                        name: settlementData.staff.name,
                        settlement_type: settlementData.settlement_summary.settlement_type,
                        net_settlement: settlementData.settlement_summary.net_settlement_amount
                      })}
                    >
                      <CreditCard size={16} />
                      <span>
                        {settlementData.settlement_summary.settlement_type === 'recoverable'
                          ? 'Record Debt Recovery & Clear'
                          : 'Disburse & Mark as Paid'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={handleDownloadPdfSlip}
                    disabled={downloadingPdf}
                    title="Download official Exit Settlement Breakdown Slip in PDF format"
                  >
                    {downloadingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    <span>{downloadingPdf ? 'Downloading PDF...' : 'Download PDF Slip'}</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={handleSendEmailSlip}
                    disabled={emailSending}
                    title="Send or resend Exit Settlement Breakdown Slip (with attached PDF) to staff email"
                  >
                    {emailSending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    <span>{emailSending ? 'Sending...' : 'Email Slip to Staff (PDF)'}</span>
                  </button>

                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleCloseModal}>
                    Close
                  </button>
                  <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePrintSlip}>
                    <Printer size={16} />
                    <span>Print Slip</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Audit Action Modal ────────────────────────────────────────────── */}
      {auditDialog.open && (
        <div className={styles.modalOverlay} onClick={() => !auditDialog.loading && setAuditDialog({ open: false, record: null, remarks: '', loading: false })}>
          <div className={styles.modalBox} style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <ShieldCheck size={20} style={{ color: '#3b82f6' }} />
                Audit Head & Super Admin: Verification & Payment Approval
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => !auditDialog.loading && setAuditDialog({ open: false, record: null, remarks: '', loading: false })}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Please review the calculated notice period earnings, 100% retention fund refund, personal savings asset refunds, and liability deductions for <strong>{auditDialog.record?.name}</strong> before approving for payment disbursement.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Audit Review Remarks / Verification Notes:
                </label>
                <textarea
                  rows={3}
                  value={auditDialog.remarks}
                  onChange={(e) => setAuditDialog((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Enter audit verification comments..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnReject}`}
                onClick={handleSubmitAuditReject}
                disabled={auditDialog.loading}
              >
                <X size={16} />
                <span>Query / Reject</span>
              </button>

              <button
                type="button"
                className={`${styles.btn} ${styles.btnAudit}`}
                onClick={handleSubmitAuditApprove}
                disabled={auditDialog.loading}
              >
                {auditDialog.loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                <span>Approve for Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Finance Payment & Debt Recovery Processing Modal ────────────── */}
      {financeDialog.open && (
        <div className={styles.modalOverlay} onClick={() => !financeDialog.loading && setFinanceDialog({ open: false, record: null, isRecoverable: false, paymentReference: '', paymentDate: '', remarks: '', loading: false })}>
          <div className={styles.modalBox} style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <CreditCard size={20} style={{ color: financeDialog.isRecoverable ? '#8b5cf6' : '#10b981' }} />
                {financeDialog.isRecoverable
                  ? 'Finance Head & Super Admin: Record Debt Recovery & Clearance'
                  : 'Finance Head & Super Admin: Disburse & Mark as Paid'}
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => !financeDialog.loading && setFinanceDialog({ open: false, record: null, isRecoverable: false, paymentReference: '', paymentDate: '', remarks: '', loading: false })}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {financeDialog.isRecoverable ? (
                  <>
                    Record receipt of outstanding exit clearance debt payment from resigned staff member <strong>{financeDialog.record?.name}</strong>.
                  </>
                ) : (
                  <>
                    Record payment disbursement details for resigned staff member <strong>{financeDialog.record?.name}</strong>.
                  </>
                )}
              </p>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#2563eb'
              }}>
                <Mail size={15} style={{ flexShrink: 0 }} />
                <span>The complete Exit Settlement Breakdown slip will be automatically emailed to the staff member upon confirmation.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    {financeDialog.isRecoverable
                      ? 'Receipt / Bank Teller / Ref No:'
                      : 'Payment Reference / Ref No:'}
                  </label>
                  <input
                    type="text"
                    value={financeDialog.paymentReference}
                    onChange={(e) => setFinanceDialog((prev) => ({ ...prev, paymentReference: e.target.value }))}
                    placeholder={financeDialog.isRecoverable ? 'e.g. REC-2026-004 / Bank Teller 10492' : 'e.g. TRF-2026-9921 / CHQ-002'}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    {financeDialog.isRecoverable
                      ? 'Recovery / Receipt Date:'
                      : 'Payment Disbursement Date:'}
                  </label>
                  <input
                    type="date"
                    value={financeDialog.paymentDate}
                    onChange={(e) => setFinanceDialog((prev) => ({ ...prev, paymentDate: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  {financeDialog.isRecoverable
                    ? 'Finance Recovery Remarks / Notes:'
                    : 'Finance Remarks / Payment Notes:'}
                </label>
                <textarea
                  rows={2}
                  value={financeDialog.remarks}
                  onChange={(e) => setFinanceDialog((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder={financeDialog.isRecoverable ? 'e.g. Exit clearance debt recovered and confirmed by Finance.' : 'e.g. Exit clearance settlement paid via direct bank transfer.'}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setFinanceDialog({ open: false, record: null, isRecoverable: false, paymentReference: '', paymentDate: '', remarks: '', loading: false })}
                disabled={financeDialog.loading}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`${styles.btn} ${financeDialog.isRecoverable ? styles.btnRecover : styles.btnFinance}`}
                onClick={handleSubmitFinancePayment}
                disabled={financeDialog.loading}
              >
                {financeDialog.loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <span>
                  {financeDialog.isRecoverable
                    ? 'Confirm Debt Recovery & Clear'
                    : 'Confirm & Mark as Paid'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Retention Months Modal Dialog ── */}
      {retentionModal.open && (
        <div className={styles.modalOverlay} onClick={() => setRetentionModal({ open: false, staffId: null, staffName: '', resignationId: null, baseSalary: 0, monthlyRate: 0, months: 0, loading: false })}>
          <div className={styles.retentionModalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <Edit2 size={18} style={{ color: '#10b981' }} />
                Edit Deducted Retention Months
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setRetentionModal({ open: false, staffId: null, staffName: '', resignationId: null, baseSalary: 0, monthlyRate: 0, months: 0, loading: false })}
                disabled={retentionModal.loading}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRetentionMonths}>
              <div className={styles.modalBody}>
                {/* Staff Summary Card */}
                <div className={styles.retentionStaffCard}>
                  <div className={styles.retentionStaffName}>{retentionModal.staffName}</div>
                  <div className={styles.retentionStaffMeta}>
                    <span>Staff ID: <strong>{retentionModal.staffId}</strong></span>
                    <span>Entry Gross Base: <strong>₦{fmt(retentionModal.baseSalary)}</strong></span>
                  </div>
                  <div className={styles.retentionStaffMeta}>
                    <span>Monthly 5% Retention: <strong>₦{fmt(retentionModal.monthlyRate)}</strong></span>
                    <span>Cap: <strong>20 Months Max</strong></span>
                  </div>
                </div>

                {/* Deducted Months Input */}
                <div className={styles.retentionInputGroup}>
                  <label>
                    Deducted Retention Months (0 — 20 Months) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    className={styles.retentionInput}
                    value={retentionModal.months}
                    onChange={(e) => setRetentionModal(prev => ({
                      ...prev,
                      months: Math.min(20, Math.max(0, parseInt(e.target.value || 0, 10)))
                    }))}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Enter the number of monthly retention deductions completed for this staff member.
                  </span>
                </div>

                {/* Real-time Calculation Preview Grid */}
                <div className={styles.retentionPreviewGrid}>
                  <div className={styles.retentionPreviewItem}>
                    <span className={styles.retentionPreviewLabel}>Monthly Rate</span>
                    <span className={styles.retentionPreviewValue}>₦{fmt(retentionModal.monthlyRate)}</span>
                  </div>
                  <div className={styles.retentionPreviewItem}>
                    <span className={styles.retentionPreviewLabel}>Months Selected</span>
                    <span className={styles.retentionPreviewValue}>
                      {parseInt(retentionModal.months, 10) || 0} of 20 {(parseInt(retentionModal.months, 10) || 0) >= 20 ? '✓' : ''}
                    </span>
                  </div>
                  <div className={styles.retentionPreviewFullRow}>
                    <span className={styles.retentionPreviewLabel}>Total Retention Refund (100%)</span>
                    <span className={styles.retentionPreviewValue}>
                      ₦{fmt((parseInt(retentionModal.months, 10) || 0) * (retentionModal.monthlyRate || 0))}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setRetentionModal({ open: false, staffId: null, staffName: '', resignationId: null, baseSalary: 0, monthlyRate: 0, months: 0, loading: false })}
                  disabled={retentionModal.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff' }}
                  disabled={retentionModal.loading}
                >
                  {retentionModal.loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Save Retention Months</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Medical Loan Balance Modal Dialog ── */}
      {medicalLoanModal.open && (
        <div className={styles.modalOverlay} onClick={() => setMedicalLoanModal({ open: false, staffId: null, staffName: '', resignationId: null, currentBalance: 0, newBalance: '', reason: '', loading: false })}>
          <div className={styles.retentionModalBox} style={{ maxWidth: '460px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ padding: '0.8rem 1.25rem' }}>
              <h3 className={styles.modalTitle} style={{ fontSize: '1.05rem' }}>
                <Edit2 size={17} style={{ color: '#ef4444' }} />
                Edit Medical Loan Balance
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setMedicalLoanModal({ open: false, staffId: null, staffName: '', resignationId: null, currentBalance: 0, newBalance: '', reason: '', loading: false })}
                disabled={medicalLoanModal.loading}
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSaveMedicalLoanBalance} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className={styles.modalBody} style={{ padding: '0.85rem 1.25rem', gap: '0.65rem' }}>
                {/* Staff Summary Card - Compact Bar */}
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '0.55rem 0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.82rem'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{medicalLoanModal.staffName}</div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Staff ID: {medicalLoanModal.staffId}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Current Balance</div>
                    <div style={{ fontWeight: 800, color: '#b91c1c' }}>₦{fmt(medicalLoanModal.currentBalance)}</div>
                  </div>
                </div>

                {/* New Balance Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.2rem' }}>
                    New Medical Loan Balance (₦) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      background: 'var(--surface, #ffffff)',
                      outline: 'none',
                    }}
                    value={medicalLoanModal.newBalance}
                    onChange={(e) => setMedicalLoanModal(prev => ({
                      ...prev,
                      newBalance: e.target.value
                    }))}
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Adjustment / Reconciliation Reason Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.2rem' }}>
                    Adjustment Note / Reason:
                  </label>
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      padding: '0.42rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.82rem',
                      color: '#0f172a',
                      background: 'var(--surface, #ffffff)',
                      outline: 'none',
                    }}
                    value={medicalLoanModal.reason}
                    onChange={(e) => setMedicalLoanModal(prev => ({
                      ...prev,
                      reason: e.target.value
                    }))}
                    placeholder="e.g. Cash payment at cashier, pharmacy bill waiver..."
                  />
                </div>

                {/* Compact Comparison Strip */}
                <div style={{
                  background: '#fff5f5',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '0.55rem 0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8rem'
                }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Reconciled: </span>
                    <strong style={{ color: '#991b1b' }}>₦{fmt(parseFloat(medicalLoanModal.newBalance) || 0)}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#64748b' }}>
                      {((parseFloat(medicalLoanModal.newBalance) || 0) < medicalLoanModal.currentBalance)
                        ? 'Reduction: '
                        : ((parseFloat(medicalLoanModal.newBalance) || 0) > medicalLoanModal.currentBalance)
                        ? 'Addition: '
                        : 'Change: '}
                    </span>
                    <strong style={{ color: '#991b1b' }}>
                      ₦{fmt(Math.abs((parseFloat(medicalLoanModal.newBalance) || 0) - medicalLoanModal.currentBalance))}
                    </strong>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter} style={{ padding: '0.65rem 1.25rem' }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  onClick={() => setMedicalLoanModal({ open: false, staffId: null, staffName: '', resignationId: null, currentBalance: 0, newBalance: '', reason: '', loading: false })}
                  disabled={medicalLoanModal.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  style={{ background: '#ef4444', borderColor: '#ef4444', color: '#ffffff', padding: '0.4rem 0.95rem', fontSize: '0.8rem' }}
                  disabled={medicalLoanModal.loading}
                >
                  {medicalLoanModal.loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Balance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Cooperative Loan Balance Modal Dialog ── */}
      {coopLoanModal.open && (
        <div
          className={styles.modalOverlay}
          onClick={() => setCoopLoanModal({
            open: false,
            staffId: null,
            staffName: '',
            resignationId: null,
            currentBalance: 0,
            newBalance: '',
            reason: '',
            loading: false
          })}
        >
          <div
            className={styles.retentionModalBox}
            style={{ maxWidth: '460px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader} style={{ padding: '0.8rem 1.25rem' }}>
              <h3 className={styles.modalTitle} style={{ fontSize: '1.05rem' }}>
                <Edit2 size={17} style={{ color: '#d97706' }} />
                Edit Cooperative Loan Balance
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setCoopLoanModal({
                  open: false,
                  staffId: null,
                  staffName: '',
                  resignationId: null,
                  currentBalance: 0,
                  newBalance: '',
                  reason: '',
                  loading: false
                })}
                disabled={coopLoanModal.loading}
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSaveCoopLoanBalance} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className={styles.modalBody} style={{ padding: '0.85rem 1.25rem', gap: '0.65rem' }}>
                {/* Staff Summary Bar */}
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '10px',
                  padding: '0.55rem 0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.82rem'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{coopLoanModal.staffName}</div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Staff ID: {coopLoanModal.staffId}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Current Balance</div>
                    <div style={{ fontWeight: 800, color: '#b45309' }}>₦{fmt(coopLoanModal.currentBalance)}</div>
                  </div>
                </div>

                {/* New Balance Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.2rem' }}>
                    New Cooperative Loan Balance (₦) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      background: 'var(--surface, #ffffff)',
                      outline: 'none',
                    }}
                    value={coopLoanModal.newBalance}
                    onChange={(e) => setCoopLoanModal(prev => ({
                      ...prev,
                      newBalance: e.target.value
                    }))}
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Adjustment / Reconciliation Reason Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.2rem' }}>
                    Adjustment Note / Reason:
                  </label>
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      padding: '0.42rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.82rem',
                      color: '#0f172a',
                      background: 'var(--surface, #ffffff)',
                      outline: 'none',
                    }}
                    value={coopLoanModal.reason}
                    onChange={(e) => setCoopLoanModal(prev => ({
                      ...prev,
                      reason: e.target.value
                    }))}
                    placeholder="e.g. Offset against savings, cash payment..."
                  />
                </div>

                {/* Compact Comparison Strip */}
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '10px',
                  padding: '0.55rem 0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8rem'
                }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Reconciled: </span>
                    <strong style={{ color: '#b45309' }}>₦{fmt(parseFloat(coopLoanModal.newBalance) || 0)}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#64748b' }}>
                      {((parseFloat(coopLoanModal.newBalance) || 0) < coopLoanModal.currentBalance)
                        ? 'Reduction: '
                        : ((parseFloat(coopLoanModal.newBalance) || 0) > coopLoanModal.currentBalance)
                        ? 'Addition: '
                        : 'Change: '}
                    </span>
                    <strong style={{ color: '#b45309' }}>
                      ₦{fmt(Math.abs((parseFloat(coopLoanModal.newBalance) || 0) - coopLoanModal.currentBalance))}
                    </strong>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter} style={{ padding: '0.65rem 1.25rem' }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  onClick={() => setCoopLoanModal({ open: false, staffId: null, staffName: '', resignationId: null, currentBalance: 0, newBalance: '', reason: '', loading: false })}
                  disabled={coopLoanModal.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  style={{ background: '#d97706', borderColor: '#d97706', color: '#ffffff', padding: '0.4rem 0.95rem', fontSize: '0.8rem' }}
                  disabled={coopLoanModal.loading}
                >
                  {coopLoanModal.loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Balance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Payment in Lieu of Notice Modal Dialog ── */}
      {noticeInLieuModal.open && (
        <div
          className={styles.modalOverlay}
          onClick={() => !noticeInLieuModal.loading && setNoticeInLieuModal(prev => ({ ...prev, open: false }))}
        >
          <div
            className={styles.modalBox}
            style={{ maxWidth: '580px', borderRadius: '16px', overflow: 'hidden', padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveNoticeInLieu} style={{ display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflow: 'hidden' }}>
              {/* Premium Header */}
              <div style={{
                padding: '1.15rem 1.4rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(to right, #ffffff, #fffafa)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                    border: '1px solid #fca5a5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.12)',
                  }}>
                    <TrendingDown size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                      Payment in Lieu of Notice Deduction
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                      Terminal clearance reconciliation &amp; notice default offset
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !noticeInLieuModal.loading && setNoticeInLieuModal(prev => ({ ...prev, open: false }))}
                  disabled={noticeInLieuModal.loading}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                  title="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody} style={{ padding: '1.15rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {/* Policy Notice Box */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(254, 242, 242, 0.8) 0%, rgba(255, 241, 242, 0.5) 100%)',
                  border: '1px solid rgba(248, 113, 113, 0.28)',
                  borderRadius: '10px',
                  padding: '0.75rem 0.95rem',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    background: '#fee2e2',
                    color: '#b91c1c',
                    borderRadius: '6px',
                    padding: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}>
                    <ShieldAlert size={16} />
                  </div>
                  <div style={{ fontSize: '0.8rem', lineHeight: 1.45, color: '#475569' }}>
                    <span style={{
                      display: 'inline-block',
                      fontWeight: 800,
                      color: '#991b1b',
                      textTransform: 'uppercase',
                      fontSize: '0.68rem',
                      letterSpacing: '0.04em',
                      background: '#fecaca',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      marginRight: '6px'
                    }}>
                      Policy Rule
                    </span>
                    If the staff member did not complete their agreed 1-month notice period or defaulted on exit terms, calculate notice in lieu to deduct directly from their exit payouts (retention refund, notice salary, or cooperative savings) to protect company funds.
                  </div>
                </div>

                {/* Staff & Compensation Card */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '0.8rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      border: '1.5px solid #bfdbfe',
                      color: '#1d4ed8',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {(noticeInLieuModal.staffName || 'ST').split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>
                        {noticeInLieuModal.staffName}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Staff ID: <strong style={{ color: '#334155' }}>{noticeInLieuModal.staffId}</strong></span>
                        <span>•</span>
                        <span>Month Basis: <strong style={{ color: '#334155' }}>{noticeInLieuModal.daysInMonth} Days</strong></span>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.675rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                      Monthly Gross / Daily Rate
                    </div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', marginTop: '1px' }}>
                      ₦{fmt(noticeInLieuModal.monthlyGross)}
                    </div>
                    <div style={{ fontSize: '0.73rem', fontWeight: 600, color: '#2563eb' }}>
                      ₦{fmt(noticeInLieuModal.dailyRate)} <span style={{ color: '#64748b', fontWeight: 400 }}>/ calendar day</span>
                    </div>
                  </div>
                </div>

                {/* Available Terminal Funds Balance Tiles */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '0.8rem 0.95rem',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.73rem',
                      fontWeight: 800,
                      color: '#334155',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      <Wallet size={14} style={{ color: '#059669' }} />
                      <span>Available Terminal Payouts (Click Tile to Target)</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Offset pool
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {/* Tile 1: Retention Savings */}
                    <div
                      onClick={() => {
                        if (noticeInLieuModal.retentionAvailable > 0) {
                          const amt = noticeInLieuModal.retentionAvailable.toFixed(2);
                          const equiv = noticeInLieuModal.dailyRate > 0 ? Math.round(noticeInLieuModal.retentionAvailable / noticeInLieuModal.dailyRate) : 0;
                          setNoticeInLieuModal(prev => ({
                            ...prev,
                            amount: amt,
                            days: equiv.toString(),
                            deductionSource: 'retention'
                          }));
                        }
                      }}
                      style={{
                        background: noticeInLieuModal.deductionSource === 'retention' ? '#ecfdf5' : '#ffffff',
                        border: `1.5px solid ${noticeInLieuModal.deductionSource === 'retention' ? '#10b981' : '#e2e8f0'}`,
                        borderRadius: '9px',
                        padding: '8px 10px',
                        cursor: noticeInLieuModal.retentionAvailable > 0 ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                        boxShadow: noticeInLieuModal.deductionSource === 'retention' ? '0 2px 6px rgba(16, 185, 129, 0.15)' : 'none',
                      }}
                      title="Click to take payment in lieu from retention savings refund"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 600 }}>Retention Savings</span>
                        {noticeInLieuModal.deductionSource === 'retention' && (
                          <span style={{ background: '#10b981', color: '#ffffff', fontSize: '0.6rem', fontWeight: 700, borderRadius: '4px', padding: '1px 4px' }}>Target</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 800, color: '#059669', fontSize: '0.9rem', marginTop: '2px' }}>
                        +{fmt(noticeInLieuModal.retentionAvailable)}
                      </div>
                      <div style={{ fontSize: '0.67rem', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                        100% Refundable
                      </div>
                    </div>

                    {/* Tile 2: Notice Salary */}
                    <div
                      onClick={() => {
                        if (noticeInLieuModal.salaryAvailable > 0) {
                          const amt = noticeInLieuModal.salaryAvailable.toFixed(2);
                          const equiv = noticeInLieuModal.dailyRate > 0 ? Math.round(noticeInLieuModal.salaryAvailable / noticeInLieuModal.dailyRate) : 0;
                          setNoticeInLieuModal(prev => ({
                            ...prev,
                            amount: amt,
                            days: equiv.toString(),
                            deductionSource: 'salary'
                          }));
                        }
                      }}
                      style={{
                        background: noticeInLieuModal.deductionSource === 'salary' ? '#eff6ff' : '#ffffff',
                        border: `1.5px solid ${noticeInLieuModal.deductionSource === 'salary' ? '#3b82f6' : '#e2e8f0'}`,
                        borderRadius: '9px',
                        padding: '8px 10px',
                        cursor: noticeInLieuModal.salaryAvailable > 0 ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                        boxShadow: noticeInLieuModal.deductionSource === 'salary' ? '0 2px 6px rgba(59, 130, 246, 0.15)' : 'none',
                      }}
                      title="Click to take payment in lieu from earned notice salary"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 600 }}>Notice Salary</span>
                        {noticeInLieuModal.deductionSource === 'salary' && (
                          <span style={{ background: '#3b82f6', color: '#ffffff', fontSize: '0.6rem', fontWeight: 700, borderRadius: '4px', padding: '1px 4px' }}>Target</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 800, color: '#2563eb', fontSize: '0.9rem', marginTop: '2px' }}>
                        +{fmt(noticeInLieuModal.salaryAvailable)}
                      </div>
                      <div style={{ fontSize: '0.67rem', color: '#2563eb', fontWeight: 600, marginTop: '2px' }}>
                        Earned Exit Pay
                      </div>
                    </div>

                    {/* Tile 3: Cooperative Savings */}
                    <div
                      onClick={() => {
                        if (noticeInLieuModal.coopSavingsAvailable > 0) {
                          const amt = noticeInLieuModal.coopSavingsAvailable.toFixed(2);
                          const equiv = noticeInLieuModal.dailyRate > 0 ? Math.round(noticeInLieuModal.coopSavingsAvailable / noticeInLieuModal.dailyRate) : 0;
                          setNoticeInLieuModal(prev => ({
                            ...prev,
                            amount: amt,
                            days: equiv.toString(),
                            deductionSource: 'coop_savings'
                          }));
                        }
                      }}
                      style={{
                        background: noticeInLieuModal.deductionSource === 'coop_savings' ? '#f0fdf4' : '#ffffff',
                        border: `1.5px solid ${noticeInLieuModal.deductionSource === 'coop_savings' ? '#059669' : '#e2e8f0'}`,
                        borderRadius: '9px',
                        padding: '8px 10px',
                        cursor: noticeInLieuModal.coopSavingsAvailable > 0 ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                        boxShadow: noticeInLieuModal.deductionSource === 'coop_savings' ? '0 2px 6px rgba(5, 150, 105, 0.15)' : 'none',
                      }}
                      title="Click to take payment in lieu from cooperative savings balance"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 600 }}>Coop. Savings</span>
                        {noticeInLieuModal.deductionSource === 'coop_savings' && (
                          <span style={{ background: '#059669', color: '#ffffff', fontSize: '0.6rem', fontWeight: 700, borderRadius: '4px', padding: '1px 4px' }}>Target</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginTop: '2px' }}>
                        +{fmt(noticeInLieuModal.coopSavingsAvailable)}
                      </div>
                      <div style={{ fontSize: '0.67rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                        Saved Balance
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '9px',
                    paddingTop: '8px',
                    borderTop: '1px solid #e2e8f0',
                  }}>
                    <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                      Total Final Terminal Earnings Pool:
                    </span>
                    <span style={{
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      background: '#ffffff',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1'
                    }}>
                      ₦{fmt(noticeInLieuModal.totalEarningsAvailable)}
                    </span>
                  </div>
                </div>

                {/* Calculation Mode Switcher: Segmented Control */}
                <div>
                  <div style={{
                    background: '#f1f5f9',
                    borderRadius: '10px',
                    padding: '3px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px',
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        const daysNum = parseInt(noticeInLieuModal.days, 10) || 30;
                        const calcAmt = (noticeInLieuModal.dailyRate * daysNum).toFixed(2);
                        setNoticeInLieuModal(prev => ({
                          ...prev,
                          calculationMode: 'days',
                          days: daysNum.toString(),
                          amount: calcAmt
                        }));
                      }}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: noticeInLieuModal.calculationMode === 'days' ? '#ffffff' : 'transparent',
                        color: noticeInLieuModal.calculationMode === 'days' ? '#0f172a' : '#64748b',
                        fontWeight: noticeInLieuModal.calculationMode === 'days' ? 800 : 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: noticeInLieuModal.calculationMode === 'days' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Clock size={14} style={{ color: noticeInLieuModal.calculationMode === 'days' ? '#dc2626' : '#94a3b8' }} />
                      <span>Calculate by Unserved Days</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNoticeInLieuModal(prev => ({ ...prev, calculationMode: 'amount' }))}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: noticeInLieuModal.calculationMode === 'amount' ? '#ffffff' : 'transparent',
                        color: noticeInLieuModal.calculationMode === 'amount' ? '#0f172a' : '#64748b',
                        fontWeight: noticeInLieuModal.calculationMode === 'amount' ? 800 : 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: noticeInLieuModal.calculationMode === 'amount' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <NairaSign size={14} style={{ color: noticeInLieuModal.calculationMode === 'amount' ? '#dc2626' : '#94a3b8' }} />
                      <span>Enter Direct Actual Amount (₦)</span>
                    </button>
                  </div>
                </div>

                {/* Mode: By Days */}
                {noticeInLieuModal.calculationMode === 'days' ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                        Number of Unserved Notice Days: *
                      </label>
                      <span style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 600 }}>
                        Formula: {noticeInLieuModal.days || 0} days × ₦{fmt(noticeInLieuModal.dailyRate)} = ₦{fmt(parseFloat(noticeInLieuModal.amount) || 0)}
                      </span>
                    </div>

                    <input
                      type="number"
                      min="0"
                      max="365"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.8rem',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        background: '#ffffff',
                        outline: 'none',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                      value={noticeInLieuModal.days}
                      onChange={(e) => {
                        const d = e.target.value;
                        const numD = parseInt(d, 10);
                        const calcAmt = !isNaN(numD) && numD >= 0 ? (noticeInLieuModal.dailyRate * numD).toFixed(2) : '0.00';
                        setNoticeInLieuModal(prev => ({
                          ...prev,
                          days: d,
                          amount: calcAmt
                        }));
                      }}
                      placeholder="e.g. 15, 30"
                      required
                    />

                    {/* Quick Days Preset Chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {[
                        { label: '1 Full Month (30d)', days: 30 },
                        { label: '15 Days (Half Month)', days: 15 },
                        { label: '10 Days', days: 10 },
                        { label: '5 Days', days: 5 },
                        { label: '0 Days (Reset)', days: 0 },
                      ].map((preset, idx) => {
                        const isSelected = String(noticeInLieuModal.days) === String(preset.days);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const calcAmt = (noticeInLieuModal.dailyRate * preset.days).toFixed(2);
                              setNoticeInLieuModal(prev => ({
                                ...prev,
                                days: preset.days.toString(),
                                amount: calcAmt
                              }));
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${isSelected ? '#dc2626' : '#e2e8f0'}`,
                              background: isSelected ? '#fef2f2' : '#ffffff',
                              fontSize: '0.72rem',
                              color: isSelected ? '#b91c1c' : '#334155',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Mode: By Amount */
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                        Actual Payment in Lieu Amount (₦) *
                      </label>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                        {noticeInLieuModal.dailyRate > 0 && parseFloat(noticeInLieuModal.amount) > 0
                          ? `≈ ${Math.round(parseFloat(noticeInLieuModal.amount) / noticeInLieuModal.dailyRate)} days unserved notice`
                          : ''}
                      </span>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        pointerEvents: 'none'
                      }}>
                        <NairaSign size={16} />
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.8rem 0.5rem 2rem',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '0.95rem',
                          fontWeight: 800,
                          color: '#0f172a',
                          background: '#ffffff',
                          outline: 'none',
                        }}
                        value={noticeInLieuModal.amount}
                        onChange={(e) => {
                          const val = e.target.value;
                          const numVal = parseFloat(val);
                          const equivDays = !isNaN(numVal) && noticeInLieuModal.dailyRate > 0 ? Math.round(numVal / noticeInLieuModal.dailyRate) : 0;
                          setNoticeInLieuModal(prev => ({
                            ...prev,
                            amount: val,
                            days: equivDays.toString()
                          }));
                        }}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    {/* Quick Amount Match Presets */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const amt = noticeInLieuModal.monthlyGross.toFixed(2);
                          setNoticeInLieuModal(prev => ({
                            ...prev,
                            amount: amt,
                            days: '30'
                          }));
                        }}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }}
                      >
                        1 Month Gross (₦{fmt(noticeInLieuModal.monthlyGross)})
                      </button>

                      {noticeInLieuModal.retentionAvailable > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const amt = noticeInLieuModal.retentionAvailable.toFixed(2);
                            const equiv = noticeInLieuModal.dailyRate > 0 ? Math.round(noticeInLieuModal.retentionAvailable / noticeInLieuModal.dailyRate) : 0;
                            setNoticeInLieuModal(prev => ({
                              ...prev,
                              amount: amt,
                              days: equiv.toString(),
                              deductionSource: 'retention'
                            }));
                          }}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#f0fdf4', fontSize: '0.72rem', color: '#166534', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Match Retention (₦{fmt(noticeInLieuModal.retentionAvailable)})
                        </button>
                      )}

                      {noticeInLieuModal.salaryAvailable > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const amt = noticeInLieuModal.salaryAvailable.toFixed(2);
                            const equiv = noticeInLieuModal.dailyRate > 0 ? Math.round(noticeInLieuModal.salaryAvailable / noticeInLieuModal.dailyRate) : 0;
                            setNoticeInLieuModal(prev => ({
                              ...prev,
                              amount: amt,
                              days: equiv.toString(),
                              deductionSource: 'salary'
                            }));
                          }}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', fontSize: '0.72rem', color: '#1e40af', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Match Notice Salary (₦{fmt(noticeInLieuModal.salaryAvailable)})
                        </button>
                      )}

                      {noticeInLieuModal.coopSavingsAvailable > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const amt = noticeInLieuModal.coopSavingsAvailable.toFixed(2);
                            const equiv = noticeInLieuModal.dailyRate > 0 ? Math.round(noticeInLieuModal.coopSavingsAvailable / noticeInLieuModal.dailyRate) : 0;
                            setNoticeInLieuModal(prev => ({
                              ...prev,
                              amount: amt,
                              days: equiv.toString(),
                              deductionSource: 'coop_savings'
                            }));
                          }}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#f0fdf4', fontSize: '0.72rem', color: '#166534', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Match Coop Savings (₦{fmt(noticeInLieuModal.coopSavingsAvailable)})
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setNoticeInLieuModal(prev => ({ ...prev, amount: '0.00', days: '0' }))}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fff5f5', fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Reset / Clear (₦0.00)
                      </button>
                    </div>
                  </div>
                )}

                {/* Deduction Source & Offset Target Dropdown */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Deduct From / Offset Target Source:
                  </label>
                  <select
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none',
                    }}
                    value={noticeInLieuModal.deductionSource}
                    onChange={(e) => setNoticeInLieuModal(prev => ({ ...prev, deductionSource: e.target.value }))}
                  >
                    <option value="general">All Available Exit Settlement Funds (General Offset Pool)</option>
                    <option value="retention">Retention Savings Refund (Take from staff retention fund)</option>
                    <option value="salary">Notice Salary Payment (Take from earned notice salary)</option>
                    <option value="coop_savings">Cooperative Savings Refund (Take from staff cooperative balance)</option>
                  </select>
                </div>

                {/* Reason / Agreement Default Note */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Reason / Agreement Breach Note:
                  </label>
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.82rem',
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none',
                    }}
                    value={noticeInLieuModal.reason}
                    onChange={(e) => setNoticeInLieuModal(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="e.g. Staff did not meet up with agreed notice period / handover"
                  />
                </div>

                {/* Financial Clearance Impact Hero Summary */}
                {(() => {
                  const numAmt = parseFloat(noticeInLieuModal.amount) || 0;
                  const currentDeductionsExceptLieu = (settlementData.deductions?.itemized_deductions || [])
                    .filter(d => !d.name.includes('Payment in Lieu'))
                    .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                  const newTotalDeductions = currentDeductionsExceptLieu + numAmt;
                  const totalEarnings = parseFloat(settlementData.settlement_summary?.total_final_earnings ?? 0) || 0;
                  const projectedNet = totalEarnings - newTotalDeductions;
                  const isRecoverable = projectedNet < 0;

                  return (
                    <div style={{
                      background: isRecoverable
                        ? 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)'
                        : 'linear-gradient(135deg, #f0fdf4 0%, #f7fee7 100%)',
                      border: `1.5px solid ${isRecoverable ? '#fca5a5' : '#86efac'}`,
                      borderRadius: '12px',
                      padding: '0.85rem 1rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '8px',
                        paddingBottom: '8px',
                        borderBottom: `1px solid ${isRecoverable ? '#fecaca' : '#bbf7d0'}`
                      }}>
                        <div>
                          <div style={{ fontSize: '0.675rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total Final Earnings</div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginTop: '2px' }}>₦{fmt(totalEarnings)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.675rem', color: '#dc2626', textTransform: 'uppercase', fontWeight: 700 }}>Notice in Lieu</div>
                          <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.9rem', marginTop: '2px' }}>- ₦{fmt(numAmt)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.675rem', color: '#b91c1c', textTransform: 'uppercase', fontWeight: 700 }}>Total Final Deductions</div>
                          <div style={{ fontWeight: 800, color: '#b91c1c', fontSize: '0.9rem', marginTop: '2px' }}>- ₦{fmt(newTotalDeductions)}</div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '8px',
                      }}>
                        <div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: isRecoverable ? '#b91c1c' : '#15803d',
                          }}>
                            {isRecoverable ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                            <span>{isRecoverable ? 'FINAL NET RECOVERABLE FROM STAFF:' : 'FINAL NET PAYABLE TO STAFF:'}</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: isRecoverable ? '#991c1c' : '#166534', marginTop: '2px' }}>
                            {isRecoverable
                              ? 'Notice deduction exceeds earnings; balance flagged for Debt Recovery.'
                              : 'Notice deduction will be satisfied directly from terminal earnings.'}
                          </div>
                        </div>

                        <div style={{
                          fontSize: '1.3rem',
                          fontWeight: 900,
                          color: isRecoverable ? '#b91c1c' : '#15803d',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          letterSpacing: '-0.02em',
                        }}>
                          <NairaSign size={19} />
                          <span>{fmt(Math.abs(projectedNet))}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Premium Footer */}
              <div style={{
                padding: '0.85rem 1.4rem',
                borderTop: '1px solid #f1f5f9',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '10px'
              }}>
                <button
                  type="button"
                  style={{
                    padding: '0.55rem 1.1rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#475569',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setNoticeInLieuModal(prev => ({ ...prev, open: false }))}
                  disabled={noticeInLieuModal.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                  }}
                  disabled={noticeInLieuModal.loading}
                >
                  {noticeInLieuModal.loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  <span>Apply &amp; Save Notice Deduction</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Forward Back to Audit Head Modal ────────────── */}
      {resubmitDialog.open && (
        <div className={styles.modalOverlay} onClick={() => !resubmitDialog.loading && setResubmitDialog({ open: false, record: null, remarks: '', loading: false })}>
          <div className={styles.modalBox} style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <ShieldCheck size={20} style={{ color: '#f59e0b' }} />
                Forward to Audit Head for Approval
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => !resubmitDialog.loading && setResubmitDialog({ open: false, record: null, remarks: '', loading: false })}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                This exit settlement for <strong>{resubmitDialog.record?.name}</strong> was queried by Internal Audit.
                After reviewing and making necessary corrections, provide explanation notes below and forward it back for Audit Head approval.
              </p>

              {resubmitDialog.record?.audit_remarks && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '0.82rem',
                  color: '#b91c1c'
                }}>
                  <strong>Audit Head Query / Reason:</strong>
                  <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                    {resubmitDialog.record.audit_remarks}
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Correction & Explanation Notes for Audit Head:
                </label>
                <textarea
                  rows={3}
                  value={resubmitDialog.remarks}
                  onChange={(e) => setResubmitDialog((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Describe the adjustments or corrections made (e.g. Adjusted retention months, reviewed loan deduction)..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setResubmitDialog({ open: false, record: null, remarks: '', loading: false })}
                disabled={resubmitDialog.loading}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`${styles.btn} ${styles.btnResubmit}`}
                onClick={handleSubmitResubmit}
                disabled={resubmitDialog.loading}
              >
                {resubmitDialog.loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                <span>Forward to Audit Head</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Printable Official Settlement Slip (Hidden on Screen, Visible on Print) ── */}
      {settlementData && (
        <div className={styles.printableSlip}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>ISALU HOSPITALS LIMITED</h1>
            <p style={{ margin: '4px 0', fontSize: '0.9rem' }}>HR & PAYROLL DEPARTMENT — STAFF EXIT SETTLEMENT & CLEARANCE VOUCHER</p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#555' }}>Approved Resignation & Final Accounts Settlement</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px', fontSize: '0.85rem' }}>
            <div>
              <p style={{ margin: '3px 0' }}><strong>Staff Name:</strong> {settlementData.staff.name}</p>
              <p style={{ margin: '3px 0' }}><strong>Staff ID:</strong> {settlementData.staff.id}</p>
              <p style={{ margin: '3px 0' }}><strong>Department:</strong> {settlementData.staff.department}</p>
              <p style={{ margin: '3px 0' }}><strong>Bank Details:</strong> {settlementData.staff.bank_name} — {settlementData.staff.account_no}</p>
            </div>
            <div>
              <p style={{ margin: '3px 0' }}><strong>Date of Appointment:</strong> {formatDate(settlementData.staff?.appointment_date || settlementData.timeline?.appointment_date)}</p>
              <p style={{ margin: '3px 0' }}><strong>Resignation Date:</strong> {formatDate(settlementData.timeline.resignation_date)}</p>
              <p style={{ margin: '3px 0' }}><strong>Notice Duration:</strong> Exactly 1 Calendar Month ({settlementData.timeline.notice_period_days || 30} Days)</p>
              <p style={{ margin: '3px 0' }}><strong>Effective Exit Date:</strong> {formatDate(settlementData.timeline.exit_date)}</p>
              <p style={{ margin: '3px 0' }}><strong>HR Approval Date:</strong> {formatDate(settlementData.timeline.admin_approved_at)}</p>
            </div>
          </div>

          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '8px' }}>1. Notice Period Earned Salary</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '15px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0', textAlign: 'left' }}>
                <th style={{ padding: '6px', border: '1px solid #ddd' }}>Period</th>
                <th style={{ padding: '6px', border: '1px solid #ddd' }}>Days in Month</th>
                <th style={{ padding: '6px', border: '1px solid #ddd' }}>Days Worked</th>
                <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'right' }}>Amount (₦)</th>
              </tr>
            </thead>
            <tbody>
              {settlementData.notice_earnings.breakdown.map((b, idx) => (
                <tr key={idx} style={{ background: b.is_paid_via_payroll ? '#f8fafc' : '#fff' }}>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                    {b.period_label}
                    {b.is_paid_via_payroll && (
                      <span style={{ color: '#059669', fontWeight: 600, display: 'block', fontSize: '0.72rem' }}>
                        ✓ Paid via Regular Monthly Payroll (Excluded from Settlement)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>{b.days_in_month}</td>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>{b.days_worked}</td>
                  <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'right', color: b.is_paid_via_payroll ? '#64748b' : '#000' }}>
                    ₦{fmt(b.earned_salary)}
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: '#fafafa' }}>
                <td colSpan={3} style={{ padding: '6px', border: '1px solid #ddd' }}>Total Notice Salary Earnings</td>
                <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'right' }}>₦{fmt(settlementData.notice_earnings.total_notice_salary)}</td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '8px' }}>2. Retention Fund Refund</h3>
          <p style={{ fontSize: '0.8rem', margin: '4px 0 10px' }}>
            Total Accumulated Retention Refund (100% Refundable upon completion of 1-month notice): <strong>₦{fmt(settlementData.retention_refund.total_refund_amount)}</strong>
          </p>

          {settlementData.coop_savings_refund?.total_savings_balance > 0 && (
            <>
              <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '8px' }}>3. Cooperative Savings Refund (Staff Asset)</h3>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 10px' }}>
                Total Accumulated Cooperative Savings Balance Refunded to Staff: <strong>₦{fmt(settlementData.coop_savings_refund.total_savings_balance)}</strong>
              </p>
            </>
          )}

          {settlementData.bonuses_and_allowances?.total_amount > 0 && (
            <>
              <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '8px' }}>4. Active Bonuses & Special Allowances</h3>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 10px' }}>
                Total Additional Bonuses & Allowances: <strong>₦{fmt(settlementData.bonuses_and_allowances.total_amount)}</strong>
              </p>
            </>
          )}

          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '8px' }}>
            {settlementData.coop_savings_refund?.total_savings_balance > 0 ? '5' : '3'}. Outstanding Liabilities & Statutory Deductions Offset
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '15px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0', textAlign: 'left' }}>
                <th style={{ padding: '6px', border: '1px solid #ddd' }}>Deduction Item</th>
                <th style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'right' }}>Amount (₦)</th>
              </tr>
            </thead>
            <tbody>
              {(settlementData.deductions?.itemized_deductions || []).map((d, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                    {d.name}
                    {d.name.includes('Leave of Absence') && d.amount > 0 && d.note && d.note !== 'Nil' && (
                      <span style={{ fontSize: '0.75rem', color: '#666' }}> ({d.note})</span>
                    )}
                    {d.name.includes('Payment in Lieu') && d.amount > 0 && d.note && d.note !== 'Nil' && (
                      <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}> ({d.note})</span>
                    )}
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'right' }}>₦{fmt(d.amount)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: '#fafafa' }}>
                <td style={{ padding: '6px', border: '1px solid #ddd' }}>Total Final Deductions</td>
                <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'right' }}>₦{fmt(settlementData.deductions.total_deductions)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ border: '2px solid #000', padding: '12px', textAlign: 'center', margin: '20px 0', background: '#f9f9f9' }}>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', textTransform: 'uppercase' }}>
              {settlementData.settlement_summary.settlement_type === 'payable' ? 'NET PAYABLE TO STAFF' : 'NET RECOVERABLE FROM STAFF'}
            </h2>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>
              ₦{fmt(Math.abs(settlementData.settlement_summary.net_settlement_amount))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '30px', fontSize: '0.78rem', textAlign: 'center' }}>
            <div style={{ border: '1px solid #bbb', padding: '10px', borderRadius: '4px' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: 700, textTransform: 'uppercase' }}>1. HR Head Approval</p>
              <p style={{ margin: '2px 0', color: '#555' }}>Approved: {settlementData.clearance_workflow?.hr_approval?.approved_by || 'HR Head'}</p>
              <p style={{ margin: '2px 0', color: '#555' }}>Date: {formatDate(settlementData.clearance_workflow?.hr_approval?.approved_at)}</p>
              <div style={{ marginTop: '20px', borderTop: '1px dashed #666', paddingTop: '4px', fontStyle: 'italic' }}>Signature & Date</div>
            </div>
            <div style={{ border: '1px solid #bbb', padding: '10px', borderRadius: '4px' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: 700, textTransform: 'uppercase' }}>2. Audit Head Clearance</p>
              <p style={{ margin: '2px 0', color: '#555' }}>
                Status: {settlementData.clearance_workflow?.audit_approval?.status === 1 ? 'PASSED & APPROVED' : 'PENDING'}
              </p>
              <p style={{ margin: '2px 0', color: '#555' }}>Audited by: {settlementData.clearance_workflow?.audit_approval?.audited_by || 'Audit Head'}</p>
              <p style={{ margin: '2px 0', color: '#555' }}>Date: {formatDate(settlementData.clearance_workflow?.audit_approval?.audited_at)}</p>
              <div style={{ marginTop: '20px', borderTop: '1px dashed #666', paddingTop: '4px', fontStyle: 'italic' }}>Audit Stamp & Signature</div>
            </div>
            <div style={{ border: '1px solid #bbb', padding: '10px', borderRadius: '4px' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: 700, textTransform: 'uppercase' }}>
                {settlementData.settlement_summary.settlement_type === 'recoverable'
                  ? '3. Finance Debt Recovery'
                  : '3. Finance Disbursement'}
              </p>
              <p style={{ margin: '2px 0', color: '#555' }}>
                Status: {settlementData.clearance_workflow?.finance_payment?.status === 1
                  ? (settlementData.settlement_summary.settlement_type === 'recoverable' ? 'RECOVERED & CLEARED' : 'DISBURSED / PAID')
                  : (settlementData.settlement_summary.settlement_type === 'recoverable' ? 'PENDING RECOVERY' : 'PENDING')}
              </p>
              <p style={{ margin: '2px 0', color: '#555' }}>
                {settlementData.settlement_summary.settlement_type === 'recoverable' ? 'Cleared by: ' : 'Paid by: '}
                {settlementData.clearance_workflow?.finance_payment?.paid_by || 'Finance Head'}
              </p>
              <p style={{ margin: '2px 0', color: '#555' }}>
                {settlementData.settlement_summary.settlement_type === 'recoverable' ? 'Receipt Ref: ' : 'Ref: '}
                {settlementData.clearance_workflow?.finance_payment?.payment_reference || 'N/A'}
              </p>
              <p style={{ margin: '2px 0', color: '#555' }}>Date: {formatDate(settlementData.clearance_workflow?.finance_payment?.paid_at)}</p>
              <div style={{ marginTop: '10px', borderTop: '1px dashed #666', paddingTop: '4px', fontStyle: 'italic' }}>Finance Officer Signature</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
