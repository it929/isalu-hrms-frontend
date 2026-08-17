"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Users, Search, Loader2, FileText, AlertCircle, CheckCircle2, Edit2, Trash2, Plus, X, Calendar, Info, Check, Printer } from 'lucide-react';
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

function formatDateDMY(dateStr) {
  if (!dateStr) return '—';
  try {
    const str = String(dateStr).trim();
    const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export default function ApplyRefundPage() {
  // Loading & Toast States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Dropdown Autocomplete Staff State
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const dropdownRef = useRef(null);

  // User Context State
  const [userCtx, setUserCtx] = useState({
    isSuperAdmin: false,
    isAdminStaff: false,
    isFinanceStaff: false,
    isAuditStaff: false,
    isHod: false,
    employee: null,
  });

  // Modal States
  const [confirmDelete, setConfirmDelete] = useState(null); // id of record to delete
  const [actionLoading, setActionLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null); // record for detailed view modal
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  
  // Approval Modal State
  const [approvalModal, setApprovalModal] = useState({
    show: false,
    recordId: null,
    level: '', // 'HOD', 'Finance', 'HR'
    action: '', // 'approve', 'reject'
    remarks: '',
  });

  // Form Fields
  const [editId, setEditId] = useState(null);
  const [amount, setAmount] = useState('');
  const [refundDate, setRefundDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [reason, setReason] = useState('');

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('10');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStartDate, filterEndDate, filterStatus, itemsPerPage]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch staff list for dropdown
  const fetchStaffData = useCallback(async () => {
    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/refunds/staff`, { headers });
      if (res.data.status === 'success') {
        setStaffList(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  }, []);

  // Fetch submitted refunds list
  const fetchRecords = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/refunds`, { headers });
      if (res.data.status === 'success') {
        setRecords(res.data.data || []);
        setUserCtx({
          isSuperAdmin: res.data.isSuperAdmin || false,
          isAdminStaff: res.data.isAdminStaff || false,
          isFinanceStaff: res.data.isFinanceStaff || false,
          isAuditStaff: res.data.isAuditStaff || false,
          isHod: res.data.isHod || false,
          employee: res.data.employee || null,
        });
      }
    } catch (err) {
      showToast('Failed to retrieve refund records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStaffData();
    fetchRecords(false);
    setMounted(true);
  }, [fetchStaffData, fetchRecords]);

  // Click outside dropdown handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        if (selectedStaff) {
          setDropdownSearch(selectedStaff.name);
        } else {
          setDropdownSearch('');
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedStaff]);

  // Determine if active user can select other staff members (Only Super Admin)
  const canSelectStaff = userCtx.isSuperAdmin || 
    (mounted && typeof window !== 'undefined' && (() => {
      try {
        const role = JSON.parse(localStorage.getItem('hrms_role'));
        const roleName = role?.name?.toLowerCase() || '';
        return roleName === 'super admin' || roleName === 'super administrator';
      } catch {
        return false;
      }
    })());

  // Prepopulate staff selection if user is not Admin/SuperAdmin
  useEffect(() => {
    const currentEmployee = userCtx.employee;

    if (!canSelectStaff && currentEmployee) {
      const empId = currentEmployee.ID ?? currentEmployee.id;
      const rawName = `${currentEmployee.surname || ''} ${currentEmployee.first_name || ''} ${currentEmployee.othernames || ''}`;
      const fullName = currentEmployee.name || rawName.replace(/\s+/g, ' ').trim();

      const matchingStaff = staffList.find(s => String(s.id) === String(empId));
      if (matchingStaff) {
        setSelectedStaff(matchingStaff);
        setDropdownSearch(matchingStaff.name);
      } else {
        setSelectedStaff({
          id: empId,
          name: fullName,
          fileNo: currentEmployee.fileNo || '',
        });
        setDropdownSearch(fullName);
      }
    }
  }, [staffList, userCtx, canSelectStaff]);

  // Filter staff list for dropdown autocomplete
  const filteredStaff = dropdownSearch.trim() === ''
    ? staffList
    : staffList.filter(s => {
        const q = dropdownSearch.toLowerCase();
        const nameMatch = s.name ? String(s.name).toLowerCase().includes(q) : false;
        const idMatch = s.id ? String(s.id).toLowerCase().includes(q) : false;
        return nameMatch || idMatch;
      });

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setShowDropdown(false);
  };

  const handleClearForm = () => {
    setEditId(null);
    const currentEmployee = userCtx.employee;

    if (!canSelectStaff && currentEmployee) {
      const empId = currentEmployee.ID ?? currentEmployee.id;
      const matchingStaff = staffList.find(s => String(s.id) === String(empId));
      if (matchingStaff) {
        setSelectedStaff(matchingStaff);
        setDropdownSearch(matchingStaff.name);
      }
    } else {
      setSelectedStaff(null);
      setDropdownSearch('');
    }

    setAmount('');
    setRefundDate(new Date().toISOString().split('T')[0]);
    setReason('');
  };

  // Submit/Apply for Refund
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      showToast('Please specify a valid positive amount.', 'error');
      return;
    }
    if (!refundDate) {
      showToast('Please select the application date.', 'error');
      return;
    }
    if (!reason.trim()) {
      showToast('Please provide a reason for the refund request.', 'error');
      return;
    }

    setSaving(true);
    const headers = buildHeaders();
    const payload = {
      id: editId,
      staff_id: selectedStaff.id,
      amount: parseFloat(amount),
      reason: reason.trim(),
      refund_date: refundDate,
    };

    try {
      const res = await axios.post(`${API_BASE}/payroll/refunds`, payload, { headers });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Refund request saved successfully.');
        handleClearForm();
        fetchRecords(true); // silent refresh
      } else {
        showToast(res.data.message || 'An error occurred.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to save refund application.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Pre-fill fields for editing
  const handleEdit = (record) => {
    setEditId(record.id);

    const matchingStaff = staffList.find(s => s.id === record.staff_id);
    if (matchingStaff) {
      setSelectedStaff(matchingStaff);
      setDropdownSearch(matchingStaff.name);
    } else {
      const staffObj = {
        id: record.staff_id,
        name: record.name || `${record.surname} ${record.first_name}`,
        fileNo: record.fileNo || '',
      };
      setSelectedStaff(staffObj);
      setDropdownSearch(staffObj.name);
    }

    setAmount(record.amount);
    setRefundDate(record.refund_date);
    setReason(record.reason || '');
  };

  // Delete Trigger & Deletion
  const handleDeleteTrigger = (id) => {
    setConfirmDelete(id);
  };

  const handleDeleteConfirm = async () => {
    const id = confirmDelete;
    if (!id) return;

    setActionLoading(true);
    // Optimistic delete
    const originalRecords = [...records];
    setRecords(records.filter(r => r.id !== id));

    const headers = buildHeaders();
    try {
      const res = await axios.delete(`${API_BASE}/payroll/refunds/${id}`, { headers });
      if (res.data.status === 'success') {
        showToast('Refund application deleted successfully.');
        setConfirmDelete(null);
        fetchRecords(true); // silent sync
      } else {
        setRecords(originalRecords); // rollback
        showToast(res.data.message || 'Deletion failed.', 'error');
      }
    } catch (err) {
      setRecords(originalRecords); // rollback
      showToast('Failed to delete refund application.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Approval Process Triggers & Submission
  const handleApprovalAction = (recordId, level, action) => {
    setApprovalModal({
      show: true,
      recordId,
      level,
      action,
      remarks: '',
    });
  };

  const handleApprovalSubmit = async () => {
    const { recordId, level, action, remarks } = approvalModal;
    if (!recordId) return;

    setActionLoading(true);

    // Optimistic UI Update: immediately reflect change in the table row
    const originalRecords = [...records];
    setRecords(prevRecords =>
      prevRecords.map(r => {
        if (r.id === recordId) {
          const updated = { ...r };
          if (action === 'approve') {
            if (level === 'HOD') updated.hod_status = 1;
            if (level === 'HR') updated.admin_status = 1;
            if (level === 'Audit') updated.audit_status = 1;
            if (level === 'Finance') {
              updated.finance_status = 1;
              updated.status = 1; // overall approved (paid)
            }
          } else {
            if (level === 'HOD') {
              updated.hod_status = 2;
              updated.status = 2; // overall rejected
            }
            if (level === 'HR') {
              updated.admin_status = 2;
              updated.status = 2; // overall rejected
            }
            if (level === 'Audit') {
              updated.audit_status = 2;
              updated.status = 2; // overall rejected
            }
            if (level === 'Finance') {
              updated.finance_status = 2;
              updated.status = 2; // overall rejected
            }
          }
          return updated;
        }
        return r;
      })
    );

    const headers = buildHeaders();
    const actionUrl = `${API_BASE}/payroll/refunds/${level.toLowerCase()}-${action}/${recordId}?remarks=${encodeURIComponent(remarks)}`;

    try {
      const res = await axios.get(actionUrl, { headers });
      if (res.data.status === 'success') {
        showToast(res.data.message || `Refund request successfully ${action === 'approve' ? 'approved' : 'rejected'}.`);
        setApprovalModal({ show: false, recordId: null, level: '', action: '', remarks: '' });
        fetchRecords(true);
      } else {
        setRecords(originalRecords); // rollback
        showToast(res.data.message || 'Approval action failed.', 'error');
      }
    } catch (err) {
      setRecords(originalRecords); // rollback
      const msg = err.response?.data?.message ?? 'Failed to process refund action.';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter and paginated records
  const filteredRecords = records.filter(r => {
    // 1. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = r.name ? String(r.name).toLowerCase().includes(q) : false;
      const staffIdMatch = r.staff_id ? String(r.staff_id).toLowerCase().includes(q) : false;
      const reasonMatch = r.reason ? String(r.reason).toLowerCase().includes(q) : false;
      const deptMatch = r.department ? String(r.department).toLowerCase().includes(q) : false;
      if (!nameMatch && !staffIdMatch && !reasonMatch && !deptMatch) {
        return false;
      }
    }

    // 2. Date filter (parse r.refund_date or r.created_at)
    if (filterStartDate) {
      const start = new Date(filterStartDate);
      const applied = r.refund_date ? new Date(r.refund_date) : (r.created_at ? new Date(r.created_at) : null);
      if (applied) {
        start.setHours(0, 0, 0, 0);
        applied.setHours(0, 0, 0, 0);
        if (applied < start) return false;
      }
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      const applied = r.refund_date ? new Date(r.refund_date) : (r.created_at ? new Date(r.created_at) : null);
      if (applied) {
        end.setHours(0, 0, 0, 0);
        applied.setHours(0, 0, 0, 0);
        if (applied > end) return false;
      }
    }

    // 3. Status filter (0 = Pending, 1 = Approved/Paid, 2 = Rejected)
    if (filterStatus !== 'all') {
      const statusNum = Number(r.status);
      if (filterStatus === 'pending' && statusNum !== 0) return false;
      if (filterStatus === 'approved' && statusNum !== 1) return false;
      if (filterStatus === 'rejected' && statusNum !== 2) return false;
    }

    return true;
  });

  const totalPages = itemsPerPage === 'all'
    ? 1
    : Math.ceil(filteredRecords.length / parseInt(itemsPerPage, 10)) || 1;
  const paginatedRecords = itemsPerPage === 'all'
    ? filteredRecords
    : filteredRecords.slice(
        (currentPage - 1) * parseInt(itemsPerPage, 10),
        currentPage * parseInt(itemsPerPage, 10)
      );

  const isFormDisabled = !canSelectStaff && selectedStaff && String(selectedStaff.id) !== String(userCtx.employee?.ID ?? userCtx.employee?.id);

  // Helper check to determine if a tier approval button should show
  const canRecommendHOD = (row) => {
    if (row.status !== 0 || row.hod_status !== 0) return false;
    if (canSelectStaff) return true;
    if (userCtx.isHod && userCtx.employee) {
      const empId = userCtx.employee.ID ?? userCtx.employee.id;
      const empDeptId = userCtx.employee.departmentID ?? userCtx.employee.department_id;
      if (empDeptId && row.departmentID) {
        return String(row.departmentID) === String(empDeptId);
      }
      return row.department === userCtx.employee.department || String(row.staff_id) === String(empId);
    }
    return false;
  };

  const canRecommendHR = (row) => {
    if (row.status !== 0 || row.hod_status !== 1 || row.admin_status !== 0) return false;
    return canSelectStaff || userCtx.isAdminStaff;
  };

  const canApproveAudit = (row) => {
    if (row.status !== 0 || row.admin_status !== 1 || row.audit_status !== 0) return false;
    return canSelectStaff || userCtx.isAuditStaff;
  };

  const canApproveFinance = (row) => {
    if (row.status !== 0 || row.audit_status !== 1 || row.finance_status !== 0) return false;
    return canSelectStaff || userCtx.isFinanceStaff;
  };

  const getApprovalLevel = (row) => {
    if (canRecommendHOD(row)) return 'hod';
    if (canRecommendHR(row)) return 'hr';
    if (canApproveAudit(row)) return 'audit';
    if (canApproveFinance(row)) return 'finance';
    return null;
  };

  const eligibleRecords = filteredRecords.filter(r => getApprovalLevel(r) !== null);
  const isAllEligibleSelected = eligibleRecords.length > 0 && eligibleRecords.every(r => selectedIds.includes(r.id));

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;

    setActionLoading(true);
    const headers = buildHeaders();
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      const row = records.find(r => r.id === id);
      if (!row) continue;

      const level = getApprovalLevel(row);
      if (!level) {
        failCount++;
        continue;
      }

      const actionUrl = `${API_BASE}/payroll/refunds/${level}-approve/${id}?remarks=${encodeURIComponent('Bulk approved')}`;
      try {
        const res = await axios.get(actionUrl, { headers });
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
      showToast(`Successfully approved ${successCount} refund application(s).${failCount > 0 ? ` Failed: ${failCount}` : ''}`);
      if (typeof window !== 'undefined') {
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('hrms_')) sessionStorage.removeItem(key);
        });
      }
      setSelectedIds([]);
      fetchRecords(true);
    } else {
      showToast('Failed to approve selected refund application(s).', 'error');
    }
    setShowBulkApproveModal(false);
    setActionLoading(false);
  };

  // Helper for overall application status badge mapping
  const getOverallBadge = (status) => {
    if (status === 1) return <span className={`${styles.badge} ${styles.badgeApproved}`}>Paid</span>;
    if (status === 2) return <span className={`${styles.badge} ${styles.badgeRejected}`}>Rejected</span>;
    return <span className={`${styles.badge} ${styles.badgePending}`}>Pending</span>;
  };
 
  // Helper for tier status representation
  const getTierBadge = (status, type) => {
    const label = type === 'hod' ? 'HOD' : type === 'hr' ? 'HR' : type === 'audit' ? 'Audit' : 'Fin.';
    const badgeStyle = type === 'hod' ? styles.badgeHodApproved : type === 'hr' ? styles.badgeHrApproved : type === 'audit' ? styles.badgeAuditApproved : styles.badgeFinanceApproved;
    if (status === 1) {
      const approvedLabel = type === 'finance' ? 'Paid' : 'Approved';
      return (
        <span className={styles.tierBadgeItem}>
          <span className={styles.tierLabel}>{label}:</span>
          <span className={`${styles.badge} ${badgeStyle}`} style={{ padding: '0.1rem 0.4rem', fontSize: '0.68rem' }}>{approvedLabel}</span>
        </span>
      );
    }
    if (status === 2) {
      return (
        <span className={styles.tierBadgeItem}>
          <span className={styles.tierLabel}>{label}:</span>
          <span className={`${styles.badge} ${styles.badgeRejected}`} style={{ padding: '0.1rem 0.4rem', fontSize: '0.68rem' }}>Rejected</span>
        </span>
      );
    }
    return (
      <span className={styles.tierBadgeItem}>
        <span className={styles.tierLabel}>{label}:</span>
        <span className={`${styles.badge} ${styles.badgePending}`} style={{ padding: '0.1rem 0.4rem', fontSize: '0.68rem' }}>Pending</span>
      </span>
    );
  };

  return (
    <div className={styles.container}>
      {/* Toast Alert */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={`${styles.header} ${styles.noPrint}`}>
        <h1 className={styles.title}>Apply for Refund</h1>
        <p className={styles.subtitle}>Submit salary or expense refund applications for approval.</p>
      </div>

      {/* Form Card */}
      <div className={`${styles.card} ${styles.noPrint}`}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            {editId ? 'Modify Refund Application' : 'New Refund Request'}
          </h2>
        </div>

        <div className={styles.cardBody}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              
              {/* Select Staff (Autocomplete Dropdown) */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Select Staff Member *</label>
                <div className={styles.dropdownContainer} ref={dropdownRef}>
                  <div className={styles.inputGroup}>
                    <Users className={styles.inputIcon} size={16} />
                    <input
                      type="text"
                      className={`${styles.input} ${styles.inputWithIcon} ${!canSelectStaff ? styles.readonly : ''}`}
                      placeholder={!canSelectStaff ? "Readonly employee context" : "Search staff by name or staff ID..."}
                      value={dropdownSearch}
                      onChange={(e) => {
                        setDropdownSearch(e.target.value);
                        setShowDropdown(true);
                        setSelectedStaff(null);
                      }}
                      onFocus={() => {
                        if (canSelectStaff) {
                          setShowDropdown(true);
                          setDropdownSearch('');
                        }
                      }}
                      disabled={!canSelectStaff}
                    />
                  </div>

                  {showDropdown && canSelectStaff && filteredStaff.length > 0 && (
                    <ul className={styles.dropdownList}>
                      {filteredStaff.map((staff) => (
                        <li
                          key={staff.id}
                          className={styles.dropdownItem}
                          onClick={() => handleSelectStaff(staff)}
                        >
                          <span className={styles.staffName}>{staff.name}</span>
                          <span className={styles.dropdownItemSub}>Staff ID: {staff.id}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {showDropdown && canSelectStaff && filteredStaff.length === 0 && (
                    <div className={styles.dropdownList}>
                      <div className={styles.dropdownEmpty}>No active staff records found</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Refund Date */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Application Date *</label>
                <div className={styles.inputGroup}>
                  <Calendar className={styles.inputIcon} size={16} />
                  <input
                    type="date"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    value={refundDate}
                    onChange={(e) => setRefundDate(e.target.value)}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>

              {/* Refund Amount */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Refund Amount (₦) *</label>
                <div className={styles.inputGroup}>
                  <NairaSign className={styles.inputIcon} size={16} />
                  <input
                    type="number"
                    step="0.01"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="Enter refund amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>

              {/* Reason Description */}
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.label}>Reason / Purpose for Refund *</label>
                <textarea
                  className={styles.input}
                  rows={2}
                  placeholder="State the purpose for this refund request..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isFormDisabled}
                />
              </div>

            </div>

            {/* Actions buttons */}
            {!isFormDisabled && (
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={handleClearForm}
                  disabled={saving}
                >
                  Clear Fields
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className={styles.loadingSpinner} size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      {editId ? 'Update Request' : 'Submit Request'}
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Directory Records List */}
      <div className={`${styles.card} ${styles.printCard}`}>
        <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className={styles.cardTitle}>Refund Registry</h2>
          <div className={styles.noPrint} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {selectedIds.length > 0 && (
              <button
                type="button"
                className={styles.submitBtn}
                style={{ background: '#10b981', borderColor: '#10b981', color: '#fff', padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => setShowBulkApproveModal(true)}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className={styles.loadingSpinner} size={15} /> : <CheckCircle2 size={15} />}
                Approve Selected ({selectedIds.length})
              </button>
            )}
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => window.print()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
            >
              <Printer size={15} />
              Print Refund Registry
            </button>
          </div>
        </div>

        {/* ── Filters Bar ── */}
        <div className={`${styles.filterBar} ${styles.noPrint}`}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Search:</span>
            <input
              type="text"
              placeholder="Search employee, ID, department..."
              className={styles.filterInput}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>From:</span>
            <input
              type="date"
              className={styles.filterInput}
              value={filterStartDate}
              onChange={(e) => {
                setFilterStartDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>To:</span>
            <input
              type="date"
              className={styles.filterInput}
              value={filterEndDate}
              onChange={(e) => {
                setFilterEndDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Status:</span>
            <select
              className={styles.filterSelect}
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved / Paid</option>
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
              <option value="10">10 records</option>
              <option value="20">20 records</option>
              <option value="30">30 records</option>
              <option value="50">50 records</option>
              <option value="100">100 records</option>
              <option value="all">All Records</option>
            </select>
          </div>
          {(filterStartDate || filterEndDate || filterStatus !== 'all' || searchQuery) && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: 'fit-content' }}
              onClick={() => {
                setFilterStartDate('');
                setFilterEndDate('');
                setFilterStatus('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* List Table */}
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 className={styles.loadingSpinner} size={28} />
              <p style={{ marginTop: '0.75rem' }}>Synchronizing payroll refund records...</p>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText className={styles.emptyIcon} size={32} />
              <p>No matching refund application records found.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={isAllEligibleSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newIds = [...new Set([...selectedIds, ...eligibleRecords.map(r => r.id)])];
                            setSelectedIds(newIds);
                          } else {
                            const eligibleSet = new Set(eligibleRecords.map(r => r.id));
                            setSelectedIds(selectedIds.filter(id => !eligibleSet.has(id)));
                          }
                        }}
                      />
                    </th>
                    <th>Staff Profile</th>
                    <th>Dept.</th>
                    <th>Requested</th>
                    <th>App Date</th>
                    <th>Status</th>
                    <th>Approval Statuses</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((row) => {
                    const rowPending = row.status === 0;
                    const empId = userCtx.employee ? (userCtx.employee.ID ?? userCtx.employee.id) : null;
                    const isOwnRow = empId && String(row.staff_id) === String(empId);
                    const canEditRow = rowPending && (canSelectStaff || isOwnRow);
                    const canDeleteRow = rowPending && (canSelectStaff || isOwnRow);
                    const canApproveRowLevel = getApprovalLevel(row);

                    return (
                      <tr key={row.id}>
                        <td>
                          {canApproveRowLevel !== null ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds(prev => [...prev, row.id]);
                                } else {
                                  setSelectedIds(prev => prev.filter(id => id !== row.id));
                                }
                              }}
                            />
                          ) : (
                            <input type="checkbox" disabled style={{ opacity: 0.3 }} />
                          )}
                        </td>
                        <td>
                          <div className={styles.staffCell}>
                            <span className={styles.staffName}>{row.name}</span>
                            <span className={styles.staffFile}>Staff ID: {row.staff_id}</span>
                          </div>
                        </td>
                        <td>{row.department || '—'}</td>
                        <td style={{ fontWeight: 600 }}>₦{fmt(row.amount)}</td>
                        <td>{formatDateDMY(row.refund_date)}</td>
                        <td>{getOverallBadge(row.status)}</td>
                        <td>
                          <div className={styles.tierBadgeContainer}>
                            {getTierBadge(row.hod_status, 'hod')}
                            {getTierBadge(row.admin_status, 'hr')}
                            {getTierBadge(row.audit_status, 'audit')}
                            {getTierBadge(row.finance_status, 'finance')}
                          </div>
                        </td>
                        <td>
                          <div className={styles.actionGroup}>
                            {/* View details */}
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.viewBtn}`}
                              title="View details"
                              onClick={() => setDetailRecord(row)}
                            >
                              <Info size={16} />
                            </button>

                            {/* Edit pending */}
                            {canEditRow && (
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.editBtn}`}
                                title="Edit application"
                                onClick={() => handleEdit(row)}
                              >
                                <Edit2 size={16} />
                              </button>
                            )}

                            {/* Delete pending */}
                            {canDeleteRow && (
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                title="Delete application"
                                onClick={() => handleDeleteTrigger(row.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}

                            {/* HOD Approvals */}
                            {canRecommendHOD(row) && (
                              <div style={{ display: 'flex', gap: '0.2rem' }}>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.approveBtn}`}
                                  title="HOD Approve"
                                  onClick={() => handleApprovalAction(row.id, 'HOD', 'approve')}
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.rejectBtn}`}
                                  title="HOD Reject"
                                  onClick={() => handleApprovalAction(row.id, 'HOD', 'reject')}
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )}

                            {/* HR Approvals */}
                            {canRecommendHR(row) && (
                              <div style={{ display: 'flex', gap: '0.2rem' }}>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.approveBtn}`}
                                  title="HR Approve"
                                  onClick={() => handleApprovalAction(row.id, 'HR', 'approve')}
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.rejectBtn}`}
                                  title="HR Reject"
                                  onClick={() => handleApprovalAction(row.id, 'HR', 'reject')}
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )}
 
                            {/* Audit Approvals */}
                            {canApproveAudit(row) && (
                              <div style={{ display: 'flex', gap: '0.2rem' }}>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.approveBtn}`}
                                  title="Audit Approve"
                                  onClick={() => handleApprovalAction(row.id, 'Audit', 'approve')}
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.rejectBtn}`}
                                  title="Audit Reject"
                                  onClick={() => handleApprovalAction(row.id, 'Audit', 'reject')}
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )}
 
                            {/* Finance Approvals */}
                            {canApproveFinance(row) && (
                              <div style={{ display: 'flex', gap: '0.2rem' }}>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.approveBtn}`}
                                  title="Mark as Paid"
                                  onClick={() => handleApprovalAction(row.id, 'Finance', 'approve')}
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.rejectBtn}`}
                                  title="Finance Reject"
                                  onClick={() => handleApprovalAction(row.id, 'Finance', 'reject')}
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )}

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {filteredRecords.length > 0 && (
                <div className={styles.pagination}>
                  <span className={styles.paginationText}>
                    Showing {filteredRecords.length === 0 ? 0 : (itemsPerPage === 'all' ? 1 : (currentPage - 1) * parseInt(itemsPerPage, 10) + 1)} to {itemsPerPage === 'all' ? filteredRecords.length : Math.min(currentPage * parseInt(itemsPerPage, 10), filteredRecords.length)} of {filteredRecords.length} records {itemsPerPage !== 'all' && totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
                  </span>
                  {itemsPerPage !== 'all' && totalPages > 1 && (
                    <div className={styles.paginationButtons}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(1)}
                      >
                        First
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                      >
                        Prev
                      </button>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            className={`${styles.btn} ${currentPage === pageNum ? styles.btnPrimary : styles.btnSecondary}`}
                            style={{ minWidth: '30px', padding: '0.375rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        Last
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Details View Modal */}
      <AnimatePresence>
        {detailRecord && (
          <div className={styles.modalOverlay} onClick={() => setDetailRecord(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={styles.modalBox}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Refund Request Details</h3>
                <button className={styles.modalClose} onClick={() => setDetailRecord(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff Member</span>
                    <span className={styles.detailValue}>{detailRecord.name}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff ID</span>
                    <span className={styles.detailValue}>{detailRecord.staff_id}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Department</span>
                    <span className={styles.detailValue}>{detailRecord.department || '—'}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Refund Amount</span>
                    <span className={styles.detailValue} style={{ fontWeight: 700 }}>₦{fmt(detailRecord.amount)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Application Date</span>
                    <span className={styles.detailValue}>{formatDateDMY(detailRecord.refund_date)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Overall Status</span>
                    <span className={styles.detailValue}>{getOverallBadge(detailRecord.status)}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>HOD Status Details</span>
                    <span className={styles.detailValue}>
                      {detailRecord.hod_status === 1 ? `Approved by ${detailRecord.hod_name || 'HOD'} on ${formatDateDMY(detailRecord.hod_date)}` : detailRecord.hod_status === 2 ? 'Rejected' : 'Pending'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>HR Status Details</span>
                    <span className={styles.detailValue}>
                      {detailRecord.admin_status === 1 ? `Approved by ${detailRecord.admin_name || 'HR Admin'} on ${formatDateDMY(detailRecord.admin_date)}` : detailRecord.admin_status === 2 ? 'Rejected' : 'Pending'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Audit Status Details</span>
                    <span className={styles.detailValue}>
                      {detailRecord.audit_status === 1 ? `Approved by ${detailRecord.audit_name || 'Audit Staff'} on ${formatDateDMY(detailRecord.audit_date)}` : detailRecord.audit_status === 2 ? 'Rejected' : 'Pending'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Finance Status Details</span>
                    <span className={styles.detailValue}>
                      {detailRecord.finance_status === 1 ? `Paid by ${detailRecord.finance_name || 'Finance Staff'} on ${formatDateDMY(detailRecord.finance_date)}` : detailRecord.finance_status === 2 ? 'Rejected' : 'Pending'}
                    </span>
                  </div>

                  <div className={styles.detailItemFull}>
                    <span className={styles.detailLabel}>Remarks/Auditing Trail Notes</span>
                    <span className={styles.detailValue} style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                      {detailRecord.remarks || 'No remarks provided.'}
                    </span>
                  </div>

                  <div className={styles.detailItemFull}>
                    <span className={styles.detailLabel}>Reason</span>
                    <span className={styles.detailValue} style={{ whiteSpace: 'pre-wrap' }}>
                      {detailRecord.reason}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.modalCloseBtn} onClick={() => setDetailRecord(null)}>
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Deletion Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className={styles.modalOverlay} onClick={() => setConfirmDelete(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={styles.modalBox}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.confirmBox}>
                <div className={`${styles.confirmIcon} ${styles.confirmIconRed}`}>
                  <Trash2 size={32} />
                </div>
                <h3 className={styles.cardTitle} style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                  Confirm Deletion
                </h3>
                <p className={styles.confirmMsg}>
                  Are you sure you want to delete this refund request? This action is permanent and cannot be undone.
                </p>

                <div className={styles.confirmActions}>
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => setConfirmDelete(null)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className={`${styles.confirmActionBtn} ${styles.dangerBtn}`}
                    onClick={handleDeleteConfirm}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Deleting...' : 'Delete Application'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Approval/Rejection Dialog Modal */}
      <AnimatePresence>
        {approvalModal.show && (
          <div className={styles.modalOverlay} onClick={() => setApprovalModal({ show: false, recordId: null, level: '', action: '', remarks: '' })}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={styles.modalBox}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  {approvalModal.action === 'approve' 
                    ? (approvalModal.level === 'Finance' ? 'Mark as Paid' : 'Approve Application') 
                    : 'Reject Application'}
                </h3>
                <button
                  className={styles.modalClose}
                  onClick={() => setApprovalModal({ show: false, recordId: null, level: '', action: '', remarks: '' })}
                >
                  <X size={16} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.detailItemFull}>
                  <p className={styles.confirmMsg} style={{ textAlign: 'left', marginBottom: '0.5rem' }}>
                    You are performing a <strong>{approvalModal.level}</strong> level <strong>{approvalModal.action === 'approve' ? 'approval' : 'rejection'}</strong>.
                  </p>
                  <label className={styles.label}>Provide Remarks / Comments (Optional)</label>
                  <textarea
                    className={styles.modalTextarea}
                    placeholder="Enter any comments, observations or reasons for this approval action..."
                    value={approvalModal.remarks}
                    onChange={(e) => setApprovalModal(prev => ({ ...prev, remarks: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.modalFooter} style={{ gap: '0.5rem' }}>
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setApprovalModal({ show: false, recordId: null, level: '', action: '', remarks: '' })}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  className={`${styles.confirmActionBtn} ${approvalModal.action === 'approve' ? styles.successBtn : styles.dangerBtn}`}
                  onClick={handleApprovalSubmit}
                  disabled={actionLoading}
                >
                  {actionLoading 
                    ? 'Processing...' 
                    : approvalModal.action === 'approve' 
                    ? (approvalModal.level === 'Finance' ? 'Confirm Payment' : 'Confirm Approval') 
                    : 'Confirm Rejection'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Approval Confirmation Modal */}
      <AnimatePresence>
        {showBulkApproveModal && (
          <div className={styles.modalOverlay} onClick={() => setShowBulkApproveModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={styles.modalBox}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.confirmBox}>
                <div className={`${styles.confirmIcon} ${styles.confirmIconGreen}`}>
                  <CheckCircle2 size={32} />
                </div>
                <h3 className={styles.cardTitle} style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                  Bulk Approve Refund Requests
                </h3>
                <p className={styles.confirmMsg}>
                  Are you sure you want to approve <strong>{selectedIds.length}</strong> selected refund application(s) at your assigned authorization level?
                </p>

                <div className={styles.confirmActions}>
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => setShowBulkApproveModal(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className={`${styles.confirmActionBtn} ${styles.successBtn}`}
                    onClick={handleBulkApprove}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className={styles.loadingSpinner} size={16} /> : null}
                    {actionLoading ? 'Processing Bulk Approvals...' : `Approve ${selectedIds.length} Application(s)`}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
