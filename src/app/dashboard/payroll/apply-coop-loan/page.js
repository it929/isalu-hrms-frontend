"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  DollarSign,
  Users,
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

export default function ApplyCoopLoanPage() {
  // UI & Loading States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [loans, setLoans] = useState([]);
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
  const [viewRecord, setViewRecord] = useState(null); // detail modal
  const [confirmAction, setConfirmAction] = useState(null); // { type, id, label }
  const [actionLoading, setActionLoading] = useState(false);

  // Form Fields
  const [editLoanId, setEditLoanId] = useState(null);
  const loanType = 'Cooperative Loan'; // Preset to Cooperative Loan
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

  // Fetch dynamic employee loans list
  const fetchLoans = useCallback(async (silent = false) => {
    const cacheKeyLoans = 'hrms_apply_coop_loans_cache';
    let hasCache = false;

    if (!silent) {
      if (typeof window !== 'undefined') {
        const cachedLoans = sessionStorage.getItem(cacheKeyLoans);
        if (cachedLoans) {
          setLoans(JSON.parse(cachedLoans));
          hasCache = true;
        }
      }
      if (!hasCache) setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const loanRes = await axios.get(`${API_BASE}/payroll/coop-loans`, { headers });
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
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!(sessionStorage.getItem('hrms_apply_coop_loans_cache') && sessionStorage.getItem('hrms_coop_loans_staff_cache'));
    }
    const timer = setTimeout(() => {
      fetchStaffData();
      if (!hasCache) {
        fetchLoans();
      }
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [fetchStaffData, fetchLoans]);

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
    : staffList.filter(s =>
        s.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        s.fileNo.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        String(s.id).includes(dropdownSearch)
      );

  // Statistics tailored ONLY for Cooperative Loans
  const coopLoans = loans.filter(l => l.loan_type === 'Cooperative Loan');
  const totalLoansCount = coopLoans.length;
  
  const totalOutstandingBalance = coopLoans
    .filter(l => l.status.toLowerCase() === 'approved')
    .reduce((sum, item) => sum + parseFloat(item.balance || 0), 0);

  const activeMonthlyDeductions = coopLoans
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

    // Check if selected staff has an outstanding Cooperative Loan
    const hasOutstanding = coopLoans.some(l => 
      l.staffId === selectedStaff.id && 
      l.status?.toLowerCase() === 'approved' && 
      parseFloat(l.balance || 0) > 0
    );

    if (hasOutstanding && !editLoanId) {
      showToast('This staff member already has an outstanding Cooperative Loan and cannot apply for a new one.', 'error');
      return;
    }

    if (!loanAmount || parseFloat(loanAmount) <= 0) {
      showToast('Please enter a valid loan amount.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: editLoanId,
        staffId: selectedStaff.id,
        loan_type: loanType,
        loan_amount: parseFloat(loanAmount),
        balance: balance !== '' ? parseFloat(balance) : parseFloat(loanAmount),
        monthly_deduction: 0.00,
        status: status,
      };

      const res = await axios.post(`${API_BASE}/payroll/coop-loans`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Cooperative Loan record saved successfully.');
        handleClearForm();
        fetchLoans(true); // Refetch in-place
      } else {
        showToast(res.data.message || 'Failed to save Cooperative Loan record.', 'error');
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

    setLoanAmount(loan.loan_amount);
    setBalance(loan.balance);
    setMonthlyDeduction(loan.monthly_deduction);
    setStatus(loan.status);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete action
  const handleDelete = (id) => {
    openConfirm('delete', id, 'Delete Cooperative Loan');
  };

  // Approve / Reject / Delete actions confirmation handler
  const openConfirm = (type, id, label) => setConfirmAction({ type, id, label });
  const closeConfirm = () => setConfirmAction(null);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    
    if (type === 'delete') {
      const originalLoans = [...loans];
      setLoans(prevLoans => prevLoans.filter(l => l.id !== id));
      closeConfirm();
      
      try {
        const res = await axios.delete(`${API_BASE}/payroll/coop-loans/${id}`, {
          headers: buildHeaders()
        });
        if (res.data.status === 'success') {
          showToast(res.data.message || 'Loan record deleted successfully.', 'success');
          fetchLoans(true);
        } else {
          showToast(res.data.message || 'Failed to delete loan record.', 'error');
          setLoans(originalLoans);
        }
      } catch (err) {
        showToast(err.response?.data?.message || 'Server error deleting record.', 'error');
        setLoans(originalLoans);
      }
      return;
    }

    setActionLoading(true);
    try {
      const endpoint = `${API_BASE}/payroll/coop-loans/${type}/${id}`;
      const res = await axios.get(endpoint, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        fetchLoans(true);
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

  // Filter existing loans for the table (Cooperative Loans only)
  const filteredLoans = coopLoans.filter(l => {
    if (selectedStaff && Number(l.staffId) !== Number(selectedStaff.id)) {
      return false;
    }
    const q = searchQuery.toLowerCase();
    const nameMatch = l.name ? String(l.name).toLowerCase().includes(q) : false;
    const fileMatch = l.fileNo ? String(l.fileNo).toLowerCase().includes(q) : false;
    return nameMatch || fileMatch;
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
        <h1 className={styles.title}>Cooperative Loan Workspace</h1>
        <p className={styles.subtitle}>Apply and manage cooperative loan allocations, outstanding balances, and monthly cooperative payroll deductions.</p>
      </div>

      {/* Statistics section */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            <Users size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Cooperative Loans</div>
            <div className={styles.statValue}>{totalLoansCount.toLocaleString()}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            <DollarSign size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Coop. Outstanding Balance</div>
            <div className={styles.statValue}>₦{fmt(totalOutstandingBalance)}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <TrendingUp size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Coop. Monthly Deductions</div>
            <div className={styles.statValue}>₦{fmt(activeMonthlyDeductions)}</div>
          </div>
        </div>
      </div>

      {/* Setup Form Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>{editLoanId ? 'Modify Cooperative Loan Assignment' : 'Apply For A Cooperative Loan'}</h2>
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

              {/* Loan Amount */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Cooperative Loan Amount (₦) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={styles.input}
                  placeholder="0.00"
                  value={loanAmount}
                  onChange={(e) => {
                    setLoanAmount(e.target.value);
                    if (!editLoanId) {
                      setBalance(e.target.value);
                    }
                  }}
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
                {editLoanId ? 'Update Loan Assignment' : 'Apply for Cooperative Loan'}
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
              placeholder="Search by staff name or file number..."
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
              <div>Loading cooperative loan allocations...</div>
            </div>
          ) : paginatedLoans.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Department</th>
                  <th>Loan Amount</th>
                  <th>Outstanding Balance</th>
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
                      <td>₦{fmt(loan.loan_amount)}</td>
                      <td>₦{fmt(loan.balance)}</td>
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
            <div className={styles.emptyState}>No cooperative loan records found.</div>
          )}
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.paginationText}>
              Showing Page {currentPage} of {totalPages} ({filteredLoans.length} total records)
            </span>
            <div className={styles.paginationButtons}>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details View Modal */}
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
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Cooperative Loan Allocation Details</h3>
                <button className={styles.modalClose} onClick={() => setViewRecord(null)}>
                  <X size={16} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff Member</span>
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
                    <span className={styles.detailLabel}>Total Loan Amount</span>
                    <span className={styles.detailValue}>₦{fmt(viewRecord.loan_amount)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Outstanding Balance</span>
                    <span className={styles.detailValue}>₦{fmt(viewRecord.balance)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Monthly Repayment</span>
                    <span className={styles.detailValue}>₦{fmt(viewRecord.monthly_deduction)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Approval Status</span>
                    <span className={styles.detailValue} style={{ textTransform: 'capitalize' }}>
                      {viewRecord.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.modalCloseBtn} onClick={() => setViewRecord(null)}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.modalBox}
              style={{ maxWidth: '400px' }}
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
            >
              <div className={styles.confirmBox}>
                <div className={`${styles.confirmIcon} ${confirmAction.type === 'delete' ? styles.confirmIconRed : styles.confirmIconGreen}`}>
                  {confirmAction.type === 'delete' ? <XCircle size={36} /> : <ThumbsUp size={36} />}
                </div>
                <h3 className={styles.cardTitle} style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  {confirmAction.label}
                </h3>
                <p className={styles.confirmMsg}>
                  Are you sure you want to perform this action?
                </p>
                <div className={styles.confirmActions}>
                  <button
                    className={styles.modalCloseBtn}
                    onClick={closeConfirm}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className={`${styles.confirmActionBtn} ${confirmAction.type === 'delete' ? styles.dangerBtn : styles.successBtn}`}
                    onClick={handleConfirmAction}
                    disabled={actionLoading}
                  >
                    {actionLoading && <Loader2 size={16} className="animate-spin" />}
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
