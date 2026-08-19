"use client";

import { useState, useEffect, useCallback } from 'react';
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
// These persist across client-side page navigations inside the Next.js single-page-app
let cachedPageData = null;
let cachedLeaveRecords = null;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ApplyLeavePage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [pageData, setPageData]   = useState(cachedPageData);
  const [formLoading, setFormLoading] = useState(!cachedPageData);
  const [tableLoading, setTableLoading] = useState(!cachedLeaveRecords);
  const [leaveRecords, setLeaveRecords] = useState(cachedLeaveRecords || []);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    leave_type: '',
    employee_id: '',
    start_date: '',
    end_date: '',
    leave_reason: '',
  });
  const [remainingDays, setRemainingDays] = useState('');
  const [calcLoading, setCalcLoading]     = useState(false);
  const [editRecordId, setEditRecordId]   = useState(null);

  const [viewRecord, setViewRecord]   = useState(null); // detail modal
  const [confirmAction, setConfirmAction] = useState(null); // { type, id, label }
  const [actionLoading, setActionLoading] = useState(false);

  const [toast, setToast] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Fetch page data (form metadata) ────────────────────────────────────────
  const fetchFormData = useCallback(async (silent = false) => {
    if (silent && cachedPageData) {
      setPageData(cachedPageData);
      return;
    }
    if (!silent) setFormLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hr/apply-leave`, { headers: buildHeaders() });
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

  // ── Fetch leave records for the table ──────────────────────────────────────
  const fetchRecords = useCallback(async (silent = false) => {
    if (silent && cachedLeaveRecords) {
      setLeaveRecords(cachedLeaveRecords);
      return;
    }
    if (!silent) setTableLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hr/apply-leave/records`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setLeaveRecords(res.data.leaveRecords || []);
        cachedLeaveRecords = res.data.leaveRecords || [];
      } else {
        showToast(res.data.message || 'Failed to load records.', 'error');
      }
    } catch (err) {
      showToast('Failed to load leave records. Check your connection.', 'error');
      console.error(err);
    } finally {
      if (!silent) setTableLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const hasCache = !!cachedPageData;
    const hasRecordsCache = !!cachedLeaveRecords;
    fetchFormData(hasCache);
    fetchRecords(hasRecordsCache);
  }, [fetchFormData, fetchRecords]);

  // ── Auto-prepopulate employee ID for regular staff ──────────────────────────
  useEffect(() => {
    if (pageData) {
      const isSuperAdmin = pageData.isSuperAdmin ?? false;
      const isAdminStaff = pageData.isAdminStaff ?? false;
      const currentEmployee = pageData.employee ?? null;

      if (!(isSuperAdmin || isAdminStaff) && currentEmployee) {
        setForm(prev => ({
          ...prev,
          employee_id: currentEmployee.ID,
        }));
      }
    }
  }, [pageData]);

  // ── Auto-calculate end date & remaining days ───────────────────────────────
  useEffect(() => {
    const { employee_id, leave_type, start_date } = form;
    if (!employee_id || !leave_type || !start_date) return;

    const controller = new AbortController();
    setCalcLoading(true);

    axios.get(`${API_BASE}/hr/apply-leave/calculate-end-date`, {
      headers: buildHeaders(),
      params: { employee_id, leave_type, start_date },
      signal: controller.signal,
    })
      .then(res => {
        if (res.data.status === 'success') {
          setRemainingDays(res.data.remaining_days ?? '');
          setForm(prev => ({ ...prev, end_date: res.data.end_date ?? '' }));
        }
      })
      .catch(err => { if (!axios.isCancel(err)) console.error(err); })
      .finally(() => setCalcLoading(false));

    return () => controller.abort();
  }, [form.employee_id, form.leave_type, form.start_date]);

  // ── Form handlers ──────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (rec) => {
    setEditRecordId(rec.id);
    setForm({
      leave_type: rec.leave_type_id,
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
      leave_type: '',
      employee_id: pageData && !(pageData.isSuperAdmin || pageData.isAdminStaff) && pageData.employee
        ? pageData.employee.ID
        : '',
      start_date: '',
      end_date: '',
      leave_reason: '',
    });
    setRemainingDays('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isEdit = !!editRecordId;
      const url = isEdit ? `${API_BASE}/hr/apply-leave/${editRecordId}` : `${API_BASE}/hr/apply-leave`;
      const res = await (isEdit
        ? axios.put(url, form, { headers: buildHeaders() })
        : axios.post(url, form, { headers: buildHeaders() })
      );
      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        handleCancelEdit();
        cachedLeaveRecords = null;
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
      const endpoint = `${API_BASE}/hr/apply-leave/${type}/${id}`;
      const res = await axios.get(endpoint, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        cachedLeaveRecords = null;
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
  const leaveTypes   = pageData?.leaveTypes   ?? [];
  const employees    = pageData?.employees    ?? [];
  const isSuperAdmin = pageData?.isSuperAdmin ?? false;
  const isHod        = pageData?.isHod        ?? false;
  const isAdminStaff = pageData?.isAdminStaff ?? false;
  const currentEmployee = pageData?.employee  ?? null;

  const canHodAct   = isHod || isSuperAdmin || isAdminStaff;
  const canAdminAct = isAdminStaff || isSuperAdmin;

  const selectedEmpObj = (isSuperAdmin || isAdminStaff)
    ? employees.find(e => String(e.ID) === String(form.employee_id))
    : currentEmployee;

  const selectedEmpGender = (selectedEmpObj?.gender || currentEmployee?.gender || '').toLowerCase().trim();
  const isSelectedEmpMale = selectedEmpGender === 'male' || selectedEmpGender === 'm';

  // ── CustomSelect option shapes ─────────────────────────────────────────────
  const leaveTypeOptions = leaveTypes
    .filter(lt => {
      const typeName = (lt.leaveType || '').toLowerCase();
      const isMaternity = typeName.includes('maternity') || String(lt.id) === '3';
      if (isSelectedEmpMale && isMaternity) {
        return false;
      }
      return true;
    })
    .map(lt => ({
      id:   lt.id,
      name: lt.leaveType,
    }));

  const employeeOptions = (isSuperAdmin || isAdminStaff)
    ? employees.map(emp => ({
        id:   emp.ID,
        name: `${emp.surname} ${emp.first_name} ${emp.othernames}`.trim() + (emp.office_shift == 1 ? ' (Admin)' : ' (Shift)'),
      }))
    : (currentEmployee
        ? [{
            id:   currentEmployee.ID,
            name: `${currentEmployee.surname} ${currentEmployee.first_name} ${currentEmployee.othernames}`.trim() + (currentEmployee.office_shift == 1 ? ' (Admin)' : ' (Shift)'),
          }]
        : []
      );

  const hasNotUploadedEducation = selectedEmpObj && selectedEmpObj.has_uploaded_education === false;

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
      const rec = leaveRecords.find(r => r.id === id);
      if (!rec) continue;

      const actionType = getApprovalLevel(rec);
      if (!actionType) {
        failCount++;
        continue;
      }

      try {
        const endpoint = `${API_BASE}/hr/apply-leave/${actionType}/${id}`;
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
      cachedLeaveRecords = null;
      setSelectedIds([]);
      fetchRecords(true);
    } else {
      showToast('Failed to approve selected leave application(s).', 'error');
    }
    setShowBulkApproveModal(false);
    setActionLoading(false);
  };

  const filteredRecords = leaveRecords.filter(rec => {
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
        <h1>Leave Application</h1>
        <p>Apply for leave, review records and manage approvals.</p>
      </div>

      {/* ── Application Form ── */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Calendar size={18} style={{ marginRight: '0.5rem', flexShrink: 0 }} />
          {editRecordId ? 'Edit Leave Application' : 'Apply for Leave'}
          {formLoading && <Loader2 size={16} className={styles.inlineSpinner} style={{ marginLeft: 'auto' }} />}
        </h2>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>

            {/* Leave Type */}
            <div className={styles.formGroup}>
              <CustomSelect
                name="leave_type"
                label="Leave Type"
                placeholder={formLoading ? "Loading leave types..." : "-- Select Leave Type --"}
                options={leaveTypeOptions}
                value={form.leave_type}
                onChange={handleChange}
                searchable={false}
                required
                disabled={formLoading}
              />
            </div>

            {/* Employee */}
            <div className={styles.formGroup}>
              <CustomSelect
                name="employee_id"
                label="Employee"
                placeholder={formLoading ? "Loading employees..." : "-- Select Employee --"}
                options={employeeOptions}
                value={form.employee_id}
                onChange={handleChange}
                searchable={true}
                required
                disabled={formLoading || !(isSuperAdmin || isAdminStaff)}
              />
            </div>

            {/* Remaining Days (read-only) */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Remaining Days
                {calcLoading && <Loader2 size={13} className={styles.inlineSpinner} />}
              </label>
              <input
                type="text"
                className={`${styles.input} ${styles.readonly}`}
                value={remainingDays}
                placeholder="Auto-calculated"
                readOnly
              />
            </div>

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
              <label className={styles.label}>
                End Date
                {calcLoading && <Loader2 size={13} className={styles.inlineSpinner} />}
              </label>
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
              <label className={styles.label}>Leave Reason</label>
              <textarea
                name="leave_reason"
                className={styles.textarea}
                rows={3}
                placeholder="Enter reason for leave…"
                value={form.leave_reason}
                onChange={handleChange}
                required
              />
            </div>

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
            <button type="submit" className={styles.submitBtn} disabled={submitting || formLoading || hasNotUploadedEducation}>
              {submitting
                ? (editRecordId
                    ? <><Loader2 size={16} className={styles.btnSpinner} /> Updating…</>
                    : <><Loader2 size={16} className={styles.btnSpinner} /> Submitting…</>
                  )
                : (editRecordId
                    ? <><Send size={16} /> Update Leave Application</>
                    : <><Send size={16} /> Submit Leave Application</>
                  )
              }
            </button>
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
            Leave Records
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
              Print Leave Record
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
          {(filterStartDate || filterEndDate || filterStatus !== 'all' || searchQuery) && (
            <button
              type="button"
              className={styles.cancelBtn}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: 'fit-content' }}
              onClick={() => {
                setFilterStartDate('');
                setFilterEndDate('');
                setFilterStatus('all');
                setSearchQuery('');
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
                            filteredRecords.length > 0 &&
                            filteredRecords.filter(getApprovalLevel).length > 0 &&
                            filteredRecords.filter(getApprovalLevel).every(r => selectedIds.includes(r.id))
                          }
                          onChange={(e) => {
                            const eligible = filteredRecords.filter(getApprovalLevel);
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
                    <th>Leave Type</th>
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
                      <td colSpan={showCheckboxes ? 11 : 10} className={styles.emptyRow}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <Loader2 size={16} className={styles.spinner} />
                          <span>Loading leave records…</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={showCheckboxes ? 11 : 10} className={styles.emptyRow}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.5rem 0' }}>
                          <Calendar size={32} strokeWidth={1.5} style={{ color: 'var(--secondary)' }} />
                          <span style={{ color: 'var(--secondary)' }}>No leave records found.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec, i) => {
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
                          <td>{i + 1}</td>
                          <td className={styles.capitalize}>
                            {rec.surname} {rec.first_name} {rec.othernames}
                          </td>
                          <td>{rec.department}</td>
                          <td>{rec.leaveType}</td>
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
                                  title="Edit Leave Details"
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
                <h3 className={styles.modalTitle}>Leave Details</h3>
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
                    <span className={styles.detailLabel}>Leave Type</span>
                    <span className={styles.detailValue}>{viewRecord.leaveType}</span>
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
                  <span className={styles.detailLabel}>Leave Reason</span>
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
                Are you sure you want to <strong>{confirmAction.type.includes('reject') ? 'reject' : 'approve'}</strong> this leave request at <strong>{confirmAction.label.replace(' Approve', '').replace(' Reject', '')}</strong> level?
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
              .map(id => leaveRecords.find(r => r.id === id))
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
