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
  FileSpreadsheet,
  Download,
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

function getTierBadge(status, type) {
  const label = type === 'hod' ? 'HOD:' : 'HR:';

  let levelStatus = 0; // 0 = pending, 1 = approved, 2 = rejected
  if (type === 'hod') {
    if (status === 1 || status === 2 || status === 4) {
      levelStatus = 1; // HOD approved
    } else if (status === 3) {
      levelStatus = 2; // HOD rejected
    } else {
      levelStatus = 0; // pending
    }
  } else if (type === 'hr') {
    if (status === 2) {
      levelStatus = 1; // HR approved
    } else if (status === 4 || status === 3) {
      levelStatus = 2; // HR rejected
    } else {
      levelStatus = 0; // pending
    }
  }

  if (levelStatus === 1) {
    return (
      <span className={styles.tierBadgeItem}>
        <span className={styles.tierLabel}>{label}</span>
        <span
          className={`${styles.badge} ${styles.badgeHodApproved}`}
          style={{ padding: '0.12rem 0.55rem', fontSize: '0.68rem', fontWeight: '700', letterSpacing: '0.02em' }}
        >
          APPROVED
        </span>
      </span>
    );
  }
  if (levelStatus === 2) {
    return (
      <span className={styles.tierBadgeItem}>
        <span className={styles.tierLabel}>{label}</span>
        <span
          className={`${styles.badge} ${styles.badgeRejected}`}
          style={{ padding: '0.12rem 0.55rem', fontSize: '0.68rem', fontWeight: '700', letterSpacing: '0.02em' }}
        >
          REJECTED
        </span>
      </span>
    );
  }
  return (
    <span className={styles.tierBadgeItem}>
      <span className={styles.tierLabel}>{label}</span>
      <span
        className={`${styles.badge} ${styles.badgePending}`}
        style={{ padding: '0.12rem 0.55rem', fontSize: '0.68rem', fontWeight: '700', letterSpacing: '0.02em' }}
      >
        PENDING
      </span>
    </span>
  );
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
  const [exportingCsv, setExportingCsv]       = useState(false);

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
  const canHodAct   = isHod || isSuperAdmin;
  const canAdminAct = isAdminStaff || isSuperAdmin;

  const canHodApproveRec = useCallback((rec) => {
    if (!rec || rec.status !== 0) return false;
    if (isSuperAdmin) return true;
    if (isHod && currentEmployee?.departmentID && (String(rec.department_id) === String(currentEmployee.departmentID) || String(rec.department) === String(currentEmployee.department))) {
      return true;
    }
    if (pageData?.isDelegatedHod && pageData?.delegated_department_id && (String(rec.department_id) === String(pageData.delegated_department_id) || String(rec.department) === String(pageData.delegated_department))) {
      return true;
    }
    return false;
  }, [isSuperAdmin, isHod, currentEmployee, pageData]);

  const canAdminApproveRec = useCallback((rec) => {
    if (!rec || rec.status !== 1) return false;
    return isAdminStaff || isSuperAdmin;
  }, [isAdminStaff, isSuperAdmin]);

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

  // Deduction calculation for LOA based on exact days in each month (e.g. Jan 31 days vs Feb 28/29 days)
  const loaCalculation = useMemo(() => {
    if (!form.start_date || !form.end_date) return null;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;

    const diffTime = Math.abs(end - start);
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const monthlySalary = parseFloat(selectedEmpObj?.monthly_salary) || 0;
    const availableNetPay = (staffNetPay?.amount !== undefined && staffNetPay?.amount !== null)
      ? parseFloat(staffNetPay.amount)
      : monthlySalary;

    // Cross-month prorated breakdown
    const monthBreakdowns = [];
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    let totalEstimatedDeduction = 0;

    while (cur <= endMonth) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const daysInThisMonth = new Date(y, m + 1, 0).getDate();
      const mStart = new Date(y, m, 1);
      const mEnd = new Date(y, m, daysInThisMonth);
      const mName = cur.toLocaleString('default', { month: 'long', year: 'numeric' });

      const overlapStart = start > mStart ? start : mStart;
      const overlapEnd = end < mEnd ? end : mEnd;

      let mDays = 0;
      if (selectedEmpObj?.office_shift === 1) {
        let tempD = new Date(overlapStart);
        while (tempD <= overlapEnd) {
          const dayOfWeek = tempD.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            mDays++;
          }
          tempD.setDate(tempD.getDate() + 1);
        }
      } else {
        const diffMs = Math.abs(overlapEnd - overlapStart);
        mDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
      }

      const mDailyRate = (monthlySalary > 0 && daysInThisMonth > 0) ? (monthlySalary / daysInThisMonth) : 0;
      const mDeduction = mDailyRate * mDays;
      totalEstimatedDeduction += mDeduction;

      monthBreakdowns.push({
        monthName: mName,
        daysInMonth: daysInThisMonth,
        daysOnLeave: mDays,
        dailyRate: mDailyRate,
        deduction: mDeduction
      });

      cur.setMonth(cur.getMonth() + 1);
    }

    const firstMonth = monthBreakdowns[0] || {};
    const isMultiMonth = monthBreakdowns.length > 1;

    const isExceeded = (availableNetPay > 0 && totalEstimatedDeduction >= availableNetPay) || (availableNetPay <= 0 && durationDays > 0);
    const estimatedRemainingNet = Math.max(0, availableNetPay - totalEstimatedDeduction);

    return {
      durationDays,
      daysInMonth: firstMonth.daysInMonth || 30,
      monthName: isMultiMonth
        ? `${monthBreakdowns[0].monthName} – ${monthBreakdowns[monthBreakdowns.length - 1].monthName}`
        : (firstMonth.monthName || ''),
      monthlySalary,
      dailyRate: firstMonth.dailyRate || 0,
      estimatedDeduction: totalEstimatedDeduction,
      availableNetPay,
      isExceeded,
      estimatedRemainingNet,
      isMultiMonth,
      monthBreakdowns
    };
  }, [form.start_date, form.end_date, selectedEmpObj, staffNetPay]);

  const getApprovalLevel = useCallback((rec) => {
    if (rec.status === 0 && canHodApproveRec(rec)) {
      return 'hod-approve';
    }
    if (rec.status === 1 && canAdminApproveRec(rec)) {
      return 'admin-approve';
    }
    return null;
  }, [canHodApproveRec, canAdminApproveRec]);

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

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== 'all') params.append('status', filterStatus);
      if (filterStartDate) params.append('start_date', filterStartDate);
      if (filterEndDate) params.append('end_date', filterEndDate);
      if (searchQuery) params.append('search', searchQuery);

      const res = await axios.get(`${API_BASE}/hr/apply-loa/export?${params.toString()}`, {
        headers: buildHeaders(),
        responseType: 'blob'
      });

      const filename = `Leave_of_Absence_Records_${new Date().toISOString().split('T')[0]}.csv`;
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          link.remove();
          window.URL.revokeObjectURL(url);
        } catch { /* ignore */ }
      }, 150);

      showToast('Leave of Absence spreadsheet (.csv) downloaded successfully!', 'success');
    } catch (err) {
      console.error('Failed to export LOA spreadsheet via endpoint, using client export fallback:', err);
      if (filteredRecords.length > 0) {
        const rows = [
          ['ISALU HRMS — LEAVE OF ABSENCE (LOA) APPLICATIONS & DEDUCTION REPORT'],
          ['Generated on: ' + new Date().toLocaleString() + ' | Total Records: ' + filteredRecords.length],
          [],
          [
            'S/N',
            'Staff ID',
            'Staff Name',
            'Department',
            'Start Date',
            'End Date',
            'Duration (Days)',
            'Days in Month',
            'Target Month',
            'Monthly Gross Salary (NGN)',
            'Daily Salary Rate (NGN)',
            'Estimated LOA Deduction (NGN)',
            'Date Applied',
            'Status',
            'Reason for Leave of Absence'
          ]
        ];

        let totalDeduction = 0;
        let totalDays = 0;

        filteredRecords.forEach((r, idx) => {
          const name = `${r.surname || ''} ${r.first_name || ''} ${r.othernames || ''}`.trim();
          const badge = statusBadge(r.status);
          const ded = parseFloat(r.estimated_deduction || 0);
          const dur = parseInt(r.duration_days || 0, 10);
          totalDeduction += ded;
          totalDays += dur;

          rows.push([
            idx + 1,
            r.staffId || '',
            name,
            r.department || '',
            formatDate(r.start_date),
            formatDate(r.end_date),
            dur,
            r.days_in_month || '',
            r.month_name || '',
            fmt(r.monthly_salary || 0),
            fmt(r.daily_rate || 0),
            fmt(ded),
            formatDate(r.date_applied || r.created_at),
            badge.label,
            `"${(r.reason_of_leave || '').replace(/"/g, '""')}"`
          ]);
        });

        rows.push([]);
        rows.push(['TOTAL', '', '', '', '', '', `${totalDays} days`, '', '', '', '', fmt(totalDeduction), '', '', '']);

        const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Leave_of_Absence_Records_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          try {
            link.remove();
            window.URL.revokeObjectURL(url);
          } catch { /* ignore */ }
        }, 150);
        showToast('Leave of Absence spreadsheet (.csv) downloaded successfully!', 'success');
      } else {
        showToast('No records available to export.', 'error');
      }
    } finally {
      setExportingCsv(false);
    }
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

                {loaCalculation.isMultiMonth && (
                  <div style={{ marginTop: '0.35rem', borderTop: '1px dashed rgba(59, 130, 246, 0.2)', paddingTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6' }}>🗓️ Prorated Month-by-Month Deduction Schedule:</span>
                    {loaCalculation.monthBreakdowns.map((mb, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.02)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                        <span>• {mb.monthName} ({mb.daysOnLeave} day{mb.daysOnLeave !== 1 ? 's' : ''} @ ₦{fmt(mb.dailyRate)}/day on {mb.daysInMonth}d base):</span>
                        <strong style={{ color: '#38bdf8' }}>₦{fmt(mb.deduction)}</strong>
                      </div>
                    ))}
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
              onClick={handleExportCsv}
              disabled={exportingCsv || filteredRecords.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.85rem',
                fontSize: '0.82rem',
                background: '#ecfdf5',
                borderColor: '#10b981',
                color: '#059669',
                fontWeight: '600',
                cursor: exportingCsv || filteredRecords.length === 0 ? 'not-allowed' : 'pointer'
              }}
              title="Download Leave of Absence spreadsheet as CSV"
            >
              {exportingCsv ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
              {exportingCsv ? 'Exporting…' : 'Download Spreadsheet (.csv)'}
            </button>
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
                        <div className={styles.tierBadgeContainer}>
                          {getTierBadge(rec.status, 'hod')}
                          {getTierBadge(rec.status, 'hr')}
                        </div>
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

                          {/* HOD Actions (status = 0 → Pending, strictly HOD or SuperAdmin) */}
                          {rec.status === 0 && canHodApproveRec(rec) && (
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

                          {/* Admin Actions (status = 1 → HOD Approved, strictly HR HEAD or SuperAdmin) */}
                          {rec.status === 1 && canAdminApproveRec(rec) && (
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
                    <span className={styles.detailLabel}>Approval Status</span>
                    <div className={styles.tierBadgeContainer} style={{ minWidth: '135px' }}>
                      {getTierBadge(viewRecord.status, 'hod')}
                      {getTierBadge(viewRecord.status, 'hr')}
                    </div>
                  </div>
                </div>

                {/* Cross-Month Breakdown (if multi-month) */}
                {viewRecord.month_breakdowns && viewRecord.month_breakdowns.length > 1 && (
                  <div style={{ margin: '0.75rem 0', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px', padding: '0.6rem 0.8rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6', display: 'block', marginBottom: '0.35rem' }}>
                      🗓️ Cross-Month Prorated Deduction Schedule
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {viewRecord.month_breakdowns.map((mb, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
                          <span>• {mb.month_name} ({mb.days_on_leave} day{mb.days_on_leave !== 1 ? 's' : ''} on {mb.days_in_month}d month):</span>
                          <strong style={{ color: 'var(--text-primary)' }}>₦{fmt(mb.deduction)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
