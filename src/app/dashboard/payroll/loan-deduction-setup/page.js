"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Users, TrendingUp, Search, Loader2, FileText, AlertCircle, CheckCircle2, Edit2, Trash2, Plus, X, Settings, Calendar, Percent, Power, Upload } from 'lucide-react';
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
  const itemsPerPage = 8;

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
        s.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        s.fileNo.toLowerCase().includes(dropdownSearch.toLowerCase())
      );

  const filteredSetups = setups.filter(s => {
    if (selectedStaff && s.staffId !== selectedStaff.id) {
      return false;
    }
    return s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.fileNo?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalPages = Math.ceil(filteredSetups.length / itemsPerPage);
  const paginatedSetups = filteredSetups.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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

  const isConfigurator = userCtx.isSuperAdmin || userCtx.isAdminStaff || getIsConfiguratorFromLocalStorage();

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
        <h1 className={styles.title}>Loan Deduction Setup</h1>
        <p className={styles.subtitle}>Configure how regular employee loan deductions are recovered monthly from employee salaries, including interest and durations.</p>
      </div>

      {isConfigurator && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Setup Form */}
          <div className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{editSetupId ? 'Modify Deduction Setup' : 'Create Deduction Setup'}</h2>
            </div>
            <div className={styles.cardBody}>
              <form onSubmit={handleSubmit}>
                <div className={styles.formGrid}>
                  {/* Autocomplete Select Staff */}
                  <div className={styles.formGroup} ref={dropdownRef}>
                    <label className={styles.label}>Select Staff Member *</label>
                    <div className={styles.dropdownContainer}>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Search by name, file number..."
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
                              <span className={styles.staffName}>{staff.name}</span>
                              <span className={styles.staffFileNo}>({staff.fileNo})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Loan Amount */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Loan Principal Amount (₦) *</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>₦</span>
                      <input
                        type="number"
                        step="0.01"
                        className={styles.input}
                        style={{ paddingLeft: '32px' }}
                        placeholder="0.00"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Interest Rate */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Interest Rate (%) *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.01"
                        className={styles.input}
                        placeholder="0"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        required
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>%</span>
                    </div>
                  </div>

                  {/* Duration Months */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Repayment Duration (Months) *</label>
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
                    <label className={styles.label}>Repayment Start Month *</label>
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
                    <label className={styles.label}>Monthly Deduction Amount (Calculated)</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={monthlyDeduction ? `₦ ${fmt(monthlyDeduction)}` : ''}
                      disabled
                      style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                    />
                  </div>

                  {/* End Month (Calculated) */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Expected Repayment End Month</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={endMonth || ''}
                      disabled
                      style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                    />
                  </div>

                  {/* Balance Remaining */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Balance Remaining (₦)</label>
                    <input
                      type="number"
                      step="0.01"
                      className={styles.input}
                      value={balanceRemaining}
                      onChange={(e) => setBalanceRemaining(e.target.value)}
                      placeholder="Auto-calculated if left blank"
                      disabled={editSetupId === null}
                      style={editSetupId === null ? { backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' } : {}}
                    />
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
                    href={`${API_BASE}/payroll/loan-deduction-setups/template`}
                    download="loan_setup_import_template.csv"
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
                  <li>Column 1: **Staff ID** or **File Number**</li>
                  <li>Column 2: **Loan Amount**</li>
                  <li>Column 3: **Interest Rate (%)**</li>
                  <li>Column 4: **Duration Months**</li>
                  <li>Column 5: **Start Month** (format: `YYYY-MM`)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List Card */}
      <div className={styles.card} style={{ marginTop: '32px' }}>
        <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <h2 className={styles.cardTitle}>Deduction Setup Configurations</h2>
          <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '320px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                className={styles.input}
                style={{ paddingLeft: '36px' }}
                placeholder="Search staff configurations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={styles.cardBody} style={{ padding: '0' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          ) : filteredSetups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--text-secondary)' }} />
              No deduction setups found.
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
                    <th>Start / End Month</th>
                    <th>Balance Remaining</th>
                    <th>Status</th>
                    {isConfigurator && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedSetups.map((setup) => (
                    <tr key={setup.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{setup.name}</div>
                        <div className={styles.staffFileNo} style={{ fontSize: '0.8rem' }}>{setup.fileNo}</div>
                      </td>
                      <td style={{ fontWeight: '500' }}>₦ {fmt(setup.loan_amount)}</td>
                      <td>{setup.interest_rate}%</td>
                      <td>{setup.duration_months} Months</td>
                      <td style={{ color: 'var(--danger)', fontWeight: '600' }}>₦ {fmt(setup.monthly_deduction)}</td>
                      <td>
                        <div>Start: {setup.start_month}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>End: {setup.end_month}</div>
                      </td>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        ₦ {fmt(setup.balance_remaining)}
                      </td>
                      <td>
                        <span className={setup.is_active === 1 ? styles.badgeSuccess : styles.badgeDanger}>
                          {setup.is_active === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isConfigurator && (
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className={styles.iconButton}
                              onClick={() => handleToggleStatus(setup.id)}
                              title={setup.is_active === 1 ? 'Deactivate' : 'Activate'}
                            >
                              <Power size={14} style={{ color: setup.is_active === 1 ? 'var(--danger)' : 'var(--success)' }} />
                            </button>
                            <button
                              className={styles.iconButton}
                              onClick={() => handleEdit(setup)}
                              title="Modify Setup"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className={styles.iconButton}
                              onClick={() => handleDelete(setup.id)}
                              title="Delete Setup"
                            >
                              <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Showing Page {currentPage} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  style={{ padding: '0.4rem 0.8rem' }}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                >
                  Previous
                </button>
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  style={{ padding: '0.4rem 0.8rem' }}
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                >
                  Next
                </button>
              </div>
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
