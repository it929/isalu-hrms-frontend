"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Users, Search, Loader2, FileText, AlertCircle, CheckCircle2, Edit2, Trash2, Plus, Settings, Calendar, Power, Upload } from 'lucide-react';
import NairaSign from '@/components/ui/NairaSign';
import styles from '../apply-coop-loan/page.module.css';

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

export default function OtherDeductionSetupPage() {
  // UI & Loading States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [setups, setSetups] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown Autocomplete Staff State
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const dropdownRef = useRef(null);
  const [staffNetPay, setStaffNetPay] = useState(null);
  const [loadingNetPay, setLoadingNetPay] = useState(false);

  // User Context State
  const [userCtx, setUserCtx] = useState({
    isSuperAdmin: false,
    isHod: false,
    isAdminStaff: false,
    isAuditStaff: false,
    employee: null,
  });

  // Modal States
  const [confirmAction, setConfirmAction] = useState(null); // { type, id, label }
  const [actionLoading, setActionLoading] = useState(false);

  // Form Fields
  const [editSetupId, setEditSetupId] = useState(null);
  const [calcMode, setCalcMode] = useState('amount'); // 'amount' (Normal Amount Setup) or 'days' (Day Deduction Setup)
  const [deductionDays, setDeductionDays] = useState('');
  const [staffSalaryInfo, setStaffSalaryInfo] = useState(null);
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [deductionType, setDeductionType] = useState('one_time'); // 'one_time' or 'spread'
  const [totalAmount, setTotalAmount] = useState('');
  const [durationMonths, setDurationMonths] = useState('');
  const [monthlyDeduction, setMonthlyDeduction] = useState('');
  const [balanceRemaining, setBalanceRemaining] = useState('');
  const [startMonth, setStartMonth] = useState(''); // Format: YYYY-MM
  const [endMonth, setEndMonth] = useState(''); // Format: YYYY-MM
  const [remarks, setRemarks] = useState('');
  const [isActive, setIsActive] = useState(1);

  // Import File Ref
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('10');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch static staff data once on mount
  const fetchStaffData = useCallback(async () => {
    const cacheKeyStaff = 'hrms_coop_loans_staff_cache';
    if (typeof window !== 'undefined') {
      const cachedStaff = sessionStorage.getItem(cacheKeyStaff);
      if (cachedStaff) {
        setStaffList(JSON.parse(cachedStaff));
        return;
      }
    }
    const headers = buildHeaders();
    try {
      const staffRes = await axios.get(`${API_BASE}/payroll/coop-loans/staff`, { headers });
      if (staffRes.data.status === 'success') {
        const freshStaff = staffRes.data.data || [];
        setStaffList(freshStaff);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKeyStaff, JSON.stringify(freshStaff));
        }
      }
    } catch (err) {
      console.error('Failed to retrieve staff list:', err);
    }
  }, []);

  // Fetch dynamic other setups list
  const fetchSetups = useCallback(async (silent = false) => {
    const cacheKeySetups = 'hrms_other_deduction_setups_cache';
    let hasCache = false;

    if (typeof window !== 'undefined') {
      const cachedSetups = sessionStorage.getItem(cacheKeySetups);
      if (cachedSetups) {
        setSetups(JSON.parse(cachedSetups));
        hasCache = true;
      }
    }

    if (!silent && !hasCache) {
      setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/other-deduction-setups`, { headers });
      if (res.data.status === 'success') {
        const freshData = res.data.data || [];
        setSetups(freshData);
        setUserCtx({
          isSuperAdmin: res.data.isSuperAdmin || false,
          isHod: res.data.isHod || false,
          isAdminStaff: res.data.isAdminStaff || false,
          isAuditStaff: res.data.isAuditStaff || false,
          employee: res.data.employee || null,
        });
        if (typeof window !== 'undefined') sessionStorage.setItem(cacheKeySetups, JSON.stringify(freshData));
      }
    } catch (err) {
      showToast('Failed to retrieve other setups.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!(sessionStorage.getItem('hrms_other_deduction_setups_cache') && sessionStorage.getItem('hrms_coop_loans_staff_cache'));
    }
    const timer = setTimeout(() => {
      fetchStaffData();
      fetchSetups(hasCache);
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [fetchStaffData, fetchSetups]);

  // Exact days in the selected month
  const daysInSelectedMonth = useMemo(() => {
    if (!startMonth) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    }
    const parts = startMonth.split('-');
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return new Date(y, m, 0).getDate();
    }
    return 30;
  }, [startMonth]);

  // Effective daily salary based on actual calendar days
  const effectiveDailySalary = useMemo(() => {
    if (staffSalaryInfo && staffSalaryInfo.monthly_salary > 0 && daysInSelectedMonth > 0) {
      return staffSalaryInfo.monthly_salary / daysInSelectedMonth;
    }
    return staffSalaryInfo?.daily_salary || 0;
  }, [staffSalaryInfo, daysInSelectedMonth]);

  // Dynamic calculations for Monthly Deduction and End Month in Amount Mode
  useEffect(() => {
    if (calcMode === 'amount') {
      if (deductionType === 'one_time') {
        const amount = parseFloat(totalAmount);
        if (!isNaN(amount) && amount > 0) {
          setMonthlyDeduction(amount.toFixed(2));
        } else {
          setMonthlyDeduction('');
        }
      } else {
        const amount = parseFloat(totalAmount);
        const months = parseInt(durationMonths);
        if (!isNaN(amount) && amount > 0 && !isNaN(months) && months > 0) {
          setMonthlyDeduction((amount / months).toFixed(2));
        } else {
          setMonthlyDeduction('');
        }
      }
    }
  }, [totalAmount, durationMonths, deductionType, calcMode]);

  // Dynamic calculation for Days Mode
  useEffect(() => {
    if (calcMode === 'days') {
      const days = parseFloat(deductionDays);
      if (!isNaN(days) && days > 0 && effectiveDailySalary > 0) {
        const computedAmt = (days * effectiveDailySalary).toFixed(2);
        setTotalAmount(computedAmt);
        setMonthlyDeduction(computedAmt);
        setBalanceRemaining(computedAmt);
        setDeductionType('one_time');
        setDurationMonths('1');
        setEndMonth(startMonth);
      } else if (isNaN(days) || days <= 0) {
        setTotalAmount('');
        setMonthlyDeduction('');
        setBalanceRemaining('');
      }
    }
  }, [calcMode, deductionDays, effectiveDailySalary, startMonth]);

  useEffect(() => {
    if (calcMode === 'days' || deductionType === 'one_time') {
      setEndMonth(startMonth);
    } else {
      const months = parseInt(durationMonths);
      if (startMonth && !isNaN(months) && months > 0) {
        const parts = startMonth.split('-');
        if (parts.length === 2) {
          const y = parseInt(parts[0]);
          const m = parseInt(parts[1]);
          const date = new Date(y, m - 1, 1);
          date.setMonth(date.getMonth() + months - 1);
          const nextY = date.getFullYear();
          const nextM = String(date.getMonth() + 1).padStart(2, '0');
          setEndMonth(`${nextY}-${nextM}`);
        }
      } else {
        setEndMonth('');
      }
    }
  }, [startMonth, durationMonths, deductionType, calcMode]);

  const isDeductionExceedingNet = useMemo(() => {
    if (!staffNetPay || staffNetPay.amount === null || isNaN(parseFloat(staffNetPay.amount))) return false;
    const net = parseFloat(staffNetPay.amount);
    const deduct = parseFloat(monthlyDeduction);
    if (isNaN(deduct) || deduct <= 0) return false;
    return deduct > net;
  }, [staffNetPay, monthlyDeduction]);

  // Click outside listener for staff dropdown autocomplete
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchStaffNetPay = useCallback(async (staffId) => {
    setLoadingNetPay(true);
    try {
      const headers = buildHeaders();
      const res = await axios.get(`${API_BASE}/payroll/staff-netpay/${staffId}`, { headers });
      if (res.data.status === 'success') {
        setStaffNetPay({
          amount: res.data.net_pay,
          grossPay: res.data.gross_pay,
          month: res.data.month,
          year: res.data.year,
          isEstimated: res.data.is_estimated
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

  const fetchStaffSalary = useCallback(async (staffId, monthStr) => {
    setLoadingSalary(true);
    try {
      const headers = buildHeaders();
      let monthParam = '';
      let yearParam = '';
      if (monthStr && monthStr.includes('-')) {
        const [y, m] = monthStr.split('-');
        yearParam = y;
        monthParam = m;
      }
      const res = await axios.get(`${API_BASE}/payroll/other-deduction-setups/staff-salary/${staffId}?month=${monthParam}&year=${yearParam}`, { headers });
      if (res.data.status === 'success') {
        setStaffSalaryInfo(res.data.data);
      } else {
        setStaffSalaryInfo(null);
      }
    } catch (err) {
      console.error('Failed to fetch staff salary:', err);
      setStaffSalaryInfo(null);
    } finally {
      setLoadingSalary(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStaff) {
      fetchStaffNetPay(selectedStaff.id);
      fetchStaffSalary(selectedStaff.id, startMonth);
    } else {
      setStaffNetPay(null);
      setStaffSalaryInfo(null);
    }
  }, [selectedStaff, startMonth, fetchStaffNetPay, fetchStaffSalary]);

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setShowDropdown(false);
  };

  const handleClearForm = () => {
    setEditSetupId(null);
    setSelectedStaff(null);
    setDropdownSearch('');
    setCalcMode('amount');
    setDeductionDays('');
    setStaffSalaryInfo(null);
    setDeductionType('one_time');
    setTotalAmount('');
    setDurationMonths('');
    setMonthlyDeduction('');
    setBalanceRemaining('');
    setStartMonth(getCurrentMonthStr());
    setEndMonth(getCurrentMonthStr());
    setRemarks('');
    setIsActive(1);
  };

  // Submit setup configuration
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }

    if (calcMode === 'days') {
      const days = parseFloat(deductionDays);
      if (isNaN(days) || days <= 0) {
        showToast('Please enter a valid number of days to deduct (e.g. 0.5, 1, 2, 3).', 'error');
        return;
      }
    }

    const amt = parseFloat(totalAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid total deduction amount.', 'error');
      return;
    }

    let months = 1;
    if (calcMode === 'amount' && deductionType === 'spread') {
      months = parseInt(durationMonths);
      if (isNaN(months) || months <= 0) {
        showToast('Please enter a valid duration in months.', 'error');
        return;
      }
    }

    if (!startMonth) {
      showToast('Please select a start month / payroll period.', 'error');
      return;
    }

    if (!remarks || !remarks.trim()) {
      showToast('Please enter the Remarks (Reason / Description) for this penalty deduction.', 'error');
      return;
    }

    const monthlyAmt = parseFloat(monthlyDeduction);
    if (staffNetPay && staffNetPay.amount !== null && !isNaN(parseFloat(staffNetPay.amount))) {
      const currentAvailableNet = parseFloat(staffNetPay.amount);
      if (monthlyAmt > currentAvailableNet) {
        showToast(`Deduction declined: Monthly deduction of ₦${monthlyAmt.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} exceeds staff's available Net Pay (₦${currentAvailableNet.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Net pay cannot be negative.`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        id: editSetupId,
        staffId: selectedStaff.id,
        calculation_mode: calcMode,
        deduction_type: calcMode === 'days' ? 'one_time' : deductionType,
        deduction_days: calcMode === 'days' ? parseFloat(deductionDays) : null,
        daily_rate: calcMode === 'days' ? effectiveDailySalary : null,
        monthly_salary: calcMode === 'days' ? (staffSalaryInfo?.monthly_salary || 0) : null,
        days_in_month: calcMode === 'days' ? daysInSelectedMonth : null,
        total_amount: amt,
        duration_months: calcMode === 'days' ? 1 : months,
        monthly_deduction: parseFloat(monthlyDeduction),
        balance_remaining: (!editSetupId || balanceRemaining === '' || isNaN(parseFloat(balanceRemaining)) || parseFloat(balanceRemaining) <= 0)
          ? amt
          : parseFloat(balanceRemaining),
        start_month: startMonth,
        end_month: calcMode === 'days' ? startMonth : endMonth,
        remarks: remarks.trim() || null,
        is_active: isActive,
      };

      const res = await axios.post(`${API_BASE}/payroll/other-deduction-setups`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Other deduction saved successfully.');
        handleClearForm();
        fetchSetups(true);
      } else {
        showToast(res.data.message || 'Failed to save configuration.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error saving configuration.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Populate form for edit
  const handleEdit = (setup) => {
    setEditSetupId(setup.id);
    const staff = staffList.find(s => s.id === setup.staffId);
    if (staff) {
      setSelectedStaff(staff);
      setDropdownSearch(staff.name);
    } else {
      setSelectedStaff({ id: setup.staffId, name: setup.name || 'Unknown Staff' });
      setDropdownSearch(setup.name || 'Unknown Staff');
    }

    const mode = setup.calculation_mode === 'days' || (setup.deduction_days && parseFloat(setup.deduction_days) > 0) ? 'days' : 'amount';
    setCalcMode(mode);
    setDeductionDays(setup.deduction_days ? String(setup.deduction_days) : '');
    setDeductionType(setup.deduction_type || 'one_time');
    setTotalAmount(setup.total_amount);
    setDurationMonths(setup.deduction_type === 'spread' ? setup.duration_months : '');
    setMonthlyDeduction(setup.monthly_deduction);
    setBalanceRemaining(setup.balance_remaining);
    setStartMonth(setup.start_month);
    setEndMonth(setup.end_month);
    setRemarks(setup.remarks || '');
    setIsActive(setup.is_active);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle status
  const handleToggleStatus = async (id) => {
    try {
      const res = await axios.post(`${API_BASE}/payroll/other-deduction-setups/toggle/${id}`, {}, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        fetchSetups(true);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to toggle status.', 'error');
    }
  };

  // Delete configuration
  const handleDelete = (id) => {
    setConfirmAction({ type: 'delete', id, label: 'Delete Penalty Deduction Setup' });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    setActionLoading(true);

    try {
      if (type === 'delete') {
        const res = await axios.delete(`${API_BASE}/payroll/other-deduction-setups/${id}`, {
          headers: buildHeaders()
        });
        if (res.data.status === 'success') {
          showToast(res.data.message || 'Setup deleted successfully.', 'success');
          fetchSetups(true);
        }
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error processing request.', 'error');
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  // Drag-and-drop Excel upload handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      showToast('Unsupported format. Please upload an Excel (.xlsx, .xls) or CSV file.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setImporting(true);

    try {
      const res = await axios.post(`${API_BASE}/payroll/other-deduction-setups/import`, formData, {
        headers: {
          ...buildHeaders(),
          'Content-Type': 'multipart/form-data',
        }
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Bulk configurations imported successfully.');
        fetchSetups(true);
      } else {
        showToast(res.data.message || 'Bulk import failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error processing file.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const filteredStaff = dropdownSearch.trim() === ''
    ? staffList
    : staffList.filter(s =>
        s.name?.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        String(s.id).includes(dropdownSearch) ||
        s.department?.toLowerCase().includes(dropdownSearch.toLowerCase())
      );

  const filteredSetups = setups.filter(s => {
    if (selectedStaff && s.staffId !== selectedStaff.id) {
      return false;
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return s.name?.toLowerCase().includes(q) ||
      String(s.staffId).includes(q) ||
      (s.department && s.department.toLowerCase().includes(q)) ||
      (s.remarks && s.remarks.toLowerCase().includes(q));
  });

  const totalPages = itemsPerPage === 'all'
    ? 1
    : Math.ceil(filteredSetups.length / parseInt(itemsPerPage, 10)) || 1;
  const paginatedSetups = itemsPerPage === 'all'
    ? filteredSetups
    : filteredSetups.slice(
        (currentPage - 1) * parseInt(itemsPerPage, 10),
        currentPage * parseInt(itemsPerPage, 10)
      );

  const checkAdminPrivilege = () => {
    if (typeof window === 'undefined') return false;
    try {
      const role = JSON.parse(localStorage.getItem('hrms_role'));
      const roleName = role?.name?.toLowerCase() || '';
      return roleName === 'super admin' || roleName === 'system admin' || roleName === 'admin' || roleName === 'admin staff' || role.id === 1 || role.id === 48;
    } catch {
      return false;
    }
  };

  const isConfigurator = true;

  if (!mounted) {
    return (
      <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Penalty Deduction Setup</h1>
        <p className={styles.subtitle}>Configure penalty deductions from employee salaries, supporting both one-time deductions and monthly spreading, as well as bulk spreadsheet importing.</p>
      </div>

      {isConfigurator && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Setup Form */}
          <div className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{editSetupId ? 'Modify Penalty Deduction Setup' : 'Create Penalty Deduction Setup'}</h2>
            </div>
            <div className={styles.cardBody}>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Autocomplete Select Staff */}
                  <div className={styles.formGroup} ref={dropdownRef}>
                    <label className={styles.label}>Select Staff Member *</label>
                    <div className={styles.dropdownContainer}>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Search by name, staff ID..."
                        value={dropdownSearch}
                        onChange={(e) => {
                          setDropdownSearch(e.target.value);
                          setShowDropdown(true);
                          if (selectedStaff && e.target.value !== selectedStaff.name) {
                            setSelectedStaff(null);
                          }
                        }}
                        onFocus={() => setShowDropdown(true)}
                      />
                      {showDropdown && (
                        <ul className={styles.dropdownList}>
                           {filteredStaff.length > 0 ? (
                            filteredStaff.map((staff) => (
                              <li
                                key={staff.id}
                                className={styles.dropdownItem}
                                onClick={() => handleSelectStaff(staff)}
                              >
                                <span className={styles.staffName}>{staff.name}</span>
                                <span className={styles.dropdownItemSub}>Staff ID: {staff.id}</span>
                              </li>
                            ))
                          ) : (
                            <li className={styles.dropdownEmpty}>No active staff members found</li>
                          )}
                        </ul>
                      )}
                    </div>
                  
                    {selectedStaff && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                          padding: '0.75rem 1rem',
                          background: 'rgba(59, 130, 246, 0.08)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          fontSize: '0.9rem',
                          marginTop: '0.5rem'
                        }}
                      >
                        {loadingNetPay ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', width: '100%', justifyContent: 'center' }}>
                            <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6' }} />
                            <span>Fetching salary details...</span>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#9ca3af' }}>Gross Salary:</span>
                                <span style={{ fontWeight: 'bold', color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <NairaSign size={14} />
                                  {staffNetPay ? fmt(staffNetPay.grossPay) : '0.00'}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#9ca3af' }}>Current Net Pay:</span>
                                <span style={{ fontWeight: 'bold', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <NairaSign size={14} />
                                  {staffNetPay ? fmt(staffNetPay.amount) : '0.00'}
                                </span>
                              </div>
                            </div>

                            {staffNetPay?.month && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#9ca3af' }}>
                                ({staffNetPay.month} {staffNetPay.year}){staffNetPay.isEstimated ? ' [Estimated]' : ''}
                              </span>
                            )}
                          </>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* Setup Mode Toggle Switch */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Deduction Calculation Mode *</label>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.5rem',
                      background: 'rgba(241, 245, 249, 0.7)',
                      padding: '4px',
                      borderRadius: '10px',
                      border: '1px solid rgba(226, 232, 240, 0.9)'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          setCalcMode('amount');
                        }}
                        style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: calcMode === 'amount' ? '600' : '500',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease',
                          background: calcMode === 'amount' ? '#2563eb' : 'transparent',
                          color: calcMode === 'amount' ? '#ffffff' : '#64748b',
                          boxShadow: calcMode === 'amount' ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                        }}
                      >
                        <NairaSign size={15} />
                        Normal Setup (Fixed Amount)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCalcMode('days');
                          if (!deductionDays) setDeductionDays('1');
                        }}
                        style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: calcMode === 'days' ? '600' : '500',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease',
                          background: calcMode === 'days' ? '#059669' : 'transparent',
                          color: calcMode === 'days' ? '#ffffff' : '#64748b',
                          boxShadow: calcMode === 'days' ? '0 2px 6px rgba(5, 150, 105, 0.25)' : 'none',
                        }}
                      >
                        <Calendar size={15} />
                        Day Setup (Deduct Days)
                      </button>
                    </div>
                  </div>

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* MODE 1: DAY-BASED DEDUCTION SETUP */}
                  {/* ───────────────────────────────────────────────────────────── */}
                  {calcMode === 'days' ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                    >
                      {/* Quick Select Days Pills */}
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Quick Select Days to Deduct</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {[
                            { label: '0.5 Day (Half Day)', val: '0.5' },
                            { label: '1 Day', val: '1' },
                            { label: '2 Days', val: '2' },
                            { label: '3 Days', val: '3' },
                            { label: '4 Days', val: '4' },
                            { label: '5 Days', val: '5' },
                          ].map((pill) => (
                            <button
                              key={pill.val}
                              type="button"
                              onClick={() => setDeductionDays(pill.val)}
                              style={{
                                padding: '0.4rem 0.8rem',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                border: '1px solid',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                borderColor: deductionDays === pill.val ? '#059669' : '#cbd5e1',
                                background: deductionDays === pill.val ? '#ecfdf5' : '#ffffff',
                                color: deductionDays === pill.val ? '#065f46' : '#475569',
                                fontWeight: deductionDays === pill.val ? '600' : '500',
                              }}
                            >
                              {pill.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Custom Days Input */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Number of Days to Deduct *</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            className={styles.input}
                            placeholder="e.g. 0.5, 1, 1.5, 2, 3..."
                            value={deductionDays}
                            onChange={(e) => setDeductionDays(e.target.value)}
                            required
                          />
                        </div>

                        {/* Start Month / Payroll Period */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Payroll Month / Period *</label>
                          <input
                            type="month"
                            className={styles.input}
                            value={startMonth}
                            onChange={(e) => setStartMonth(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      {/* Live Calculation Preview Card */}
                      <div style={{
                        padding: '1rem',
                        background: 'linear-gradient(135deg, rgba(236, 253, 245, 0.7), rgba(240, 253, 250, 0.7))',
                        border: '1px solid #a7f3d0',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        fontSize: '0.875rem'
                      }}>
                        <div style={{ fontWeight: '600', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={16} color="#059669" />
                          <span>Day Deduction Calculation Breakdown</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', paddingTop: '4px' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Monthly Gross:</span>
                            <span style={{ fontWeight: '600', color: '#1e293b' }}>
                              ₦{fmt(staffSalaryInfo?.monthly_salary || 0)}
                            </span>
                          </div>

                          <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Days in Month:</span>
                            <span style={{ fontWeight: '600', color: '#1e293b' }}>
                              {daysInSelectedMonth} days
                            </span>
                          </div>

                          <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Daily Salary Rate:</span>
                            <span style={{ fontWeight: '600', color: '#059669' }}>
                              ₦{fmt(effectiveDailySalary)} / day
                            </span>
                          </div>

                          <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Deduction Days:</span>
                            <span style={{ fontWeight: '700', color: '#0f766e' }}>
                              {parseFloat(deductionDays) > 0 ? `${deductionDays} day(s)` : '0 days'}
                            </span>
                          </div>
                        </div>

                        <div style={{
                          borderTop: '1px dashed #6ee7b7',
                          paddingTop: '8px',
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span style={{ fontWeight: '600', color: '#065f46' }}>Total Deduction Amount:</span>
                          <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#047857', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <NairaSign size={16} />
                            {fmt(totalAmount || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Status</label>
                        <select
                          className={styles.select}
                          value={isActive}
                          onChange={(e) => setIsActive(parseInt(e.target.value))}
                        >
                          <option value={1}>Active</option>
                          <option value={0}>Deactivated</option>
                        </select>
                      </div>

                      {/* Remarks Field */}
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Remarks (Reason / Description) *</label>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="e.g. 1 day salary deduction for unexcused leave, half day deduction..."
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          maxLength={500}
                          required
                        />
                      </div>
                    </motion.div>
                  ) : (
                    /* ───────────────────────────────────────────────────────────── */
                    /* MODE 2: NORMAL AMOUNT-BASED DEDUCTION SETUP */
                    /* ───────────────────────────────────────────────────────────── */
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Deduction Type */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Deduction Type *</label>
                          <select
                            className={styles.select}
                            value={deductionType}
                            onChange={(e) => setDeductionType(e.target.value)}
                          >
                            <option value="one_time">One-Time Deduction</option>
                            <option value="spread">Spread Across Months</option>
                          </select>
                        </div>

                        {/* Total Amount */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Total Amount (₦) *</label>
                          <div className={styles.inputGroup}>
                            <NairaSign size={16} className={styles.inputIcon} />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className={`${styles.input} ${styles.inputWithIcon}`}
                              placeholder="Enter total amount"
                              value={totalAmount}
                              onChange={(e) => setTotalAmount(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Duration Months (Active only for Spread) */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Duration (Months) *</label>
                          <input
                            type="number"
                            min="1"
                            className={styles.input}
                            placeholder={deductionType === 'one_time' ? "1 month (Fixed)" : "e.g. 3"}
                            value={deductionType === 'one_time' ? '1' : durationMonths}
                            onChange={(e) => setDurationMonths(e.target.value)}
                            disabled={deductionType === 'one_time'}
                            style={deductionType === 'one_time' ? { backgroundColor: 'var(--bg-disabled, #f1f5f9)', cursor: 'not-allowed' } : {}}
                            required
                          />
                        </div>

                        {/* Calculated Monthly Deduction */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Monthly Deduction (₦)</label>
                          <div className={styles.inputGroup}>
                            <NairaSign size={16} className={styles.inputIcon} />
                            <input
                              type="text"
                              className={`${styles.input} ${styles.inputWithIcon}`}
                              placeholder="Calculated automatically"
                              value={monthlyDeduction}
                              disabled
                              style={{ backgroundColor: 'var(--bg-disabled, #f1f5f9)', cursor: 'not-allowed' }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Remaining Balance */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Remaining Balance (₦)</label>
                          <div className={styles.inputGroup}>
                            <NairaSign size={16} className={styles.inputIcon} />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className={`${styles.input} ${styles.inputWithIcon}`}
                              placeholder="Defaults to total amount"
                              value={balanceRemaining}
                              onChange={(e) => setBalanceRemaining(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Start Month */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Start Month *</label>
                          <input
                            type="month"
                            className={styles.input}
                            value={startMonth}
                            onChange={(e) => setStartMonth(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Calculated End Month */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>End Month</label>
                          <input
                            type="month"
                            className={styles.input}
                            value={endMonth}
                            disabled
                            style={{ backgroundColor: 'var(--bg-disabled, #f1f5f9)', cursor: 'not-allowed' }}
                          />
                        </div>

                        {/* Status */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Status</label>
                          <select
                            className={styles.select}
                            value={isActive}
                            onChange={(e) => setIsActive(parseInt(e.target.value))}
                          >
                            <option value={1}>Active</option>
                            <option value={0}>Deactivated</option>
                          </select>
                        </div>
                      </div>

                      {/* Remarks Field */}
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Remarks (Reason / Description) *</label>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="e.g. Uniform fee, damaged equipment, ID card replacement..."
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          maxLength={500}
                          required
                        />
                      </div>
                    </motion.div>
                  )}

                  {isDeductionExceedingNet && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        background: '#fef2f2',
                        border: '1px solid #fca5a5',
                        color: '#991b1b',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        marginTop: '1.25rem'
                      }}
                    >
                      <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong style={{ display: 'block', marginBottom: '2px' }}>Deduction Exceeds Available Net Pay:</strong>
                        Monthly deduction of <strong>₦{fmt(monthlyDeduction)}</strong> exceeds the staff member's available Net Pay (<strong>₦{fmt(staffNetPay?.amount || 0)}</strong>). This deduction will be declined because net pay cannot be negative.
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className={styles.formActions} style={{ marginTop: '1.5rem' }}>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleClearForm}>
                    Clear Form
                  </button>
                  <button 
                    type="submit" 
                    className={`${styles.btn} ${styles.btnPrimary}`} 
                    disabled={saving || isDeductionExceedingNet}
                    style={isDeductionExceedingNet ? { opacity: 0.5, cursor: 'not-allowed', backgroundColor: '#94a3b8', borderColor: '#94a3b8' } : {}}
                    title={isDeductionExceedingNet ? 'Cannot save: Deduction exceeds available Net Pay' : ''}
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {editSetupId ? 'Update Configuration' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Import Excel Zone */}
          <div className={styles.card} style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Bulk Import Excel/CSV</h2>
            </div>
            <div className={styles.cardBody} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div
                className={`${styles.dragDropZone} ${dragActive ? styles.dragActive : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
                style={{
                  border: '2px dashed var(--border-color, #e2e8f0)',
                  borderRadius: '0.5rem',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                />
                {importing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
                    <p style={{ fontWeight: 500 }}>Processing spreadsheet...</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <Upload size={36} style={{ color: 'var(--primary)' }} />
                    <p style={{ fontWeight: 500, fontSize: '0.95rem' }}>Drag & drop file here or click to browse</p>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Supports Excel (.xlsx, .xls) and CSV (.csv)</span>
                  </div>
                )}
              </div>
              <div style={{ marginTop: '1.25rem', fontSize: '0.825rem', color: '#64748b', lineHeight: '1.4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <p style={{ fontWeight: 600, margin: 0 }}>Spreadsheet Formatting Guideline:</p>
                  <a
                    href={`${API_BASE}/payroll/other-deduction-setups/template`}
                    download="other_deduction_import_template.csv"
                    style={{
                      color: 'var(--primary, #6366f1)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                    }}
                  >
                    Download Template
                  </a>
                </div>
                <ul style={{ listStyleType: 'disc', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <li>Column 1: **Staff ID**</li>
                  <li>Column 2: **Deduction Type** (`one_time` or `spread`)</li>
                  <li>Column 3: **Total Amount**</li>
                  <li>Column 4: **Duration Months** (optional, ignored for one_time)</li>
                  <li>Column 5: **Start Month** (format: `YYYY-MM`)</li>
                  <li>Column 6: **Remarks** (optional description / reason)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup Configurations Table */}
      <div className={styles.card}>
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <Search size={18} className={styles.inputIcon} />
            <input
              type="text"
              className={`${styles.input} ${styles.inputWithIcon}`}
              placeholder="Search setups by staff name, ID, or remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.perPageGroup}>
            <span className={styles.perPageLabel}>Show:</span>
            <select
              className={styles.perPageSelect}
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
        </div>

        <div className={styles.cardBody} style={{ padding: 0 }}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 size={32} className="animate-spin emptyIcon" />
              <p>Retrieving configurations...</p>
            </div>
          ) : paginatedSetups.length > 0 ? (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Staff Info</th>
                    <th>Department</th>
                    <th>Type</th>
                    <th>Total Amount</th>
                    <th>Monthly Deduction</th>
                    <th>Remaining Balance</th>
                    <th>Period (Start - End)</th>
                    <th>Remarks</th>
                    <th>Status</th>
                    {isConfigurator && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedSetups.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className={styles.staffCell}>
                          <span className={styles.staffName}>{s.name}</span>
                          <span className={styles.staffFile}>Staff ID: {s.staffId}</span>
                        </div>
                      </td>
                      <td>{s.department || 'N/A'}</td>
                      <td>
                        {s.calculation_mode === 'days' || (s.deduction_days && parseFloat(s.deduction_days) > 0) ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#ecfdf5',
                              color: '#065f46',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              border: '1px solid #a7f3d0'
                            }}>
                              <Calendar size={12} />
                              {s.deduction_days} {parseFloat(s.deduction_days) === 1 ? 'Day' : 'Days'} Deduct
                            </span>
                            {s.daily_rate > 0 && (
                              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '500' }}>
                                @ ₦{fmt(s.daily_rate)}/day
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: '#eff6ff',
                            color: '#1e40af',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            border: '1px solid #bfdbfe',
                            textTransform: 'capitalize'
                          }}>
                            <NairaSign size={12} />
                            {s.deduction_type?.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: '600', color: '#0f172a' }}>₦{fmt(s.total_amount)}</td>
                      <td>₦{fmt(s.monthly_deduction)}</td>
                      <td>₦{fmt(s.balance_remaining)}</td>
                      <td>{s.start_month} to {s.end_month}</td>
                      <td>
                        <div style={{ maxWidth: '180px', whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '0.85rem', color: s.remarks ? 'inherit' : 'var(--secondary, #94a3b8)' }}>
                          {s.remarks || '—'}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`${styles.badge} ${s.is_active === 1 ? styles.badgeApproved : styles.badgeRejected}`}
                          onClick={() => isConfigurator && handleToggleStatus(s.id)}
                          style={{ border: 'none', cursor: isConfigurator ? 'pointer' : 'default' }}
                        >
                          {s.is_active === 1 ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      {isConfigurator && (
                        <td>
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                              onClick={() => handleEdit(s)}
                              title="Edit Setup"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                              onClick={() => handleDelete(s.id)}
                              title="Delete Setup"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <FileText size={32} className={styles.emptyIcon} />
              <p>No other configurations found.</p>
            </div>
          )}

          {/* Pagination */}
          {filteredSetups.length > 0 && (
            <div className={styles.pagination}>
              <span className={styles.paginationText}>
                Showing {filteredSetups.length === 0 ? 0 : (itemsPerPage === 'all' ? 1 : (currentPage - 1) * parseInt(itemsPerPage, 10) + 1)} to {itemsPerPage === 'all' ? filteredSetups.length : Math.min(currentPage * parseInt(itemsPerPage, 10), filteredSetups.length)} of {filteredSetups.length} entries {itemsPerPage !== 'all' && totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
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
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.confirmBox}>
              <div className={`${styles.confirmIcon} ${styles.confirmIconRed}`}>
                <AlertCircle size={32} />
              </div>
              <h3 className={styles.cardTitle} style={{ marginBottom: '0.5rem' }}>
                {confirmAction.label}
              </h3>
              <p className={styles.confirmMsg}>
                Are you sure you want to delete this penalty deduction configuration? This action cannot be undone.
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setConfirmAction(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.confirmActionBtn} ${styles.dangerBtn}`}
                  onClick={handleConfirmAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
