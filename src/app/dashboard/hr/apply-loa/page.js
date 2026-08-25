"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Send,
  Clock,
  X,
  Edit,
  Printer,
} from 'lucide-react';
import CustomSelect from '../../../../components/ui/CustomSelect';
import NairaSign from '@/components/ui/NairaSign';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hrms_user');
    if (raw) {
      const user = JSON.parse(raw);
      return user?.id ?? null;
    }
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

function statusBadge(status) {
  switch (status) {
    case 1:  return { label: 'HOD Approved',  cls: styles.badgeHodApproved };
    case 2:  return { label: 'HR Approved',   cls: styles.badgeHrApproved  };
    case 3:  return { label: 'HOD Rejected',  cls: styles.badgeRejected    };
    case 4:  return { label: 'HR Rejected',   cls: styles.badgeRejected    };
    default: return { label: 'Pending',       cls: styles.badgePending     };
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${parseInt(day, 10).toString().padStart(2, '0')} ${months[mIdx]}, ${year}`;
    }
  }
  return dateStr;
}

// ── In-Memory Client Cache ───────────────────────────────────────────────────
let cachedPageData = null;
let cachedLoaRecords = null;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ApplyLoaPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  const [pageData, setPageData]   = useState(cachedPageData);
  const [formLoading, setFormLoading] = useState(!cachedPageData);
  const [tableLoading, setTableLoading] = useState(!cachedLoaRecords);
  const [loaRecords, setLoaRecords] = useState(cachedLoaRecords || []);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    employee_id: '',
    start_date: '',
    end_date: '',
    leave_reason: '',
  });
  const [editRecordId, setEditRecordId]   = useState(null);

  const [viewRecord, setViewRecord]   = useState(null); // detail modal
  const [confirmAction, setConfirmAction] = useState(null); // { type, id, label }
  const [actionLoading, setActionLoading] = useState(false);

  const [toast, setToast] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate]     = useState('');
  const [filterStatus, setFilterStatus]       = useState('all');
  const [searchQuery, setSearchQuery]         = useState('');
  const [itemsPerPage, setItemsPerPage]       = useState('10');
  const [currentPage, setCurrentPage]         = useState(1);

  const [staffNetPay, setStaffNetPay] = useState(null);
  const [loadingNetPay, setLoadingNetPay] = useState(false);

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Fetch staff net pay for target date/month ───────────────────────────────
  const fetchStaffNetPay = useCallback(async (staffId, date = null) => {
    if (!staffId) {
      setStaffNetPay(null);
      return;
    }
    setLoadingNetPay(true);
    try {
      const headers = buildHeaders();
      const targetDate = date || new Date().toISOString().split('T')[0];
      const url = `${API_BASE}/payroll/ious/used-limit?staff_id=${staffId}&date=${targetDate}`;
      const res = await axios.get(url, { headers });
      if (res.data.status === 'success' && res.data.data) {
        setStaffNetPay({
          amount: res.data.data.available_net_pay,
          month: res.data.data.month_name,
        });
      } else {
        setStaffNetPay(null);
      }
    } catch (err) {
      console.error('Failed to fetch staff net pay:', err);
      setStaffNetPay(null);
    } finally {
      setLoadingNetPay(false);
    }
  }, []);

  // ── Fetch page data (form metadata) ────────────────────────────────────────
  const fetchFormData = useCallback(async (silent = false) => {
    if (silent && cachedPageData) {
      setPageData(cachedPageData);
      return;
    }
    if (!silent) setFormLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hr/apply-loa`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setPageData(res.data);
        cachedPageData = res.data;
      } else {
        showToast(res.data.message || 'Failed to load form metadata.', 'error');
      }
    } catch (err) {
      showToast('Failed to load page data. Check your connection.', 'error');
      console.error(err);
    } finally {
      if (!silent) setFormLoading(false);
    }
  }, [showToast]);

  // ── Fetch LOA records for the table ──────────────────────────────────────
  const fetchRecords = useCallback(async (silent = false) => {
    if (silent && cachedLoaRecords) {
      setLoaRecords(cachedLoaRecords);
      return;
    }
    if (!silent) setTableLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hr/apply-loa/records`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setLoaRecords(res.data.loaRecords || []);
        cachedLoaRecords = res.data.loaRecords || [];
      } else {
        showToast(res.data.message || 'Failed to load records.', 'error');
      }
    } catch (err) {
      showToast('Failed to load records. Check your connection.', 'error');
      console.error(err);
    } finally {
      if (!silent) setTableLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    setMounted(true);
    const hasCache = !!cachedPageData;
    const hasRecordsCache = !!cachedLoaRecords;
    fetchFormData(hasCache);
    fetchRecords(hasRecordsCache);
  }, [fetchFormData, fetchRecords]);

  // ── Reset page on filter/items-per-page change ─────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStartDate, filterEndDate, filterStatus, itemsPerPage]);

  // ── Auto-prepopulate employee ID for regular staff ──────────────────────────
  useEffect(() => {
    if (pageData) {
      const isSuperAdmin = pageData.isSuperAdmin ?? false;
      const isAdminStaff = pageData.isAdminStaff ?? false;
      const isAuditStaff = pageData.isAuditStaff ?? false;
      const isFinanceStaff = pageData.isFinanceStaff ?? false;
      const currentEmployee = pageData.employee ?? null;

      if (!(isSuperAdmin || isAdminStaff || isAuditStaff || isFinanceStaff) && currentEmployee) {
        setForm(prev => ({
          ...prev,
          employee_id: currentEmployee.ID,
        }));
      }
    }
  }, [pageData]);

  // ── Auto-fetch staff net pay on employee / date selection ───────────────────
  useEffect(() => {
    const isSuperAdmin = pageData?.isSuperAdmin ?? false;
    const isAdminStaff = pageData?.isAdminStaff ?? false;
    const isAuditStaff = pageData?.isAuditStaff ?? false;
    const isFinanceStaff = pageData?.isFinanceStaff ?? false;
    const currentEmployee = pageData?.employee ?? null;

    const empId = form.employee_id || (!(isSuperAdmin || isAdminStaff || isAuditStaff || isFinanceStaff) && currentEmployee?.ID);
    if (empId) {
      fetchStaffNetPay(empId, form.start_date || null);
    } else {
      setStaffNetPay(null);
    }
  }, [form.employee_id, form.start_date, pageData, fetchStaffNetPay]);

  // ── Form handlers ──────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (rec) => {
    setEditRecordId(rec.id);
    setForm({
      employee_id: rec.staffId,
      start_date: rec.start_date,
      end_date: rec.end_date,
      leave_reason: rec.reason_of_leave || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditRecordId(null);
    setForm({
      employee_id: pageData && !(pageData.isSuperAdmin || pageData.isAdminStaff || pageData.isAuditStaff || pageData.isFinanceStaff) && pageData.employee
        ? pageData.employee.ID
        : '',
      start_date: '',
      end_date: '',
      leave_reason: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loaCalculation && loaCalculation.isExceeded) {
      showToast(`Cannot apply for Leave of Absence: This employee available net pay for ${loaCalculation.monthName} can not be negative.`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const isEdit = !!editRecordId;
      const url = isEdit ? `${API_BASE}/hr/apply-loa/${editRecordId}` : `${API_BASE}/hr/apply-loa`;
      const res = await (isEdit
        ? axios.put(url, form, { headers: buildHeaders() })
        : axios.post(url, form, { headers: buildHeaders() })
      );
      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        handleCancelEdit();
        cachedLoaRecords = null;
        fetchRecords(true);
      } else {
        showToast(res.data.message || `Failed to ${isEdit ? 'update' : 'submit'} application.`, 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'An error occurred while submitting.';
      showToast(msg, 'error');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Approve / Reject ───────────────────────────────────────────────────────
  const openConfirm = (type, id, label) => setConfirmAction({ type, id, label });
  const closeConfirm = () => setConfirmAction(null);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    setActionLoading(true);
    try {
      const endpoint = `${API_BASE}/hr/apply-loa/${type}/${id}`;
      const res = await axios.get(endpoint, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        cachedLoaRecords = null;
        fetchRecords(true);
      } else {
        showToast(res.data.message || 'Action failed.', 'error');
      }
    } catch (err) {
      showToast('An error occurred. Please try again.', 'error');
      console.error(err);
    } finally {
      setActionLoading(false);
      closeConfirm();
    }
  };

  // ── Destructure page data ──────────────────────────────────────────────────
  const employees    = pageData?.employees    ?? [];
  const isSuperAdmin = pageData?.isSuperAdmin ?? false;
  const isHod        = pageData?.isHod        ?? false;
  const isAdminStaff = pageData?.isAdminStaff ?? false;
  const isAuditStaff = pageData?.isAuditStaff ?? false;
  const isFinanceStaff = pageData?.isFinanceStaff ?? false;
  const currentEmployee = pageData?.employee  ?? null;

  const canSelectStaff = isSuperAdmin || isAdminStaff || isAuditStaff || isFinanceStaff;
  const canHodAct   = isHod || isSuperAdmin || isAdminStaff;
  const canAdminAct = isAdminStaff || isSuperAdmin;

  const formatName = (emp) => {
    if (!emp) return '';
    const other = emp.othernames && String(emp.othernames).trim() !== '' && String(emp.othernames).toLowerCase() !== 'null'
      ? ` ${emp.othernames}`
      : '';
    return `${emp.surname} ${emp.first_name}${other}`.trim();
  };

  const employeeOptions = canSelectStaff
    ? employees.map(emp => ({
        id:   emp.ID,
        name: formatName(emp),
      }))
    : (currentEmployee
        ? [{
            id:   currentEmployee.ID,
            name: formatName(currentEmployee),
          }]
        : []
      );

  const selectedEmpObj = canSelectStaff
    ? employees.find(e => String(e.ID) === String(form.employee_id))
    : currentEmployee;

  const hasNotUploadedEducation = selectedEmpObj && selectedEmpObj.has_uploaded_education === false;

  // Deduction calculation for LOA based on exact days in the month (e.g. 28, 29, 30, or 31 days)
  const loaCalculation = useMemo(() => {
    if (!form.start_date || !form.end_date) return null;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;

    const diffTime = Math.abs(end - start);
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const year = start.getFullYear();
    const month = start.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate(); // 28, 29, 30, or 31 days
    const monthName = start.toLocaleString('default', { month: 'long', year: 'numeric' });

    const monthlySalary = parseFloat(selectedEmpObj?.monthly_salary) || 0;
    const dailyRate = (monthlySalary > 0 && daysInMonth > 0) ? (monthlySalary / daysInMonth) : 0;
    const estimatedDeduction = dailyRate * durationDays;

    const availableNetPay = (staffNetPay?.amount !== undefined && staffNetPay?.amount !== null)
      ? parseFloat(staffNetPay.amount)
      : monthlySalary;

    const isExceeded = (availableNetPay > 0 && estimatedDeduction >= availableNetPay) || (availableNetPay <= 0 && durationDays > 0);
    const estimatedRemainingNet = Math.max(0, availableNetPay - estimatedDeduction);

    return {
      durationDays,
      daysInMonth,
      monthName,
      monthlySalary,
      dailyRate,
      estimatedDeduction,
      availableNetPay,
      isExceeded,
      estimatedRemainingNet,
    };
  }, [form.start_date, form.end_date, selectedEmpObj, staffNetPay]);

  const getApprovalLevel = useCallback((rec) => {
    if (rec.status === 0 && canHodAct) {
      return 'hod-approve';
    }
    if (rec.status === 1 && canAdminAct) {
      return 'admin-approve';
    }
    return null;
  }, [canHodAct, canAdminAct]);

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    let successCount = 0;
    let failCount = 0;
    const headers = buildHeaders();

    for (const id of selectedIds) {
      const rec = loaRecords.find(r => r.id === id);
      if (!rec) continue;

      const actionType = getApprovalLevel(rec);
      if (!actionType) {
        failCount++;
        continue;
      }

      try {
        const endpoint = `${API_BASE}/hr/apply-loa/${actionType}/${id}`;
        const res = await axios.get(endpoint, { headers });
        if (res.data.status === 'success') {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    if (successCount > 0) {
      showToast(`Successfully approved ${successCount} leave application(s).${failCount > 0 ? ` Failed: ${failCount}` : ''}`, 'success');
      cachedLoaRecords = null;
      setSelectedIds([]);
      fetchRecords(true);
    } else {
      showToast('Failed to approve selected leave application(s).', 'error');
    }
    setShowBulkApproveModal(false);
    setActionLoading(false);
  };

  const filteredRecords = loaRecords.filter(rec => {
    // 1. Search Query
    if (searchQuery) {
      const fullName = `${rec.surname || ''} ${rec.first_name || ''} ${rec.othernames || ''}`.toLowerCase();
      const deptName = (rec.department || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      if (!fullName.includes(q) && !deptName.includes(q)) {
        return false;
      }
    }

    // 2. Date applied filter (parse rec.created_at or rec.date_applied)
    if (filterStartDate) {
      const start = new Date(filterStartDate);
      const applied = rec.created_at ? new Date(rec.created_at) : new Date(rec.date_applied);
      start.setHours(0, 0, 0, 0);
      applied.setHours(0, 0, 0, 0);
      if (applied < start) return false;
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      const applied = rec.created_at ? new Date(rec.created_at) : new Date(rec.date_applied);
      end.setHours(0, 0, 0, 0);
      applied.setHours(0, 0, 0, 0);
      if (applied > end) return false;
    }

    // 3. Status filter
    if (filterStatus !== 'all') {
      const isPending = rec.status !== 1 && rec.status !== 2 && rec.status !== 3 && rec.status !== 4;
      const isApproved = rec.status === 1 || rec.status === 2;
      const isRejected = rec.status === 3 || rec.status === 4;

      if (filterStatus === 'pending' && !isPending) return false;
      if (filterStatus === 'approved' && !isApproved) return false;
      if (filterStatus === 'rejected' && !isRejected) return false;
    }
    return true;
  });

  const showCheckboxes = canHodAct || canAdminAct;

  // ── Pagination Calculation ──────────────────────────────────────────────────
  const totalPages = itemsPerPage === 'all'
    ? 1
    : Math.ceil(filteredRecords.length / parseInt(itemsPerPage, 10)) || 1;

  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * parseInt(itemsPerPage, 10);
  const paginatedRecords = itemsPerPage === 'all'
    ? filteredRecords
    : filteredRecords.slice(startIndex, startIndex + parseInt(itemsPerPage, 10));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <h1>Leave of Absence Application</h1>
        <p>Apply for a leave of absence, review records and manage approvals.</p>
      </div>

      {/* ── Application Form ── */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Calendar size={18} style={{ marginRight: '0.5rem', flexShrink: 0 }} />
          {editRecordId ? 'Edit Leave of Absence' : 'Apply for Leave of Absence'}
          {formLoading && <Loader2 size={16} className={styles.inlineSpinner} style={{ marginLeft: 'auto' }} />}
        </h2>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>

            {/* Employee */}
            <div className={`${styles.formGroup} ${styles.spanFull}`}>
              <CustomSelect
                name="employee_id"
                label="Employee"
                placeholder={formLoading ? "Loading employees..." : "-- Select Employee --"}
                options={employeeOptions}
                value={form.employee_id}
                onChange={handleChange}
                searchable={true}
                required
                disabled={formLoading || !canSelectStaff}
              />
            </div>

            {/* Employee Info / Net Pay Card */}
            {selectedEmpObj && (
              <div
                className={styles.spanFull}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.9rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginTop: '-0.35rem'
                }}
              >
                <span>
                  Employee: <strong>{formatName(selectedEmpObj)}</strong>
                </span>
                <span>
                  Available Net Pay: <strong style={{ color: (staffNetPay?.amount ?? 0) > 0 ? '#10b981' : '#ef4444' }}>
                    {loadingNetPay ? 'Calculating…' : `₦${fmt(staffNetPay?.amount ?? 0)}`}
                  </strong>
                  {staffNetPay?.month ? (
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8', marginLeft: '6px' }}>({staffNetPay.month})</span>
                  ) : null}
                </span>
              </div>
            )}

            {/* Start Date */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Start Date</label>
              <input
                type="date"
                name="start_date"
                className={styles.input}
                value={form.start_date}
                onChange={handleChange}
                required
              />
            </div>

            {/* End Date */}
            <div className={styles.formGroup}>
              <label className={styles.label}>End Date</label>
              <input
                type="date"
                name="end_date"
                className={styles.input}
                value={form.end_date}
                onChange={handleChange}
                required
                min={form.start_date}
              />
            </div>

            {/* Leave Reason */}
            <div className={`${styles.formGroup} ${styles.spanFull}`}>
              <label className={styles.label}>Reason for Leave</label>
              <textarea
                name="leave_reason"
                className={styles.textarea}
                rows={3}
                placeholder="Enter reason for leave of absence…"
                value={form.leave_reason}
                onChange={handleChange}
                required
              />
            </div>

            {/* Live Calculation Preview Banner */}
            {loaCalculation && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.spanFull}
                style={{
                  background: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                    ⚡ Leave of Absence Deduction Breakdown
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                    {loaCalculation.daysInMonth} Days in {loaCalculation.monthName}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', color: '#94a3b8' }}>
                  <span>
                    Daily Rate: <strong>₦{fmt(loaCalculation.dailyRate)} / day</strong> (based on {loaCalculation.daysInMonth} days)
                  </span>
                  <span>
                    Duration: <strong>{loaCalculation.durationDays} day(s)</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.82rem', paddingTop: '0.15rem' }}>
                  <span>
                    Available Net Pay: <strong style={{ color: loaCalculation.availableNetPay > 0 ? '#10b981' : '#ef4444' }}>
                      ₦{fmt(loaCalculation.availableNetPay)}
                    </strong>
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Target: <strong>{loaCalculation.monthName}</strong></span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed rgba(59, 130, 246, 0.25)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Estimated Deduction from Net Pay:</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <NairaSign size={15} />
                    {fmt(loaCalculation.estimatedDeduction)}
                  </span>
                </div>

                {!loaCalculation.isExceeded && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                    <span>Estimated Take-Home after LOA:</span>
                    <strong style={{ color: '#10b981' }}>₦{fmt(loaCalculation.estimatedRemainingNet)}</strong>
                  </div>
                )}

                {loaCalculation.isExceeded && (
                  <div style={{ marginTop: '0.3rem', color: '#991b1b', background: '#fee2e2', padding: '0.45rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>This employee available net pay for {loaCalculation.monthName} can not be negative. Application will be declined.</span>
                  </div>
                )}
              </motion.div>
            )}

          </div>

          {/* Submit */}
          <div className={styles.submitRow} style={{ gap: '0.75rem' }}>
            {editRecordId && (
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleCancelEdit}
                disabled={submitting}
              >
                Cancel Edit
              </button>
            )}
            {mounted ? (
              <button type="submit" className={styles.submitBtn} disabled={submitting || formLoading || !!hasNotUploadedEducation}>
                {submitting
                  ? (editRecordId
                      ? <><Loader2 size={16} className={styles.btnSpinner} /> Updating…</>
                      : <><Loader2 size={16} className={styles.btnSpinner} /> Submitting…</>
                    )
                  : (editRecordId
                      ? <><Send size={16} /> Update LOA Application</>
                      : <><Send size={16} /> Submit LOA Application</>
                    )
                }
              </button>
            ) : (
              <button type="submit" className={styles.submitBtn} disabled>
                Submit LOA Application
              </button>
            )}
          </div>
          {hasNotUploadedEducation && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'right', fontWeight: '500' }}>
              Complete your documentation
            </p>
          )}
        </form>
      </div>

      {/* ── Records Table ── */}
      <div className={`${styles.card} ${styles.printCard}`}>
        <h2 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <Clock size={18} style={{ marginRight: '0.5rem', flexShrink: 0 }} />
            Leave of Absence Records
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {selectedIds.length > 0 && (
              <button
                type="button"
                className={`${styles.cancelBtn} ${styles.noPrint}`}
                onClick={() => setShowBulkApproveModal(true)}
                disabled={actionLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.82rem', background: '#10b981', borderColor: '#10b981', color: '#fff' }}
              >
                {actionLoading ? <Loader2 size={15} className={styles.spinner} style={{ color: '#fff' }} /> : <CheckCircle2 size={15} />}
                Approve Selected ({selectedIds.length})
              </button>
            )}
            <button
              type="button"
              className={`${styles.cancelBtn} ${styles.noPrint}`}
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.82rem', borderColor: 'var(--border)' }}
            >
              <Printer size={15} />
              Print LOA Record
            </button>
          </div>
        </h2>

        {/* ── Filters Bar ── */}
        <div className={`${styles.filterBar} ${styles.noPrint}`}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Search:</span>
            <input
              type="text"
              placeholder="Search staff, department..."
              className={styles.filterInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>From:</span>
            <input
              type="date"
              className={styles.filterInput}
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>To:</span>
            <input
              type="date"
              className={styles.filterInput}
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Status:</span>
            <select
              className={styles.filterSelect}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Show:</span>
            <select
              className={styles.filterSelect}
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
              <option value="all">All</option>
            </select>
          </div>
          {(filterStartDate || filterEndDate || filterStatus !== 'all' || searchQuery || itemsPerPage !== '10') && (
            <button
              type="button"
              className={styles.cancelBtn}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: 'fit-content' }}
              onClick={() => {
                setFilterStartDate('');
                setFilterEndDate('');
                setFilterStatus('all');
                setSearchQuery('');
                setItemsPerPage('10');
                setCurrentPage(1);
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                {showCheckboxes && (
                  <th style={{ width: '40px' }} className={styles.noPrint}>
                    <input
                      type="checkbox"
                      checked={
                        paginatedRecords.length > 0 &&
                        paginatedRecords.filter(getApprovalLevel).length > 0 &&
                        paginatedRecords.filter(getApprovalLevel).every(r => selectedIds.includes(r.id))
                      }
                      onChange={(e) => {
                        const eligible = paginatedRecords.filter(getApprovalLevel);
                        if (e.target.checked) {
                          setSelectedIds(prev => {
                            const next = [...prev];
                            eligible.forEach(r => {
                              if (!next.includes(r.id)) next.push(r.id);
                            });
                            return next;
                          });
                        } else {
                          setSelectedIds(prev =>
                            prev.filter(id => !eligible.some(r => r.id === id))
                          );
                        }
                      }}
                    />
                  </th>
                )}
                <th>S/N</th>
                <th>Staff Name</th>
                <th>Department</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Duration</th>
                <th>Date Applied</th>
                <th>Status</th>
                <th className={styles.noPrint}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableLoading ? (
                <tr>
                  <td colSpan={showCheckboxes ? 10 : 9} className={styles.emptyRow}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Loader2 size={16} className={styles.spinner} />
                      <span>Loading LOA records…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={showCheckboxes ? 10 : 9} className={styles.emptyRow}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.5rem 0' }}>
                      <Calendar size={32} strokeWidth={1.5} style={{ color: 'var(--secondary)' }} />
                      <span style={{ color: 'var(--secondary)' }}>No records found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((rec, i) => {
                  const badge = statusBadge(rec.status);
                  return (
                    <tr key={rec.id}>
                      {showCheckboxes && (
                        <td className={styles.noPrint}>
                          {getApprovalLevel(rec) ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(rec.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds(prev => [...prev, rec.id]);
                                } else {
                                  setSelectedIds(prev => prev.filter(id => id !== rec.id));
                                }
                              }}
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={false}
                              disabled
                              style={{ opacity: 0.3 }}
                            />
                          )}
                        </td>
                      )}
                      <td>{startIndex + i + 1}</td>
                      <td className={styles.capitalize}>
                        {rec.surname} {rec.first_name} {rec.othernames}
                      </td>
                      <td>{rec.department}</td>
                      <td>{formatDate(rec.start_date)}</td>
                      <td>{formatDate(rec.end_date)}</td>
                      <td>{rec.duration_days} day{rec.duration_days !== 1 ? 's' : ''}</td>
                      <td>{rec.date_applied}</td>
                      <td>
                        <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td>
                        <div className={styles.actionGroup}>
                          {/* View */}
                          <button
                            className={`${styles.iconBtn} ${styles.viewBtn}`}
                            title="View Details"
                            onClick={() => setViewRecord(rec)}
                          >
                            <Eye size={15} />
                          </button>

                          {/* Edit (Pending: status 0) */}
                          {rec.status === 0 && (
                            <button
                              className={`${styles.iconBtn} ${styles.editBtn}`}
                              title="Edit Details"
                              onClick={() => handleEdit(rec)}
                            >
                              <Edit size={14} />
                            </button>
                          )}

                          {/* HOD Actions (status = 0 → Pending) */}
                          {rec.status === 0 && canHodAct && (
                            <>
                              <button
                                className={`${styles.iconBtn} ${styles.approveBtn}`}
                                title="HOD Approve"
                                onClick={() => openConfirm('hod-approve', rec.id, 'HOD Approve')}
                              >
                                <ThumbsUp size={14} />
                              </button>
                              <button
                                className={`${styles.iconBtn} ${styles.rejectBtn}`}
                                title="HOD Reject"
                                onClick={() => openConfirm('hod-reject', rec.id, 'HOD Reject')}
                              >
                                <ThumbsDown size={14} />
                              </button>
                            </>
                          )}

                          {/* Admin Actions (status = 1 → HOD Approved) */}
                          {rec.status === 1 && canAdminAct && (
                            <>
                              <button
                                className={`${styles.iconBtn} ${styles.approveBtn}`}
                                title="HR Approve"
                                onClick={() => openConfirm('admin-approve', rec.id, 'HR Approve')}
                              >
                                <ThumbsUp size={14} />
                              </button>
                              <button
                                className={`${styles.iconBtn} ${styles.rejectBtn}`}
                                title="HR Reject"
                                onClick={() => openConfirm('admin-reject', rec.id, 'HR Reject')}
                              >
                                <ThumbsDown size={14} />
                              </button>
                            </>
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

        {/* ── Pagination Footer ── */}
        <div className={`${styles.paginationFooter} ${styles.noPrint}`}>
          <span className={styles.paginationInfo}>
            Showing {filteredRecords.length === 0 ? 0 : startIndex + 1} to {itemsPerPage === 'all' ? filteredRecords.length : Math.min(startIndex + parseInt(itemsPerPage, 10), filteredRecords.length)} of {filteredRecords.length} entries {itemsPerPage !== 'all' && totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
          </span>

          {itemsPerPage !== 'all' && totalPages > 1 && (
            <div className={styles.paginationControls}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                if (totalPages > 7 && Math.abs(pageNum - currentPage) > 2 && pageNum !== 1 && pageNum !== totalPages) {
                  if (pageNum === 2 || pageNum === totalPages - 1) {
                    return <span key={pageNum} className={styles.pageEllipsis}>...</span>;
                  }
                  return null;
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    className={`${styles.pageBtn} ${currentPage === pageNum ? styles.pageBtnActive : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════ VIEW DETAIL MODAL ═══════════════ */}
      <AnimatePresence>
        {viewRecord && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewRecord(null)}
          >
            <motion.div
              className={styles.modalBox}
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>LOA Details</h3>
                <button className={styles.modalClose} onClick={() => setViewRecord(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff Name</span>
                    <span className={styles.detailValue + ' ' + styles.capitalize}>
                      {viewRecord.surname} {viewRecord.first_name} {viewRecord.othernames}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Department</span>
                    <span className={styles.detailValue}>{viewRecord.department}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Start Date</span>
                    <span className={styles.detailValue}>{formatDate(viewRecord.start_date)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>End Date</span>
                    <span className={styles.detailValue}>{formatDate(viewRecord.end_date)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Duration</span>
                    <span className={styles.detailValue}>{viewRecord.duration_days} day{viewRecord.duration_days !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Days in Month</span>
                    <span className={styles.detailValue}>{viewRecord.days_in_month || 30} days ({viewRecord.month_name || ''})</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Daily Salary Rate</span>
                    <span className={styles.detailValue}>₦{fmt(viewRecord.daily_rate || 0)} / day</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Est. Net Pay Deduction</span>
                    <span className={styles.detailValue} style={{ color: '#3b82f6', fontWeight: 700 }}>
                      ₦{fmt(viewRecord.estimated_deduction || 0)}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Date Applied</span>
                    <span className={styles.detailValue}>{viewRecord.date_applied}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Status</span>
                    <span className={`${styles.badge} ${statusBadge(viewRecord.status).cls}`}>
                      {statusBadge(viewRecord.status).label}
                    </span>
                  </div>
                </div>

                {/* Reason panel */}
                <div className={styles.reasonBox}>
                  <span className={styles.detailLabel}>Reason for Leave</span>
                  <p className={styles.reasonText}>{viewRecord.reason_of_leave}</p>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.modalCloseBtn} onClick={() => setViewRecord(null)}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ CONFIRM ACTION MODAL ═══════════════ */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeConfirm}
          >
            <motion.div
              className={`${styles.modalBox} ${styles.confirmBox}`}
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={`${styles.confirmIcon} ${confirmAction.type.includes('reject') ? styles.confirmIconRed : styles.confirmIconGreen}`}>
                {confirmAction.type.includes('reject') ? <XCircle size={28} /> : <CheckCircle2 size={28} />}
              </div>
              <h3 className={styles.modalTitle}>Confirm Action</h3>
              <p className={styles.confirmMsg}>
                Are you sure you want to <strong>{confirmAction.type.includes('reject') ? 'reject' : 'approve'}</strong> this leave of absence request at <strong>{confirmAction.label.replace(' Approve', '').replace(' Reject', '')}</strong> level?
              </p>
              <div className={styles.confirmActions}>
                <button className={styles.modalCloseBtn} onClick={closeConfirm} disabled={actionLoading}>
                  Cancel
                </button>
                <button
                  className={`${styles.confirmActionBtn} ${confirmAction.type.includes('reject') ? styles.dangerBtn : styles.successBtn}`}
                  onClick={handleConfirmAction}
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? <><Loader2 size={15} className={styles.btnSpinner} /> Processing…</>
                    : <>{confirmAction.type.includes('reject') ? 'Reject' : 'Approve'}</>
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bulk Approval Modal ── */}
      <AnimatePresence>
        {showBulkApproveModal && (() => {
          const selectedLevels = Array.from(new Set(
            selectedIds
              .map(id => loaRecords.find(r => r.id === id))
              .filter(Boolean)
              .map(getApprovalLevel)
              .filter(Boolean)
              .map(lvl => lvl.startsWith('hod') ? 'HOD' : 'HR')
          )).join(', ');

          return (
            <div className={styles.modalOverlay} onClick={() => setShowBulkApproveModal(false)}>
              <motion.div
                className={`${styles.modalBox} ${styles.confirmBox}`}
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={e => e.stopPropagation()}
              >
                <div className={styles.confirmIcon} style={{ background: '#d1fae5', color: '#10b981' }}>
                  <CheckCircle2 size={28} />
                </div>
                <h3 className={styles.modalTitle}>Confirm Bulk Approval</h3>
                <p className={styles.confirmMsg}>
                  Are you sure you want to approve the <strong>{selectedIds.length}</strong> selected leave application(s) at <strong>{selectedLevels || 'N/A'}</strong> level?
                </p>
                <div className={styles.confirmActions}>
                  <button className={styles.modalCloseBtn} onClick={() => setShowBulkApproveModal(false)} disabled={actionLoading}>
                    Cancel
                  </button>
                  <button
                    className={styles.confirmActionBtn}
                    style={{ background: '#10b981', color: '#fff', border: 'none' }}
                    onClick={handleBulkApprove}
                    disabled={actionLoading}
                  >
                    {actionLoading
                      ? <><Loader2 size={15} className={styles.btnSpinner} /> Approving…</>
                      : <>Approve All</>
                    }
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ═══════════════ TOAST ═══════════════ */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {toast.type === 'error'
              ? <AlertCircle size={18} />
              : <CheckCircle2 size={18} />
            }
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
