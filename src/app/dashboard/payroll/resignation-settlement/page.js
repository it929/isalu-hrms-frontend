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
  ExternalLink
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

  // Filtered Records (client-side filters)
  const filteredRecords = records.filter((r) => {
    if (settlementFilter === 'payable' && r.settlement_type !== 'payable') return false;
    if (settlementFilter === 'recoverable' && r.settlement_type !== 'recoverable') return false;

    if (workflowFilter === 'pending_audit' && r.audit_status !== 0) return false;
    if (workflowFilter === 'ready_for_payment' && (r.audit_status !== 1 || r.finance_status === 1)) return false;
    if (workflowFilter === 'paid' && r.finance_status !== 1) return false;

    return true;
  });

  const handlePrintSlip = () => {
    window.print();
  };

  const canAudit = userPermissions.is_super_admin || userPermissions.is_admin_staff || userPermissions.is_audit_staff;
  const canFinance = userPermissions.is_super_admin || userPermissions.is_admin_staff || userPermissions.is_finance_staff;

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
                  <th>Exit Date</th>
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
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', fontWeight: 600, color: '#ec4899' }}>
                        <Calendar size={13} style={{ color: '#ec4899' }} />
                        {formatDate(r.exit_date)}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#3b82f6' }}>
                      ₦{fmt(r.notice_salary_total)}
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

                        {/* Audit Approve Action Button */}
                        {canAudit && r.audit_status === 0 && (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.btnAudit}`}
                            onClick={(e) => handleOpenAuditDialog(r, e)}
                            title="Audit Head: Check & Approve for Payment / Recovery"
                          >
                            <ShieldCheck size={14} />
                            <span>Audit</span>
                          </button>
                        )}

                        {/* Finance Action: Pay or Recover */}
                        {canFinance && r.audit_status === 1 && r.finance_status === 0 && (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${r.settlement_type === 'recoverable' ? styles.btnRecover : styles.btnFinance}`}
                            onClick={(e) => handleOpenFinanceDialog(r, e)}
                            title={r.settlement_type === 'recoverable' ? 'Finance Head: Record Debt Recovery from Staff' : 'Finance Head: Mark as Paid'}
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
                      <span className={styles.metaLabel}>Notice Submission Date:</span>
                      <span className={styles.metaValue}>{formatDate(settlementData.timeline.resignation_date)} (30 Days)</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Effective Exit Date:</span>
                      <span className={styles.metaValue} style={{ color: '#ec4899' }}>{formatDate(settlementData.timeline.exit_date)}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Payroll Status:</span>
                      <span className={styles.metaValue} style={{ color: '#d97706' }}>Removed from Active Payroll</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Declared Base Salary:</span>
                      <span className={styles.metaValue} style={{ color: '#3b82f6' }}>₦{fmt(settlementData.salary_structure.declared_salary)}</span>
                    </div>
                  </div>

                  {/* Dual Column Side-by-Side Breakdown Grid */}
                  <div className={styles.sheetGrid}>
                    {/* Left Column: Earnings & Allowances */}
                    <div className={styles.sheetSection}>
                      <div className={styles.sheetSectionHeader}>
                        <span>EARNINGS & REFUNDS (ASSETS)</span>
                        <span>AMOUNT (₦)</span>
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
                        <div key={idx} className={styles.sheetRow} style={{ background: 'rgba(59, 130, 246, 0.03)' }}>
                          <span>
                            Notice Salary: {b.month_name}
                            <span className={styles.sheetRowNote}>
                              ({b.days_worked}/{b.days_in_month} days{b.is_full_month ? ' full' : ''})
                            </span>
                          </span>
                          <span style={{ color: '#3b82f6' }}>{fmt(b.earned_salary)}</span>
                        </div>
                      ))}

                      {/* Retention Fund 100% Refund */}
                      <div className={styles.sheetRow} style={{ background: 'rgba(16, 185, 129, 0.04)' }}>
                        <span>
                          Retention Savings (100% Refund)
                          <span className={styles.sheetRowNote}>
                            ({settlementData.retention_refund.months_deducted} mos @ ₦{fmt(settlementData.retention_refund.monthly_rate)})
                          </span>
                        </span>
                        <span style={{ color: '#10b981' }}>+{fmt(settlementData.retention_refund.total_refund_amount)}</span>
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
                      <div className={styles.sheetSectionHeader} style={{ background: 'rgba(239, 68, 68, 0.06)', color: '#b91c1c' }}>
                        <span>ITEMIZED DEDUCTIONS & LIABILITIES</span>
                        <span>AMOUNT (₦)</span>
                      </div>

                      {settlementData.deductions?.itemized_deductions ? (
                        settlementData.deductions.itemized_deductions.map((d, i) => (
                          <div key={i} className={styles.sheetRow}>
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
                            </span>
                            <span style={d.amount > 0 ? { color: '#ef4444' } : { color: '#94a3b8' }}>
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

                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleCloseModal}>
                    Close
                  </button>
                  <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePrintSlip}>
                    <Printer size={16} />
                    <span>Print Official Settlement Slip</span>
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
                Audit Head: Verification & Payment Approval
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
                  ? 'Finance Head: Record Debt Recovery & Clearance'
                  : 'Finance Head: Disburse & Mark as Paid'}
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
              <p style={{ margin: '3px 0' }}><strong>Resignation Date:</strong> {formatDate(settlementData.timeline.resignation_date)}</p>
              <p style={{ margin: '3px 0' }}><strong>Notice Duration:</strong> 30 Days (1 Month)</p>
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
                <tr key={idx}>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>{b.period_label}</td>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>{b.days_in_month}</td>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>{b.days_worked}</td>
                  <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'right' }}>₦{fmt(b.earned_salary)}</td>
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
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>{d.name}</td>
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
