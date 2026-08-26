"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Users, Search, Loader2, FileText, AlertCircle, CheckCircle2, Edit2, Trash2, Plus, ChevronDown, X, Calendar, Info, Check, Building2, Percent, Printer } from 'lucide-react';
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

function formatIouDate(dateStr) {
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
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
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
    available_net_pay: null,
    month_name: ''
  });

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('10');

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
    if (!silent) {
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
          isDelegatedHod: res.data.isDelegatedHod || false,
          delegated_department_id: res.data.delegated_department_id || null,
          employee: res.data.employee || null,
        };
        setUserCtx(freshCtx);
      }
    } catch (err) {
      showToast('Failed to retrieve IOU records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStaffData();
      fetchRecords(false);
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
  const canSelectStaff = userCtx.isSuperAdmin || userCtx.isAdminStaff || userCtx.isHod || 
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
          available_net_pay: null,
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
    const canTake = limitDetails.can_take_iou !== undefined ? limitDetails.can_take_iou : (selectedStaff?.can_take_iou ?? 1);
    if (canTake === 0) {
      showToast('This employee is not eligible to take IOU.', 'error');
      return;
    }

    const requestedAmt = parseFloat(amount);
    const maxAllowed = limitDetails.max_limit || selectedStaff?.max_iou || 0;
    const alreadyUsed = limitDetails.used_amount || 0;
    const remainingLimit = limitDetails.remaining_limit !== undefined ? limitDetails.remaining_limit : maxAllowed;

    if (requestedAmt > remainingLimit) {
      if (alreadyUsed > 0) {
        showToast(`Requested amount (₦${fmt(requestedAmt)}) exceeds the remaining monthly limit of ₦${fmt(remainingLimit)} (₦${fmt(alreadyUsed)} already applied in ${limitDetails.month_name}).`, 'error');
      } else {
        showToast(`Requested amount (₦${fmt(requestedAmt)}) exceeds the maximum allowed limit of ₦${fmt(maxAllowed)}.`, 'error');
      }
      return;
    }

    // Net Pay check: The requested amount must not reduce available net pay to zero or negative
    const availableNetPay = limitDetails.available_net_pay !== undefined && limitDetails.available_net_pay !== null
      ? limitDetails.available_net_pay
      : null;

    if (availableNetPay !== null && (availableNetPay <= 0 || requestedAmt >= availableNetPay)) {
      const monthStr = limitDetails.month_name || 'this month';
      showToast(`Cannot apply for IOU: This employee available net pay for ${monthStr} can not be negative.`, 'error');
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
        max_iou: (record.gross_salary || 0) * 0.70,
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

    if (action === 'reject' && (!remarks || !remarks.trim())) {
      showToast('Remarks are compulsory when rejecting an IOU application.', 'error');
      return;
    }

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
  const remainingLimit = limitDetails.remaining_limit !== undefined ? limitDetails.remaining_limit : maxIouLimit;
  const canTake = limitDetails.can_take_iou !== undefined ? limitDetails.can_take_iou : (selectedStaff?.can_take_iou ?? 1);
  const availableNetPay = limitDetails.available_net_pay !== undefined && limitDetails.available_net_pay !== null
    ? limitDetails.available_net_pay
    : null;
  const projectedNetPay = availableNetPay !== null ? (availableNetPay - currentRequestAmount) : null;
  const isNetPayExceeded = availableNetPay !== null && currentRequestAmount > 0 && projectedNetPay <= 0;

  // Determine progress color based on percentage of max allowed limit used
  const limitPercent = maxIouLimit > 0 ? (totalPlannedAmount / maxIouLimit) * 100 : 0;
  let progressClass = styles.progressBarGreen;
  let textClass = styles.limitTextGreen;
  if (limitPercent > 80 && limitPercent <= 100) {
    progressClass = styles.progressBarYellow;
    textClass = styles.limitTextYellow;
  } else if (limitPercent > 100 || isNetPayExceeded) {
    progressClass = styles.progressBarRed;
    textClass = styles.limitTextRed;
  }

  // Filter and paginated records
  const filteredRecords = records.filter(r => {
    const empId = userCtx.employee ? (userCtx.employee.ID ?? userCtx.employee.id) : null;
    const isOwnRow = empId && String(r.staff_id) === String(empId);

    // If it is the user's own application or user is Super Admin, they can always see it
    if (isOwnRow || userCtx.isSuperAdmin) {
      // Apply date filters & search filters below
    } else {
      // Check role-based visibility conditions (additive)
      let visible = false;
      let hasRole = false;

      // 1. HOD rule: see records of staff in his department
      if (userCtx.isHod && userCtx.employee) {
        hasRole = true;
        const activeDeptId = userCtx.isDelegatedHod ? userCtx.delegated_department_id : userCtx.employee.departmentID;
        if (String(r.department_id) === String(activeDeptId)) {
          visible = true;
        }
      }

      // 2. HR Head rule: only see records that HOD has approved (exclude if user is Audit or Finance)
      const isHrHead = userCtx.isAdminStaff && !userCtx.isAuditStaff && !userCtx.isFinanceStaff;
      if (isHrHead) {
        hasRole = true;
        if (Number(r.hod_status) === 1) {
          visible = true;
        }
      }

      // 3. Audit Head rule: only see record that HR head has approved
      if (userCtx.isAuditStaff) {
        hasRole = true;
        if (Number(r.admin_status) === 1) {
          visible = true;
        }
      }

      // 4. Finance Head rule: only see records that Audit head has approved
      if (userCtx.isFinanceStaff) {
        hasRole = true;
        if (Number(r.audit_status) === 1) {
          visible = true;
        }
      }

      if (!hasRole || !visible) {
        return false;
      }
    }

    if (filterStartDate && r.iou_date < filterStartDate) {
      return false;
    }
    if (filterEndDate && r.iou_date > filterEndDate) {
      return false;
    }
    if (filterStatus !== 'all') {
      const isPending = Number(r.status) !== 1 && Number(r.status) !== 2;
      const isApproved = Number(r.status) === 1;
      const isRejected = Number(r.status) === 2;

      if (filterStatus === 'pending' && !isPending) return false;
      if (filterStatus === 'approved' && !isApproved) return false;
      if (filterStatus === 'rejected' && !isRejected) return false;
    }
    return (
      (r.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (r.staff_id && r.staff_id.toString().includes(searchQuery)) ||
      (r.reason?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (r.department && (r.department.toLowerCase() || '').includes(searchQuery.toLowerCase()))
    );
  });

  const totalPages = itemsPerPage === 'all'
    ? 1
    : Math.ceil(filteredRecords.length / parseInt(itemsPerPage, 10)) || 1;

  const displayedRecords = itemsPerPage === 'all'
    ? filteredRecords
    : filteredRecords.slice((currentPage - 1) * parseInt(itemsPerPage, 10), currentPage * parseInt(itemsPerPage, 10));

  const isFormDisabled = !canSelectStaff && selectedStaff && String(selectedStaff.id) !== String(userCtx.employee?.ID ?? userCtx.employee?.id);

  // Helper check to determine if a tier approval button should show
  const canRecommendHOD = (row) => {
    if (Number(row.status) !== 0 || Number(row.hod_status) !== 0) return false;
    if (userCtx.isSuperAdmin) return true;
    if (userCtx.isHod && userCtx.employee) {
      const empId = userCtx.employee.ID ?? userCtx.employee.id;
      const activeDeptId = userCtx.isDelegatedHod ? userCtx.delegated_department_id : userCtx.employee.departmentID;
      return String(row.department_id) === String(activeDeptId) || String(row.staff_id) === String(empId);
    }
    return false;
  };

  const canRecommendHR = (row) => {
    if (Number(row.status) !== 0 || Number(row.hod_status) !== 1 || Number(row.admin_status) !== 0) return false;
    const isHrHead = userCtx.isAdminStaff && !userCtx.isAuditStaff && !userCtx.isFinanceStaff;
    return userCtx.isSuperAdmin || isHrHead;
  };

  const canApproveAudit = (row) => {
    if (Number(row.status) !== 0 || Number(row.admin_status) !== 1 || Number(row.audit_status) !== 0) return false;
    return userCtx.isSuperAdmin || userCtx.isAuditStaff;
  };

  const canApproveFinance = (row) => {
    if (Number(row.status) !== 0 || Number(row.audit_status) !== 1 || Number(row.finance_status) !== 0) return false;
    return userCtx.isSuperAdmin || userCtx.isFinanceStaff;
  };

  const getApprovalLevel = (row) => {
    if (canRecommendHOD(row)) return 'HOD';
    if (canRecommendHR(row)) return 'HR';
    if (canApproveAudit(row)) return 'Audit';
    if (canApproveFinance(row)) return 'Finance';
    return null;
  };

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

      const actionUrl = `${API_BASE}/payroll/ious/${level.toLowerCase()}-approve/${id}?remarks=${encodeURIComponent('Bulk approved')}`;
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
      showToast(`Successfully approved ${successCount} IOU application(s).${failCount > 0 ? ` Failed: ${failCount}` : ''}`);
      if (typeof window !== 'undefined') {
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('hrms_apply_iou_limit_cache_')) {
            sessionStorage.removeItem(key);
          }
        });
      }
      setSelectedIds([]);
      fetchRecords(true);
    } else {
      showToast(`Failed to approve selected application(s).`, 'error');
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
      <div className={styles.header}>
        <h1 className={styles.title}>Apply for IOU</h1>
        <p className={styles.subtitle}>Submit salary IOUs. Requests are limited to a maximum of 50% of monthly salary for staff under active retention (or 70% after completing 20-month retention / custom configurations).</p>
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <div>
                              <span className={styles.staffName}>{staff.name}</span>
                              <span className={styles.dropdownItemSub}>Staff ID: {staff.id}</span>
                            </div>
                            {staff.is_retention_active && !staff.has_completed_retention ? (
                              <span style={{ fontSize: '0.68rem', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: '600' }}>
                                Retention (50% Limit)
                              </span>
                            ) : null}
                          </div>
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
                <label className={styles.label}>Salary Limit Status</label>
                <div className={styles.salaryIndicatorCard}>
                  {selectedStaff ? (
                    canTake === 0 ? (
                      <div style={{ color: '#991b1b', background: '#fee2e2', padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '0.85rem' }}>
                        <AlertCircle size={18} />
                        <span>This staff member is blocked / not eligible to take IOU.</span>
                      </div>
                    ) : (
                      <>
                        {/* Retention Notice for incomplete retention */}
                        {((limitDetails.is_retention_active && !limitDetails.has_completed_retention) || (selectedStaff?.is_retention_active && !selectedStaff?.has_completed_retention)) && (
                          <div style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1e40af',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0.4rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Info size={15} color="#2563eb" />
                              <span>Retention In Progress: Month {limitDetails.retention_months ?? selectedStaff?.retention_months ?? 0} of 20</span>
                            </div>
                            <span style={{
                              background: '#dbeafe',
                              color: '#1e40af',
                              padding: '0.1rem 0.45rem',
                              borderRadius: '999px',
                              fontSize: '0.7rem',
                              fontWeight: '700'
                            }}>
                              Capped at 50% of Salary
                            </span>
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.9, fontSize: '0.78rem' }}>
                            <span>Max Limit ({limitDetails.limit_percentage ?? selectedStaff?.limit_percentage ?? 70}%): <strong style={{ color: 'var(--primary)' }}>₦{fmt(maxIouLimit)}</strong></span>
                            {limitDetails.month_name && (
                              <span>Remaining Limit: <strong style={{ color: remainingLimit > 0 ? 'var(--primary)' : 'var(--danger)' }}>₦{fmt(remainingLimit)}</strong></span>
                            )}
                          </div>
                          {limitDetails.month_name && availableNetPay !== null && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', opacity: 0.85, fontSize: '0.78rem', paddingTop: '0.15rem' }}>
                              <span>Available Net Pay: <strong style={{ color: availableNetPay > 0 ? '#10b981' : '#ef4444' }}>₦{fmt(availableNetPay)}</strong></span>
                            </div>
                          )}
                        </div>
                        <div className={styles.progressBarContainer} style={{ marginTop: '0.4rem' }}>
                          <div
                            className={`${styles.progressBarFill} ${progressClass}`}
                            style={{ width: `${Math.min(100, (maxIouLimit > 0 ? (totalPlannedAmount / maxIouLimit) * 100 : 0))}%` }}
                          />
                        </div>
                        <div className={`${styles.limitText} ${textClass}`}>
                          {alreadyUsedAmount > 0 ? (
                            <span>Total request ({((totalPlannedAmount / (maxIouLimit || 1)) * 100).toFixed(1)}% of limit) = ₦{fmt(alreadyUsedAmount)} (applied) + ₦{fmt(currentRequestAmount)} (current)</span>
                          ) : (
                            <span>Requested amount is {((currentRequestAmount / (maxIouLimit || 1)) * 100).toFixed(1)}% of maximum allowed limit</span>
                          )}
                          {totalPlannedAmount > maxIouLimit && (
                            <span style={{ fontWeight: 700 }}>EXCEEDS ALLOWED LIMIT</span>
                          )}
                        </div>
                        {isNetPayExceeded && (
                          <div style={{ marginTop: '0.4rem', color: '#991b1b', background: '#fee2e2', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <AlertCircle size={14} />
                            <span>This employee available net pay for {limitDetails.month_name || 'this month'} can not be negative (₦{fmt(projectedNetPay)}).</span>
                          </div>
                        )}
                        {!isNetPayExceeded && currentRequestAmount > 0 && projectedNetPay !== null && (
                          <div style={{ marginTop: '0.3rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            Estimated Take-Home after IOU: <strong style={{ color: '#10b981' }}>₦{fmt(projectedNetPay)}</strong>
                          </div>
                        )}
                      </>
                    )
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
                  <NairaSign className={styles.inputIcon} size={16} />
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
                  disabled={saving || (totalPlannedAmount > maxIouLimit) || (selectedStaff && selectedStaff.has_uploaded_education === false)}
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
            {selectedStaff && selectedStaff.has_uploaded_education === false && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'right', fontWeight: '500' }}>
                Complete your documentation
              </p>
            )}
          </form>
        </div>
      </div>

      {/* Directory Records List */}
      <div className={`${styles.card} ${styles.printCard}`}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>IOU Applications Registry</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {selectedIds.length > 0 && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary} ${styles.noPrint}`}
                onClick={() => setShowBulkApproveModal(true)}
                disabled={actionLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.82rem', background: '#10b981', borderColor: '#10b981', color: '#fff' }}
              >
                {actionLoading ? <Loader2 className={styles.loadingSpinner} size={15} /> : <Check size={15} />}
                Approve Selected ({selectedIds.length})
              </button>
            )}
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.noPrint}`}
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
            >
              <Printer size={15} />
              Print IOU Record
            </button>
          </div>
        </div>

        {/* Search tool */}
        <div className={`${styles.searchBar} ${styles.noPrint}`}>
          <div className={styles.searchInputWrapper}>
            <Search className={styles.searchIcon} size={16} />
            <input
              type="text"
              placeholder="Search table by employee, department, reason..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.dateFilterGroup}>
            <span>From:</span>
            <input
              type="date"
              className={styles.dateInput}
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
            />
          </div>
          <div className={styles.dateFilterGroup}>
            <span>To:</span>
            <input
              type="date"
              className={styles.dateInput}
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
            />
          </div>
          <div className={styles.dateFilterGroup}>
            <span>Status:</span>
            <select
              className={styles.dateInput}
              style={{ minHeight: 'auto', padding: '0.4rem 0.5rem', cursor: 'pointer' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className={styles.dateFilterGroup}>
            <span>Per Page:</span>
            <select
              className={styles.dateInput}
              style={{ minHeight: 'auto', padding: '0.4rem 0.5rem', cursor: 'pointer', fontWeight: 600 }}
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="30">30 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
              <option value="all">All Records</option>
            </select>
          </div>
          {(filterStartDate || filterEndDate || filterStatus !== 'all' || searchQuery || itemsPerPage !== '10') && (
            <button
              type="button"
              className={styles.clearFiltersBtn}
              onClick={() => {
                setFilterStartDate('');
                setFilterEndDate('');
                setFilterStatus('all');
                setSearchQuery('');
                setItemsPerPage('10');
                setCurrentPage(1);
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* List Table */}
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 className={styles.loadingSpinner} size={28} />
              <p style={{ marginTop: '0.75rem' }}>Synchronizing payroll IOU records...</p>
            </div>
          ) : displayedRecords.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText className={styles.emptyIcon} size={32} />
              <p>No matching IOU application records found.</p>
            </div>
          ) : (
            <>
              {/* Screen Table (Hidden on print) */}
              <table className={`${styles.table} ${styles.noPrint}`}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
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
                        title="Select All Pending My Approval"
                      />
                    </th>
                    <th>Staff Profile</th>
                    <th>Dept.</th>
                    <th>Requested</th>
                    <th>Salary %</th>
                    <th>App Date</th>
                    <th>Status</th>
                    <th>Approval Statuses</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRecords.map((row) => {
                    const rowPending = row.status === 0;
                    const empId = userCtx.employee ? (userCtx.employee.ID ?? userCtx.employee.id) : null;
                    const isOwnRow = empId && String(row.staff_id) === String(empId);
                    const canEditRow = rowPending && Number(row.hod_status) !== 1 && (canSelectStaff || isOwnRow);
                    const canDeleteRow = rowPending && Number(row.hod_status) !== 1 && (canSelectStaff || isOwnRow);

                    return (
                      <tr key={row.id}>
                        <td>
                          {getApprovalLevel(row) ? (
                            <input
                              key={`chk-active-${row.id}`}
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
                            <input
                              key={`chk-disabled-${row.id}`}
                              type="checkbox"
                              checked={false}
                              readOnly
                              disabled
                              style={{ opacity: 0.3 }}
                            />
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
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span 
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                backgroundColor: (row.total_month_percentage || row.percentage_of_salary) > 50 
                                  ? 'rgba(239, 68, 68, 0.15)' 
                                  : (row.total_month_percentage || row.percentage_of_salary) > 40 
                                    ? 'rgba(245, 158, 11, 0.15)' 
                                    : 'rgba(16, 185, 129, 0.15)',
                                color: (row.total_month_percentage || row.percentage_of_salary) > 50 
                                  ? '#dc2626' 
                                  : (row.total_month_percentage || row.percentage_of_salary) > 40 
                                    ? '#d97706' 
                                    : '#059669',
                                border: (row.total_month_percentage || row.percentage_of_salary) > 50 
                                  ? '1px solid rgba(239, 68, 68, 0.3)' 
                                  : (row.total_month_percentage || row.percentage_of_salary) > 40 
                                    ? '1px solid rgba(245, 158, 11, 0.3)' 
                                    : '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                              title={`Requested: ${row.percentage_of_salary || 0}% of Monthly Salary`}
                            >
                              <span>{row.percentage_of_salary || 0}%</span>
                              <span style={{ fontSize: '0.72rem', opacity: 0.85, marginLeft: '3px' }} title={`Total Applied in Month: ${row.total_month_percentage}% (₦${fmt(row.total_collected_month)})`}>
                                (Total: {row.total_month_percentage}%)
                              </span>
                            </span>
                          </div>
                        </td>
                        <td>{formatIouDate(row.iou_date)}</td>
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

              {/* Print-only Table (All records, Hidden on screen) */}
              <table className={`${styles.table} ${styles.printOnlyTable}`}>
                <thead>
                  <tr>
                    <th>Staff Profile</th>
                    <th>Dept.</th>
                    <th>Requested</th>
                    <th>Salary %</th>
                    <th>App Date</th>
                    <th>Status</th>
                    <th>Approval Statuses</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className={styles.staffCell}>
                          <span className={styles.staffName}>{row.name}</span>
                          <span className={styles.staffFile}>Staff ID: {row.staff_id}</span>
                        </div>
                      </td>
                      <td>{row.department || '—'}</td>
                      <td style={{ fontWeight: 600 }}>₦{fmt(row.amount)}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{row.percentage_of_salary || 0}%</span>
                        <span style={{ fontSize: '0.75rem', color: '#475569', marginLeft: '4px' }}>
                          (Total: {row.total_month_percentage}%)
                        </span>
                      </td>
                      <td>{formatIouDate(row.iou_date)}</td>
                      <td>{getOverallBadge(row.status)}</td>
                      <td>
                        <div className={styles.tierBadgeContainer}>
                          {getTierBadge(row.hod_status, 'hod')}
                          {getTierBadge(row.admin_status, 'hr')}
                          {getTierBadge(row.audit_status, 'audit')}
                          {getTierBadge(row.finance_status, 'finance')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              <div className={`${styles.pagination} ${styles.noPrint}`}>
                <span className={styles.paginationText} style={{ fontWeight: 500 }}>
                  Showing {filteredRecords.length === 0 ? 0 : (itemsPerPage === 'all' ? 1 : (currentPage - 1) * parseInt(itemsPerPage, 10) + 1)} to {itemsPerPage === 'all' ? filteredRecords.length : Math.min(currentPage * parseInt(itemsPerPage, 10), filteredRecords.length)} of {filteredRecords.length} records {itemsPerPage !== 'all' && totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
                </span>
                
                {itemsPerPage !== 'all' && totalPages > 1 && (
                  <div className={styles.paginationButtons}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
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
                          style={{ minWidth: '32px', padding: '0.35rem 0.5rem', fontSize: '0.78rem' }}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Details View Modal */}
      <AnimatePresence mode="wait">
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
                    <span className={styles.detailLabel}>Staff ID</span>
                    <span className={styles.detailValue}>{detailRecord.staff_id}</span>
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
                    <span className={styles.detailValue}>
                      {detailRecord.percentage_of_salary || 0}% of Salary
                      <span style={{ display: 'block', color: '#059669', fontWeight: 600, fontSize: '0.8rem', marginTop: '2px' }}>
                        Total Applied in Month: {detailRecord.total_month_percentage}% (₦{fmt(detailRecord.total_collected_month)})
                      </span>
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Application Date</span>
                    <span className={styles.detailValue}>{formatIouDate(detailRecord.iou_date)}</span>
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
                    <span className={styles.detailLabel}>Audit Status Details</span>
                    <span className={styles.detailValue}>
                      {detailRecord.audit_status === 1 ? `Approved by ${detailRecord.audit_name || 'Audit Staff'} on ${detailRecord.audit_date || '—'}` : detailRecord.audit_status === 2 ? 'Rejected' : 'Pending'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Finance Status Details</span>
                    <span className={styles.detailValue}>
                      {detailRecord.finance_status === 1 ? `Paid by ${detailRecord.finance_name || 'Finance Staff'} on ${detailRecord.finance_date || '—'}` : detailRecord.finance_status === 2 ? 'Rejected' : 'Pending'}
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
      <AnimatePresence mode="wait">
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
      <AnimatePresence mode="wait">
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
                  <label className={styles.label}>
                    {approvalModal.action === 'reject' ? (
                      <span>Provide Rejection Remarks <strong style={{ color: '#ef4444' }}>* (Compulsory)</strong></span>
                    ) : (
                      <span>Provide Remarks / Comments (Optional)</span>
                    )}
                  </label>
                  <textarea
                    className={styles.modalTextarea}
                    placeholder={approvalModal.action === 'reject' ? "Please state the reason for rejecting this IOU application (compulsory)..." : "Enter any comments, observations or reasons for this approval action..."}
                    value={approvalModal.remarks}
                    onChange={(e) => setApprovalModal(prev => ({ ...prev, remarks: e.target.value }))}
                    style={approvalModal.action === 'reject' && !approvalModal.remarks?.trim() ? { borderColor: '#ef4444' } : {}}
                    required={approvalModal.action === 'reject'}
                  />
                  {approvalModal.action === 'reject' && !approvalModal.remarks?.trim() && (
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem', display: 'block' }}>
                      Please provide remarks before confirming rejection.
                    </span>
                  )}
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

      {/* Confirmation Bulk Approval Modal */}
      <AnimatePresence mode="wait">
        {showBulkApproveModal && (() => {
          const selectedLevels = Array.from(new Set(
            selectedIds
              .map(id => records.find(r => r.id === id))
              .filter(Boolean)
              .map(getApprovalLevel)
              .filter(Boolean)
          )).join(', ');

          return (
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
                  <div className={`${styles.confirmIcon}`} style={{ background: '#d1fae5', color: '#10b981' }}>
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className={styles.cardTitle} style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                    Confirm Bulk Approval
                  </h3>
                  <p className={styles.confirmMsg}>
                    Are you sure you want to approve the <strong>{selectedIds.length}</strong> selected IOU application(s)? This will recommend or finalize approvals at your authorized authorization tier level(s): <strong>{selectedLevels || 'N/A'}</strong>.
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
                      className={`${styles.confirmActionBtn}`}
                      style={{ background: '#10b981', color: '#fff' }}
                      onClick={handleBulkApprove}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Approving...' : 'Confirm Approve'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
