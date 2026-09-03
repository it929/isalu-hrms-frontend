"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Users, Search, Loader2, FileText, AlertCircle, CheckCircle2, Edit2, Trash2, Plus, Settings, Calendar, Power, Upload, AlertOctagon, TrendingUp, CreditCard, Coins, ShieldAlert, X, Building2 } from 'lucide-react';
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

function fmtMonth(ym) {
  if (!ym) return '—';
  const parts = String(ym).split('-');
  if (parts.length === 2) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${months[monthIdx]} ${year}`;
    }
  }
  return ym;
}

function getCurrentMonthStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
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
  const [startMonth, setStartMonth] = useState(getCurrentMonthStr); // Format: YYYY-MM
  const [endMonth, setEndMonth] = useState(getCurrentMonthStr); // Format: YYYY-MM
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

  const fetchStaffNetPay = useCallback(async (staffId, monthStr) => {
    setLoadingNetPay(true);
    try {
      const headers = buildHeaders();
      let queryParams = '';
      if (monthStr && monthStr.includes('-')) {
        const [y, m] = monthStr.split('-');
        queryParams = `?month=${parseInt(m, 10)}&year=${parseInt(y, 10)}`;
      }
      const res = await axios.get(`${API_BASE}/payroll/staff-netpay/${staffId}${queryParams}`, { headers });
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

  const activeCount = setups.filter(s => s.is_active === 1).length;
  const totalMonthlyDeduction = setups
    .filter(s => s.is_active === 1)
    .reduce((acc, s) => acc + (parseFloat(s.monthly_deduction) || 0), 0);
  const totalBalanceRemaining = setups
    .reduce((acc, s) => acc + (parseFloat(s.balance_remaining) || 0), 0);
  const totalPenaltyAmount = setups
    .reduce((acc, s) => acc + (parseFloat(s.total_amount) || 0), 0);

  if (!mounted) {
    return (
      <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerBadge}>
          <AlertOctagon size={13} />
          Payroll Deductions
        </div>
        <h1 className={styles.title}>
          <ShieldAlert size={28} className={styles.titleIcon} />
          Penalty Deduction Setup
        </h1>
        <p className={styles.subtitle}>
          Configure penalty deductions from employee salaries, supporting both one-time deductions and monthly spreading, as well as bulk spreadsheet importing.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconRed}`}>
            <Users size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Setups</span>
            <div className={styles.statValue}>
              {activeCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--secondary)' }}>/ {setups.length}</span>
            </div>
            <span className={styles.statSubtext}>Configured staff penalties</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconEmerald}`}>
            <TrendingUp size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Monthly Deduction Pool</span>
            <div className={styles.statValue}>
              ₦ {fmt(totalMonthlyDeduction)}
            </div>
            <span className={styles.statSubtext}>Active monthly recovery</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconAmber}`}>
            <CreditCard size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Outstanding Balance</span>
            <div className={styles.statValue}>
              ₦ {fmt(totalBalanceRemaining)}
            </div>
            <span className={styles.statSubtext}>Pending deduction balance</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconBlue}`}>
            <FileText size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Penalty Portfolio</span>
            <div className={styles.statValue}>
              ₦ {fmt(totalPenaltyAmount)}
            </div>
            <span className={styles.statSubtext}>Cumulative penalty value</span>
          </div>
        </div>
      </div>

      {isConfigurator && (
        <div className={styles.topGrid}>
          {/* Setup Form */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderLeft}>
                <div className={styles.cardHeaderIcon}>
                  {editSetupId ? <Edit2 size={18} /> : <Plus size={18} />}
                </div>
                <h2 className={styles.cardTitle}>
                  {editSetupId ? `Modify Penalty Setup (#${editSetupId})` : 'Create Penalty Deduction Setup'}
                </h2>
              </div>
              {editSetupId && (
                <button
                  type="button"
                  onClick={handleClearForm}
                  className={styles.countBadge}
                  style={{ cursor: 'pointer' }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div className={styles.cardBody}>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Autocomplete Select Staff */}
                  <div className={styles.formGroup} ref={dropdownRef}>
                    <label className={styles.label}>
                      Select Staff Member <span className={styles.reqStar}>*</span>
                    </label>
                    <div className={styles.dropdownContainer}>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Search by name, staff ID, department..."
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
                                <div className={styles.staffDropdownLeft}>
                                  <div className={styles.dropdownAvatar}>
                                    {staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                                  </div>
                                  <span className={styles.staffName}>{staff.name}</span>
                                </div>
                                <span className={styles.staffFileNo}>Staff ID: {staff.id}</span>
                              </li>
                            ))
                          ) : (
                            <li style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--secondary)', fontSize: '0.85rem' }}>
                              No active staff members found
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  
                    {selectedStaff && (
                      <motion.div 
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={styles.salaryBanner}
                      >
                        {loadingNetPay ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)', width: '100%', justifyContent: 'center' }}>
                            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--primary)' }} />
                            <span>Fetching salary details...</span>
                          </div>
                        ) : (
                          <>
                            <div className={styles.salaryItems}>
                              <div className={styles.salaryItem}>
                                <span className={styles.salaryLabel}>Gross Salary:</span>
                                <span className={styles.salaryValueGross}>
                                  <NairaSign size={14} />
                                  {staffNetPay ? fmt(staffNetPay.grossPay) : '0.00'}
                                </span>
                              </div>

                              <div className={styles.salaryItem}>
                                <span className={styles.salaryLabel}>Current Net Pay:</span>
                                <span className={styles.salaryValueNet}>
                                  <NairaSign size={14} />
                                  {staffNetPay ? fmt(staffNetPay.amount) : '0.00'}
                                </span>
                              </div>
                            </div>

                            {staffNetPay?.month && (
                              <span className={styles.salaryPeriod}>
                                (Active Month: {staffNetPay.month} {staffNetPay.year}){staffNetPay.isEstimated ? ' [Estimated]' : ''}
                              </span>
                            )}
                          </>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* Setup Mode Toggle Switch */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Deduction Calculation Mode <span className={styles.reqStar}>*</span>
                    </label>
                    <div className={styles.modeSwitchContainer}>
                      <button
                        type="button"
                        onClick={() => setCalcMode('amount')}
                        className={`${styles.modeBtn} ${calcMode === 'amount' ? styles.modeBtnActiveAmount : ''}`}
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
                        className={`${styles.modeBtn} ${calcMode === 'days' ? styles.modeBtnActiveDays : ''}`}
                      >
                        <Calendar size={15} />
                        Day Setup (Deduct Days)
                      </button>
                    </div>
                  </div>

                  {/* MODE 1: DAY-BASED DEDUCTION SETUP */}
                  {calcMode === 'days' ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                    >
                      {/* Quick Select Days Pills */}
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Quick Select Days to Deduct</label>
                        <div className={styles.quickDaysGrid}>
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
                              className={`${styles.quickDayBtn} ${deductionDays === pill.val ? styles.quickDayBtnActive : ''}`}
                            >
                              {pill.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Custom Days Input */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>
                            Number of Days to Deduct <span className={styles.reqStar}>*</span>
                          </label>
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
                          <label className={styles.label}>
                            Payroll Month / Period <span className={styles.reqStar}>*</span>
                          </label>
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
                      <div className={styles.calcPreviewCard}>
                        <div style={{ fontWeight: '600', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={16} color="#059669" />
                          <span>Day Deduction Calculation Breakdown</span>
                        </div>

                        <div className={styles.calcGrid}>
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
                        <label className={styles.label}>
                          Remarks (Reason / Description) <span className={styles.reqStar}>*</span>
                        </label>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="e.g. 1 day salary deduction for unexcused absence, disciplinary action..."
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          maxLength={500}
                          required
                        />
                      </div>
                    </motion.div>
                  ) : (
                    /* MODE 2: NORMAL AMOUNT-BASED DEDUCTION SETUP */
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Deduction Type */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>
                            Deduction Type <span className={styles.reqStar}>*</span>
                          </label>
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
                          <label className={styles.label}>
                            Total Amount (₦) <span className={styles.reqStar}>*</span>
                          </label>
                          <div className={styles.inputWrapper}>
                            <span className={styles.inputPrefix}>₦</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className={`${styles.input} ${styles.inputWithPrefix}`}
                              placeholder="0.00"
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
                          <label className={styles.label}>
                            Duration (Months) <span className={styles.reqStar}>*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            className={`${styles.input} ${deductionType === 'one_time' ? styles.inputDisabled : ''}`}
                            placeholder={deductionType === 'one_time' ? "1 month (Fixed)" : "e.g. 3"}
                            value={deductionType === 'one_time' ? '1' : durationMonths}
                            onChange={(e) => setDurationMonths(e.target.value)}
                            disabled={deductionType === 'one_time'}
                            required
                          />
                        </div>

                        {/* Calculated Monthly Deduction */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Monthly Deduction (₦)</label>
                          <div className={styles.inputWrapper}>
                            <span className={styles.inputPrefix}>₦</span>
                            <input
                              type="text"
                              className={`${styles.input} ${styles.inputWithPrefix} ${styles.inputDisabled}`}
                              placeholder="Calculated automatically"
                              value={monthlyDeduction ? fmt(monthlyDeduction) : ''}
                              disabled
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Remaining Balance */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Remaining Balance (₦)</label>
                          <div className={styles.inputWrapper}>
                            <span className={styles.inputPrefix}>₦</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className={`${styles.input} ${styles.inputWithPrefix}`}
                              placeholder="Defaults to total amount"
                              value={balanceRemaining}
                              onChange={(e) => setBalanceRemaining(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Start Month */}
                        <div className={styles.formGroup}>
                          <label className={styles.label}>
                            Start Month <span className={styles.reqStar}>*</span>
                          </label>
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
                          <label className={styles.label}>Expected End Month</label>
                          <input
                            type="text"
                            className={`${styles.input} ${styles.inputDisabled}`}
                            value={endMonth ? fmtMonth(endMonth) : ''}
                            disabled
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
                        <label className={styles.label}>
                          Remarks (Reason / Description) <span className={styles.reqStar}>*</span>
                        </label>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="e.g. Uniform fee, damaged equipment, ID card replacement, penalty..."
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
                        marginTop: '0.5rem'
                      }}
                    >
                      <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong style={{ display: 'block', marginBottom: '2px' }}>Deduction Exceeds Available Net Pay:</strong>
                        Monthly deduction of <strong>₦{fmt(monthlyDeduction)}</strong> exceeds the staff member&apos;s available Net Pay (<strong>₦{fmt(staffNetPay?.amount || 0)}</strong>). This deduction will be declined because net pay cannot be negative.
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={handleClearForm}
                    disabled={saving}
                  >
                    Clear Form
                  </button>
                  <button
                    type="submit"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    {editSetupId ? 'Update Configuration' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Bulk Import Excel/CSV */}
          <div className={styles.card} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderLeft}>
                <div className={styles.cardHeaderIcon}>
                  <Upload size={18} />
                </div>
                <h2 className={styles.cardTitle}>Bulk Import Excel/CSV</h2>
              </div>
            </div>
            <div className={styles.cardBody} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div
                className={`${styles.dragDropZone} ${dragActive ? styles.dragActive : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
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
                    <Loader2 size={36} className="animate-spin" style={{ color: '#dc2626' }} />
                    <p style={{ fontWeight: 600 }}>Processing spreadsheet...</p>
                  </div>
                ) : (
                  <>
                    <div className={styles.uploadIconCircle}>
                      <Upload size={24} />
                    </div>
                    <p className={styles.uploadTitle}>Drag & drop file here or click to browse</p>
                    <span className={styles.uploadSub}>Supports Excel (.xlsx, .xls) and CSV (.csv)</span>
                  </>
                )}
              </div>
              <div className={styles.guidelinesBox}>
                <div className={styles.guidelineHeader}>
                  <span className={styles.guidelineTitle}>Spreadsheet Formatting Guideline:</span>
                  <a
                    href={`${API_BASE}/payroll/other-deduction-setups/template`}
                    download="penalty_deduction_import_template.csv"
                    className={styles.downloadTemplateLink}
                  >
                    Download Template
                  </a>
                </div>
                <ul className={styles.guidelineList}>
                  <li className={styles.guidelineItem}>
                    <span className={styles.guidelineDot} />
                    <span>Column 1: <strong>Staff ID</strong></span>
                  </li>
                  <li className={styles.guidelineItem}>
                    <span className={styles.guidelineDot} />
                    <span>Column 2: <strong>Deduction Type</strong> (<code>one_time</code> or <code>spread</code>)</span>
                  </li>
                  <li className={styles.guidelineItem}>
                    <span className={styles.guidelineDot} />
                    <span>Column 3: <strong>Total Amount</strong></span>
                  </li>
                  <li className={styles.guidelineItem}>
                    <span className={styles.guidelineDot} />
                    <span>Column 4: <strong>Duration Months</strong> (optional, ignored for one_time)</span>
                  </li>
                  <li className={styles.guidelineItem}>
                    <span className={styles.guidelineDot} />
                    <span>Column 5: <strong>Start Month</strong> (format: <code>YYYY-MM</code>)</span>
                  </li>
                  <li className={styles.guidelineItem}>
                    <span className={styles.guidelineDot} />
                    <span>Column 6: <strong>Remarks</strong> (optional description / reason)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup Configurations Table Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderLeft}>
            <div className={styles.cardHeaderIcon}>
              <ShieldAlert size={18} />
            </div>
            <h2 className={styles.cardTitle}>Penalty Deduction Configurations</h2>
            <span className={styles.countBadge}>{filteredSetups.length} records</span>
          </div>
          <div className={styles.filterBar}>
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
            <div className={styles.searchWrapper}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search setups by staff name, ID, or remarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.searchClearBtn}
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.cardBody} style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
              <Loader2 size={28} className="animate-spin" style={{ color: '#dc2626' }} />
            </div>
          ) : paginatedSetups.length > 0 ? (
            <div className={styles.tableResponsive}>
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
                    {isConfigurator && <th style={{ textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedSetups.map((s) => {
                    const initials = s.name
                      ? s.name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase()
                      : 'U';
                    const isCleared = parseFloat(s.balance_remaining || 0) <= 0;

                    return (
                      <tr key={s.id}>
                        <td>
                          <div className={styles.staffCell}>
                            <div className={styles.staffAvatar}>
                              {initials}
                            </div>
                            <div className={styles.staffText}>
                              <span className={styles.staffNameText}>{s.name}</span>
                              <span className={styles.staffIdBadge}>ID #{s.staffId}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={styles.deptBadge}>
                            <Building2 size={13} style={{ color: 'var(--secondary)' }} />
                            {s.department || 'N/A'}
                          </span>
                        </td>
                        <td>
                          {s.calculation_mode === 'days' || (s.deduction_days && parseFloat(s.deduction_days) > 0) ? (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
                              <span className={styles.typeBadgeDay}>
                                <Calendar size={12} />
                                {s.deduction_days} {parseFloat(s.deduction_days) === 1 ? 'Day' : 'Days'} Deduct
                              </span>
                              {s.daily_rate > 0 && (
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '500' }}>
                                  @ ₦{fmt(s.daily_rate)}/day
                                </span>
                              )}
                            </div>
                          ) : s.deduction_type === 'one_time' ? (
                            <span className={styles.typeBadgeOneTime}>
                              One-Time
                            </span>
                          ) : (
                            <span className={styles.typeBadgeSpread}>
                              Monthly Spread ({s.duration_months || 1} Mos)
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={styles.currencyAmount}>₦{fmt(s.total_amount)}</span>
                        </td>
                        <td>
                          <span className={styles.monthlyDeductionCell}>₦{fmt(s.monthly_deduction)}</span>
                        </td>
                        <td>
                          {isCleared ? (
                            <span className={styles.balanceCleared}>
                              <CheckCircle2 size={13} /> Cleared (₦0.00)
                            </span>
                          ) : (
                            <span className={styles.balanceCell}>₦{fmt(s.balance_remaining)}</span>
                          )}
                        </td>
                        <td>
                          <div className={styles.periodCell}>
                            <div className={styles.periodItem}>
                              <span className={styles.periodLabel}>From</span>
                              <span className={styles.periodValue}>{fmtMonth(s.start_month)}</span>
                            </div>
                            <div className={styles.periodItem}>
                              <span className={styles.periodLabel}>To</span>
                              <span className={styles.periodValue}>{fmtMonth(s.end_month)}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className={styles.remarksCell}>
                            {s.remarks || '—'}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={s.is_active === 1 ? styles.badgeSuccess : styles.badgeDanger}
                            onClick={() => isConfigurator && handleToggleStatus(s.id)}
                            title={isConfigurator ? (s.is_active === 1 ? 'Click to deactivate' : 'Click to activate') : undefined}
                            style={{ border: 'none' }}
                          >
                            <span className={styles.badgeDot} />
                            {s.is_active === 1 ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        {isConfigurator && (
                          <td>
                            <div className={styles.actionsCell} style={{ justifyContent: 'center' }}>
                              <button
                                type="button"
                                className={`${styles.iconButton} ${s.is_active === 1 ? styles.btnPowerActive : styles.btnPowerInactive}`}
                                onClick={() => handleToggleStatus(s.id)}
                                title={s.is_active === 1 ? 'Deactivate Setup' : 'Activate Setup'}
                              >
                                <Power size={14} />
                              </button>
                              <button
                                type="button"
                                className={`${styles.iconButton} ${styles.btnEdit}`}
                                onClick={() => handleEdit(s)}
                                title="Modify Setup"
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--secondary)' }}>
              <AlertCircle size={36} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--secondary)', opacity: 0.6 }} />
              <p style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>No penalty deduction configurations found</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Try adjusting your search query or add a new configuration above.</p>
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
                    className={styles.pageBtn}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    First
                  </button>
                  <button
                    type="button"
                    className={styles.pageBtn}
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
                    onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className={styles.pageBtn}
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
