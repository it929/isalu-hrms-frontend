'use client';

import React, { useState, useEffect, useCallback, useMemo, useSyncExternalStore, useRef } from 'react';
import axios from 'axios';
import {
  FileWarning,
  Search,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Printer,
  Edit2,
  Edit3,
  RotateCcw,
  Trash2,
  FileText,
  User,
  Building,
  Calendar,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  X,
  Loader2,
  Check,
  Send,
  LogOut,
  CreditCard,
  DollarSign,
  ArrowRight,
  Sparkles,
  Download,
  Mail,
  Save,
  Copy
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
      if (roleName) headers['X-User-Role'] = roleName;
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

const emptySubscribe = () => () => {};

function getActiveRoleName() {
  if (typeof window === 'undefined') return '';
  try {
    const rawRole = localStorage.getItem('hrms_role');
    if (rawRole) {
      const parsed = JSON.parse(rawRole);
      return String(parsed?.rolename || parsed?.name || parsed?.role_name || '').toLowerCase().trim();
    }
  } catch { /* ignore */ }
  return '';
}

function getLoggedInStaffId() {
  if (typeof window === 'undefined') return null;
  try {
    const u = JSON.parse(localStorage.getItem('hrms_user'));
    return u?.staff_id ?? u?.staffID ?? u?.employee_id ?? (u?.username && /^\d+$/.test(u.username) ? parseInt(u.username, 10) : null);
  } catch { /* ignore */ }
  return null;
}

export default function AdviceToResignPage() {
  // ─── State Management ───────────────────────────────────────────────────────
  const [records, setRecords] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [reasonOptions, setReasonOptions] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    applied: 0,
    hr_approved: 0,
    audit_approved: 0,
    audit_rejected: 0,
    paid: 0,
    complied: 0,
    terminated: 0,
    withdrawn: 0,
    overdue: 0
  });

  const [userPermissions, setUserPermissions] = useState({
    user_id: null,
    is_super_admin: false,
    is_hr_head: false,
    is_audit_head: false,
    is_finance_head: false,
    staff_id: null
  });

  const activeRoleName = useSyncExternalStore(emptySubscribe, getActiveRoleName, () => '');
  const loggedInStaffId = useSyncExternalStore(emptySubscribe, getLoggedInStaffId, () => null);

  const isSuperAdmin = useMemo(() => {
    return Boolean(
      userPermissions.is_super_admin ||
      ['super admin', 'super administrator', 'superadmin', 'administrator', 'admin'].includes(activeRoleName)
    );
  }, [userPermissions.is_super_admin, activeRoleName]);

  const isHrHead = useMemo(() => {
    return Boolean(
      isSuperAdmin ||
      userPermissions.is_hr_head ||
      ['hr head', 'head of hr', 'hr', 'human resources'].includes(activeRoleName)
    );
  }, [isSuperAdmin, userPermissions.is_hr_head, activeRoleName]);

  const isAuditHead = useMemo(() => {
    return Boolean(
      isSuperAdmin ||
      userPermissions.is_audit_head ||
      ['audit head', 'head of audit', 'audit', 'internal audit'].includes(activeRoleName)
    );
  }, [isSuperAdmin, userPermissions.is_audit_head, activeRoleName]);

  const isFinanceHead = useMemo(() => {
    return Boolean(
      isSuperAdmin ||
      userPermissions.is_finance_head ||
      ['finance head', 'head of finance', 'finance', 'accountant', 'accounts'].includes(activeRoleName)
    );
  }, [isSuperAdmin, userPermissions.is_finance_head, activeRoleName]);

  const isPrivileged = useMemo(() => {
    return Boolean(isSuperAdmin || isHrHead || isAuditHead || isFinanceHead);
  }, [isSuperAdmin, isHrHead, isAuditHead, isFinanceHead]);

  const currentStaffId = userPermissions.staff_id || loggedInStaffId;

  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState(null);

  // ─── Workflow Modals State ─────────────────────────────────────────────────
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // Step 1: Staff Apply Modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyTargetRecord, setApplyTargetRecord] = useState(null);
  const [applyData, setApplyData] = useState({
    applied_date: new Date().toISOString().split('T')[0],
    staff_remarks: ''
  });

  // Step 2: HR Head Approve Modal
  const [showHrApproveModal, setShowHrApproveModal] = useState(false);
  const [hrApproveTargetRecord, setHrApproveTargetRecord] = useState(null);
  const [hrApproveData, setHrApproveData] = useState({
    effective_exit_date: new Date().toISOString().split('T')[0],
    hr_remarks: ''
  });

  // Step 3: Audit Head Review Modal
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTargetRecord, setAuditTargetRecord] = useState(null);
  const [auditData, setAuditData] = useState({
    action: 'approve', // 'approve' | 'reject'
    audit_remarks: ''
  });

  // Step 4: Finance Head Pay Modal
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeTargetRecord, setFinanceTargetRecord] = useState(null);
  const [financeData, setFinanceData] = useState({
    payment_reference: '',
    payment_date: new Date().toISOString().split('T')[0],
    finance_remarks: ''
  });

  // Settlement Detailed Modal
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementTargetRecord, setSettlementTargetRecord] = useState(null);
  const [settlementData, setSettlementData] = useState(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  // Reconciliation Modals State (Retention Months, Medical Loan, Coop Loan)
  const [retentionModal, setRetentionModal] = useState({
    open: false,
    staffId: null,
    staffName: '',
    adviceId: null,
    baseSalary: 0,
    monthlyRate: 0,
    months: 0,
    loading: false,
  });

  const [medicalLoanModal, setMedicalLoanModal] = useState({
    open: false,
    staffId: null,
    staffName: '',
    adviceId: null,
    currentBalance: 0,
    newBalance: '',
    reason: 'Exit clearance reconciliation',
    loading: false,
  });

  const [coopLoanModal, setCoopLoanModal] = useState({
    open: false,
    staffId: null,
    staffName: '',
    adviceId: null,
    currentBalance: 0,
    newBalance: '',
    reason: 'Exit clearance reconciliation',
    loading: false,
  });

  const canManageRetention = isSuperAdmin || isHrHead || isFinanceHead;
  const canManageMedicalLoan = isSuperAdmin || isHrHead || isFinanceHead || isAuditHead;
  const canManageCoopLoan = isSuperAdmin || isHrHead || isFinanceHead || isAuditHead;

  // Fallback Action (Terminate / Withdraw) Modal
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionTargetRecord, setActionTargetRecord] = useState(null);
  const [actionData, setActionData] = useState({
    status: 'complied',
    compliance_date: new Date().toISOString().split('T')[0],
    resolution_remarks: '',
    convert_to_resignation: true
  });

  // Official Letter Modal
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [letterData, setLetterData] = useState(null);
  const [originalLetterData, setOriginalLetterData] = useState(null);
  const [letterLoading, setLetterLoading] = useState(false);
  const [includeHeading, setIncludeHeading] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(true);
  const letterContentRef = useRef(null);

  // Issue Form State
  const [formData, setFormData] = useState({
    staff_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    deadline_date: '',
    reason: '',
    query_reference: '',
    details: '',
    consequence_if_defaulted: 'Failure to tender your formal letter of resignation on or before the stated deadline will result in immediate termination of appointment with summary forfeiture of separation entitlements.'
  });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Fetch Records ─────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await axios.get(`${API_BASE}/advice-to-resign`, {
        headers: buildHeaders(),
        params
      });

      if (res.data?.status) {
        setRecords(res.data.data?.records || []);
        if (res.data.data?.stats) {
          setStats(res.data.data.stats);
        }
        if (res.data.data?.user_permissions) {
          setUserPermissions(res.data.data.user_permissions);
        }
      }
    } catch (err) {
      console.error('Failed to load records:', err);
      showToast(err.response?.data?.message || 'Error fetching advice records', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, showToast]);

  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      try {
        const [recRes, staffRes] = await Promise.all([
          axios.get(`${API_BASE}/advice-to-resign`, {
            headers: buildHeaders(),
            params: {
              ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {}),
              ...(searchQuery.trim() ? { search: searchQuery.trim() } : {})
            }
          }),
          axios.get(`${API_BASE}/advice-to-resign/staff`, { headers: buildHeaders() })
        ]);

        if (!ignore) {
          if (recRes.data?.status) {
            setRecords(recRes.data.data?.records || []);
            if (recRes.data.data?.stats) setStats(recRes.data.data.stats);
            if (recRes.data.data?.user_permissions) setUserPermissions(recRes.data.data.user_permissions);
          }
          if (staffRes.data?.status) {
            setStaffList(staffRes.data.data?.staff || []);
            setReasonOptions(staffRes.data.data?.reasons || []);
          }
          setLoading(false);
          setStaffLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load initial data:', err);
          setLoading(false);
          setStaffLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      ignore = true;
    };
  }, [statusFilter, searchQuery]);

  // ─── Quick Deadline Setter Helper ──────────────────────────────────────────
  const addDaysToDeadline = (days) => {
    const base = formData.issue_date ? new Date(formData.issue_date) : new Date();
    base.setDate(base.getDate() + days);
    setFormData(prev => ({
      ...prev,
      deadline_date: base.toISOString().split('T')[0]
    }));
  };

  // ─── Handle Open Issue / Edit Modal ───────────────────────────────────────
  const handleOpenIssue = (record = null) => {
    if (!isSuperAdmin && !isHrHead) {
      showToast('Access restricted: Only Super Admin and HR Head can issue or edit Advice notices.', 'error');
      return;
    }
    if (record) {
      setEditingRecord(record);
      setFormData({
        staff_id: record.staff_id || '',
        issue_date: record.issue_date || new Date().toISOString().split('T')[0],
        deadline_date: record.deadline_date || '',
        reason: record.reason || '',
        query_reference: record.query_reference || '',
        details: record.details || '',
        consequence_if_defaulted: record.consequence_if_defaulted || ''
      });
    } else {
      setEditingRecord(null);
      const defaultDeadline = new Date();
      defaultDeadline.setDate(defaultDeadline.getDate() + 2);

      setFormData({
        staff_id: '',
        issue_date: new Date().toISOString().split('T')[0],
        deadline_date: defaultDeadline.toISOString().split('T')[0],
        reason: reasonOptions[0] || 'Unsatisfactory Performance',
        query_reference: '',
        details: '',
        consequence_if_defaulted: 'Failure to tender your formal letter of resignation on or before the stated deadline will result in immediate termination of appointment with summary forfeiture of separation entitlements.'
      });
    }
    setShowIssueModal(true);
  };

  // ─── Handle Submit Issue / Update ──────────────────────────────────────────
  const handleSubmitIssue = async (e) => {
    e.preventDefault();
    if (!formData.staff_id) {
      showToast('Please select a staff member.', 'error');
      return;
    }
    if (!formData.deadline_date) {
      showToast('Please set a compliance deadline.', 'error');
      return;
    }
    if (!formData.reason.trim()) {
      showToast('Please specify the reason for advice to resign.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (editingRecord) {
        const res = await axios.put(`${API_BASE}/advice-to-resign/${editingRecord.id}`, formData, {
          headers: buildHeaders()
        });
        if (res.data?.status) {
          showToast(res.data.message || 'Record updated successfully');
          setShowIssueModal(false);
          fetchRecords();
        }
      } else {
        const res = await axios.post(`${API_BASE}/advice-to-resign`, formData, {
          headers: buildHeaders()
        });
        if (res.data?.status) {
          showToast(res.data.message || 'Advice to resign issued successfully');
          setShowIssueModal(false);
          fetchRecords();
        }
      }
    } catch (err) {
      console.error('Failed to save advice record:', err);
      showToast(err.response?.data?.message || 'Error saving advice record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 1: Staff Apply Handlers ──────────────────────────────────────────
  const handleOpenApply = (record) => {
    const isOwn = currentStaffId && (Number(record.staff_id) === Number(currentStaffId) || Number(record.staff?.id) === Number(currentStaffId));
    if (!isSuperAdmin && !isHrHead && !isOwn) {
      showToast('Access restricted: Only the affected staff member, HR Head, or Super Admin can tender resignation.', 'error');
      return;
    }
    setApplyTargetRecord(record);
    setApplyData({
      applied_date: record.applied_date || new Date().toISOString().split('T')[0],
      staff_remarks: record.staff_remarks || `I hereby tender my formal resignation from the services of Isalu Hospitals Limited pursuant to Notice ${record.reference_no}.`
    });
    setShowApplyModal(true);
  };

  const handleSubmitApply = async (e) => {
    e.preventDefault();
    if (!applyTargetRecord) return;

    try {
      setSubmitting(true);
      const res = await axios.post(`${API_BASE}/advice-to-resign/${applyTargetRecord.id}/staff-apply`, applyData, {
        headers: buildHeaders()
      });

      if (res.data?.status) {
        showToast(res.data.message || 'Resignation application submitted successfully');
        setShowApplyModal(false);
        fetchRecords();
      }
    } catch (err) {
      console.error('Failed to submit application:', err);
      showToast(err.response?.data?.message || 'Failed to submit application', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 2: HR Head Approve Handlers ──────────────────────────────────────
  const handleOpenHrApprove = (record) => {
    if (!isSuperAdmin && !isHrHead) {
      showToast('Access restricted: Only HR Head or Super Admin can approve resignations and remove staff from payroll.', 'error');
      return;
    }
    setHrApproveTargetRecord(record);
    setHrApproveData({
      effective_exit_date: record.applied_date || record.compliance_date || new Date().toISOString().split('T')[0],
      hr_remarks: 'Voluntary resignation accepted pursuant to Advice Notice. Staff removed from active payroll and immediate exit settlement authorized.'
    });
    setShowHrApproveModal(true);
  };

  const handleSubmitHrApprove = async (e) => {
    e.preventDefault();
    if (!hrApproveTargetRecord) return;

    try {
      setSubmitting(true);
      const res = await axios.post(`${API_BASE}/advice-to-resign/${hrApproveTargetRecord.id}/hr-approve`, hrApproveData, {
        headers: buildHeaders()
      });

      if (res.data?.status) {
        showToast(res.data.message || 'Resignation approved. Staff removed from payroll & settlement computed.');
        setShowHrApproveModal(false);
        fetchRecords();
        if (res.data.data?.settlement_data) {
          setSettlementData(res.data.data.settlement_data);
          setSettlementTargetRecord(hrApproveTargetRecord);
          setShowSettlementModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to approve resignation:', err);
      showToast(err.response?.data?.message || 'Failed to approve resignation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 3: Audit Head Review Handlers ────────────────────────────────────
  const handleOpenAuditReview = async (record) => {
    if (!isSuperAdmin && !isAuditHead) {
      showToast('Access restricted: Only Audit Head or Super Admin can review exit settlements.', 'error');
      return;
    }
    setAuditTargetRecord(record);
    setAuditData({
      action: 'approve',
      audit_remarks: 'All settlement computations, retention savings, and loan deductions verified and approved.'
    });
    setShowAuditModal(true);

    // If settlement summary is missing or all zeros, load real computed settlement dynamically
    const sum = record.settlement_summary;
    const hasValidNumbers = sum && (Number(sum.total_earnings || sum.total_final_earnings || 0) > 0 || Number(sum.total_deductions || sum.total_final_deductions || 0) > 0);
    if (!hasValidNumbers) {
      try {
        const res = await axios.get(`${API_BASE}/advice-to-resign/${record.id}/settlement`, {
          headers: buildHeaders()
        });
        const settlement = res.data?.data?.settlement || res.data?.settlement;
        if (settlement?.settlement_summary) {
          const s = settlement.settlement_summary;
          const liveSummary = {
            total_earnings: Number(s.total_final_earnings ?? 0),
            total_deductions: Number(s.total_final_deductions ?? 0),
            net_settlement: Number(s.net_settlement_amount ?? 0),
            is_payable: (s.settlement_type !== 'recoverable' && Number(s.net_settlement_amount ?? 0) >= 0),
            settlement_type: s.settlement_type,
          };
          setAuditTargetRecord(prev => prev && prev.id === record.id ? { ...prev, settlement_summary: liveSummary } : prev);
        }
      } catch (err) {
        console.error('Failed to load live settlement snapshot for audit:', err);
      }
    }
  };

  const handleSubmitAuditReview = async (e) => {
    e.preventDefault();
    if (!auditTargetRecord) return;

    try {
      setSubmitting(true);
      const res = await axios.post(`${API_BASE}/advice-to-resign/${auditTargetRecord.id}/audit-review`, auditData, {
        headers: buildHeaders()
      });

      if (res.data?.status) {
        showToast(res.data.message || 'Audit review processed successfully');
        setShowAuditModal(false);
        fetchRecords();
      }
    } catch (err) {
      console.error('Failed to process audit review:', err);
      showToast(err.response?.data?.message || 'Failed to process audit review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 4: Finance Head Pay Handlers ─────────────────────────────────────
  const handleOpenFinancePay = async (record) => {
    if (!isSuperAdmin && !isFinanceHead) {
      showToast('Access restricted: Only Finance Head or Super Admin can disburse settlement payments.', 'error');
      return;
    }
    setFinanceTargetRecord(record);
    setFinanceData({
      payment_reference: `PAY-ATR-${new Date().getFullYear()}-${String(record.id).padStart(4, '0')}`,
      payment_date: new Date().toISOString().split('T')[0],
      finance_remarks: 'Exit settlement payment disbursed via electronic bank transfer.'
    });
    setShowFinanceModal(true);

    // If settlement summary is missing or all zeros, load real computed settlement dynamically
    const sum = record.settlement_summary;
    const hasValidNumbers = sum && (Number(sum.total_earnings || sum.total_final_earnings || 0) > 0 || Number(sum.total_deductions || sum.total_final_deductions || 0) > 0);
    if (!hasValidNumbers) {
      try {
        const res = await axios.get(`${API_BASE}/advice-to-resign/${record.id}/settlement`, {
          headers: buildHeaders()
        });
        const settlement = res.data?.data?.settlement || res.data?.settlement;
        if (settlement?.settlement_summary) {
          const s = settlement.settlement_summary;
          const liveSummary = {
            total_earnings: Number(s.total_final_earnings ?? 0),
            total_deductions: Number(s.total_final_deductions ?? 0),
            net_settlement: Number(s.net_settlement_amount ?? 0),
            is_payable: (s.settlement_type !== 'recoverable' && Number(s.net_settlement_amount ?? 0) >= 0),
            settlement_type: s.settlement_type,
          };
          setFinanceTargetRecord(prev => prev && prev.id === record.id ? { ...prev, settlement_summary: liveSummary } : prev);
        }
      } catch (err) {
        console.error('Failed to load live settlement snapshot for finance:', err);
      }
    }
  };

  const handleSubmitFinancePay = async (e) => {
    e.preventDefault();
    if (!financeTargetRecord) return;

    if (!financeData.payment_reference.trim()) {
      showToast('Please provide a payment reference number.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post(`${API_BASE}/advice-to-resign/${financeTargetRecord.id}/finance-pay`, financeData, {
        headers: buildHeaders()
      });

      if (res.data?.status) {
        showToast(res.data.message || 'Settlement payment recorded and disbursed successfully');
        setShowFinanceModal(false);
        fetchRecords();
      }
    } catch (err) {
      console.error('Failed to record payment:', err);
      showToast(err.response?.data?.message || 'Failed to record payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── View Settlement Breakdown Handlers ────────────────────────────────────
  const handleOpenSettlement = async (record) => {
    const isOwn = currentStaffId && (Number(record.staff_id) === Number(currentStaffId) || Number(record.staff?.id) === Number(currentStaffId));
    if (!isSuperAdmin && !isHrHead && !isAuditHead && !isFinanceHead && !isOwn) {
      showToast('Access restricted: Only authorized officers or the affected staff can view settlement slips.', 'error');
      return;
    }
    setSettlementTargetRecord(record);
    setShowSettlementModal(true);
    setSettlementLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/advice-to-resign/${record.id}/settlement`, {
        headers: buildHeaders()
      });
      if (res.data?.status) {
        setSettlementData(res.data.data?.settlement || res.data.settlement);
      }
    } catch (err) {
      console.error('Failed to fetch settlement:', err);
      showToast(err.response?.data?.message || 'Failed to compute settlement breakdown', 'error');
    } finally {
      setSettlementLoading(false);
    }
  };

  const handleDownloadPdfSlip = async () => {
    if (!settlementTargetRecord?.id) return;
    setDownloadingPdf(true);
    try {
      const res = await axios.get(
        `${API_BASE}/advice-to-resign/${settlementTargetRecord.id}/download-pdf`,
        {
          headers: buildHeaders(),
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const staffId = settlementData?.staff?.id || settlementTargetRecord.staff_id;
      link.setAttribute('download', `Exit_Settlement_Slip_StaffID_${staffId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Official Exit Settlement PDF slip downloaded successfully.');
    } catch (err) {
      console.error('PDF download error:', err);
      showToast('Error downloading settlement PDF slip.', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSendEmailSlip = async () => {
    if (!settlementTargetRecord?.id) return;
    setEmailSending(true);
    try {
      const res = await axios.post(
        `${API_BASE}/advice-to-resign/${settlementTargetRecord.id}/send-email`,
        {},
        { headers: buildHeaders() }
      );
      if (res.data?.status === 'success') {
        showToast(res.data.message || 'Exit settlement slip & PDF emailed successfully.');
      } else {
        showToast(res.data?.message || 'Failed to email settlement slip.', 'error');
      }
    } catch (err) {
      console.error('Email error:', err);
      showToast(err.response?.data?.message || 'Error emailing settlement slip.', 'error');
    } finally {
      setEmailSending(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  // ── Open Edit Retention Months Modal ──
  const handleOpenEditRetention = (data, e) => {
    e?.stopPropagation();
    if (!canManageRetention) {
      showToast('Permission denied: Only Super Administrators, HR Head, and Finance Head can edit retention months.', 'warning');
      return;
    }
    const staffId = data.staff?.id || data.staff_id || settlementTargetRecord?.staff_id;
    const staffName = data.staff?.name || settlementTargetRecord?.staff?.name;
    const adviceId = settlementTargetRecord?.id;
    const rawMonths = data.retention_refund?.months_deducted ?? 0;
    const months = parseInt(rawMonths, 10) || 0;
    const baseSalary = data.retention_refund?.base_salary ?? data.salary_structure?.monthly_gross ?? 0;
    const monthlyRate = data.retention_refund?.monthly_rate ?? (baseSalary * 0.05);

    setRetentionModal({
      open: true,
      staffId,
      staffName,
      adviceId,
      baseSalary,
      monthlyRate,
      months,
      loading: false,
    });
  };

  // ── Save Edited Retention Months ──
  const handleSaveRetentionMonths = async (e) => {
    e?.preventDefault();
    if (!retentionModal.staffId) return;

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
        advice_id: retentionModal.adviceId,
      }, { headers });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Retention deducted months updated successfully.');
        if (res.data.data?.settlement) {
          setSettlementData(res.data.data.settlement);
        } else if (retentionModal.adviceId) {
          const sRes = await axios.get(`${API_BASE}/advice-to-resign/${retentionModal.adviceId}/settlement`, { headers });
          if (sRes.data?.status) {
            setSettlementData(sRes.data.data?.settlement || sRes.data.settlement);
          }
        }
        setRetentionModal({ open: false, staffId: null, staffName: '', adviceId: null, baseSalary: 0, monthlyRate: 0, months: 0, loading: false });
        fetchRecords();
      } else {
        showToast(res.data.message || 'Failed to update retention months.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error updating retention months.', 'error');
    } finally {
      setRetentionModal(prev => ({ ...prev, loading: false }));
    }
  };

  // ── Open Edit Medical Loan Modal ──
  const handleOpenEditMedicalLoan = (data, currentAmount, e) => {
    e?.stopPropagation();
    if (!canManageMedicalLoan) {
      showToast('Permission denied: Only Super Administrators, HR Head, Finance Head, or Audit Head can reconcile medical loan balance.', 'warning');
      return;
    }
    const staffId = data.staff?.id || data.staff_id || settlementTargetRecord?.staff_id;
    const staffName = data.staff?.name || settlementTargetRecord?.staff?.name;
    const adviceId = settlementTargetRecord?.id;
    const curBal = parseFloat(currentAmount) || 0;

    setMedicalLoanModal({
      open: true,
      staffId,
      staffName,
      adviceId,
      currentBalance: curBal,
      newBalance: curBal.toString(),
      reason: 'Exit clearance reconciliation',
      loading: false,
    });
  };

  // ── Save Edited Medical Loan Balance ──
  const handleSaveMedicalLoanBalance = async (e) => {
    e?.preventDefault();
    if (!medicalLoanModal.staffId) return;

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
        advice_id: medicalLoanModal.adviceId,
      }, { headers });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Medical loan balance updated successfully.');
        if (res.data.data?.settlement) {
          setSettlementData(res.data.data.settlement);
        } else if (medicalLoanModal.adviceId) {
          const sRes = await axios.get(`${API_BASE}/advice-to-resign/${medicalLoanModal.adviceId}/settlement`, { headers });
          if (sRes.data?.status) {
            setSettlementData(sRes.data.data?.settlement || sRes.data.settlement);
          }
        }
        setMedicalLoanModal({ open: false, staffId: null, staffName: '', adviceId: null, currentBalance: 0, newBalance: '', reason: '', loading: false });
        fetchRecords();
      } else {
        showToast(res.data.message || 'Failed to update medical loan balance.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error updating medical loan balance.', 'error');
    } finally {
      setMedicalLoanModal(prev => ({ ...prev, loading: false }));
    }
  };

  // ── Open Edit Cooperative Loan Modal ──
  const handleOpenEditCoopLoan = (data, currentAmount, e) => {
    e?.stopPropagation();
    if (!canManageCoopLoan) {
      showToast('Permission denied: Only Super Administrators, HR Head, Finance Head, or Audit Head can reconcile cooperative loan balance.', 'warning');
      return;
    }
    const staffId = data.staff?.id || data.staff_id || settlementTargetRecord?.staff_id;
    const staffName = data.staff?.name || settlementTargetRecord?.staff?.name;
    const adviceId = settlementTargetRecord?.id;
    const curBal = parseFloat(currentAmount) || 0;

    setCoopLoanModal({
      open: true,
      staffId,
      staffName,
      adviceId,
      currentBalance: curBal,
      newBalance: curBal.toString(),
      reason: 'Exit clearance reconciliation',
      loading: false,
    });
  };

  // ── Save Edited Cooperative Loan Balance ──
  const handleSaveCoopLoanBalance = async (e) => {
    e?.preventDefault();
    if (!coopLoanModal.staffId) return;

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
        advice_id: coopLoanModal.adviceId,
      }, { headers });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Cooperative loan balance updated successfully.');
        if (res.data.data?.settlement) {
          setSettlementData(res.data.data.settlement);
        } else if (coopLoanModal.adviceId) {
          const sRes = await axios.get(`${API_BASE}/advice-to-resign/${coopLoanModal.adviceId}/settlement`, { headers });
          if (sRes.data?.status) {
            setSettlementData(sRes.data.data?.settlement || sRes.data.settlement);
          }
        }
        setCoopLoanModal({ open: false, staffId: null, staffName: '', adviceId: null, currentBalance: 0, newBalance: '', reason: '', loading: false });
        fetchRecords();
      } else {
        showToast(res.data.message || 'Failed to update cooperative loan balance.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error updating cooperative loan balance.', 'error');
    } finally {
      setCoopLoanModal(prev => ({ ...prev, loading: false }));
    }
  };

  // ─── Handle Delete Record ──────────────────────────────────────────────────
  const handleDelete = async (record) => {
    if (!isSuperAdmin && !isHrHead) {
      showToast('Access restricted: Only Super Admin and HR Head can delete advice records.', 'error');
      return;
    }
    if (!confirm(`Are you sure you want to delete advice record ${record.reference_no} for ${record.staff?.name || 'this staff'}?`)) {
      return;
    }

    try {
      const res = await axios.delete(`${API_BASE}/advice-to-resign/${record.id}`, {
        headers: buildHeaders()
      });
      if (res.data?.status) {
        showToast(res.data.message || 'Record deleted successfully');
        fetchRecords();
      }
    } catch (err) {
      console.error('Failed to delete record:', err);
      showToast(err.response?.data?.message || 'Failed to delete record', 'error');
    }
  };

  // ─── Handle Open Fallback Action Modal ─────────────────────────────────────
  const handleOpenAction = (record) => {
    if (!isSuperAdmin && !isHrHead) {
      showToast('Access restricted: Only Super Admin and HR Head can record outcomes or terminate appointment.', 'error');
      return;
    }
    setActionTargetRecord(record);
    setActionData({
      status: 'terminated',
      compliance_date: new Date().toISOString().split('T')[0],
      resolution_remarks: 'Staff failed to comply within stipulated deadline. Appointment terminated as indicated in Advice Notice.',
      convert_to_resignation: false
    });
    setShowActionModal(true);
  };

  const handleSubmitAction = async (e) => {
    e.preventDefault();
    if (!actionTargetRecord) return;

    try {
      setSubmitting(true);
      const res = await axios.post(`${API_BASE}/advice-to-resign/${actionTargetRecord.id}/action`, actionData, {
        headers: buildHeaders()
      });

      if (res.data?.status) {
        showToast(res.data.message || 'Outcome recorded successfully');
        setShowActionModal(false);
        fetchRecords();
      }
    } catch (err) {
      console.error('Failed to record action:', err);
      showToast(err.response?.data?.message || 'Failed to record action outcome', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Handle Open Letter Modal ──────────────────────────────────────────────
  const handleOpenLetter = async (record) => {
    setShowLetterModal(true);
    setLetterLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/advice-to-resign/${record.id}/letter`, {
        headers: buildHeaders()
      });
      if (res.data?.status) {
        setLetterData(res.data.data);
        setOriginalLetterData(JSON.parse(JSON.stringify(res.data.data)));
      }
    } catch (err) {
      console.error('Failed to load letter:', err);
      showToast('Failed to generate letter preview', 'error');
      setShowLetterModal(false);
    } finally {
      setLetterLoading(false);
    }
  };

  const handleResetLetter = () => {
    if (originalLetterData) {
      setLetterData(JSON.parse(JSON.stringify(originalLetterData)));
      showToast('Letter content reset to original draft.');
    }
  };

  const handleCopyLetterText = () => {
    if (letterContentRef.current) {
      const text = letterContentRef.current.innerText;
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showToast('Official letter text copied to clipboard!');
        }).catch(() => {
          showToast('Failed to copy text', 'error');
        });
      }
      return;
    }
    if (!letterData) return;
    const recipientName = letterData.staff?.name || '';
    const staffId = letterData.staff?.staff_id || letterData.staff?.id || '';
    const dept = letterData.staff?.department || '';
    const desig = letterData.staff?.designation || '';

    const text = `ISALU HOSPITALS LIMITED
No 46, Ijaiye Road Opposite Ogba Shopping Arcade, Caterpillar Bus-Stop, Ogba, Lagos Nigeria.
Tel: 08169618571, 08062287502, 08033088592 | Email: info@isaluhospitals.com | Web: www.isaluhospitals.com

REF: ${letterData.reference_no}
DATE: ${letterData.letter_date}

To:
${recipientName} (StaffID: ${staffId})
${desig ? `${desig}\n` : ''}${dept ? `${dept}\n` : ''}Isalu Hospitals Limited.

LETTER OF ADVICE TO TENDER FORMAL RESIGNATION

Dear ${recipientName},

Following a comprehensive administrative and disciplinary review of your employment records and conduct${letterData.query_reference ? ` (Ref: Query ${letterData.query_reference})` : ''}, Management has reviewed matters concerning: ${letterData.reason}.

${letterData.details ? `Particulars / Findings:\n${letterData.details}\n\n` : ''}In the best interest of the hospital and in consideration of maintaining professional decorum, Management hereby formally advises you to voluntarily tender your letter of resignation from the services of Isalu Hospitals Limited.

Your formal letter of resignation must be submitted to the Human Resources Department on or before ${letterData.deadline_date}.

Consequence of Default:
${letterData.consequence}

Upon the timeous receipt of your resignation letter, you will be required to properly hand over all hospital property, badges, equipment, and records in your custody to your Head of Department, after which your clearance and terminal benefits will be processed in accordance with hospital policy.

Yours faithfully,
For: ISALU HOSPITALS LIMITED

${letterData.signatory?.name || 'ANIFOWOSHE MONSURAT'}
${letterData.signatory?.title || 'Head of Human Resources & Corporate Services'}
Isalu Hospitals Limited`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Official letter text copied to clipboard!');
      }).catch(() => {
        showToast('Failed to copy text', 'error');
      });
    }
  };

  // ─── Helper for Rendering Deadline Countdown Badge ─────────────────────────
  const renderDeadlineBadge = (record) => {
    if (record.status === 'applied') {
      return <span className={`${styles.countdownPill} ${styles.countdownGreen}`}><Check size={12} /> Applied {record.applied_date ? `(${formatDate(record.applied_date)})` : ''}</span>;
    }
    if (record.status === 'hr_approved') {
      return <span className={`${styles.countdownPill} ${styles.countdownGreen}`}><Check size={12} /> Off Payroll</span>;
    }
    if (record.status === 'audit_approved') {
      return <span className={`${styles.countdownPill} ${styles.countdownGreen}`}><Check size={12} /> Audit Cleared</span>;
    }
    if (record.status === 'paid') {
      return <span className={`${styles.countdownPill} ${styles.countdownGreen}`}><Check size={12} /> Disbursed</span>;
    }
    if (record.status === 'complied') {
      return <span className={`${styles.countdownPill} ${styles.countdownGreen}`}><Check size={12} /> Complied</span>;
    }
    if (record.status === 'terminated') {
      return <span className={`${styles.countdownPill} ${styles.countdownRed}`}><X size={12} /> Terminated</span>;
    }
    if (record.status === 'withdrawn') {
      return <span className={`${styles.countdownPill} ${styles.countdownMuted}`}>Withdrawn</span>;
    }

    if (record.is_overdue) {
      return (
        <span className={`${styles.countdownPill} ${styles.countdownRed}`}>
          <AlertTriangle size={12} /> {record.days_overdue} {record.days_overdue === 1 ? 'day' : 'days'} overdue
        </span>
      );
    }

    if (record.days_remaining === 0) {
      return (
        <span className={`${styles.countdownPill} ${styles.countdownAmber}`}>
          <Clock size={12} /> Due Today
        </span>
      );
    }

    return (
      <span className={`${styles.countdownPill} ${styles.countdownAmber}`}>
        <Clock size={12} /> {record.days_remaining} {record.days_remaining === 1 ? 'day' : 'days'} left
      </span>
    );
  };

  // ─── Helper for Rendering Status Badge ─────────────────────────────────────
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'applied':
        return <span className={`${styles.statusBadge} ${styles.statusApplied}`}><Send size={12} /> Staff Applied</span>;
      case 'hr_approved':
        return <span className={`${styles.statusBadge} ${styles.statusHrApproved}`}><CheckCircle2 size={12} /> HR Approved (In Audit)</span>;
      case 'audit_approved':
        return <span className={`${styles.statusBadge} ${styles.statusAuditApproved}`}><CheckCircle2 size={12} /> Audit Approved (Ready for Pay)</span>;
      case 'audit_rejected':
        return <span className={`${styles.statusBadge} ${styles.statusAuditRejected}`}><XCircle size={12} /> Audit Queried</span>;
      case 'paid':
        return <span className={`${styles.statusBadge} ${styles.statusPaid}`}><CheckCircle2 size={12} /> Paid &amp; Settled</span>;
      case 'complied':
        return <span className={`${styles.statusBadge} ${styles.statusComplied}`}><CheckCircle2 size={12} /> Complied</span>;
      case 'terminated':
        return <span className={`${styles.statusBadge} ${styles.statusTerminated}`}><XCircle size={12} /> Terminated</span>;
      case 'withdrawn':
        return <span className={`${styles.statusBadge} ${styles.statusWithdrawn}`}>Withdrawn</span>;
      case 'pending':
      default:
        return <span className={`${styles.statusBadge} ${styles.statusPending}`}><Clock size={12} /> Notice Served</span>;
    }
  };

  return (
    <div className={styles.container}>
      {/* ── Top Header ── */}
      <header className={styles.header}>
        <div className={styles.headerTitleWrapper}>
          <div className={styles.headerIcon}>
            <FileWarning size={24} />
          </div>
          <div>
            <h1 className={styles.title}>Advice to Resign Registry</h1>
            <p className={styles.subtitle}>
              {isPrivileged
                ? 'Manage administrative Advice to Resign notices, staff voluntary application, HR Head approval & automatic payroll deactivation, audit review, and finance payout.'
                : 'Review your administrative Notice of Advice to Resign and tender your voluntary resignation before the stipulated deadline.'}
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            onClick={() => fetchRecords()}
            className={styles.btnSecondary}
            title="Refresh Registry"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {(isSuperAdmin || isHrHead) && (
            <button
              onClick={() => handleOpenIssue()}
              className={styles.btnPrimary}
            >
              <Plus size={16} />
              <span>Issue Advice Notice</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Metric Stats Cards & Control Bar (Privileged Management Only: Super Admin, HR Head, Audit Head, Finance) ── */}
      {isPrivileged && (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statCard} onClick={() => setStatusFilter('all')} style={{ cursor: 'pointer' }}>
              <div className={styles.statIconWrapper} style={{ background: '#eff6ff', color: '#0284c7' }}>
                <FileText size={22} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.total}</span>
                <span className={styles.statLabel}>Total Notices</span>
              </div>
            </div>

            <div className={styles.statCard} onClick={() => setStatusFilter('pending')} style={{ cursor: 'pointer' }}>
              <div className={styles.statIconWrapper} style={{ background: '#fffbeb', color: '#d97706' }}>
                <Clock size={22} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.pending}</span>
                <span className={styles.statLabel}>Notice Served</span>
              </div>
            </div>

            <div className={styles.statCard} onClick={() => setStatusFilter('applied')} style={{ cursor: 'pointer' }}>
              <div className={styles.statIconWrapper} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <Send size={22} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.applied}</span>
                <span className={styles.statLabel}>Staff Applied</span>
              </div>
            </div>

            <div className={styles.statCard} onClick={() => setStatusFilter('hr_approved')} style={{ cursor: 'pointer' }}>
              <div className={styles.statIconWrapper} style={{ background: '#f0f9ff', color: '#0284c7' }}>
                <ShieldCheck size={22} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.hr_approved}</span>
                <span className={styles.statLabel}>In Audit Review</span>
              </div>
            </div>

            <div className={styles.statCard} onClick={() => setStatusFilter('audit_approved')} style={{ cursor: 'pointer' }}>
              <div className={styles.statIconWrapper} style={{ background: '#ecfdf5', color: '#059669' }}>
                <CreditCard size={22} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.audit_approved}</span>
                <span className={styles.statLabel}>Ready for Finance</span>
              </div>
            </div>

            <div className={styles.statCard} onClick={() => setStatusFilter('paid')} style={{ cursor: 'pointer' }}>
              <div className={styles.statIconWrapper} style={{ background: '#f0fdf4', color: '#16a34a' }}>
                <CheckCircle2 size={22} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{stats.paid}</span>
                <span className={styles.statLabel}>Settled &amp; Paid</span>
              </div>
            </div>
          </div>

          <div className={styles.controlBar}>
            <div className={styles.searchGroup}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search by staff name, StaffID, reference, or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className={styles.statusFilterPills}>
              {[
                { id: 'all', label: 'All', count: stats.total },
                { id: 'pending', label: 'Notice Served', count: stats.pending },
                { id: 'applied', label: 'Staff Applied', count: stats.applied },
                { id: 'hr_approved', label: 'In Audit Review', count: stats.hr_approved },
                { id: 'audit_approved', label: 'Ready for Pay', count: stats.audit_approved },
                { id: 'paid', label: 'Settled & Paid', count: stats.paid },
                { id: 'terminated', label: 'Terminated', count: stats.terminated }
              ].map((st) => (
                <button
                  key={st.id}
                  className={`${styles.filterPill} ${statusFilter === st.id ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter(st.id)}
                >
                  <span>{st.label}</span>
                  <span className={statusFilter === st.id ? styles.pillCountActive : styles.pillCount}>
                    {st.count ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Table Card ── */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '13%' }}>Ref Number</th>
                <th style={{ width: '22%' }}>Target Staff Member</th>
                <th style={{ width: '18%' }}>Reason for Notice</th>
                <th style={{ width: '10%' }}>Issued Date</th>
                <th style={{ width: '13%' }}>Compliance Deadline</th>
                <th style={{ width: '12%' }}>Workflow Status</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', color: '#64748b' }}>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Loading Advice to Resign registry records...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>
                        <FileWarning size={28} />
                      </div>
                      <h3 className={styles.emptyTitle}>
                        {isPrivileged ? 'No Advice to Resign records found' : 'No Advice to Resign Notice Issued'}
                      </h3>
                      <p className={styles.emptySubtitle}>
                        {isPrivileged
                          ? (searchQuery || statusFilter !== 'all'
                              ? 'Try adjusting your search criteria or status filter.'
                              : 'Issue a formal Advice to Resign notice to start the administrative separation workflow.')
                          : 'Your employment record is in good standing. You do not have any pending administrative Advice to Resign notices.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <span className={styles.refBadge}>{rec.reference_no}</span>
                    </td>
                    <td>
                      {(() => {
                        const staffName = rec.staff?.name || rec.staff_name || 'Staff Member';
                        const staffIdCode = rec.staff_id || rec.staff?.staff_id || rec.staff?.id;
                        const staffDept = rec.staff?.department || rec.department || '';
                        const staffDesig = rec.staff?.designation || rec.designation || '';
                        const initials = staffName
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('') || 'ST';

                        return (
                          <div className={styles.staffCol}>
                            <div className={styles.staffAvatar}>
                              {initials}
                            </div>
                            <div>
                              <div className={styles.staffName}>{staffName}</div>
                              <div className={styles.staffSub}>
                                StaffID: <strong>{staffIdCode}</strong>
                                {staffDept ? ` • ${staffDept}` : ''}
                                {staffDesig ? ` (${staffDesig})` : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <div className={styles.reasonCategory}>{rec.reason}</div>
                      {rec.query_reference && (
                        <div className={styles.queryRefTag}>
                          Ref: {rec.query_reference}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.84375rem', color: '#475569' }}>
                        {rec.issue_date}
                      </span>
                    </td>
                    <td>
                      <div className={styles.deadlineBox}>
                        <span className={styles.deadlineDate}>{rec.deadline_date}</span>
                        {renderDeadlineBadge(rec)}
                      </div>
                    </td>
                    <td>
                      {renderStatusBadge(rec.status)}
                    </td>
                    <td>
                      {(() => {
                        const isOwnRecord = Boolean(
                          currentStaffId && (
                            Number(rec.staff_id) === Number(currentStaffId) ||
                            Number(rec.staff?.id) === Number(currentStaffId)
                          )
                        );

                        const canViewLetter = isSuperAdmin || isHrHead || isAuditHead || isFinanceHead || isOwnRecord;
                        const canStaffApply = (rec.status === 'pending' || rec.status === 'audit_rejected') && (isSuperAdmin || isHrHead || isOwnRecord);
                        const canHrApprove = (rec.status === 'applied' || (isSuperAdmin && rec.status === 'pending')) && (isSuperAdmin || isHrHead);
                        const canAuditReview = (rec.status === 'hr_approved' || rec.status === 'audit_rejected') && (isSuperAdmin || isAuditHead);
                        const canFinancePay = rec.status === 'audit_approved' && (isSuperAdmin || isFinanceHead);
                        const canViewSettlement = (rec.resignation_request_id || ['hr_approved', 'audit_approved', 'paid', 'complied'].includes(rec.status)) &&
                          (isSuperAdmin || isHrHead || isAuditHead || isFinanceHead || isOwnRecord);
                        const canManageNotice = rec.status === 'pending' && (isSuperAdmin || isHrHead);

                        const hasAnyAction = canViewLetter || canStaffApply || canHrApprove || canAuditReview || canFinancePay || canViewSettlement || canManageNotice;

                        if (!hasAnyAction) {
                          return (
                            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                              View only
                            </div>
                          );
                        }

                        return (
                          <div className={styles.actionBtns} style={{ justifyContent: 'flex-end' }}>
                            {/* 1. Official Letter Preview */}
                            {canViewLetter && (
                              <button
                                className={`${styles.iconBtn} ${styles.iconBtnLetter}`}
                                title="View / Print Official Advice Letter"
                                onClick={() => handleOpenLetter(rec)}
                              >
                                <Printer size={15} />
                              </button>
                            )}

                            {/* 2. Step 1: Staff Apply (Tender Resignation) */}
                            {canStaffApply && (
                              <button
                                className={`${styles.iconBtn} ${styles.iconBtnApply}`}
                                title="Staff Apply: Tender Voluntary Resignation"
                                onClick={() => handleOpenApply(rec)}
                              >
                                <Send size={15} />
                              </button>
                            )}

                            {/* 3. Step 2: HR Head Approve (Removes staff from payroll + calculates settlement) */}
                            {canHrApprove && (
                              <button
                                className={`${styles.iconBtn} ${styles.iconBtnHr}`}
                                title="HR Head: Approve Resignation & Compute Settlement (Deactivates Payroll)"
                                onClick={() => handleOpenHrApprove(rec)}
                              >
                                <CheckCircle2 size={15} />
                              </button>
                            )}

                            {/* 4. Step 3: Audit Head Review Settlement */}
                            {canAuditReview && (
                              <button
                                className={`${styles.iconBtn} ${styles.iconBtnAudit}`}
                                title="Audit Head: Review & Reconcile Exit Settlement"
                                onClick={() => handleOpenAuditReview(rec)}
                              >
                                <ShieldCheck size={15} />
                              </button>
                            )}

                            {/* 5. Step 4: Finance Head Pay Settlement */}
                            {canFinancePay && (
                              <button
                                className={`${styles.iconBtn} ${styles.iconBtnFinance}`}
                                title="Finance Head: Disburse Settlement Payment"
                                onClick={() => handleOpenFinancePay(rec)}
                              >
                                <CreditCard size={15} />
                              </button>
                            )}

                            {/* 6. Settlement Breakdown Slip */}
                            {canViewSettlement && (
                              <button
                                className={`${styles.iconBtn} ${styles.iconBtnSettlement}`}
                                title="View Complete Exit Settlement Slip & Calculation Breakdown"
                                onClick={() => handleOpenSettlement(rec)}
                              >
                                <FileText size={15} />
                              </button>
                            )}

                            {/* 7. Defaulted / Terminate / Withdraw action (HR Head & Super Admin only) */}
                            {canManageNotice && (
                              <>
                                <button
                                  className={`${styles.iconBtn} ${styles.iconBtnAction}`}
                                  title="Record Default / Terminate Appointment"
                                  onClick={() => handleOpenAction(rec)}
                                >
                                  <ShieldAlert size={15} />
                                </button>

                                <button
                                  className={styles.iconBtn}
                                  title="Edit Notice Details"
                                  onClick={() => handleOpenIssue(rec)}
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                  title="Delete Notice"
                                  onClick={() => handleDelete(rec)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Issue / Edit Advice to Resign Notice ── */}
      {showIssueModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleArea}>
                <div className={styles.modalHeaderIconBadge}>
                  <FileWarning size={22} />
                </div>
                <div>
                  <div className={styles.modalHeaderTag}>
                    <ShieldAlert size={12} />
                    <span>Official HR Notice</span>
                  </div>
                  <h2 className={styles.modalHeaderTitle}>
                    {editingRecord ? 'Edit Advice to Resign Notice' : 'Issue Advice to Resign Notice'}
                  </h2>
                  <p className={styles.modalHeaderSubtitle}>
                    Formal administrative advice to voluntarily tender resignation before disciplinary separation.
                  </p>
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setShowIssueModal(false)}
                title="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleSubmitIssue}>
              <div className={styles.modalBody}>
                {/* Section 1: Target Staff */}
                <div className={styles.formSection}>
                  <div className={styles.formSectionTitle}>
                    <span className={styles.formSectionTitleNumber}>1</span>
                    <span>Target Employee &amp; Compliance Timeline</span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Target Staff Member <span className={styles.labelRequired}>*</span>
                    </label>
                    <select
                      className={styles.select}
                      value={formData.staff_id}
                      onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                      disabled={editingRecord !== null || staffLoading}
                      required
                    >
                      <option value="">-- Select Active Staff Member --</option>
                      {staffList.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} [StaffID: {st.id}] • {st.department || 'General'} ({st.designation || 'Staff'})
                        </option>
                      ))}
                    </select>

                    {/* Selected Staff Live Preview Card */}
                    {(() => {
                      const selected = staffList.find(s => String(s.id) === String(formData.staff_id));
                      if (!selected) {
                        return (
                          <span className={styles.inputHelp}>
                            Only currently active staff in the hospital are eligible for issuance.
                          </span>
                        );
                      }
                      return (
                        <div className={styles.selectedStaffCard}>
                          <div className={styles.selectedStaffLeft}>
                            <div className={styles.selectedStaffAvatar}>
                              {selected.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                                {selected.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                StaffID: <strong>{selected.id}</strong> • Dept: {selected.department || 'General'} • Designation: {selected.designation || 'Staff'}
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.71875rem', fontWeight: 600, color: '#0284c7', background: '#e0f2fe', padding: '0.2rem 0.6rem', borderRadius: '9999px' }}>
                            Active
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>
                        <Calendar size={14} style={{ color: '#0284c7' }} />
                        <span>Issue Date</span>
                        <span className={styles.labelRequired}>*</span>
                      </label>
                      <input
                        type="date"
                        className={styles.input}
                        value={formData.issue_date}
                        onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>
                        <Clock size={14} style={{ color: '#d97706' }} />
                        <span>Compliance Deadline</span>
                        <span className={styles.labelRequired}>*</span>
                      </label>
                      <input
                        type="date"
                        className={styles.input}
                        value={formData.deadline_date}
                        onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
                        required
                      />
                      <div className={styles.deadlineHelperButtons}>
                        <button type="button" onClick={() => addDaysToDeadline(1)}>+24 Hours</button>
                        <button type="button" onClick={() => addDaysToDeadline(2)}>+48 Hours</button>
                        <button type="button" onClick={() => addDaysToDeadline(3)}>+3 Days</button>
                        <button type="button" onClick={() => addDaysToDeadline(7)}>+1 Week</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Administrative Reasons */}
                <div className={styles.formSection}>
                  <div className={styles.formSectionTitle}>
                    <span className={styles.formSectionTitleNumber}>2</span>
                    <span>Reason &amp; Findings</span>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>
                        Administrative Reason Category <span className={styles.labelRequired}>*</span>
                      </label>
                      <select
                        className={styles.select}
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        required
                      >
                        <option value="">-- Select Administrative Reason --</option>
                        {reasonOptions.map((r, i) => (
                          <option key={i} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>
                        Related Query / Case Ref (Optional)
                      </label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="e.g. QRY/2026/09/014"
                        value={formData.query_reference}
                        onChange={(e) => setFormData({ ...formData, query_reference: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Detailed Particulars &amp; Management Findings
                    </label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Detail the specific operational findings, committee recommendations, or audit findings leading to this advice..."
                      value={formData.details}
                      onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Consequence if Defaulted
                    </label>
                    <input
                      type="text"
                      className={styles.input}
                      value={formData.consequence_if_defaulted}
                      onChange={(e) => setFormData({ ...formData, consequence_if_defaulted: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowIssueModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving Notice...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>{editingRecord ? 'Save Changes' : 'Issue Advice to Resign'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Step 1 - Staff Apply (Tender Voluntary Resignation) ── */}
      {showApplyModal && applyTargetRecord && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleArea}>
                <div className={styles.modalHeaderIconBadge} style={{ background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe' }}>
                  <Send size={22} />
                </div>
                <div>
                  <div className={styles.modalHeaderTag} style={{ background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe' }}>
                    <User size={12} />
                    <span>Step 1: Voluntary Resignation Application</span>
                  </div>
                  <h2 className={styles.modalHeaderTitle}>
                    Tender Resignation Application
                  </h2>
                  <p className={styles.modalHeaderSubtitle}>
                    Reference: <strong>{applyTargetRecord.reference_no}</strong> • Staff tender voluntary resignation pursuant to Advice Notice.
                  </p>
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setShowApplyModal(false)}
                title="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleSubmitApply}>
              <div className={styles.modalBody}>
                {/* Staff Summary */}
                <div className={styles.selectedStaffCard}>
                  <div className={styles.selectedStaffLeft}>
                    <div className={styles.selectedStaffAvatar}>
                      {(applyTargetRecord.staff?.name || 'ST').split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                        {applyTargetRecord.staff?.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        StaffID: <strong>{applyTargetRecord.staff_id || applyTargetRecord.staff?.id}</strong> • Notice Deadline: <strong>{applyTargetRecord.deadline_date}</strong>
                      </div>
                    </div>
                  </div>
                  <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                    Awaiting Application
                  </span>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <Calendar size={14} style={{ color: '#7c3aed' }} />
                    <span>Application / Resignation Date</span>
                    <span className={styles.labelRequired}>*</span>
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={applyData.applied_date}
                    onChange={(e) => setApplyData({ ...applyData, applied_date: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <span>Voluntary Resignation Letter &amp; Staff Statement</span>
                    <span className={styles.labelRequired}>*</span>
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={4}
                    placeholder="Enter the employee's tendered resignation statement or letter reference..."
                    value={applyData.staff_remarks}
                    onChange={(e) => setApplyData({ ...applyData, staff_remarks: e.target.value })}
                    required
                  />
                  <span className={styles.inputHelp}>
                    Submitting this form transitions the advice status to &quot;Staff Applied&quot; and submits it for HR Head approval.
                  </span>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowApplyModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Submitting Application...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Submit Resignation Application</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Step 2 - HR Head Approve & Compute Settlement ── */}
      {showHrApproveModal && hrApproveTargetRecord && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleArea}>
                <div className={styles.modalHeaderIconBadge} style={{ background: '#f0f9ff', color: '#0284c7', borderColor: '#bae6fd' }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div className={styles.modalHeaderTag} style={{ background: '#f0f9ff', color: '#0284c7', borderColor: '#bae6fd' }}>
                    <CheckCircle2 size={12} />
                    <span>Step 2: HR Head Approval</span>
                  </div>
                  <h2 className={styles.modalHeaderTitle}>
                    HR Head Approval &amp; Exit Settlement Authorization
                  </h2>
                  <p className={styles.modalHeaderSubtitle}>
                    Approve voluntary resignation, deactivate employee from active payroll, and compute complete exit settlement.
                  </p>
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setShowHrApproveModal(false)}
                title="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleSubmitHrApprove}>
              <div className={styles.modalBody}>
                {/* Important Payroll & Settlement Rule Banner */}
                <div className={styles.payrollNoticeBanner}>
                  <AlertTriangle size={20} style={{ color: '#0284c7', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Mandatory Payroll &amp; Settlement Action:</strong>
                    <div style={{ marginTop: '0.25rem' }}>
                      Approving this Advice to Resign compliance will automatically:
                    </div>
                    <ul style={{ margin: '0.35rem 0 0 1.25rem', padding: 0 }}>
                      <li><strong>Remove the staff member from active monthly payroll</strong> (staff status set to inactive so no further monthly salary is generated).</li>
                      <li><strong>Calculate complete exit settlement</strong> (prorated earnings, retention savings refund, cooperative savings refund &amp; loan balance offsets).</li>
                      <li><strong>Forward the verified settlement to the Audit Head</strong> for formal reconciliation and review.</li>
                    </ul>
                  </div>
                </div>

                {/* Target Employee Summary */}
                <div className={styles.selectedStaffCard}>
                  <div className={styles.selectedStaffLeft}>
                    <div className={styles.selectedStaffAvatar}>
                      {(hrApproveTargetRecord.staff?.name || 'ST').split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                        {hrApproveTargetRecord.staff?.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        StaffID: <strong>{hrApproveTargetRecord.staff_id || hrApproveTargetRecord.staff?.id}</strong> • Applied Date: <strong>{hrApproveTargetRecord.applied_date || 'Today'}</strong>
                      </div>
                    </div>
                  </div>
                  <span className={`${styles.statusBadge} ${styles.statusApplied}`}>
                    Staff Applied
                  </span>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <Calendar size={14} style={{ color: '#0284c7' }} />
                    <span>Effective Exit Date</span>
                    <span className={styles.labelRequired}>*</span>
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={hrApproveData.effective_exit_date}
                    onChange={(e) => setHrApproveData({ ...hrApproveData, effective_exit_date: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <span>HR Head Approval Remarks</span>
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    placeholder="Enter official HR Head approval remarks, handover directives, or clearance instructions..."
                    value={hrApproveData.hr_remarks}
                    onChange={(e) => setHrApproveData({ ...hrApproveData, hr_remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowHrApproveModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Removing from Payroll &amp; Computing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Approve &amp; Calculate Settlement</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Step 3 - Audit Head Review Settlement ── */}
      {showAuditModal && auditTargetRecord && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleArea}>
                <div className={styles.modalHeaderIconBadge} style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div className={styles.modalHeaderTag} style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}>
                    <ShieldCheck size={12} />
                    <span>Step 3: Internal Audit Examination</span>
                  </div>
                  <h2 className={styles.modalHeaderTitle}>
                    Audit Head Review &amp; Reconciliation
                  </h2>
                  <p className={styles.modalHeaderSubtitle}>
                    Reference: <strong>{auditTargetRecord.reference_no}</strong> • Verify computed settlement figures, loan balances, and deductions.
                  </p>
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setShowAuditModal(false)}
                title="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleSubmitAuditReview}>
              <div className={styles.modalBody}>
                {/* Staff Summary */}
                <div className={styles.selectedStaffCard}>
                  <div className={styles.selectedStaffLeft}>
                    <div className={styles.selectedStaffAvatar}>
                      {(auditTargetRecord.staff?.name || 'ST').split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                        {auditTargetRecord.staff?.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        StaffID: <strong>{auditTargetRecord.staff_id || auditTargetRecord.staff?.id}</strong> • HR Approved At: <strong>{formatDate(auditTargetRecord.hr_approved_at || auditTargetRecord.compliance_date)}</strong>
                      </div>
                    </div>
                  </div>
                  <span className={`${styles.statusBadge} ${styles.statusHrApproved}`}>
                    In Audit Review
                  </span>
                </div>

                {/* Quick Computed Settlement Summary Banner */}
                {auditTargetRecord.settlement_summary && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.875rem', margin: '0.75rem 0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Computed Settlement Snapshot
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                      <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.71875rem', color: '#64748b' }}>Total Earnings</div>
                        <div style={{ fontWeight: 700, color: '#047857' }}>
                          <NairaSign />{fmt(auditTargetRecord.settlement_summary.total_final_earnings ?? auditTargetRecord.settlement_summary.total_earnings ?? 0)}
                        </div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.71875rem', color: '#64748b' }}>Total Deductions</div>
                        <div style={{ fontWeight: 700, color: '#b91c1c' }}>
                          <NairaSign />{fmt(auditTargetRecord.settlement_summary.total_final_deductions ?? auditTargetRecord.settlement_summary.total_deductions ?? 0)}
                        </div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.71875rem', color: '#64748b' }}>Net Settlement</div>
                        <div style={{
                          fontWeight: 800,
                          color: (auditTargetRecord.settlement_summary.is_payable !== false && auditTargetRecord.settlement_summary.settlement_type !== 'recoverable' && Number(auditTargetRecord.settlement_summary.net_settlement_amount ?? auditTargetRecord.settlement_summary.net_settlement ?? 0) >= 0) ? '#059669' : '#d97706'
                        }}>
                          <NairaSign />{fmt(Math.abs(Number(auditTargetRecord.settlement_summary.net_settlement_amount ?? auditTargetRecord.settlement_summary.net_settlement ?? 0)))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Audit Decision Choice */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Audit Decision <span className={styles.labelRequired}>*</span>
                  </label>
                  <div className={styles.outcomeSelector}>
                    <div
                      className={`${styles.outcomeCard} ${auditData.action === 'approve' ? styles.outcomeCardActiveComplied : ''}`}
                      onClick={() => setAuditData({ ...auditData, action: 'approve' })}
                    >
                      <CheckCircle2 size={24} color="#10b981" />
                      <span className={styles.outcomeTitle}>Approve Settlement</span>
                      <span className={styles.outcomeDesc}>Calculations reconciled &amp; cleared for Finance payment</span>
                    </div>

                    <div
                      className={`${styles.outcomeCard} ${auditData.action === 'reject' ? styles.outcomeCardActiveTerminated : ''}`}
                      onClick={() => setAuditData({ ...auditData, action: 'reject' })}
                    >
                      <XCircle size={24} color="#ef4444" />
                      <span className={styles.outcomeTitle}>Query / Return to HR</span>
                      <span className={styles.outcomeDesc}>Discrepancies found; return to HR for adjustment</span>
                    </div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <span>Audit Examination Remarks</span>
                    {auditData.action === 'reject' && <span className={styles.labelRequired}>*</span>}
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    placeholder="Enter audit verification details, loan account notes, or reason for return..."
                    value={auditData.audit_remarks}
                    onChange={(e) => setAuditData({ ...auditData, audit_remarks: e.target.value })}
                    required={auditData.action === 'reject'}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowAuditModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  style={auditData.action === 'reject' ? { background: '#dc2626', borderColor: '#dc2626' } : { background: '#059669', borderColor: '#059669' }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Recording Audit Decision...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>{auditData.action === 'approve' ? 'Approve Settlement for Finance' : 'Return to HR with Query'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Step 4 - Finance Head Pay Settlement ── */}
      {showFinanceModal && financeTargetRecord && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleArea}>
                <div className={styles.modalHeaderIconBadge} style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>
                  <CreditCard size={22} />
                </div>
                <div>
                  <div className={styles.modalHeaderTag} style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>
                    <CreditCard size={12} />
                    <span>Step 4: Finance Head Disbursement</span>
                  </div>
                  <h2 className={styles.modalHeaderTitle}>
                    Disburse Exit Settlement Payment
                  </h2>
                  <p className={styles.modalHeaderSubtitle}>
                    Reference: <strong>{financeTargetRecord.reference_no}</strong> • Record settlement transaction voucher and mark as Paid.
                  </p>
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setShowFinanceModal(false)}
                title="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleSubmitFinancePay}>
              <div className={styles.modalBody}>
                {/* Staff Summary */}
                <div className={styles.selectedStaffCard}>
                  <div className={styles.selectedStaffLeft}>
                    <div className={styles.selectedStaffAvatar}>
                      {(financeTargetRecord.staff?.name || 'ST').split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                        {financeTargetRecord.staff?.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        StaffID: <strong>{financeTargetRecord.staff_id || financeTargetRecord.staff?.id}</strong> • Audit Status: <strong>Verified &amp; Approved</strong>
                      </div>
                    </div>
                  </div>
                  <span className={`${styles.statusBadge} ${styles.statusAuditApproved}`}>
                    Audit Approved
                  </span>
                </div>

                {/* Net Settlement Amount Card */}
                {financeTargetRecord.settlement_summary && (
                  <div className={styles.settlementTotalBox} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', margin: '0.75rem 0 1.25rem 0' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>
                        Approved Net Amount to Disburse
                      </div>
                      <div style={{ fontSize: '0.71875rem', color: '#15803d' }}>
                        Total Earnings: <NairaSign />{fmt(financeTargetRecord.settlement_summary.total_final_earnings ?? financeTargetRecord.settlement_summary.total_earnings ?? 0)} | Deductions: <NairaSign />{fmt(financeTargetRecord.settlement_summary.total_final_deductions ?? financeTargetRecord.settlement_summary.total_deductions ?? 0)}
                      </div>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d' }}>
                      <NairaSign />{fmt(Math.abs(Number(financeTargetRecord.settlement_summary.net_settlement_amount ?? financeTargetRecord.settlement_summary.net_settlement ?? 0)))}
                    </div>
                  </div>
                )}

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      <span>Payment Reference / Voucher ID</span>
                      <span className={styles.labelRequired}>*</span>
                    </label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. TXN-IHL-EXIT-2026-0042"
                      value={financeData.payment_reference}
                      onChange={(e) => setFinanceData({ ...financeData, payment_reference: e.target.value })}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      <Calendar size={14} style={{ color: '#16a34a' }} />
                      <span>Disbursement Date</span>
                      <span className={styles.labelRequired}>*</span>
                    </label>
                    <input
                      type="date"
                      className={styles.input}
                      value={financeData.payment_date}
                      onChange={(e) => setFinanceData({ ...financeData, payment_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <span>Finance Payment Notes &amp; Transfer Voucher Details</span>
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    placeholder="Enter bank transfer notes, cheque number, or payment remarks..."
                    value={financeData.finance_remarks}
                    onChange={(e) => setFinanceData({ ...financeData, finance_remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowFinanceModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Recording Payout...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} />
                      <span>Confirm &amp; Disburse Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Comprehensive Exit Settlement Breakdown Slip & Clearance ── */}
      {showSettlementModal && settlementTargetRecord && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <h2 className={styles.modalBoxTitle}>
                <Sparkles size={20} style={{ color: '#ec4899' }} />
                <span>Exit Settlement Breakdown &amp; Clearance</span>
              </h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setShowSettlementModal(false)}
                title="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {settlementLoading ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                  <Loader2 size={28} className="animate-spin" style={{ color: '#0284c7', margin: '0 auto 1rem auto' }} />
                  <div style={{ color: '#64748b', fontWeight: 600 }}>Computing real-time exit settlement breakdown...</div>
                </div>
              ) : settlementData ? (
                <>
                  {/* Administrative Separation Notice Rule Banner (No 1-Month Notice) */}
                  <div className={styles.noticeRuleBanner}>
                    <Sparkles size={16} style={{ flexShrink: 0 }} />
                    <span>
                      {settlementData.timeline?.rule_description ||
                        `Administrative Separation (Advice to Resign): No 1-month notice requirement. Staff is deactivated from active monthly payroll; exit settlement prorated for days worked up to exit date.`}
                    </span>
                  </div>

                  {/* Staff Metadata Summary Box (Matching Screenshot 4-Column Grid) */}
                  <div className={styles.staffMetaBox}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>STAFF NAME:</span>
                      <span className={styles.metaValue}>{settlementData.staff?.name || settlementTargetRecord.staff?.name}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>STAFF ID:</span>
                      <span className={styles.metaValue}>{settlementData.staff?.id || settlementTargetRecord.staff_id}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>DEPARTMENT:</span>
                      <span className={styles.metaValue}>{settlementData.staff?.department || settlementTargetRecord.department || 'General Operations'}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>BANK &amp; ACCOUNT:</span>
                      <span className={styles.metaValue}>
                        {settlementData.staff?.bank_name || 'Standard Payroll Bank'} — {settlementData.staff?.account_no || 'On File'}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>DATE OF APPOINTMENT:</span>
                      <span className={styles.metaValue} style={{ color: '#0f172a', fontWeight: 600 }}>
                        {formatDate(settlementData.staff?.appointment_date || settlementData.timeline?.appointment_date)}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>NOTICE SUBMISSION DATE:</span>
                      <span className={styles.metaValue}>
                        {formatDate(settlementTargetRecord.applied_date || settlementTargetRecord.issue_date || settlementData.timeline?.resignation_date)}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>EFFECTIVE EXIT DATE:</span>
                      <span className={styles.metaValue} style={{ color: '#ec4899', fontWeight: 700 }}>
                        {formatDate(settlementTargetRecord.compliance_date || settlementTargetRecord.applied_date || settlementData.timeline?.exit_date)}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>PAYROLL STATUS:</span>
                      {(() => {
                        const isRemovedFromPayroll = ['hr_approved', 'audit_approved', 'paid'].includes(settlementTargetRecord?.status)
                          || settlementData?.clearance_workflow?.hr_approval?.status === 1
                          || settlementData?.staff?.staff_status === 0
                          || settlementData?.timeline?.payroll_status === 'Removed from Active Payroll'
                          || settlementData?.staff?.payroll_status === 'Removed from Active Payroll'
                          || settlementTargetRecord?.status === 'terminated';

                        return (
                          <span
                            className={styles.metaValue}
                            style={{ color: isRemovedFromPayroll ? '#d97706' : '#059669', fontWeight: 700 }}
                          >
                            {isRemovedFromPayroll
                              ? 'Removed from Active Payroll'
                              : 'Current Month Active on Regular Payroll'}
                          </span>
                        );
                      })()}
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>GROSS SALARY:</span>
                      <span className={styles.metaValue} style={{ color: '#3b82f6' }}>
                        ₦{fmt(settlementData.salary_structure?.monthly_gross || settlementData.salary_structure?.declared_salary || settlementData.salary_structure?.basic_salary)}
                      </span>
                    </div>
                  </div>

                  {/* Dual Column Side-by-Side Breakdown Grid */}
                  <div className={styles.sheetGrid}>
                    {/* Left Column: Earnings & Allowances */}
                    <div className={styles.sheetSection}>
                      <div className={styles.sheetSectionHeader}>
                        <span>EARNINGS &amp; REFUNDS (ASSETS)</span>
                        <span>AMOUNT (₦)</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Basic Salary</span>
                        <span>{fmt(settlementData.salary_structure?.basic_salary)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Housing Allowance</span>
                        <span>{fmt(settlementData.salary_structure?.housing_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Transport Allowance</span>
                        <span>{fmt(settlementData.salary_structure?.transport_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Medical Allowance</span>
                        <span>{fmt(settlementData.salary_structure?.medical_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Utility Allowance</span>
                        <span>{fmt(settlementData.salary_structure?.utility_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Meal Allowance</span>
                        <span>{fmt(settlementData.salary_structure?.meal_allowance)}</span>
                      </div>

                      {/* Notice / Prorated Exit Salary Rows */}
                      {(settlementData.notice_earnings?.breakdown || []).map((b, idx) => (
                        <div key={idx} className={styles.sheetRow} style={{ background: 'rgba(59, 130, 246, 0.03)' }}>
                          <span>
                            {settlementData.timeline?.is_advice_to_resign ? 'Prorated Exit Salary' : 'Notice Salary'}: {b.month_name}
                            <span className={styles.sheetRowNote}>
                              ({b.days_worked}/{b.days_in_month} days{b.payroll_note ? ` — ${b.payroll_note}` : ''})
                            </span>
                          </span>
                          <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                            ₦{fmt(b.earned_salary)}
                          </span>
                        </div>
                      ))}

                      {/* Retention Fund 100% Refund */}
                      <div className={styles.sheetRow} style={{ background: 'rgba(16, 185, 129, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div>
                            <span>Retention Savings (100% Refund)</span>
                            <span className={styles.sheetRowNote} style={{ display: 'block' }}>
                              ({settlementData.retention_refund?.months_deducted || 0} mos @ ₦{fmt(settlementData.retention_refund?.monthly_rate || 0)})
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
                        <span style={{ color: '#10b981', fontWeight: 600 }}>+{fmt(settlementData.retention_refund?.total_refund_amount || 0)}</span>
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
                          <span style={{ color: '#10b981', fontWeight: 600 }}>+{fmt(settlementData.coop_savings_refund.total_savings_balance)}</span>
                        </div>
                      )}

                      {/* Active Bonuses & Special Allowances */}
                      {settlementData.bonuses_and_allowances?.total_amount > 0 && (
                        <div className={styles.sheetRow} style={{ background: 'rgba(245, 158, 11, 0.04)' }}>
                          <span>
                            Bonuses &amp; Special Allowances
                            {settlementData.bonuses_and_allowances.items?.length > 0 && (
                              <span className={styles.sheetRowNote}>
                                ({settlementData.bonuses_and_allowances.items.map(i => i.title).join(', ')})
                              </span>
                            )}
                          </span>
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>+{fmt(settlementData.bonuses_and_allowances.total_amount)}</span>
                        </div>
                      )}

                      {/* Left Total: Total Final Earnings */}
                      <div className={`${styles.sheetRow} ${styles.sheetTotalRow}`}>
                        <span>TOTAL FINAL EARNINGS &amp; REFUNDS</span>
                        <span style={{ color: '#047857' }}>₦{fmt(settlementData.settlement_summary?.total_final_earnings ?? settlementData.total_earnings)}</span>
                      </div>
                    </div>

                    {/* Right Column: Itemized Deductions & Liabilities */}
                    <div className={styles.sheetSection}>
                      <div className={styles.sheetSectionHeader} style={{ background: 'rgba(239, 68, 68, 0.06)', color: '#b91c1c' }}>
                        <span>ITEMIZED DEDUCTIONS &amp; LIABILITIES</span>
                        <span>AMOUNT (₦)</span>
                      </div>

                      {settlementData.deductions?.itemized_deductions && settlementData.deductions.itemized_deductions.length > 0 ? (
                        settlementData.deductions.itemized_deductions.map((d, i) => (
                          <div key={i} className={styles.sheetRow} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div>
                                <span>
                                  {d.name}
                                  {d.name.includes('Retention') && (
                                    <span className={styles.sheetRowNote} style={{ color: '#10b981' }}> (Refunded) (Refunded under Earnings)</span>
                                  )}
                                  {d.name === 'PAYE Tax' && Number(d.amount) === 0 && (
                                    <span className={styles.sheetRowNote} style={{ color: '#64748b' }}> (Exempt ≤₦800k)</span>
                                  )}
                                  {d.name.includes('Pension') && Number(d.amount) === 0 && (
                                    <span className={styles.sheetRowNote} style={{ color: '#64748b' }}> (Not Enrolled)</span>
                                  )}
                                  {d.name.includes('Savings') && (
                                    <span className={styles.sheetRowNote} style={{ color: '#10b981' }}> (Refunded under Earnings)</span>
                                  )}
                                  {d.name.includes('Leave of Absence') && Number(d.amount) > 0 && d.note && d.note !== 'Nil' && (
                                    <span className={styles.sheetRowNote} style={{ color: '#ef4444' }}> ({d.note})</span>
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
                            </div>
                            <span style={Number(d.amount) > 0 ? { color: '#ef4444', fontWeight: 600 } : { color: '#94a3b8' }}>
                              {fmt(d.amount)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className={styles.sheetRow}>
                            <span>Cooperative Loan Outstanding</span>
                            <span style={{ color: (settlementData.coop_loan_balance > 0) ? '#ef4444' : '#94a3b8' }}>{fmt(settlementData.coop_loan_balance || 0)}</span>
                          </div>
                          <div className={styles.sheetRow}>
                            <span>Staff Loan / Advance Offset</span>
                            <span style={{ color: (settlementData.loan_deductions > 0) ? '#ef4444' : '#94a3b8' }}>{fmt(settlementData.loan_deductions || 0)}</span>
                          </div>
                          <div className={styles.sheetRow}>
                            <span>IOU Balance Offset</span>
                            <span style={{ color: (settlementData.iou_balance > 0) ? '#ef4444' : '#94a3b8' }}>{fmt(settlementData.iou_balance || 0)}</span>
                          </div>
                          <div className={styles.sheetRow}>
                            <span>Medical Loan Balance Offset</span>
                            <span style={{ color: (settlementData.medical_loan_balance > 0) ? '#ef4444' : '#94a3b8' }}>{fmt(settlementData.medical_loan_balance || 0)}</span>
                          </div>
                          <div className={styles.sheetRow}>
                            <span>Absence &amp; Surcharge Deductions</span>
                            <span style={{ color: ((settlementData.absence_deductions || 0) + (settlementData.surcharge_deductions || 0) > 0) ? '#ef4444' : '#94a3b8' }}>
                              {fmt((settlementData.absence_deductions || 0) + (settlementData.surcharge_deductions || 0))}
                            </span>
                          </div>
                        </>
                      )}

                      {/* Right Total: Total Deductions */}
                      <div className={`${styles.sheetRow} ${styles.sheetTotalRow}`} style={{ color: '#ef4444' }}>
                        <span>ITEMIZED DEDUCTIONS &amp; LIABILITIES</span>
                        <span>- ₦{fmt(settlementData.settlement_summary?.total_final_deductions ?? settlementData.total_deductions)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Net Settlement Banner */}
                  <div className={`${styles.netTakeHomeBanner} ${(settlementData.settlement_summary?.settlement_type === 'recoverable' || Number(settlementData.settlement_summary?.net_settlement_amount ?? settlementData.net_settlement) < 0) ? styles.netTakeHomeBannerRecoverable : ''}`}>
                    <div>
                      <div
                        className={styles.netTakeHomeLabel}
                        style={{
                          color: (settlementData.settlement_summary?.settlement_type === 'recoverable' || Number(settlementData.settlement_summary?.net_settlement_amount ?? settlementData.net_settlement) < 0)
                            ? '#ef4444'
                            : '#10b981'
                        }}
                      >
                        {(settlementData.settlement_summary?.settlement_type === 'recoverable' || Number(settlementData.settlement_summary?.net_settlement_amount ?? settlementData.net_settlement) < 0)
                          ? 'FINAL NET RECOVERABLE FROM STAFF'
                          : 'FINAL NET PAYABLE TO STAFF'}
                      </div>
                      <div className={styles.netTakeHomeSub}>
                        Total Final Earnings &amp; Refunds minus Total Itemized Deductions &amp; Liabilities
                      </div>
                    </div>

                    <div
                      className={styles.netTakeHomeAmount}
                      style={{
                        color: (settlementData.settlement_summary?.settlement_type === 'recoverable' || Number(settlementData.settlement_summary?.net_settlement_amount ?? settlementData.net_settlement) < 0)
                          ? '#ef4444'
                          : '#10b981'
                      }}
                    >
                      <NairaSign size={24} />
                      {fmt(Math.abs(Number(settlementData.settlement_summary?.net_settlement_amount ?? settlementData.net_settlement ?? 0)))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  No settlement calculation generated yet. Approve the resignation to calculate settlement.
                </div>
              )}
            </div>

            {/* Modal Footer with Actions matching Screenshot */}
            <div className={styles.modalFooter}>
              {/* Audit Review Action button inside Modal */}
              {(isSuperAdmin || isAuditHead) && settlementTargetRecord.status === 'hr_approved' && (
                <button
                  type="button"
                  className={`${styles.btnPrimary} ${styles.btnAudit}`}
                  onClick={() => {
                    setShowSettlementModal(false);
                    handleOpenAuditReview(settlementTargetRecord);
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>Audit &amp; Approve for Payment</span>
                </button>
              )}

              {/* Finance Pay Action button inside Modal */}
              {(isSuperAdmin || isFinanceHead) && settlementTargetRecord.status === 'audit_approved' && (
                <button
                  type="button"
                  className={`${styles.btnPrimary} ${styles.btnFinance}`}
                  onClick={() => {
                    setShowSettlementModal(false);
                    handleOpenFinancePay(settlementTargetRecord);
                  }}
                >
                  <CreditCard size={16} />
                  <span>Disburse &amp; Mark as Paid</span>
                </button>
              )}

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleDownloadPdfSlip}
                disabled={downloadingPdf}
                title="Download official Exit Settlement Breakdown Slip in PDF format"
              >
                {downloadingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                <span>{downloadingPdf ? 'Downloading PDF...' : 'Download PDF Slip'}</span>
              </button>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleSendEmailSlip}
                disabled={emailSending}
                title="Send official Exit Settlement Breakdown Slip to staff email"
              >
                {emailSending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                <span>{emailSending ? 'Sending...' : 'Email Slip to Staff (PDF)'}</span>
              </button>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowSettlementModal(false)}
              >
                Close
              </button>

              <button
                type="button"
                className={`${styles.btnPrimary} ${styles.btnPrintPink}`}
                onClick={handlePrintSlip}
              >
                <Printer size={16} />
                <span>Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Fallback / Terminate Outcome ── */}
      {showActionModal && actionTargetRecord && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleArea}>
                <div className={styles.modalHeaderIconBadge} style={{ background: '#fef2f2', color: '#b91c1c', borderColor: '#fca5a5' }}>
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <div className={styles.modalHeaderTag} style={{ background: '#fef2f2', color: '#b91c1c', borderColor: '#fca5a5' }}>
                    <AlertTriangle size={12} />
                    <span>Disciplinary Action</span>
                  </div>
                  <h2 className={styles.modalHeaderTitle}>
                    Process Notice Outcome (Default / Terminate / Withdraw)
                  </h2>
                  <p className={styles.modalHeaderSubtitle}>
                    Reference: <strong>{actionTargetRecord.reference_no}</strong> • Process disciplinary default if staff fails to comply.
                  </p>
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setShowActionModal(false)}
                title="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleSubmitAction}>
              <div className={styles.modalBody}>
                {/* Staff Summary Card */}
                <div className={styles.selectedStaffCard}>
                  <div className={styles.selectedStaffLeft}>
                    <div className={styles.selectedStaffAvatar}>
                      {(actionTargetRecord.staff?.name || 'ST').split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                        {actionTargetRecord.staff?.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        StaffID: <strong>{actionTargetRecord.staff_id || actionTargetRecord.staff?.id}</strong> • Deadline: <strong>{actionTargetRecord.deadline_date}</strong>
                      </div>
                    </div>
                  </div>
                  <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                    Pending Notice
                  </span>
                </div>

                {/* Outcome Choices */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Outcome / Action Decision <span className={styles.labelRequired}>*</span>
                  </label>
                  <div className={styles.outcomeSelector}>
                    <div
                      className={`${styles.outcomeCard} ${actionData.status === 'terminated' ? styles.outcomeCardActiveTerminated : ''}`}
                      onClick={() => setActionData({ ...actionData, status: 'terminated' })}
                    >
                      <XCircle size={24} color="#ef4444" />
                      <span className={styles.outcomeTitle}>Defaulted (Terminate)</span>
                      <span className={styles.outcomeDesc}>Staff failed to comply; terminate appointment immediately</span>
                    </div>

                    <div
                      className={`${styles.outcomeCard} ${actionData.status === 'withdrawn' ? styles.outcomeCardActiveWithdrawn : ''}`}
                      onClick={() => setActionData({ ...actionData, status: 'withdrawn' })}
                    >
                      <LogOut size={24} color="#64748b" />
                      <span className={styles.outcomeTitle}>Withdraw Notice</span>
                      <span className={styles.outcomeDesc}>Management cancels the advice notice</span>
                    </div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    <span>Resolution Remarks</span>
                  </label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Enter final notes or termination order details..."
                    value={actionData.resolution_remarks}
                    onChange={(e) => setActionData({ ...actionData, resolution_remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowActionModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  style={actionData.status === 'terminated' ? { background: '#dc2626', borderColor: '#dc2626' } : {}}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Confirm Outcome</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Official Printable Hospital Letter ── */}
      {showLetterModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalLetterContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleArea}>
                <div className={styles.modalHeaderIconBadge} style={{ background: '#f0f9ff', color: '#0284c7', borderColor: '#bae6fd' }}>
                  <Printer size={22} />
                </div>
                <div>
                  <div className={styles.modalHeaderTag} style={{ background: '#f0f9ff', color: '#0284c7', borderColor: '#bae6fd' }}>
                    <Printer size={12} />
                    <span>Official Letterhead Mode</span>
                  </div>
                  <h2 className={styles.modalHeaderTitle}>
                    Official Notice of Advice to Resign
                  </h2>
                </div>
              </div>

              <div className={styles.letterToolbarControls}>
                <span className={styles.letterheadToolbarLabel}>Official Letterhead</span>
                <label className={styles.toggleLabel} title="Toggle official hospital header">
                  <input
                    type="checkbox"
                    className={styles.toggleCheckbox}
                    checked={includeHeading}
                    onChange={(e) => setIncludeHeading(e.target.checked)}
                  />
                  <span>Letterhead Heading</span>
                </label>
                <label className={styles.toggleLabel} title="Toggle official clinical services footer">
                  <input
                    type="checkbox"
                    className={styles.toggleCheckbox}
                    checked={includeFooter}
                    onChange={(e) => setIncludeFooter(e.target.checked)}
                  />
                  <span>Services Footer</span>
                </label>
                <label className={styles.toggleLabel} title="Toggle authorized HR Head signature">
                  <input
                    type="checkbox"
                    className={styles.toggleCheckbox}
                    checked={includeSignature}
                    onChange={(e) => setIncludeSignature(e.target.checked)}
                  />
                  <span>HR Head Signature</span>
                </label>

                {/* Edit Indicator Badge & Reset Button */}
                <div className={styles.editingNoticeBadge} title="Click any part of the letter text below to edit before printing">
                  <Edit3 size={13} />
                  <span>Click Text to Edit</span>
                </div>

                <button
                  type="button"
                  className={styles.btnResetLetter}
                  onClick={handleResetLetter}
                  disabled={letterLoading || !letterData}
                  title="Reset letter content to default generated draft"
                >
                  <RotateCcw size={14} />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={handleCopyLetterText}
                  disabled={letterLoading || !letterData}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.85rem' }}
                >
                  <Copy size={15} />
                  <span>Copy Text</span>
                </button>
                <button
                  type="button"
                  className={styles.btnPrintLetterAction}
                  onClick={() => window.print()}
                  disabled={letterLoading || !letterData}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
                >
                  <Printer size={15} />
                  <span>Print Letter</span>
                </button>
                <button
                  className={styles.closeBtn}
                  onClick={() => setShowLetterModal(false)}
                  title="Close modal"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={styles.letterScrollArea}>
              {letterLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                  <Loader2 size={28} className="animate-spin" style={{ color: '#0284c7', margin: '0 auto 1rem auto' }} />
                  <div>Generating formal corporate letter...</div>
                </div>
              ) : letterData ? (
                <div className={styles.paperContainer}>
                  {/* Redesigned Official ISALU HOSPITAL Letter Heading */}
                  {includeHeading ? (
                    <div className={styles.officialHeader}>
                      {/* Top Left Gradient Arc SVG */}
                      <div className={styles.headerArcWrapper}>
                        <svg
                          viewBox="0 0 32 32"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className={styles.headerArcSvg}
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <linearGradient id="isaluArcGradientAdvice" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#00b4d8" />
                              <stop offset="45%" stopColor="#00a2e8" />
                              <stop offset="100%" stopColor="#0077b6" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M0,0 L32,0 C22,10 10,22 0,32 Z"
                            fill="url(#isaluArcGradientAdvice)"
                          />
                        </svg>
                      </div>

                      {/* Header Content Grid */}
                      <div className={styles.headerContentGrid}>
                        {/* Left Address & Contact Block */}
                        <div className={styles.headerLeftBlock}>
                          <div className={styles.headerAddressLine}>No 46, Ijaiye Road Opposite Ogba Shopping Arcade,</div>
                          <div className={styles.headerAddressLine}>Caterpillar Bus-Stop, Ogba, Lagos Nigeria.</div>
                          <div className={styles.headerContactLine}>
                            <span className={styles.headerContactLabel}>Tel:</span> 08169618571, 08062287502, 08033088592
                          </div>
                          <div className={styles.headerWebLine}>
                            <span>info@isaluhospitals.com</span>, <span>www.isaluhospitals.com</span>
                          </div>
                        </div>

                        {/* Right Brand & Logo Block */}
                        <div className={styles.headerRightBlock}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/isalu_symbol.png"
                            alt="ISALU Logo Symbol"
                            className={styles.headerLogoSymbol}
                          />
                          <div className={styles.headerBrandText}>
                            <div className={styles.brandTitleMain}>ISALU</div>
                            <div className={styles.brandTitleSub}>HOSPITALS</div>
                            <div className={styles.brandTitleRow}>
                              <span className={styles.brandTitleLimited}>LIMITED</span>
                              <span className={styles.brandTitleRc}>RC: 502112</span>
                            </div>
                            <div className={styles.brandTagline}>[SPECIALIST HEALTHCARE PROVIDER]</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.preprintedSpacer}>
                      <strong>Pre-printed Letterhead Mode</strong>
                      <span>Space reserved for physical letterhead stationery in printer tray</span>
                    </div>
                  )}

                  {/* Letter Content Area */}
                  <div className={styles.letterContentArea} ref={letterContentRef}>
                    {/* Ref & Date */}
                    <div className={styles.metaRow}>
                      <div className={styles.refNumber}>
                        REF:{' '}
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          className={styles.editableField}
                          title="Click to edit Reference Number"
                          onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, reference_no: e.target.innerText.trim() }) : null)}
                        >
                          {letterData.reference_no}
                        </span>
                      </div>
                      <div className={styles.letterDate}>
                        DATE:{' '}
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          className={styles.editableField}
                          title="Click to edit Date"
                          onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, letter_date: e.target.innerText.trim() }) : null)}
                        >
                          {letterData.letter_date}
                        </span>
                      </div>
                    </div>

                    {/* Recipient */}
                    <div className={styles.recipientBlock}>
                      <div className={styles.recipientName}>
                        To:{' '}
                        <strong
                          contentEditable
                          suppressContentEditableWarning
                          className={styles.editableField}
                          title="Click to edit Recipient Name"
                          onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, staff: { ...prev.staff, name: e.target.innerText.trim() } }) : null)}
                        >
                          {letterData.staff?.name}
                        </strong>
                      </div>
                      <div>StaffID: <strong>{letterData.staff?.staff_id || letterData.staff?.id}</strong></div>
                      {letterData.staff?.designation && (
                        <div>
                          Designation:{' '}
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            className={styles.editableField}
                            title="Click to edit Designation"
                            onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, staff: { ...prev.staff, designation: e.target.innerText.trim() } }) : null)}
                          >
                            {letterData.staff.designation}
                          </span>
                        </div>
                      )}
                      {letterData.staff?.department && (
                        <div>
                          Department:{' '}
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            className={styles.editableField}
                            title="Click to edit Department"
                            onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, staff: { ...prev.staff, department: e.target.innerText.trim() } }) : null)}
                          >
                            {letterData.staff.department}
                          </span>
                        </div>
                      )}
                      <div>ISALU HOSPITALS LIMITED</div>
                    </div>

                    {/* Letter Title */}
                    <div
                      className={`${styles.letterTitle} ${styles.editableBlock}`}
                      contentEditable
                      suppressContentEditableWarning
                      title="Click to edit Letter Title"
                      onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, letter_title: e.target.innerText.trim() }) : null)}
                    >
                      {letterData.letter_title || 'LETTER OF ADVICE TO TENDER FORMAL RESIGNATION'}
                    </div>

                    {/* Salutation */}
                    <div
                      className={`${styles.letterBodyP} ${styles.editableBlock}`}
                      contentEditable
                      suppressContentEditableWarning
                      title="Click to edit Salutation"
                      onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, salutation: e.target.innerText.trim() }) : null)}
                    >
                      {letterData.salutation || `Dear ${letterData.staff?.name},`}
                    </div>

                    {/* Paragraph 1: Review & Reason */}
                    <div
                      className={`${styles.letterBodyP} ${styles.editableBlock}`}
                      contentEditable
                      suppressContentEditableWarning
                      title="Click to edit Review & Reason paragraph"
                      onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, para1: e.target.innerText.trim() }) : null)}
                    >
                      {letterData.para1 || `Following a comprehensive administrative and disciplinary review of your employment records and conduct${letterData.query_reference ? ` (Ref: Query ${letterData.query_reference})` : ''}, Management has reviewed matters concerning: ${letterData.reason}.`}
                    </div>

                    {/* Particulars / Findings Box */}
                    {letterData.details && (
                      <div
                        className={`${styles.letterHighlightBox} ${styles.editableBlock}`}
                        contentEditable
                        suppressContentEditableWarning
                        title="Click to edit Particulars / Findings"
                        onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, details: e.target.innerText.replace(/^Particulars\s*\/\s*Findings:\s*/i, '').trim() }) : null)}
                      >
                        <strong>Particulars / Findings:</strong><br />
                        {letterData.details}
                      </div>
                    )}

                    {/* Paragraph 2: Advice */}
                    <div
                      className={`${styles.letterBodyP} ${styles.editableBlock}`}
                      contentEditable
                      suppressContentEditableWarning
                      title="Click to edit Advice paragraph"
                      onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, para2: e.target.innerText.trim() }) : null)}
                    >
                      {letterData.para2 || 'In the best interest of the hospital and in consideration of maintaining professional decorum, Management hereby formally advises you to voluntarily tender your letter of resignation from the services of Isalu Hospitals Limited.'}
                    </div>

                    {/* Paragraph 3: Deadline */}
                    <div
                      className={`${styles.letterBodyP} ${styles.editableBlock}`}
                      contentEditable
                      suppressContentEditableWarning
                      title="Click to edit Deadline notice"
                      onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, para3: e.target.innerText.trim() }) : null)}
                    >
                      {letterData.para3 || `Your formal letter of resignation must be submitted to the Human Resources Department on or before ${letterData.deadline_date}.`}
                    </div>

                    {/* Consequence of Default */}
                    <div
                      className={`${styles.letterBodyP} ${styles.editableBlock}`}
                      style={{ color: '#b91c1c' }}
                      contentEditable
                      suppressContentEditableWarning
                      title="Click to edit Consequence of Default"
                      onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, consequence: e.target.innerText.replace(/^Consequence\s*of\s*Default:\s*/i, '').trim() }) : null)}
                    >
                      <strong>Consequence of Default:</strong><br />
                      {letterData.consequence}
                    </div>

                    {/* Handover & Benefits Paragraph */}
                    <div
                      className={`${styles.letterBodyP} ${styles.editableBlock}`}
                      contentEditable
                      suppressContentEditableWarning
                      title="Click to edit Handover instructions"
                      onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, para4: e.target.innerText.trim() }) : null)}
                    >
                      {letterData.para4 || 'Upon the timeous receipt of your resignation letter, you will be required to properly hand over all hospital property, badges, equipment, and records in your custody to your Head of Department, after which your clearance and terminal benefits will be processed in accordance with hospital policy.'}
                    </div>

                    {/* Signatory */}
                    <div className={styles.signatoryBlock}>
                      <div className={styles.valediction}>Yours faithfully,</div>
                      <div className={styles.valedictionOrg}>For: <strong>ISALU HOSPITALS LIMITED</strong></div>
                      <div className={styles.signatureArea}>
                        {includeSignature && letterData.signatory?.signature_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={letterData.signatory.signature_url}
                            alt="Head of Human Resources Signature"
                            className={styles.signatureImage}
                          />
                        ) : null}
                        <div
                          className={`${styles.signatureLine} ${
                            !includeSignature || !letterData.signatory?.signature_url
                              ? styles.signatureLineBlank
                              : ''
                          }`}
                        ></div>
                      </div>
                      <div
                        className={`${styles.signatoryName} ${styles.editableField}`}
                        contentEditable
                        suppressContentEditableWarning
                        title="Click to edit Signatory Name"
                        onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, signatory: { ...prev.signatory, name: e.target.innerText.trim() } }) : null)}
                      >
                        {letterData.signatory?.name || 'ANIFOWOSHE MONSURAT'}
                      </div>
                      <div
                        className={`${styles.signatoryTitle} ${styles.editableField}`}
                        contentEditable
                        suppressContentEditableWarning
                        title="Click to edit Signatory Title"
                        onBlur={(e) => setLetterData(prev => prev ? ({ ...prev, signatory: { ...prev.signatory, title: e.target.innerText.trim() } }) : null)}
                      >
                        {letterData.signatory?.title || 'Head of Human Resources & Corporate Services'}
                      </div>
                      <div className={styles.signatoryOrg}>
                        {letterData.signatory?.org || 'Isalu Hospitals Limited'}
                      </div>
                    </div>
                  </div>

                  {/* Redesigned Official Letterhead Footer */}
                  {includeFooter && (
                    <div className={styles.officialFooter}>
                      <div className={styles.footerGrid}>
                        {/* Col 1 */}
                        <div className={styles.footerCol}>
                          <div className={styles.footerColTitle}>Obstetrics &amp; Gynaecology</div>
                          <ul className={styles.footerList}>
                            <li>Antenatal Clinic</li>
                            <li>Family Planning Clinic</li>
                            <li>Fertility Clinic</li>
                            <li>Routine Gynaecology Clinic</li>
                          </ul>
                          <div className={styles.footerColSubTitle}>Admissions</div>
                          <ul className={styles.footerList}>
                            <li>Standard Private Suites</li>
                            <li>Standard Executives Suites</li>
                          </ul>
                        </div>

                        {/* Col 2 */}
                        <div className={styles.footerCol}>
                          <div className={styles.footerColTitle}>Internal Medicine</div>
                          <ul className={styles.footerList}>
                            <li>Dermatology</li>
                            <li>Diabetes Mellitus</li>
                            <li>Cardiology</li>
                            <li>Gastro-Enterology</li>
                            <li>Neurology</li>
                            <li>Psychiatry</li>
                            <li>Nephrology</li>
                          </ul>
                        </div>

                        {/* Col 3 */}
                        <div className={styles.footerCol}>
                          <div className={styles.footerColTitle}>General Surgery</div>
                          <ul className={styles.footerList}>
                            <li>General Surgery</li>
                            <li>Orthopedics</li>
                            <li>Urology</li>
                          </ul>
                          <div className={styles.footerColSubTitle}>Health Screening</div>
                          <ul className={styles.footerList}>
                            <li>Well Man Scheme</li>
                            <li>Well Woman Scheme</li>
                          </ul>
                        </div>

                        {/* Col 4 */}
                        <div className={styles.footerCol}>
                          <div className={styles.footerColTitle}>Diagnostic Imaging</div>
                          <ul className={styles.footerList}>
                            <li>X-Ray Services</li>
                            <li>Ultrasound Scans</li>
                            <li>ECG</li>
                          </ul>
                          <div className={styles.footerColSubTitle} style={{ marginTop: '0.2rem' }}>Physiotherapy</div>
                        </div>

                        {/* Col 5 */}
                        <div className={styles.footerCol} style={{ borderRight: 'none' }}>
                          <div className={styles.footerColTitle}>Paediatrics</div>
                          <ul className={styles.footerList}>
                            <li>Out-Patient Clinic</li>
                            <li>Child Welfare</li>
                            <li>Immunization</li>
                          </ul>
                          <div className={styles.footerColSubTitle}>Opthalmology</div>
                          <ul className={styles.footerList}>
                            <li>Eye Clinic</li>
                          </ul>
                        </div>
                      </div>

                      {/* Bottom Right Corner Flourish SVG */}
                      <div className={styles.footerFlourishWrapper}>
                        <svg
                          viewBox="0 0 90 60"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className={styles.footerFlourishSvg}
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <linearGradient id="footerFlourishGradAdvice" x1="0%" y1="100%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#00b4d8" />
                              <stop offset="100%" stopColor="#0077b6" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M90,0 C60,25 20,45 0,60 L90,60 Z"
                            fill="url(#footerFlourishGradAdvice)"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Retention Months Modal Dialog ── */}
      {retentionModal.open && (
        <div className={styles.modalOverlay} onClick={() => setRetentionModal({ open: false, staffId: null, staffName: '', adviceId: null, baseSalary: 0, monthlyRate: 0, months: 0, loading: false })}>
          <div className={styles.retentionModalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <Edit2 size={18} style={{ color: '#10b981' }} />
                <span>Edit Deducted Retention Months</span>
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setRetentionModal({ open: false, staffId: null, staffName: '', adviceId: null, baseSalary: 0, monthlyRate: 0, months: 0, loading: false })}
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
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
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
                  className={styles.btnSecondary}
                  onClick={() => setRetentionModal({ open: false, staffId: null, staffName: '', adviceId: null, baseSalary: 0, monthlyRate: 0, months: 0, loading: false })}
                  disabled={retentionModal.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
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
        <div className={styles.modalOverlay} onClick={() => setMedicalLoanModal({ open: false, staffId: null, staffName: '', adviceId: null, currentBalance: 0, newBalance: '', reason: '', loading: false })}>
          <div className={styles.retentionModalBox} style={{ maxWidth: '460px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ padding: '0.8rem 1.25rem' }}>
              <h3 className={styles.modalTitle} style={{ fontSize: '1.05rem' }}>
                <Edit2 size={17} style={{ color: '#ef4444' }} />
                <span>Edit Medical Loan Balance</span>
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setMedicalLoanModal({ open: false, staffId: null, staffName: '', adviceId: null, currentBalance: 0, newBalance: '', reason: '', loading: false })}
                disabled={medicalLoanModal.loading}
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSaveMedicalLoanBalance} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className={styles.modalBody} style={{ padding: '0.85rem 1.25rem', gap: '0.65rem' }}>
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
                  className={styles.btnSecondary}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  onClick={() => setMedicalLoanModal({ open: false, staffId: null, staffName: '', adviceId: null, currentBalance: 0, newBalance: '', reason: '', loading: false })}
                  disabled={medicalLoanModal.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
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
            adviceId: null,
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
                <span>Edit Cooperative Loan Balance</span>
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setCoopLoanModal({
                  open: false,
                  staffId: null,
                  staffName: '',
                  adviceId: null,
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
                  className={styles.btnSecondary}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  onClick={() => setCoopLoanModal({ open: false, staffId: null, staffName: '', adviceId: null, currentBalance: 0, newBalance: '', reason: '', loading: false })}
                  disabled={coopLoanModal.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
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

      {/* ── Toast Notification ── */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
