"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Users, TrendingUp, Search, Loader2, FileText, AlertCircle, CheckCircle2, Edit2, Trash2, Plus, X, Settings, Calendar, Percent, Power } from 'lucide-react';
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

export default function CoopLoanDeductionSetupPage() {
  // UI & Loading States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  // Fetch dynamic coop loan deduction setups list
  const fetchSetups = useCallback(async (silent = false) => {
    const cacheKeySetups = 'hrms_coop_loan_deductions_cache';
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
      const res = await axios.get(`${API_BASE}/payroll/coop-loan-deduction-setups`, { headers });
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
      showToast('Failed to retrieve cooperative loan deduction setups.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!(sessionStorage.getItem('hrms_coop_loan_deductions_cache') && sessionStorage.getItem('hrms_coop_loans_staff_cache'));
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
      const res = await axios.get(`${API_BASE}/payroll/coop-loans/approved/${staff.id}`, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success' && res.data.data) {
        setLoanAmount(res.data.data.loan_amount);
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

      const res = await axios.post(`${API_BASE}/payroll/coop-loan-deduction-setups`, payload, {
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
      const res = await axios.post(`${API_BASE}/payroll/coop-loan-deduction-setups/toggle/${id}`, {}, {
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
        const res = await axios.delete(`${API_BASE}/payroll/coop-loan-deduction-setups/${id}`, {
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
        <h1 className={styles.title}>Cooperative Loan Deduction Setup</h1>
        <p className={styles.subtitle}>Configure how cooperative loan deductions are recovered monthly from employee salaries, including interest and durations.</p>
      </div>

      {isConfigurator && (
        <div className={styles.card}>
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
                </div>

                {/* Loan Amount */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Loan Amount (₦) *</label>
                  <div className={styles.inputGroup}>
                    <NairaSign size={16} className={styles.inputIcon} />
                    <input
                      type="number"
                      step="0.01"
                      className={`${styles.input} ${styles.inputWithIcon}`}
                      placeholder="Enter loan amount"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Interest Rate */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Interest Rate (%) *</label>
                  <div className={styles.inputGroup}>
                    <Percent size={16} className={styles.inputIcon} />
                    <input
                      type="number"
                      step="0.01"
                      className={`${styles.input} ${styles.inputWithIcon}`}
                      placeholder="Enter interest rate (e.g. 5)"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Duration Months */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Duration (Months) *</label>
                  <div className={styles.inputGroup}>
                    <Calendar size={16} className={styles.inputIcon} />
                    <input
                      type="number"
                      className={`${styles.input} ${styles.inputWithIcon}`}
                      placeholder="Duration in months"
                      value={durationMonths}
                      onChange={(e) => setDurationMonths(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Calculated Monthly Deduction */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Monthly Deduction (Calculated)</label>
                  <div className={styles.inputGroup}>
                    <NairaSign size={16} className={styles.inputIcon} />
                    <input
                      type="number"
                      step="0.01"
                      className={`${styles.input} ${styles.inputWithIcon}`}
                      value={monthlyDeduction}
                      onChange={(e) => setMonthlyDeduction(e.target.value)}
                      placeholder="Computed deduction"
                    />
                  </div>
                </div>

                {/* Balance Remaining */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Balance Remaining</label>
                  <div className={styles.inputGroup}>
                    <NairaSign size={16} className={styles.inputIcon} />
                    <input
                      type="number"
                      step="0.01"
                      className={`${styles.input} ${styles.inputWithIcon}`}
                      placeholder="Balance outstanding"
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

                {/* End Month */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>End Month (Calculated)</label>
                  <input
                    type="month"
                    className={styles.input}
                    value={endMonth}
                    readOnly
                  />
                </div>

                {/* Active Toggle Status */}
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

              <div className={styles.formActions}>
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
                    <th>Loan Amount</th>
                    <th>Interest</th>
                    <th>Duration</th>
                    <th>Monthly Deduction</th>
                    <th>Balance</th>
                    <th>Period</th>
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
                      <td>₦{fmt(s.loan_amount)}</td>
                      <td>{s.interest_rate}%</td>
                      <td>{s.duration_months} Months</td>
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
              <p>No cooperative loan setups found.</p>
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
