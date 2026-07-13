"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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

export default function AbsencePenaltyDeductionSetupPage() {
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
  const [deductionType, setDeductionType] = useState('one_time'); // 'one_time' or 'spread'
  const [totalAmount, setTotalAmount] = useState('');
  const [durationMonths, setDurationMonths] = useState('');
  const [monthlyDeduction, setMonthlyDeduction] = useState('');
  const [balanceRemaining, setBalanceRemaining] = useState('');
  const [startMonth, setStartMonth] = useState(''); // Format: YYYY-MM
  const [endMonth, setEndMonth] = useState(''); // Format: YYYY-MM
  const [isActive, setIsActive] = useState(1);

  // Import File Ref
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

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

  // Fetch dynamic absence penalty setups list
  const fetchSetups = useCallback(async (silent = false) => {
    const cacheKeySetups = 'hrms_absence_penalty_setups_cache';
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
      const res = await axios.get(`${API_BASE}/payroll/absence-penalty-deduction-setups`, { headers });
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
      showToast('Failed to retrieve absence penalty setups.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!(sessionStorage.getItem('hrms_absence_penalty_setups_cache') && sessionStorage.getItem('hrms_coop_loans_staff_cache'));
    }
    const timer = setTimeout(() => {
      fetchStaffData();
      fetchSetups(hasCache);
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [fetchStaffData, fetchSetups]);

  // Dynamic calculations for Monthly Deduction and End Month
  useEffect(() => {
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
  }, [totalAmount, durationMonths, deductionType]);

  useEffect(() => {
    if (deductionType === 'one_time') {
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
  }, [startMonth, durationMonths, deductionType]);

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

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setShowDropdown(false);
  };

  const handleClearForm = () => {
    setEditSetupId(null);
    setSelectedStaff(null);
    setDropdownSearch('');
    setDeductionType('one_time');
    setTotalAmount('');
    setDurationMonths('');
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

    const amt = parseFloat(totalAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid total amount.', 'error');
      return;
    }

    let months = 1;
    if (deductionType === 'spread') {
      months = parseInt(durationMonths);
      if (isNaN(months) || months <= 0) {
        showToast('Please enter a valid duration in months.', 'error');
        return;
      }
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
        deduction_type: deductionType,
        total_amount: amt,
        duration_months: months,
        monthly_deduction: parseFloat(monthlyDeduction),
        balance_remaining: balanceRemaining !== '' ? parseFloat(balanceRemaining) : amt,
        start_month: startMonth,
        end_month: endMonth,
        is_active: isActive,
      };

      const res = await axios.post(`${API_BASE}/payroll/absence-penalty-deduction-setups`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Absence penalty configuration saved successfully.');
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

    setDeductionType(setup.deduction_type);
    setTotalAmount(setup.total_amount);
    setDurationMonths(setup.deduction_type === 'spread' ? setup.duration_months : '');
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
      const res = await axios.post(`${API_BASE}/payroll/absence-penalty-deduction-setups/toggle/${id}`, {}, {
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
    setConfirmAction({ type: 'delete', id, label: 'Delete Absence Penalty Setup' });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    setActionLoading(true);

    try {
      if (type === 'delete') {
        const res = await axios.delete(`${API_BASE}/payroll/absence-penalty-deduction-setups/${id}`, {
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
      const res = await axios.post(`${API_BASE}/payroll/absence-penalty-deduction-setups/import`, formData, {
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

  const isConfigurator = userCtx.isSuperAdmin || userCtx.isAdminStaff || checkAdminPrivilege();

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
        <h1 className={styles.title}>Absence Penalty Deduction Setup</h1>
        <p className={styles.subtitle}>Configure absence penalty deductions from employee salaries, supporting both one-time deductions and monthly spreading, as well as bulk spreadsheet importing.</p>
      </div>

      {isConfigurator && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Setup Form */}
          <div className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{editSetupId ? 'Modify Absence Penalty Setup' : 'Create Absence Penalty Setup'}</h2>
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
                                <span className={styles.dropdownItemSub}>ID: {staff.id} | File No: {staff.fileNo}</span>
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
                          fontSize: '0.9rem',
                          marginTop: '0.5rem'
                        }}
                      >
                        <span style={{ color: '#9ca3af' }}>Current Net Pay:</span>
                        {loadingNetPay ? (
                          <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6' }} />
                        ) : (
                          <span style={{ fontWeight: 'bold', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <NairaSign size={14} />
                            {staffNetPay ? fmt(staffNetPay.amount) : '0.00'}
                            {staffNetPay?.month && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#9ca3af', marginLeft: '4px' }}>
                                ({staffNetPay.month} {staffNetPay.year}){staffNetPay.isEstimated ? ' [Estimated]' : ''}
                              </span>
                            )}
                          </span>
                        )}
                      </motion.div>
                    )}
</div>

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
                      <label className={styles.label}>Total Penalty Amount (₦) *</label>
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
                </div>

                <div className={styles.formActions} style={{ marginTop: '1.5rem' }}>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleClearForm}>
                    Clear Form
                  </button>
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
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
                    href={`${API_BASE}/payroll/absence-penalty-deduction-setups/template`}
                    download="absence_penalty_import_template.csv"
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
                  <li>Column 2: **Deduction Type** (`one_time` or `spread`)</li>
                  <li>Column 3: **Total Amount**</li>
                  <li>Column 4: **Duration Months** (optional, ignored for one_time)</li>
                  <li>Column 5: **Start Month** (format: `YYYY-MM`)</li>
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
              placeholder="Search setups by staff name, file number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
                          <span className={styles.staffFile}>ID: {s.staffId} | File: {s.fileNo}</span>
                        </div>
                      </td>
                      <td>{s.department || 'N/A'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{s.deduction_type.replace('_', ' ')}</td>
                      <td>₦{fmt(s.total_amount)}</td>
                      <td>₦{fmt(s.monthly_deduction)}</td>
                      <td>₦{fmt(s.balance_remaining)}</td>
                      <td>{s.start_month} to {s.end_month}</td>
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
              <p>No absence penalty configurations found.</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <span className={styles.paginationText}>
                Page {currentPage} of {totalPages}
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{ padding: '0.4rem 0.8rem' }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{ padding: '0.4rem 0.8rem' }}
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
                Are you sure you want to delete this absence penalty configuration? This action cannot be undone.
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
