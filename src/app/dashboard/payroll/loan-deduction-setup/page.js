"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Users, TrendingUp, Search, Loader2, FileText, AlertCircle, CheckCircle2, Edit2, Trash2, Plus, X, Settings, Calendar, Percent, Power, Upload, Coins, CreditCard } from 'lucide-react';
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

export default function LoanDeductionSetupPage() {
  // UI & Loading States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Import File Ref
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

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
  const [loanAmount, setLoanAmount] = useState('');
  const [interestRate, setInterestRate] = useState('0');
  const [durationMonths, setDurationMonths] = useState('12');
  const [monthlyDeduction, setMonthlyDeduction] = useState('');
  const [balanceRemaining, setBalanceRemaining] = useState('');
  const [startMonth, setStartMonth] = useState(''); // Format: YYYY-MM
  const [endMonth, setEndMonth] = useState('');     // Format: YYYY-MM
  const [isActive, setIsActive] = useState(1);

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
    const cacheKeyStaff = 'hrms_loans_staff_setup_cache';
    if (typeof window !== 'undefined') {
      const cachedStaff = sessionStorage.getItem(cacheKeyStaff);
      if (cachedStaff) {
        setStaffList(JSON.parse(cachedStaff));
        return;
      }
    }
    const headers = buildHeaders();
    try {
      const staffRes = await axios.get(`${API_BASE}/payroll/loans/staff`, { headers });
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

  // Fetch dynamic loan deduction setups list
  const fetchSetups = useCallback(async (silent = false) => {
    const cacheKeySetups = 'hrms_loan_deductions_cache';
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
      const res = await axios.get(`${API_BASE}/payroll/loan-deduction-setups`, { headers });
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
      showToast('Failed to retrieve loan deduction setups.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!(sessionStorage.getItem('hrms_loan_deductions_cache') && sessionStorage.getItem('hrms_loans_staff_setup_cache'));
    }
    const timer = setTimeout(() => {
      fetchStaffData();
      fetchSetups(hasCache);
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [fetchStaffData, fetchSetups]);

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

  useEffect(() => {
    if (selectedStaff) {
      fetchStaffNetPay(selectedStaff.id);
    } else {
      setStaffNetPay(null);
    }
  }, [selectedStaff, fetchStaffNetPay]);

  // Recalculate monthly deduction & end month automatically
  useEffect(() => {
    const amt = parseFloat(loanAmount);
    const rate = parseFloat(interestRate);
    const dur = parseInt(durationMonths);

    if (!isNaN(amt) && amt > 0 && !isNaN(dur) && dur > 0) {
      const r = isNaN(rate) ? 0 : rate;
      const totalAmount = amt * (1 + r / 100);
      const computedDeduction = Math.round((totalAmount / dur) * 100) / 100;
      setMonthlyDeduction(computedDeduction.toString());
      if (editSetupId === null) {
        setBalanceRemaining(totalAmount.toString());
      }
    } else {
      setMonthlyDeduction('');
      if (editSetupId === null) {
        setBalanceRemaining('');
      }
    }

    if (startMonth && !isNaN(dur) && dur > 0) {
      const [y, m] = startMonth.split('-').map(Number);
      const startDate = new Date(y, m - 1, 1);
      startDate.setMonth(startDate.getMonth() + dur - 1);
      const ey = startDate.getFullYear();
      const em = String(startDate.getMonth() + 1).padStart(2, '0');
      setEndMonth(`${ey}-${em}`);
    } else {
      setEndMonth('');
    }
  }, [loanAmount, interestRate, durationMonths, startMonth, editSetupId]);

  const handleSelectStaff = async (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setShowDropdown(false);

    try {
      const res = await axios.get(`${API_BASE}/payroll/loan-deduction-setups/approved-amount/${staff.id}`, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success' && res.data.loan_amount) {
        setLoanAmount(res.data.loan_amount);
      } else {
        setLoanAmount('');
      }
    } catch (err) {
      console.error('Failed to fetch approved loan details:', err);
      setLoanAmount('');
    }
  };

  const handleClearForm = () => {
    setEditSetupId(null);
    setSelectedStaff(null);
    setDropdownSearch('');
    setLoanAmount('');
    setInterestRate('0');
    setDurationMonths('12');
    setMonthlyDeduction('');
    setBalanceRemaining('');
    setStartMonth('');
    setEndMonth('');
    setIsActive(1);
  };

  // Submit setup configuration
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }

    const amt = parseFloat(loanAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid loan amount.', 'error');
      return;
    }

    const rate = parseFloat(interestRate);
    if (isNaN(rate) || rate < 0) {
      showToast('Please enter a valid interest rate.', 'error');
      return;
    }

    const dur = parseInt(durationMonths);
    if (isNaN(dur) || dur <= 0) {
      showToast('Please enter a valid duration in months.', 'error');
      return;
    }

    if (!startMonth) {
      showToast('Please select a start month.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: editSetupId,
        staffId: selectedStaff.id,
        loan_amount: amt,
        interest_rate: rate,
        duration_months: dur,
        monthly_deduction: parseFloat(monthlyDeduction),
        balance_remaining: balanceRemaining !== '' ? parseFloat(balanceRemaining) : amt * (1 + rate / 100),
        start_month: startMonth,
        end_month: endMonth,
        is_active: isActive,
      };

      const res = await axios.post(`${API_BASE}/payroll/loan-deduction-setups`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Deduction setup configured successfully.');
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

    setLoanAmount(setup.loan_amount);
    setInterestRate(setup.interest_rate);
    setDurationMonths(setup.duration_months);
    setMonthlyDeduction(setup.monthly_deduction);
    setBalanceRemaining(setup.balance_remaining);
    setStartMonth(setup.start_month);
    setEndMonth(setup.end_month);
    setIsActive(setup.is_active);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle status
  const handleToggleStatus = async (id) => {
    try {
      const res = await axios.post(`${API_BASE}/payroll/loan-deduction-setups/toggle/${id}`, {}, {
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
    setConfirmAction({ type: 'delete', id, label: 'Delete Deduction Setup' });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    setActionLoading(true);

    try {
      if (type === 'delete') {
        const res = await axios.delete(`${API_BASE}/payroll/loan-deduction-setups/${id}`, {
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
      const res = await axios.post(`${API_BASE}/payroll/loan-deduction-setups/import`, formData, {
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
    return s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.staffId).includes(searchQuery);
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

  const getIsConfiguratorFromLocalStorage = () => {
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
  const totalLoanPortfolio = setups
    .reduce((acc, s) => acc + (parseFloat(s.loan_amount) || 0), 0);

  if (!mounted) {
    return (
      <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.headerBadge}>
          <Settings size={13} />
          Payroll Deductions
        </div>
        <h1 className={styles.title}>
          <Coins size={28} className={styles.titleIcon} />
          Loan Deduction Setup
        </h1>
        <p className={styles.subtitle}>
          Configure how regular employee loan deductions are recovered monthly from employee salaries, including interest and durations.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconBlue}`}>
            <Users size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Setups</span>
            <div className={styles.statValue}>
              {activeCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--secondary)' }}>/ {setups.length}</span>
            </div>
            <span className={styles.statSubtext}>Configured staff loans</span>
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
            <span className={styles.statSubtext}>Total active monthly recovery</span>
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
          <div className={`${styles.statIcon} ${styles.iconPurple}`}>
            <FileText size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Loan Portfolio</span>
            <div className={styles.statValue}>
              ₦ {fmt(totalLoanPortfolio)}
            </div>
            <span className={styles.statSubtext}>Cumulative principal value</span>
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
                  {editSetupId ? `Modify Deduction Setup (#${editSetupId})` : 'Create Deduction Setup'}
                </h2>
              </div>
              {editSetupId && (
                <button
                  type="button"
                  onClick={handleClearForm}
                  className={styles.countBadge}
                  style={{ cursor: 'pointer', background: 'rgba(239, 68, 68, 0.08)', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div className={styles.cardBody}>
              <form onSubmit={handleSubmit}>
                <div className={styles.formGrid}>
                  {/* Autocomplete Select Staff */}
                  <div className={`${styles.formGroup} ${styles.formGroupFull}`} ref={dropdownRef}>
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
                      {showDropdown && filteredStaff.length > 0 && (
                        <ul className={styles.dropdownList}>
                          {filteredStaff.map((staff) => (
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
                              <span className={styles.staffFileNo}>ID: {staff.id}</span>
                            </li>
                          ))}
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

                  {/* Loan Amount */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Loan Principal Amount (₦) <span className={styles.reqStar}>*</span>
                    </label>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputPrefix}>₦</span>
                      <input
                        type="number"
                        step="0.01"
                        className={`${styles.input} ${styles.inputWithPrefix}`}
                        placeholder="0.00"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Interest Rate */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Interest Rate (%) <span className={styles.reqStar}>*</span>
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="number"
                        step="0.01"
                        className={`${styles.input} ${styles.inputWithSuffix}`}
                        placeholder="0"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        required
                      />
                      <span className={styles.inputSuffix}>%</span>
                    </div>
                  </div>

                  {/* Duration Months */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Repayment Duration (Months) <span className={styles.reqStar}>*</span>
                    </label>
                    <input
                      type="number"
                      className={styles.input}
                      placeholder="12"
                      value={durationMonths}
                      onChange={(e) => setDurationMonths(e.target.value)}
                      required
                    />
                  </div>

                  {/* Start Month */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Repayment Start Month <span className={styles.reqStar}>*</span>
                    </label>
                    <input
                      type="month"
                      className={styles.input}
                      value={startMonth}
                      onChange={(e) => setStartMonth(e.target.value)}
                      required
                    />
                  </div>

                  {/* Monthly Deduction (Calculated) */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Monthly Deduction (Calculated)</label>
                    <input
                      type="text"
                      className={`${styles.input} ${styles.inputDisabled}`}
                      value={monthlyDeduction ? `₦ ${fmt(monthlyDeduction)}` : ''}
                      disabled
                    />
                  </div>

                  {/* End Month (Calculated) */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Expected End Month (Calculated)</label>
                    <input
                      type="text"
                      className={`${styles.input} ${styles.inputDisabled}`}
                      value={endMonth ? fmtMonth(endMonth) : ''}
                      disabled
                    />
                  </div>

                  {/* Balance Remaining */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Balance Remaining (₦)</label>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputPrefix}>₦</span>
                      <input
                        type="number"
                        step="0.01"
                        className={`${styles.input} ${styles.inputWithPrefix} ${editSetupId === null ? styles.inputDisabled : ''}`}
                        value={balanceRemaining}
                        onChange={(e) => setBalanceRemaining(e.target.value)}
                        placeholder="Auto-calculated if blank"
                        disabled={editSetupId === null}
                      />
                    </div>
                  </div>
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

          {/* Import Excel Zone */}
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
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
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
                  <span className={styles.guidelineTitle}>Formatting Guideline:</span>
                  <a
                    href={`${API_BASE}/payroll/loan-deduction-setups/template`}
                    download="loan_setup_import_template.csv"
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
                    <span>Column 2: <strong>Loan Amount</strong></span>
                  </li>
                  <li className={styles.guidelineItem}>
                    <span className={styles.guidelineDot} />
                    <span>Column 3: <strong>Interest Rate (%)</strong></span>
                  </li>
                  <li className={styles.guidelineItem}>
                    <span className={styles.guidelineDot} />
                    <span>Column 4: <strong>Duration Months</strong></span>
                  </li>
                  <li className={styles.guidelineItem}>
                    <span className={styles.guidelineDot} />
                    <span>Column 5: <strong>Start Month</strong> (format: <code>YYYY-MM</code>)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderLeft}>
            <div className={styles.cardHeaderIcon}>
              <Coins size={18} />
            </div>
            <h2 className={styles.cardTitle}>Deduction Setup Configurations</h2>
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
                placeholder="Search staff configurations..."
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

        <div className={styles.cardBody} style={{ padding: '0' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          ) : filteredSetups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--secondary)' }}>
              <AlertCircle size={36} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--secondary)', opacity: 0.6 }} />
              <p style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>No deduction setups found</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Try adjusting your search query or add a new configuration above.</p>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Staff Info</th>
                    <th>Loan Amount</th>
                    <th>Interest</th>
                    <th>Duration</th>
                    <th>Monthly Deduction</th>
                    <th>Repayment Period</th>
                    <th>Balance Remaining</th>
                    <th>Status</th>
                    {isConfigurator && <th style={{ textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedSetups.map((setup) => {
                    const initials = setup.name
                      ? setup.name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase()
                      : 'U';
                    const isCleared = parseFloat(setup.balance_remaining || 0) <= 0;

                    return (
                      <tr key={setup.id}>
                        <td>
                          <div className={styles.staffCell}>
                            <div className={styles.staffAvatar}>
                              {initials}
                            </div>
                            <div className={styles.staffText}>
                              <span className={styles.staffNameText}>{setup.name}</span>
                              <span className={styles.staffIdBadge}>ID #{setup.staffId}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={styles.currencyAmount}>
                            ₦ {fmt(setup.loan_amount)}
                          </span>
                        </td>
                        <td>
                          <span className={styles.interestBadge}>
                            {parseFloat(setup.interest_rate || 0).toFixed(2)}%
                          </span>
                        </td>
                        <td>
                          <span className={styles.durationBadge}>
                            <Calendar size={12} />
                            {setup.duration_months} Mos
                          </span>
                        </td>
                        <td>
                          <span className={styles.monthlyDeductionCell}>
                            ₦ {fmt(setup.monthly_deduction)}
                          </span>
                        </td>
                        <td>
                          <div className={styles.periodCell}>
                            <div className={styles.periodItem}>
                              <span className={styles.periodLabel}>From</span>
                              <span className={styles.periodValue}>{fmtMonth(setup.start_month)}</span>
                            </div>
                            <div className={styles.periodItem}>
                              <span className={styles.periodLabel}>To</span>
                              <span className={styles.periodValue}>{fmtMonth(setup.end_month)}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {isCleared ? (
                            <span className={styles.balanceCleared}>
                              <CheckCircle2 size={13} /> Cleared (₦ 0.00)
                            </span>
                          ) : (
                            <span className={styles.balanceCell}>
                              ₦ {fmt(setup.balance_remaining)}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={setup.is_active === 1 ? styles.badgeSuccess : styles.badgeDanger}>
                            <span className={styles.badgeDot} />
                            {setup.is_active === 1 ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {isConfigurator && (
                          <td>
                            <div className={styles.actionsCell} style={{ justifyContent: 'center' }}>
                              <button
                                type="button"
                                className={`${styles.iconButton} ${setup.is_active === 1 ? styles.btnPowerActive : styles.btnPowerInactive}`}
                                onClick={() => handleToggleStatus(setup.id)}
                                title={setup.is_active === 1 ? 'Deactivate Setup' : 'Activate Setup'}
                              >
                                <Power size={14} />
                              </button>
                              <button
                                type="button"
                                className={`${styles.iconButton} ${styles.btnEdit}`}
                                onClick={() => handleEdit(setup)}
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
                Are you sure you want to delete this configuration setup? This action cannot be undone.
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
