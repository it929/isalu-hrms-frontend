"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  const MONTHS = [
    { id: '01', name: 'January', code: 'JANUARY' },
    { id: '02', name: 'February', code: 'FEBRUARY' },
    { id: '03', name: 'March', code: 'MARCH' },
    { id: '04', name: 'April', code: 'APRIL' },
    { id: '05', name: 'May', code: 'MAY' },
    { id: '06', name: 'June', code: 'JUNE' },
    { id: '07', name: 'July', code: 'JULY' },
    { id: '08', name: 'August', code: 'AUGUST' },
    { id: '09', name: 'September', code: 'SEPTEMBER' },
    { id: '10', name: 'October', code: 'OCTOBER' },
    { id: '11', name: 'November', code: 'NOVEMBER' },
    { id: '12', name: 'December', code: 'DECEMBER' },
  ];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');

  const [editSetupId, setEditSetupId] = useState(null);
  const [staffSalaryInfo, setStaffSalaryInfo] = useState(null);
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthNum);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [absentDays, setAbsentDays] = useState('');
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

  // Fetch staff monthly and daily salary rate
  const fetchStaffSalary = useCallback(async (staffId) => {
    setLoadingSalary(true);
    try {
      const headers = buildHeaders();
      const res = await axios.get(`${API_BASE}/payroll/absence-penalty-deduction-setups/staff-salary/${staffId}?month=${selectedMonth}&year=${selectedYear}`, { headers });
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
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (selectedStaff) {
      fetchStaffNetPay(selectedStaff.id);
      fetchStaffSalary(selectedStaff.id);
    } else {
      setStaffNetPay(null);
      setStaffSalaryInfo(null);
    }
  }, [selectedStaff, fetchStaffNetPay, fetchStaffSalary]);

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setShowDropdown(false);
  };

  const handleClearForm = () => {
    setEditSetupId(null);
    setSelectedStaff(null);
    setDropdownSearch('');
    setStaffSalaryInfo(null);
    setSelectedMonth(currentMonthNum);
    setSelectedYear(String(currentYear));
    setAbsentDays('');
    setRemarks('');
    setIsActive(1);
  };

  // Exact number of days in the selected month & year (e.g. 28/29 for Feb, 30 for Apr/Jun/Sep/Nov, 31 for Jan/Mar/May/Jul/Aug/Oct/Dec)
  const daysInSelectedMonth = useMemo(() => {
    const y = parseInt(selectedYear, 10) || currentYear;
    const m = parseInt(selectedMonth, 10) || parseInt(currentMonthNum, 10);
    return new Date(y, m, 0).getDate();
  }, [selectedYear, selectedMonth, currentYear, currentMonthNum]);

  const selectedMonthObj = MONTHS.find(m => m.id === selectedMonth);

  // Dynamic daily salary based on actual calendar days in the selected month
  const effectiveDailySalary = useMemo(() => {
    if (staffSalaryInfo && staffSalaryInfo.monthly_salary > 0 && daysInSelectedMonth > 0) {
      return staffSalaryInfo.monthly_salary / daysInSelectedMonth;
    }
    return staffSalaryInfo?.daily_salary || 0;
  }, [staffSalaryInfo, daysInSelectedMonth]);

  // Calculated values
  const parsedAbsentDays = parseInt(absentDays, 10);
  const validAbsentDays = (!isNaN(parsedAbsentDays) && parsedAbsentDays > 0) ? parsedAbsentDays : 0;
  const calculatedPenaltyDays = validAbsentDays * 3;
  const calculatedDeductionAmount = (effectiveDailySalary > 0 && validAbsentDays > 0)
    ? (effectiveDailySalary * calculatedPenaltyDays).toFixed(2)
    : '0.00';

  // Submit setup configuration
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }

    if (!validAbsentDays || validAbsentDays <= 0) {
      showToast('Please enter the number of absent days (minimum 1 day).', 'error');
      return;
    }

    if (!selectedMonth || !selectedYear) {
      showToast('Please select the month and year.', 'error');
      return;
    }

    const startMonthStr = `${selectedYear}-${selectedMonth}`;
    const totalAmt = parseFloat(calculatedDeductionAmount) || 0;

    setSaving(true);
    try {
      const payload = {
        id: editSetupId,
        staffId: selectedStaff.id,
        month: selectedMonth,
        year: selectedYear,
        start_month: startMonthStr,
        end_month: startMonthStr,
        absent_days: validAbsentDays,
        penalty_multiplier: 3,
        penalty_days: calculatedPenaltyDays,
        daily_salary: effectiveDailySalary,
        monthly_salary: staffSalaryInfo?.monthly_salary || null,
        total_amount: totalAmt,
        deduction_type: 'one_time',
        duration_months: 1,
        monthly_deduction: totalAmt,
        balance_remaining: totalAmt,
        remarks: remarks.trim() || null,
        is_active: isActive,
      };

      const res = await axios.post(`${API_BASE}/payroll/absence-penalty-deduction-setups`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Absence penalty deduction setup saved successfully.');
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

    setAbsentDays(setup.absent_days ? String(setup.absent_days) : '1');
    setRemarks(setup.remarks || '');
    setIsActive(setup.is_active);

    if (setup.start_month) {
      const parts = setup.start_month.split('-');
      if (parts.length === 2) {
        setSelectedYear(parts[0]);
        setSelectedMonth(parts[1]);
      }
    }

    if (setup.daily_salary || setup.monthly_salary) {
      setStaffSalaryInfo({
        daily_salary: parseFloat(setup.daily_salary) || 0,
        monthly_salary: parseFloat(setup.monthly_salary) || 0,
        penalty_multiplier: setup.penalty_multiplier || 3
      });
    }

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
      (s.remarks && s.remarks.toLowerCase().includes(q)) ||
      (s.start_month && s.start_month.toLowerCase().includes(q));
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
        <h1 className={styles.title}>Absence Penalty Deduction Setup</h1>
        <p className={styles.subtitle}>Configure absence penalty deductions by selecting staff and absent days. The system automatically calculates 3 days salary deduction per absent day and applies it directly to net pay.</p>
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
                                <span className={styles.dropdownItemSub}>ID: {staff.id}</span>
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
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                          marginTop: '0.5rem'
                        }}
                      >
                        <div
                          style={{
                            padding: '0.75rem 1rem',
                            background: 'rgba(59, 130, 246, 0.08)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.9rem',
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
                                  (Active Month: {staffNetPay.month} {staffNetPay.year}){staffNetPay.isEstimated ? ' [Estimated]' : ''}
                                </span>
                              )}
                            </span>
                          )}
                        </div>

                        {staffSalaryInfo && (
                          <div
                            style={{
                              padding: '0.75rem 1rem',
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.2)',
                              borderRadius: '8px',
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.5rem',
                              fontSize: '0.85rem',
                            }}
                          >
                            <span style={{ color: '#6ee7b7', fontWeight: 600 }}>
                              Monthly Salary: ₦{fmt(staffSalaryInfo.monthly_salary)}
                            </span>
                            <span style={{ color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span>Daily Rate ({daysInSelectedMonth} days in {selectedMonthObj?.name || 'Month'}):</span>
                              <span style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                                ₦{fmt(effectiveDailySalary)} / day
                              </span>
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* Target Payroll Month & Year */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Payroll Month *</label>
                      <select
                        className={styles.select}
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        required
                      >
                        {MONTHS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Payroll Year *</label>
                      <select
                        className={styles.select}
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        required
                      >
                        {Array.from({ length: 6 }, (_, i) => currentYear - 2 + i).map((yr) => (
                          <option key={yr} value={String(yr)}>
                            {yr}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Absent Days Input & Live Penalty Calculation Card */}
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.05)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <label className={styles.label} style={{ margin: 0, color: '#f59e0b', fontWeight: 600 }}>
                        Number of Days Absent *
                      </label>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: '12px' }}>
                        Rule: 1 Day Absent = 3 Days Deduction
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className={styles.input}
                        placeholder="Enter absent days..."
                        value={absentDays}
                        onChange={(e) => setAbsentDays(e.target.value)}
                        style={{ maxWidth: '140px' }}
                        required
                      />
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {[1, 2, 3, 4, 5].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setAbsentDays(String(d))}
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.8rem',
                              borderRadius: '6px',
                              border: absentDays === String(d) ? '1px solid #f59e0b' : '1px solid var(--border-color, #e2e8f0)',
                              background: absentDays === String(d) ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                              color: absentDays === String(d) ? '#f59e0b' : 'inherit',
                              cursor: 'pointer',
                              fontWeight: absentDays === String(d) ? '600' : 'normal',
                            }}
                          >
                            {d} {d === 1 ? 'day' : 'days'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Automatic Deduction Calculation Summary */}
                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: '#d97706',
                        background: 'rgba(245, 158, 11, 0.1)',
                        padding: '0.75rem 1rem',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        marginTop: '0.25rem'
                      }}
                    >
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>⚡ Penalty Days: {validAbsentDays} day(s) absent × 3 = {calculatedPenaltyDays} days salary deduction</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed rgba(245, 158, 11, 0.3)', paddingTop: '0.35rem', marginTop: '0.2rem' }}>
                        <span style={{ color: '#92400e', fontWeight: 500 }}>Automatic Deduction from Net Pay:</span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <NairaSign size={16} />
                          {fmt(calculatedDeductionAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Remarks Field & Status */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.6fr)', gap: '1rem' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Remarks (Reason / Absence Details)</label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="e.g. Absent without leave approval on 12th..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        maxLength={500}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Status</label>
                      <select
                        className={styles.select}
                        value={isActive}
                        onChange={(e) => setIsActive(parseInt(e.target.value, 10))}
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
                    {editSetupId ? 'Update Absence Penalty' : 'Save Absence Penalty'}
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
                  <li>Column 1: **Staff ID**</li>
                  <li>Column 2: **Days Absent** (e.g. `1`, `2`, `3`)</li>
                  <li>Column 3: **Deduction Type** (`one_time`)</li>
                  <li>Column 4: **Total Amount** (optional, auto-calculated from days absent)</li>
                  <li>Column 5: **Duration Months** (optional, default: `1`)</li>
                  <li>Column 6: **Start Month** (format: `YYYY-MM`)</li>
                  <li>Column 7: **Remarks** (optional reason / absence details)</li>
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
              placeholder="Search setups by staff name, ID, remarks, or period..."
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
                    <th>Payroll Period</th>
                    <th>Days Absent</th>
                    <th>Penalty Days (3×)</th>
                    <th>Daily Rate</th>
                    <th>Net Pay Deduction</th>
                    <th>Remarks</th>
                    <th>Status</th>
                    {isConfigurator && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedSetups.map((s) => {
                    const days = s.absent_days || (s.total_amount && s.daily_salary ? Math.round(s.total_amount / (s.daily_salary * 3)) : null);
                    const pDays = s.penalty_days || (days ? days * 3 : null);
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className={styles.staffCell}>
                            <span className={styles.staffName}>{s.name}</span>
                            <span className={styles.staffFile}>Staff ID: {s.staffId}</span>
                          </div>
                        </td>
                        <td>{s.department || 'N/A'}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {s.start_month}
                          </span>
                        </td>
                        <td>
                          {days ? (
                            <span style={{ fontWeight: 600, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                              {days} {days === 1 ? 'day' : 'days'}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {pDays ? (
                            <span style={{ fontWeight: 700, color: '#ef4444' }}>
                              {pDays} days
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {s.daily_salary ? `₦${fmt(s.daily_salary)}` : '—'}
                        </td>
                        <td>
                          <strong style={{ color: '#b45309' }}>₦{fmt(s.total_amount)}</strong>
                        </td>
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
                    );
                  })}
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
