"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  DollarSign,
  Users,
  Search,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Plus,
  ChevronDown,
  X,
  Calendar,
  Info,
  Check,
  Building2,
  Percent,
} from 'lucide-react';
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

export default function ApplyIouPage() {
  // Loading & Toast States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

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
  
  // Approval Modal State
  const [approvalModal, setApprovalModal] = useState({
    show: false,
    recordId: null,
    level: '', // 'HOD', 'Finance', 'Admin'
    action: '', // 'approve', 'reject'
    remarks: '',
  });

  // Form Fields
  const [editId, setEditId] = useState(null);
  const [amount, setAmount] = useState('');
  const [iouDate, setIouDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [reason, setReason] = useState('');

  // Monthly Limit Tracking Details
  const [limitDetails, setLimitDetails] = useState({
    gross_salary: 0,
    max_limit: 0,
    used_amount: 0,
    remaining_limit: 0,
    month_name: ''
  });

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch staff list for dropdown
  const fetchStaffData = useCallback(async () => {
    const cacheKey = 'hrms_apply_iou_staff_cache';
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setStaffList(JSON.parse(cached));
          return;
        }
      } catch (err) {
        console.error('Failed to parse cached staff list:', err);
      }
    }

    const headers = buildHeaders();
    try {
      const staffRes = await axios.get(`${API_BASE}/payroll/ious/staff`, { headers });
      if (staffRes.data.status === 'success') {
        const freshData = staffRes.data.data || [];
        setStaffList(freshData);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(freshData));
        }
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  }, []);

  // Fetch submitted IOUs list
  const fetchRecords = useCallback(async (silent = false) => {
    const cacheKeyRecords = 'hrms_ious_records_cache';
    const cacheKeyCtx = 'hrms_apply_iou_user_ctx_cache';
    let hasCache = false;

    if (typeof window !== 'undefined') {
      const cachedRecords = sessionStorage.getItem(cacheKeyRecords);
      const cachedCtx = sessionStorage.getItem(cacheKeyCtx);
      if (cachedRecords && cachedCtx) {
        setRecords(JSON.parse(cachedRecords));
        setUserCtx(JSON.parse(cachedCtx));
        hasCache = true;
      } else if (cachedRecords) {
        setRecords(JSON.parse(cachedRecords));
      }
    }

    if (!silent && !hasCache) {
      setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/ious`, { headers });
      if (res.data.status === 'success') {
        const freshRecords = res.data.data || [];
        setRecords(freshRecords);
        const freshCtx = {
          isSuperAdmin: res.data.isSuperAdmin || false,
          isAdminStaff: res.data.isAdminStaff || false,
          isFinanceStaff: res.data.isFinanceStaff || false,
          isAuditStaff: res.data.isAuditStaff || false,
          isHod: res.data.isHod || false,
          employee: res.data.employee || null,
        };
        setUserCtx(freshCtx);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKeyRecords, JSON.stringify(freshRecords));
          sessionStorage.setItem(cacheKeyCtx, JSON.stringify(freshCtx));
        }
      }
    } catch (err) {
      showToast('Failed to retrieve IOU records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!(sessionStorage.getItem('hrms_ious_records_cache') && sessionStorage.getItem('hrms_apply_iou_staff_cache'));
    }
    const timer = setTimeout(() => {
      fetchStaffData();
      fetchRecords(hasCache);
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
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

  // Determine if active user can select other staff members (Admin privileges)
  const canSelectStaff = userCtx.isSuperAdmin || userCtx.isAdminStaff || 
    (mounted && typeof window !== 'undefined' && (() => {
      try {
        const role = JSON.parse(localStorage.getItem('hrms_role'));
        const roleName = role?.name?.toLowerCase() || '';
        return roleName === 'super admin' || roleName === 'system admin' || roleName === 'admin' || roleName === 'admin staff';
      } catch {
        return false;
      }
    })());

  // Prepopulate staff selection if user is not Admin/SuperAdmin
  useEffect(() => {
    const timer = setTimeout(() => {
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
            salary: 0.00,
            max_iou: 0.00
          });
          setDropdownSearch(fullName);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [staffList, userCtx, canSelectStaff]);

  const fetchUsedLimit = useCallback(async (staffId, date, excludeId, forceRefresh = false) => {
    if (!staffId || !date) return;
    const cacheKey = `hrms_apply_iou_limit_cache_${staffId}_${date}`;
    if (!forceRefresh && !excludeId && typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setLimitDetails(JSON.parse(cached));
        }
      } catch (err) {
        console.error('Failed to parse cached limit details:', err);
      }
    }

    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/ious/used-limit?staff_id=${staffId}&date=${date}${excludeId ? `&exclude_id=${excludeId}` : ''}`, { headers });
      if (res.data.status === 'success') {
        setLimitDetails(res.data.data);
        if (!excludeId && typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(res.data.data));
        }
      }
    } catch (err) {
      console.error('Failed to fetch monthly IOU limit details:', err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedStaff && iouDate) {
        fetchUsedLimit(selectedStaff.id, iouDate, editId);
      } else {
        setLimitDetails({
          gross_salary: 0,
          max_limit: 0,
          used_amount: 0,
          remaining_limit: 0,
          month_name: ''
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedStaff, iouDate, editId, fetchUsedLimit]);

  // Filter staff list
  const filteredStaff = dropdownSearch.trim() === ''
    ? staffList
    : staffList.filter(s => {
        const q = dropdownSearch.toLowerCase();
        const nameMatch = s.name ? String(s.name).toLowerCase().includes(q) : false;
        const fileMatch = s.fileNo ? String(s.fileNo).toLowerCase().includes(q) : false;
        return nameMatch || fileMatch;
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
    setIouDate(new Date().toISOString().split('T')[0]);
    setReason('');
  };

  // Submit/Apply for IOU
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
    if (!iouDate) {
      showToast('Please select the application date.', 'error');
      return;
    }
    if (!reason.trim()) {
      showToast('Please provide a reason for the IOU request.', 'error');
      return;
    }

    // Limit Validation check (cumulative monthly validation)
    const requestedAmt = parseFloat(amount);
    const maxAllowed = limitDetails.max_limit || selectedStaff.max_iou || 0;
    const alreadyUsed = limitDetails.used_amount || 0;
    const remainingLimit = limitDetails.remaining_limit !== undefined ? limitDetails.remaining_limit : maxAllowed;

    if (requestedAmt > remainingLimit) {
      if (alreadyUsed > 0) {
        showToast(`Requested amount (₦${fmt(requestedAmt)}) exceeds the remaining monthly limit of ₦${fmt(remainingLimit)} (₦${fmt(alreadyUsed)} already applied in ${limitDetails.month_name}).`, 'error');
      } else {
        showToast(`Requested amount (₦${fmt(requestedAmt)}) exceeds the 50% limit of ₦${fmt(maxAllowed)}.`, 'error');
      }
      return;
    }

    setSaving(true);
    const headers = buildHeaders();
    const payload = {
      id: editId,
      staff_id: selectedStaff.id,
      amount: requestedAmt,
      reason: reason.trim(),
      iou_date: iouDate,
      repayment_date: null,
    };

    try {
      const res = await axios.post(`${API_BASE}/payroll/ious`, payload, { headers });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'IOU record saved successfully.');
        if (typeof window !== 'undefined') {
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('hrms_apply_iou_limit_cache_')) {
              sessionStorage.removeItem(key);
            }
          });
        }
        handleClearForm();
        fetchRecords(true); // silent refresh
      } else {
        showToast(res.data.message || 'An error occurred.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to save IOU application.';
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
      // Fallback in case staff is not in the cached drop-down list yet
      const staffObj = {
        id: record.staff_id,
        name: record.name || `${record.surname} ${record.first_name}`,
        fileNo: record.fileNo || '',
        salary: record.gross_salary || 0,
        max_iou: (record.gross_salary || 0) * 0.50,
      };
      setSelectedStaff(staffObj);
      setDropdownSearch(staffObj.name);
    }

    setAmount(record.amount);
    setIouDate(record.iou_date);
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
      const res = await axios.delete(`${API_BASE}/payroll/ious/${id}`, { headers });
      if (res.data.status === 'success') {
        showToast('IOU application deleted successfully.');
        if (typeof window !== 'undefined') {
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('hrms_apply_iou_limit_cache_')) {
              sessionStorage.removeItem(key);
            }
          });
        }
        setConfirmDelete(null);
        fetchRecords(true); // silent sync
        if (selectedStaff && iouDate) {
          fetchUsedLimit(selectedStaff.id, iouDate, editId, true);
        }
      } else {
        setRecords(originalRecords); // rollback
        showToast(res.data.message || 'Deletion failed.', 'error');
      }
    } catch (err) {
      setRecords(originalRecords); // rollback
      showToast('Failed to delete IOU application.', 'error');
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
            if (level === 'Finance') {
              updated.finance_status = 1;
              updated.status = 1; // overall approved
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
    const actionUrl = `${API_BASE}/payroll/ious/${level.toLowerCase()}-${action}/${recordId}?remarks=${encodeURIComponent(remarks)}`;

    try {
      const res = await axios.get(actionUrl, { headers });
      if (res.data.status === 'success') {
        showToast(res.data.message || `IOU successfully ${action === 'approve' ? 'recommended/approved' : 'rejected'}.`);
        if (typeof window !== 'undefined') {
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('hrms_apply_iou_limit_cache_')) {
              sessionStorage.removeItem(key);
            }
          });
        }
        setApprovalModal({ show: false, recordId: null, level: '', action: '', remarks: '' });
        fetchRecords(true);
        if (selectedStaff && iouDate) {
          fetchUsedLimit(selectedStaff.id, iouDate, editId, true);
        }
      } else {
        setRecords(originalRecords); // rollback
        showToast(res.data.message || 'Approval action failed.', 'error');
      }
    } catch (err) {
      setRecords(originalRecords); // rollback
      const msg = err.response?.data?.message ?? 'Failed to process IOU action.';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper values for Progress Bar & Limits
  const grossSalary = limitDetails.gross_salary || selectedStaff?.salary || 0;
  const maxIouLimit = limitDetails.max_limit || selectedStaff?.max_iou || 0;
  const alreadyUsedAmount = limitDetails.used_amount || 0;
  const currentRequestAmount = parseFloat(amount) || 0;
  const totalPlannedAmount = alreadyUsedAmount + currentRequestAmount;
  const percentUsed = grossSalary > 0 ? (totalPlannedAmount / grossSalary) * 100 : 0;
  const remainingLimit = limitDetails.remaining_limit !== undefined ? limitDetails.remaining_limit : maxIouLimit;

  // Determine progress color
  let progressClass = styles.progressBarGreen;
  let textClass = styles.limitTextGreen;
  if (percentUsed > 40 && percentUsed <= 50) {
    progressClass = styles.progressBarYellow;
    textClass = styles.limitTextYellow;
  } else if (percentUsed > 50) {
    progressClass = styles.progressBarRed;
    textClass = styles.limitTextRed;
  }

  // Filter and paginated records
  const filteredRecords = records.filter(r => {
    if (selectedStaff && String(r.staff_id) !== String(selectedStaff.id)) {
      return false;
    }
    return (
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.fileNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const isFormDisabled = !canSelectStaff && selectedStaff && String(selectedStaff.id) !== String(userCtx.employee?.ID ?? userCtx.employee?.id);

  // Helper check to determine if a tier approval button should show
  const canRecommendHOD = (row) => {
    if (row.status !== 0 || row.hod_status !== 0) return false;
    if (canSelectStaff) return true;
    if (userCtx.isHod && userCtx.employee) {
      // Must belong to HOD's department
      const empId = userCtx.employee.ID ?? userCtx.employee.id;
      return row.department === userCtx.employee.department || String(row.staff_id) === String(empId);
    }
    return false;
  };

  const canRecommendHR = (row) => {
    if (row.status !== 0 || row.hod_status !== 1 || row.admin_status !== 0) return false;
    return canSelectStaff;
  };

  const canApproveFinance = (row) => {
    if (row.status !== 0 || row.admin_status !== 1 || row.finance_status !== 0) return false;
    return canSelectStaff || userCtx.isFinanceStaff;
  };

  // Helper for overall application status badge mapping
  const getOverallBadge = (status) => {
    if (status === 1) return <span className={`${styles.badge} ${styles.badgeApproved}`}>Approved</span>;
    if (status === 2) return <span className={`${styles.badge} ${styles.badgeRejected}`}>Rejected</span>;
    return <span className={`${styles.badge} ${styles.badgePending}`}>Pending</span>;
  };

  // Helper for tier status representation
  const getTierBadge = (status, type) => {
    const label = type === 'hod' ? 'HOD' : type === 'hr' ? 'HR' : 'Fin.';
    const badgeStyle = type === 'hod' ? styles.badgeHodApproved : type === 'hr' ? styles.badgeHrApproved : styles.badgeFinanceApproved;
    if (status === 1) {
      return (
        <span className={styles.tierBadgeItem}>
          <span className={styles.tierLabel}>{label}:</span>
          <span className={`${styles.badge} ${badgeStyle}`} style={{ padding: '0.1rem 0.4rem', fontSize: '0.68rem' }}>Approved</span>
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
      <div className={styles.header}>
        <h1 className={styles.title}>Apply for IOU</h1>
        <p className={styles.subtitle}>Submit salary IOUs. Requests are limited to a maximum of 50% of the {"employee's"} gross monthly salary.</p>
      </div>

      {/* Form Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            {editId ? 'Modify IOU Application' : 'New IOU Application'}
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
                      placeholder={!canSelectStaff ? "Readonly employee context" : "Search staff by name or file number..."}
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
                          <span className={styles.dropdownItemSub}>File No: {staff.fileNo}</span>
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

              {/* Dynamic Limit Status display */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Salary Limit Status (50% Maximum)</label>
                <div className={styles.salaryIndicatorCard}>
                  {selectedStaff ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Gross Salary: <strong>₦{fmt(grossSalary)}</strong></span>
                          <span>Max IOU Limit: <strong>₦{fmt(maxIouLimit)}</strong></span>
                        </div>
                        {limitDetails.month_name && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.85, fontSize: '0.78rem', borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                            <span>Already Applied ({limitDetails.month_name}): <strong>₦{fmt(alreadyUsedAmount)}</strong></span>
                            <span>Remaining Limit: <strong style={{ color: remainingLimit > 0 ? 'var(--primary)' : 'var(--danger)' }}>₦{fmt(remainingLimit)}</strong></span>
                          </div>
                        )}
                      </div>
                      <div className={styles.progressBarContainer}>
                        <div
                          className={`${styles.progressBarFill} ${progressClass}`}
                          style={{ width: `${Math.min(100, percentUsed * 2)}%` }}
                        />
                      </div>
                      <div className={`${styles.limitText} ${textClass}`}>
                        {alreadyUsedAmount > 0 ? (
                          <span>Total request ({percentUsed.toFixed(1)}% of salary) = ₦{fmt(alreadyUsedAmount)} (applied) + ₦{fmt(currentRequestAmount)} (current)</span>
                        ) : (
                          <span>Requested amount is {percentUsed.toFixed(1)}% of gross monthly salary</span>
                        )}
                        {totalPlannedAmount > maxIouLimit && (
                          <span style={{ fontWeight: 700 }}>EXCEEDS 50% LIMIT</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Please select a staff member to compute limits.
                    </span>
                  )}
                </div>
              </div>

              {/* IOU Amount */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Requested IOU Amount (₦) *</label>
                <div className={styles.inputGroup}>
                  <DollarSign className={styles.inputIcon} size={16} />
                  <input
                    type="number"
                    step="0.01"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="Enter IOU amount value"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>

              {/* IOU Application Date */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Application Date *</label>
                <div className={styles.inputGroup}>
                  <Calendar className={styles.inputIcon} size={16} />
                  <input
                    type="date"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    value={iouDate}
                    onChange={(e) => setIouDate(e.target.value)}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>

              {/* Reason Description */}
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.label}>Reason / Purpose for Request *</label>
                <textarea
                  className={styles.input}
                  rows={2}
                  placeholder="State the purpose for taking this IOU application..."
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
                  disabled={saving || (percentUsed > 50)}
                >
                  {saving ? (
                    <>
                      <Loader2 className={styles.loadingSpinner} size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      {editId ? 'Update Application' : 'Submit Request'}
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Directory Records List */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>IOU Applications Registry</h2>
        </div>

        {/* Search tool */}
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <Search className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search table by employee, department, reason..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* List Table */}
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 className={styles.loadingSpinner} size={28} />
              <p style={{ marginTop: '0.75rem' }}>Synchronizing payroll IOU records...</p>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText className={styles.emptyIcon} size={32} />
              <p>No matching IOU application records found.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Staff Profile</th>
                    <th>Dept.</th>
                    <th>Requested</th>
                    <th>Limit Check</th>
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

                    return (
                      <tr key={row.id}>
                        <td>
                          <div className={styles.staffCell}>
                            <span className={styles.staffName}>{row.name}</span>
                            <span className={styles.staffFile}>{row.fileNo}</span>
                          </div>
                        </td>
                        <td>{row.department || '—'}</td>
                        <td style={{ fontWeight: 600 }}>₦{fmt(row.amount)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Percent size={12} className="text-secondary" />
                            <span>{row.percentage_of_salary}%</span>
                          </div>
                        </td>
                        <td>{row.iou_date}</td>
                        <td>{getOverallBadge(row.status)}</td>
                        <td>
                          <div className={styles.tierBadgeContainer}>
                            {getTierBadge(row.hod_status, 'hod')}
                            {getTierBadge(row.admin_status, 'hr')}
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

                            {/* Approve & Recommend workflows */}
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

                            {canApproveFinance(row) && (
                              <div style={{ display: 'flex', gap: '0.2rem' }}>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.approveBtn}`}
                                  title="Finance Approve"
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

              {/* Client Pagination */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <span className={styles.paginationText}>
                    Showing {startIndex + 1} to {Math.min(filteredRecords.length, startIndex + itemsPerPage)} of {filteredRecords.length} records
                  </span>
                  <div className={styles.paginationButtons}>
                    <button
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                    >
                      Prev
                    </button>
                    <button
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      Next
                    </button>
                  </div>
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
                <h3 className={styles.modalTitle}>IOU Application Details</h3>
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
                    <span className={styles.detailLabel}>File Number</span>
                    <span className={styles.detailValue}>{detailRecord.fileNo}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Department</span>
                    <span className={styles.detailValue}>{detailRecord.department || '—'}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Requested Amount</span>
                    <span className={styles.detailValue} style={{ fontWeight: 700 }}>₦{fmt(detailRecord.amount)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Salary % Percentage</span>
                    <span className={styles.detailValue}>{detailRecord.percentage_of_salary}% of Monthly Gross Salary</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Application Date</span>
                    <span className={styles.detailValue}>{detailRecord.iou_date}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Overall Status</span>
                    <span className={styles.detailValue}>{getOverallBadge(detailRecord.status)}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>HOD Status Details</span>
                    <span className={styles.detailValue}>
                      {detailRecord.hod_status === 1 ? `Approved by ${detailRecord.hod_name || 'HOD'} on ${detailRecord.hod_date || '—'}` : detailRecord.hod_status === 2 ? 'Rejected' : 'Pending'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>HR Status Details</span>
                    <span className={styles.detailValue}>
                      {detailRecord.admin_status === 1 ? `Approved by ${detailRecord.admin_name || 'HR Admin'} on ${detailRecord.admin_date || '—'}` : detailRecord.admin_status === 2 ? 'Rejected' : 'Pending'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Finance Status Details</span>
                    <span className={styles.detailValue}>
                      {detailRecord.finance_status === 1 ? `Approved by ${detailRecord.finance_name || 'Finance Staff'} on ${detailRecord.finance_date || '—'}` : detailRecord.finance_status === 2 ? 'Rejected' : 'Pending'}
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
                  Are you sure you want to delete this IOU application request? This action is permanent and cannot be undone.
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
                  {approvalModal.action === 'approve' ? 'Approve Application' : 'Reject Application'}
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
                  {actionLoading ? 'Processing...' : approvalModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
