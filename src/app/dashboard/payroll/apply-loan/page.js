"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  DollarSign,
  Users,
  TrendingDown,
  TrendingUp,
  Search,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Plus,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  Eye,
  X,
  XCircle,
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

function statusBadge(status) {
  const s = status ? status.toLowerCase() : '';
  switch (s) {
    case 'recommended': return { label: 'HOD Approved',  cls: styles.badgeHodApproved };
    case 'hr_approved': return { label: 'HR Approved',   cls: styles.badgeHrApproved };
    case 'approved':    return { label: 'Approved',      cls: styles.badgeApproved };
    case 'hod_rejected': return { label: 'HOD Rejected',  cls: styles.badgeRejected };
    case 'hr_rejected':  return { label: 'HR Rejected',   cls: styles.badgeRejected };
    case 'audit_rejected': return { label: 'Audit Rejected', cls: styles.badgeRejected };
    case 'rejected':    return { label: 'Rejected',      cls: styles.badgeRejected };
    case 'completed':   return { label: 'Completed',     cls: styles.badgeCompleted };
    default:            return { label: 'Pending',       cls: styles.badgePending };
  }
}

export default function ApplyLoanPage() {
  // UI & Loading States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loanTypes, setLoanTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown Autocomplete Staff State
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const dropdownRef = useRef(null);

  // Dropdown Custom Select Loan Type State
  const [showLoanTypeDropdown, setShowLoanTypeDropdown] = useState(false);
  const loanTypeDropdownRef = useRef(null);

  // User Context State
  const [userCtx, setUserCtx] = useState({
    isSuperAdmin: false,
    isHod: false,
    isAdminStaff: false,
    isAuditStaff: false,
    employee: null,
  });

  // Modal States
  const [viewRecord, setViewRecord] = useState(null); // detail modal
  const [confirmAction, setConfirmAction] = useState(null); // { type, id, label }
  const [actionLoading, setActionLoading] = useState(false);

  // Form Fields
  const [editLoanId, setEditLoanId] = useState(null);
  const [loanType, setLoanType] = useState('Personal Loan');
  const [customLoanType, setCustomLoanType] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [balance, setBalance] = useState('');
  const [monthlyDeduction, setMonthlyDeduction] = useState('');
  const [status, setStatus] = useState('pending');

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch static data (staff, loan types) once on mount
  const fetchStaticData = useCallback(async () => {
    const cacheKeyStaff = 'hrms_apply_loan_staff_cache';
    const cacheKeyTypes = 'hrms_apply_loan_types_cache';
    if (typeof window !== 'undefined') {
      const cachedStaff = sessionStorage.getItem(cacheKeyStaff);
      const cachedTypes = sessionStorage.getItem(cacheKeyTypes);
      if (cachedStaff && cachedTypes) {
        setStaffList(JSON.parse(cachedStaff));
        setLoanTypes(JSON.parse(cachedTypes));
        return;
      }
    }

    const headers = buildHeaders();
    try {
      const [staffRes, typesRes] = await Promise.all([
        axios.get(`${API_BASE}/payroll/loans/staff`, { headers }),
        axios.get(`${API_BASE}/payroll/loans/types`, { headers }),
      ]);

      if (staffRes.data.status === 'success') {
        const staff = staffRes.data.data || [];
        setStaffList(staff);
        if (typeof window !== 'undefined') sessionStorage.setItem(cacheKeyStaff, JSON.stringify(staff));
      }
      if (typesRes.data.status === 'success') {
        const types = typesRes.data.data || [];
        setLoanTypes(types);
        if (typeof window !== 'undefined') sessionStorage.setItem(cacheKeyTypes, JSON.stringify(types));
      }
    } catch (err) {
      console.error('Failed to retrieve static loan setup info:', err);
    }
  }, []);

  // Fetch dynamic employee loans list
  const fetchLoans = useCallback(async (silent = false) => {
    const cacheKeyLoans = 'hrms_apply_loan_loans_cache';
    let hasCache = false;

    if (typeof window !== 'undefined') {
      const cachedLoans = sessionStorage.getItem(cacheKeyLoans);
      if (cachedLoans) {
        setLoans(JSON.parse(cachedLoans));
        hasCache = true;
      }
    }

    if (!silent && !hasCache) {
      setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const loanRes = await axios.get(`${API_BASE}/payroll/loans`, { headers });
      if (loanRes.data.status === 'success') {
        const freshLoans = loanRes.data.data || [];
        setLoans(freshLoans);
        setUserCtx({
          isSuperAdmin: loanRes.data.isSuperAdmin || false,
          isHod: loanRes.data.isHod || false,
          isAdminStaff: loanRes.data.isAdminStaff || false,
          isAuditStaff: loanRes.data.isAuditStaff || false,
          employee: loanRes.data.employee || null,
        });
        if (typeof window !== 'undefined') sessionStorage.setItem(cacheKeyLoans, JSON.stringify(freshLoans));
      }
    } catch (err) {
      showToast('Failed to retrieve loan records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!(sessionStorage.getItem('hrms_apply_loan_loans_cache') && sessionStorage.getItem('hrms_apply_loan_staff_cache') && sessionStorage.getItem('hrms_apply_loan_types_cache'));
    }
    fetchStaticData();
    fetchLoans(hasCache);
  }, [fetchStaticData, fetchLoans]);

  // Click outside listener for staff dropdown autocomplete and custom select
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (loanTypeDropdownRef.current && !loanTypeDropdownRef.current.contains(event.target)) {
        setShowLoanTypeDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prepopulate employee ID for non-admin users
  useEffect(() => {
    const isSuperAdmin = userCtx.isSuperAdmin;
    const isAdminStaff = userCtx.isAdminStaff;
    const currentEmployee = userCtx.employee;

    if (!(isSuperAdmin || isAdminStaff) && currentEmployee && staffList.length > 0) {
      const matchingStaff = staffList.find(s => s.id === currentEmployee.ID);
      if (matchingStaff) {
        setSelectedStaff(matchingStaff);
        setDropdownSearch(matchingStaff.name);
      }
    }
  }, [staffList, userCtx]);

  // Filter staff list
  const filteredStaff = dropdownSearch.trim() === ''
    ? staffList
    : staffList.filter(s => {
        const q = dropdownSearch.toLowerCase();
        const nameMatch = s.name ? String(s.name).toLowerCase().includes(q) : false;
        const fileMatch = s.fileNo ? String(s.fileNo).toLowerCase().includes(q) : false;
        const idMatch = s.id ? String(s.id).includes(q) : false;
        return nameMatch || fileMatch || idMatch;
      });

  // Statistics
  const totalLoansCount = loans.length;
  
  const totalOutstandingBalance = loans
    .filter(l => l.status.toLowerCase() === 'approved')
    .reduce((sum, item) => sum + parseFloat(item.balance || 0), 0);

  const activeMonthlyDeductions = loans
    .filter(l => l.status.toLowerCase() === 'approved')
    .reduce((sum, item) => sum + parseFloat(item.monthly_deduction || 0), 0);

  // Handle Select Staff from Autocomplete
  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setShowDropdown(false);
  };

  const handleClearForm = () => {
    setEditLoanId(null);
    const isSuperAdmin = userCtx.isSuperAdmin;
    const isAdminStaff = userCtx.isAdminStaff;
    const currentEmployee = userCtx.employee;

    if (!(isSuperAdmin || isAdminStaff) && currentEmployee) {
      const matchingStaff = staffList.find(s => s.id === currentEmployee.ID);
      if (matchingStaff) {
        setSelectedStaff(matchingStaff);
        setDropdownSearch(matchingStaff.name);
      }
    } else {
      setSelectedStaff(null);
      setDropdownSearch('');
    }

    setLoanType('Personal Loan');
    setCustomLoanType('');
    setLoanAmount('');
    setBalance('');
    setMonthlyDeduction('');
    setStatus('pending');
  };

  // Submit loan application
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }

    // Check if selected staff has an outstanding loan
    const hasOutstanding = loans.some(l => 
      l.staffId === selectedStaff.id && 
      l.status?.toLowerCase() === 'approved' && 
      parseFloat(l.balance || 0) > 0
    );

    if (hasOutstanding && !editLoanId) {
      showToast('This staff member already has an outstanding loan and cannot apply for a new one.', 'error');
      return;
    }

    const finalLoanType = loanType === 'Other' ? customLoanType.trim() : loanType;
    if (!finalLoanType) {
      showToast('Please specify the loan type.', 'error');
      return;
    }

    if (!loanAmount || parseFloat(loanAmount) <= 0) {
      showToast('Please enter a valid loan amount.', 'error');
      return;
    }

    if (!monthlyDeduction || parseFloat(monthlyDeduction) <= 0) {
      showToast('Please enter a valid monthly deduction.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: editLoanId,
        staffId: selectedStaff.id,
        loan_type: finalLoanType,
        loan_amount: parseFloat(loanAmount),
        balance: balance !== '' ? parseFloat(balance) : parseFloat(loanAmount),
        monthly_deduction: parseFloat(monthlyDeduction),
        status: status,
      };

      const res = await axios.post(`${API_BASE}/payroll/loans`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Loan record saved successfully.');
        handleClearForm();
        fetchLoans(true); // Silent refetch in-place
      } else {
        showToast(res.data.message || 'Failed to save loan record.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error saving record.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Edit action
  const handleEdit = (loan) => {
    setEditLoanId(loan.id);
    const staff = staffList.find(s => s.id === loan.staffId);
    if (staff) {
      setSelectedStaff(staff);
      setDropdownSearch(staff.name);
    } else {
      setSelectedStaff({ id: loan.staffId, name: loan.name || 'Unknown Staff' });
      setDropdownSearch(loan.name || 'Unknown Staff');
    }

    const standardTypes = loanTypes.map(t => t.name);
    if (standardTypes.includes(loan.loan_type)) {
      setLoanType(loan.loan_type);
      setCustomLoanType('');
    } else {
      setLoanType('Other');
      setCustomLoanType(loan.loan_type);
    }

    setLoanAmount(loan.loan_amount);
    setBalance(loan.balance);
    setMonthlyDeduction(loan.monthly_deduction);
    setStatus(loan.status);

    // Scroll smoothly to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete action
  const handleDelete = (id) => {
    openConfirm('delete', id, 'Delete Loan');
  };

  // Approve / Reject / Delete actions confirmation handler
  const openConfirm = (type, id, label) => setConfirmAction({ type, id, label });
  const closeConfirm = () => setConfirmAction(null);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    
    if (type === 'delete') {
      const originalLoans = [...loans];
      // Optimistic UI Update: remove immediately
      setLoans(prevLoans => prevLoans.filter(l => l.id !== id));
      closeConfirm();
      
      try {
        const res = await axios.delete(`${API_BASE}/payroll/loans/${id}`, {
          headers: buildHeaders()
        });
        if (res.data.status === 'success') {
          showToast(res.data.message || 'Loan record deleted successfully.', 'success');
          fetchLoans(true); // Silent refetch
        } else {
          showToast(res.data.message || 'Failed to delete loan record.', 'error');
          setLoans(originalLoans); // Rollback
        }
      } catch (err) {
        showToast(err.response?.data?.message || 'Server error deleting record.', 'error');
        setLoans(originalLoans); // Rollback
      }
      return;
    }

    setActionLoading(true);
    try {
      const endpoint = `${API_BASE}/payroll/loans/${type}/${id}`;
      const res = await axios.get(endpoint, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        fetchLoans(true); // Refetch
      } else {
        showToast(res.data.message || 'Action failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'An error occurred. Please try again.', 'error');
      console.error(err);
    } finally {
      setActionLoading(false);
      closeConfirm();
    }
  };

  // Filter existing loans for the table
  const filteredLoans = loans.filter(l => {
    const q = searchQuery.toLowerCase();
    const nameMatch = l.name ? String(l.name).toLowerCase().includes(q) : false;
    const fileMatch = l.fileNo ? String(l.fileNo).toLowerCase().includes(q) : false;
    const typeMatch = l.loan_type ? String(l.loan_type).toLowerCase().includes(q) : false;
    return nameMatch || fileMatch || typeMatch;
  });

  // Calculate paginated loans
  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
  const paginatedLoans = filteredLoans.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Access rights check
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

  const canSelectStaff = userCtx.isSuperAdmin || userCtx.isAdminStaff || checkAdminPrivilege();
  const canHodAct = userCtx.isHod || userCtx.isSuperAdmin || userCtx.isAdminStaff || checkAdminPrivilege();
  const canAuditAct = userCtx.isAuditStaff || userCtx.isSuperAdmin || userCtx.isAdminStaff || checkAdminPrivilege();
  const canAdminAct = userCtx.isAdminStaff || userCtx.isSuperAdmin || checkAdminPrivilege();

  const canEditDelete = (loan) => {
    if (loan.status?.toLowerCase() !== 'pending') return false;
    if (userCtx.isSuperAdmin || userCtx.isAdminStaff) return true;
    return userCtx.employee && loan.staffId === userCtx.employee.ID;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Loan Application Workspace</h1>
        <p className={styles.subtitle}>Apply and manage employee loan allocations, outstanding balances, and monthly payroll deductions.</p>
      </div>

      {/* Statistics section */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            <Users size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Configured Loans</div>
            <div className={styles.statValue}>{totalLoansCount.toLocaleString()}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            <DollarSign size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Outstanding Balance</div>
            <div className={styles.statValue}>₦{fmt(totalOutstandingBalance)}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <TrendingUp size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Monthly Deductions</div>
            <div className={styles.statValue}>₦{fmt(activeMonthlyDeductions)}</div>
          </div>
        </div>
      </div>

      {/* Setup Form Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>{editLoanId ? 'Modify Loan Assignment' : 'Apply For A Loan'}</h2>
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
                    className={`${styles.input} ${!canSelectStaff ? styles.readonly : ''}`}
                    placeholder="Search by name, file number..."
                    value={dropdownSearch}
                    onChange={(e) => {
                      if (!canSelectStaff) return;
                      setDropdownSearch(e.target.value);
                      setShowDropdown(true);
                      if (selectedStaff && e.target.value !== selectedStaff.name) {
                        setSelectedStaff(null);
                      }
                    }}
                    onFocus={() => {
                      if (canSelectStaff) setShowDropdown(true);
                    }}
                    readOnly={!canSelectStaff}
                  />
                  {showDropdown && canSelectStaff && (
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
                        <li className={styles.dropdownEmpty}>No staff found</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* Loan Type */}
              <div className={styles.formGroup} ref={loanTypeDropdownRef}>
                <label className={styles.label}>Loan Type *</label>
                <div className={styles.customSelectContainer}>
                  <button
                    type="button"
                    className={`${styles.customSelectTrigger} ${showLoanTypeDropdown ? styles.customSelectTriggerActive : ''}`}
                    onClick={() => setShowLoanTypeDropdown(!showLoanTypeDropdown)}
                  >
                    <span>{loanType === 'Other' ? 'Other (Custom Type)' : loanType}</span>
                    <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  {showLoanTypeDropdown && (
                    <ul className={styles.customSelectDropdown}>
                      {[...loanTypes.map(t => t.name), 'Other'].map((type) => (
                        <li
                          key={type}
                          className={`${styles.customSelectItem} ${loanType === type ? styles.customSelectItemActive : ''}`}
                          onClick={() => {
                            setLoanType(type);
                            setShowLoanTypeDropdown(false);
                          }}
                        >
                          {type === 'Other' ? 'Other (Custom Type)' : type}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Custom Loan Type (if Other) */}
              {loanType === 'Other' && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Specify Loan Type *</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g. Visa Loan"
                    value={customLoanType}
                    onChange={(e) => setCustomLoanType(e.target.value)}
                  />
                </div>
              )}

              {/* Loan Amount */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Loan Amount (₦) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={styles.input}
                  placeholder="0.00"
                  value={loanAmount}
                  onChange={(e) => {
                    setLoanAmount(e.target.value);
                    // Autofill balance with loan amount if creating a new entry
                    if (!editLoanId) {
                      setBalance(e.target.value);
                    }
                  }}
                />
              </div>


              {/* Monthly Deduction */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Monthly Deduction (₦) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={styles.input}
                  placeholder="0.00"
                  value={monthlyDeduction}
                  onChange={(e) => setMonthlyDeduction(e.target.value)}
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
                Clear
              </button>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={saving}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editLoanId ? 'Update Loan Assignment' : 'Apply Loan'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Existing Loan Allocations Table */}
      <div className={styles.card}>
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <Search size={18} className={styles.inputIcon} />
            <input
              type="text"
              placeholder="Search by staff name, file number, or loan type..."
              className={`${styles.input} ${styles.inputWithIcon}`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary)' }} />
              <div>Loading loan allocations...</div>
            </div>
          ) : paginatedLoans.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Department</th>
                  <th>Loan Type</th>
                  <th>Loan Amount</th>
                  <th>Outstanding Balance</th>
                  <th>Monthly Deduction</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLoans.map((loan) => {
                  const badge = statusBadge(loan.status);
                  return (
                    <tr key={loan.id}>
                      <td>
                        <div className={styles.staffCell}>
                          <span className={styles.staffName}>{loan.name}</span>
                          <span className={styles.staffFile}>File No: {loan.fileNo || 'N/A'}</span>
                        </div>
                      </td>
                      <td>{loan.department || 'N/A'}</td>
                      <td>{loan.loan_type}</td>
                      <td>₦{fmt(loan.loan_amount)}</td>
                      <td>₦{fmt(loan.balance)}</td>
                      <td>₦{fmt(loan.monthly_deduction)}</td>
                      <td>
                        <span className={`${styles.badge} ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionGroup}>
                          {/* View Detail */}
                          <button
                            className={`${styles.iconBtn} ${styles.viewBtn}`}
                            title="View Details"
                            onClick={() => setViewRecord(loan)}
                          >
                            <Eye size={14} />
                          </button>

                          {/* HOD Actions (status = pending) */}
                          {loan.status?.toLowerCase() === 'pending' && canHodAct && (
                            <>
                              <button
                                className={`${styles.iconBtn} ${styles.approveBtn}`}
                                title="HOD Approve"
                                onClick={() => openConfirm('hod-approve', loan.id, 'HOD Approve')}
                              >
                                <ThumbsUp size={14} />
                              </button>
                              <button
                                className={`${styles.iconBtn} ${styles.rejectBtn}`}
                                title="HOD Reject"
                                onClick={() => openConfirm('hod-reject', loan.id, 'HOD Reject')}
                              >
                                <ThumbsDown size={14} />
                              </button>
                            </>
                          )}

                          {/* Admin/HR Actions (status = recommended) */}
                          {loan.status?.toLowerCase() === 'recommended' && canAdminAct && (
                            <>
                              <button
                                className={`${styles.iconBtn} ${styles.approveBtn}`}
                                title="HR Approve"
                                onClick={() => openConfirm('admin-approve', loan.id, 'HR Approve')}
                              >
                                <ThumbsUp size={14} />
                              </button>
                              <button
                                className={`${styles.iconBtn} ${styles.rejectBtn}`}
                                title="HR Reject"
                                onClick={() => openConfirm('admin-reject', loan.id, 'HR Reject')}
                              >
                                <ThumbsDown size={14} />
                              </button>
                            </>
                          )}

                          {/* Audit Actions (status = hr_approved) */}
                          {loan.status?.toLowerCase() === 'hr_approved' && canAuditAct && (
                            <>
                              <button
                                className={`${styles.iconBtn} ${styles.approveBtn}`}
                                title="Audit Approve"
                                onClick={() => openConfirm('audit-approve', loan.id, 'Audit Approve')}
                              >
                                <ThumbsUp size={14} />
                              </button>
                              <button
                                className={`${styles.iconBtn} ${styles.rejectBtn}`}
                                title="Audit Reject"
                                onClick={() => openConfirm('audit-reject', loan.id, 'Audit Reject')}
                              >
                                <ThumbsDown size={14} />
                              </button>
                            </>
                          )}

                          {/* Edit / Delete Actions */}
                          {canEditDelete(loan) && (
                            <>
                              <button
                                className={`${styles.iconBtn} ${styles.editBtn}`}
                                title="Edit Assignment"
                                onClick={() => handleEdit(loan)}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                title="Delete Loan"
                                onClick={() => handleDelete(loan.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyState}>
              <FileText size={32} className={styles.emptyIcon} />
              <div>No loan records found.</div>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.paginationText}>
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLoans.length)} of {filteredLoans.length} entries
            </span>
            <div className={styles.paginationButtons}>
              <button
                className={styles.btnSecondary}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(c => c - 1)}
              >
                Previous
              </button>
              <button
                className={styles.btnSecondary}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(c => c + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ VIEW DETAIL MODAL ═══════════════ */}
      <AnimatePresence>
        {viewRecord && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewRecord(null)}
          >
            <motion.div
              className={styles.modalBox}
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Loan Details</h3>
                <button className={styles.modalClose} onClick={() => setViewRecord(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff Name</span>
                    <span className={styles.detailValue}>{viewRecord.name}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>File Number</span>
                    <span className={styles.detailValue}>{viewRecord.fileNo || 'N/A'}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Department</span>
                    <span className={styles.detailValue}>{viewRecord.department || 'N/A'}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Loan Type</span>
                    <span className={styles.detailValue}>{viewRecord.loan_type}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Loan Amount</span>
                    <span className={styles.detailValue}>₦{fmt(viewRecord.loan_amount)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Outstanding Balance</span>
                    <span className={styles.detailValue}>₦{fmt(viewRecord.balance)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Monthly Deduction</span>
                    <span className={styles.detailValue}>₦{fmt(viewRecord.monthly_deduction)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Status</span>
                    <span className={`${styles.badge} ${statusBadge(viewRecord.status).cls}`}>
                      {statusBadge(viewRecord.status).label}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.modalCloseBtn} onClick={() => setViewRecord(null)}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ CONFIRM ACTION MODAL ═══════════════ */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeConfirm}
          >
            <motion.div
              className={`${styles.modalBox} ${styles.confirmBox}`}
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={`${styles.confirmIcon} ${confirmAction.type.includes('reject') || confirmAction.type === 'delete' ? styles.confirmIconRed : styles.confirmIconGreen}`}>
                {confirmAction.type === 'delete' ? (
                  <Trash2 size={28} />
                ) : confirmAction.type.includes('reject') ? (
                  <XCircle size={28} />
                ) : (
                  <CheckCircle2 size={28} />
                )}
              </div>
              <h3 className={styles.modalTitle}>Confirm Action</h3>
              <p className={styles.confirmMsg}>
                {confirmAction.type === 'delete' ? (
                  <>Are you sure you want to <strong>delete</strong> this loan request? This action cannot be undone.</>
                ) : (
                  <>Are you sure you want to <strong>{confirmAction.type.includes('reject') ? 'reject' : 'approve'}</strong> this loan request?</>
                )}
              </p>
              <div className={styles.confirmActions}>
                <button className={styles.modalCloseBtn} onClick={closeConfirm} disabled={actionLoading}>
                  Cancel
                </button>
                <button
                  className={`${styles.confirmActionBtn} ${confirmAction.type.includes('reject') || confirmAction.type === 'delete' ? styles.dangerBtn : styles.successBtn}`}
                  onClick={handleConfirmAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <><Loader2 size={15} className="animate-spin" /> Processing…</>
                  ) : confirmAction.type === 'delete' ? (
                    'Delete'
                  ) : confirmAction.type.includes('reject') ? (
                    'Reject'
                  ) : (
                    'Approve'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}
          >
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
