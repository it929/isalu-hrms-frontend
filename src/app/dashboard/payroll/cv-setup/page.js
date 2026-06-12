"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  DollarSign,
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
  X,
  XCircle,
  Building,
  Hash,
  ListTodo,
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

export default function CvSetupPage() {
  // Loading & Toast States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Data States
  const [banks, setBanks] = useState([]);
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown Custom Select States
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const typeDropdownRef = useRef(null);
  const bankDropdownRef = useRef(null);

  // User Context State
  const [userCtx, setUserCtx] = useState({
    isSuperAdmin: false,
    isAdminStaff: false,
  });

  // Modal confirm deletion state
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form Fields
  const [editId, setEditId] = useState(null);
  const [particularID, setParticularID] = useState(''); // 1 = Earning, 2 = Deduction
  const [description, setDescription] = useState('');
  const [bank, setBank] = useState(''); // bankID
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [status, setStatus] = useState(true);

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch static data (banks list)
  const fetchBanks = useCallback(async () => {
    const cacheKey = 'hrms_cv_setup_banks_cache';
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setBanks(JSON.parse(cached));
        return;
      }
    }

    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/cv-setups/banks`, { headers });
      if (res.data.status === 'success') {
        const list = res.data.data || [];
        setBanks(list);
        if (typeof window !== 'undefined') sessionStorage.setItem(cacheKey, JSON.stringify(list));
      }
    } catch (err) {
      console.error('Failed to load banks list:', err);
    }
  }, []);

  // Fetch setup registry records
  const fetchRecords = useCallback(async (silent = false) => {
    const cacheKeyRecords = 'hrms_cv_setup_records_cache';
    let hasCache = false;

    if (!silent) {
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(cacheKeyRecords);
        if (cached) {
          setRecords(JSON.parse(cached));
          hasCache = true;
        }
      }
      if (!hasCache) setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/cv-setups`, { headers });
      if (res.data.status === 'success') {
        const list = res.data.data || [];
        setRecords(list);
        setUserCtx({
          isSuperAdmin: res.data.isSuperAdmin || false,
          isAdminStaff: res.data.isAdminStaff || false,
        });
        if (typeof window !== 'undefined') sessionStorage.setItem(cacheKeyRecords, JSON.stringify(list));
      }
    } catch (err) {
      showToast('Failed to retrieve setup variable records.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!(sessionStorage.getItem('hrms_cv_setup_records_cache') && sessionStorage.getItem('hrms_cv_setup_banks_cache'));
    }
    const timer = setTimeout(() => {
      fetchBanks();
      if (!hasCache) {
        fetchRecords();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [fetchBanks, fetchRecords]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
        setShowTypeDropdown(false);
      }
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target)) {
        setShowBankDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Statistics
  const totalCount = records.length;
  const earningsCount = records.filter(r => String(r.particularID) === '1').length;
  const deductionsCount = records.filter(r => String(r.particularID) === '2').length;

  const handleClearForm = () => {
    setEditId(null);
    setParticularID('');
    setDescription('');
    setBank('');
    setAccountName('');
    setAccountNumber('');
    setStatus(true);
    setShowTypeDropdown(false);
    setShowBankDropdown(false);
  };

  // Submit record
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!particularID) {
      showToast('Please select a Particular Type.', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('Please enter a description.', 'error');
      return;
    }

    setSaving(true);
    const headers = buildHeaders();
    const payload = {
      id: editId,
      particularID: parseInt(particularID),
      description: description.trim(),
      bank: bank || null,
      account_name: accountName.trim() || null,
      account_number: accountNumber.trim() || null,
      status: status,
    };

    try {
      const res = await axios.post(`${API_BASE}/payroll/cv-setups`, payload, { headers });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Setup record saved successfully.');
        handleClearForm();
        fetchRecords(true); // silent refresh
      } else {
        showToast(res.data.message || 'An error occurred.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to save setup variable.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Pre-fill Edit form
  const handleEdit = (record) => {
    setEditId(record.id);
    setParticularID(String(record.particularID));
    setDescription(record.description);
    setBank(record.bank ?? '');
    setAccountName(record.account_name ?? '');
    setAccountNumber(record.account_number ?? '');
    setStatus(record.status === 1);
  };

  // Delete Action trigger
  const handleDeleteTrigger = (id) => {
    setConfirmDelete(id);
  };

  // Perform Delete
  const handleDeleteConfirm = async () => {
    const id = confirmDelete;
    if (!id) return;

    setActionLoading(true);
    // Optimistic UI updates
    const originalRecords = [...records];
    setRecords(records.filter(r => r.id !== id));

    const headers = buildHeaders();
    try {
      const res = await axios.delete(`${API_BASE}/payroll/cv-setups/${id}`, { headers });
      if (res.data.status === 'success') {
        showToast('Setup variable deleted successfully.');
        setConfirmDelete(null);
        fetchRecords(true); // silent sync
      } else {
        setRecords(originalRecords); // rollback
        showToast(res.data.message || 'Deletion failed.', 'error');
      }
    } catch (err) {
      setRecords(originalRecords); // rollback
      const msg = err.response?.data?.message ?? 'Failed to delete the setup variable.';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtering records
  const filteredRecords = records.filter(r =>
    r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.variable_type_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.bankName && r.bankName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Pagination bounds
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const isFormDisabled = !(userCtx.isSuperAdmin || userCtx.isAdminStaff);

  const getParticularLabel = (val) => {
    if (String(val) === '1') return 'Earning';
    if (String(val) === '2') return 'Deduction';
    return '-- Choose Type --';
  };

  const getBankLabel = (val) => {
    if (!val) return '-- Choose Bank --';
    const found = banks.find(b => String(b.id) === String(val));
    return found ? found.name : '-- Choose Bank --';
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Control Variables Setup</h1>
        <p className={styles.subtitle}>Define, register, and configure active earning and deduction variables, including custom bank accounts.</p>
      </div>

      {/* Statistics Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconTotal}`}>
            <ListTodo size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Setups</span>
            <span className={styles.statValue}>{totalCount}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconEarning}`}>
            <TrendingUp size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Earnings</span>
            <span className={styles.statValue}>{earningsCount}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconDeduction}`}>
            <TrendingDown size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Deductions</span>
            <span className={styles.statValue}>{deductionsCount}</span>
          </div>
        </div>
      </div>

      {/* Input Form Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            {editId ? 'Modify Setup Variable' : 'Create Setup Variable'}
          </h2>
        </div>

        <div className={styles.cardBody}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              
              {/* Type Custom Dropdown Select */}
              <div className={styles.formGroup} ref={typeDropdownRef}>
                <label className={styles.label}>Particular Type *</label>
                <div className={styles.customSelectContainer}>
                  <button
                    type="button"
                    className={`${styles.customSelectTrigger} ${showTypeDropdown ? styles.customSelectTriggerActive : ''}`}
                    onClick={() => {
                      if (!isFormDisabled) setShowTypeDropdown(!showTypeDropdown);
                    }}
                    disabled={isFormDisabled}
                  >
                    <span>{getParticularLabel(particularID)}</span>
                    <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  {showTypeDropdown && !isFormDisabled && (
                    <ul className={styles.customSelectDropdown}>
                      <li
                        className={`${styles.customSelectItem} ${particularID === '1' ? styles.customSelectItemActive : ''}`}
                        onClick={() => {
                          setParticularID('1');
                          setShowTypeDropdown(false);
                        }}
                      >
                        Earning
                      </li>
                      <li
                        className={`${styles.customSelectItem} ${particularID === '2' ? styles.customSelectItemActive : ''}`}
                        onClick={() => {
                          setParticularID('2');
                          setShowTypeDropdown(false);
                        }}
                      >
                        Deduction
                      </li>
                    </ul>
                  )}
                </div>
              </div>

              {/* Description Input */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Description *</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Enter variable description (e.g. Health Allowance)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isFormDisabled}
                />
              </div>

              {/* Bank Custom Dropdown Select */}
              <div className={styles.formGroup} ref={bankDropdownRef}>
                <label className={styles.label}>Assigned Bank</label>
                <div className={styles.customSelectContainer}>
                  <button
                    type="button"
                    className={`${styles.customSelectTrigger} ${showBankDropdown ? styles.customSelectTriggerActive : ''}`}
                    onClick={() => {
                      if (!isFormDisabled) setShowBankDropdown(!showBankDropdown);
                    }}
                    disabled={isFormDisabled}
                  >
                    <span>{getBankLabel(bank)}</span>
                    <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  {showBankDropdown && !isFormDisabled && (
                    <ul className={styles.customSelectDropdown}>
                      <li
                        className={`${styles.customSelectItem} ${!bank ? styles.customSelectItemActive : ''}`}
                        onClick={() => {
                          setBank('');
                          setShowBankDropdown(false);
                        }}
                      >
                        -- Choose Bank --
                      </li>
                      {banks.map((b) => (
                        <li
                          key={b.id}
                          className={`${styles.customSelectItem} ${String(bank) === String(b.id) ? styles.customSelectItemActive : ''}`}
                          onClick={() => {
                            setBank(b.id);
                            setShowBankDropdown(false);
                          }}
                        >
                          {b.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Account Name */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Account Name</label>
                <div className={styles.inputGroup}>
                  <Building className={styles.inputIcon} size={16} />
                  <input
                    type="text"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="Enter account name"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>

              {/* Account Number */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Account Number</label>
                <div className={styles.inputGroup}>
                  <Hash className={styles.inputIcon} size={16} />
                  <input
                    type="text"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="Enter account number digits"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>



              {/* Status Toggle */}
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={status}
                    onChange={(e) => setStatus(e.target.checked)}
                    disabled={isFormDisabled}
                  />
                  Active status (Enable in calculation runs)
                </label>
              </div>

            </div>

            {/* Actions */}
            {!isFormDisabled && (
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
                  {saving ? (
                    <>
                      <Loader2 className={styles.loadingSpinner} size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      {editId ? 'Update Setup' : 'Add Setup'}
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* listings table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Variables Setup Directory</h2>
        </div>

        {/* Search bar */}
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <Search className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search setups by description or type..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Table Layout */}
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 className={styles.loadingSpinner} size={28} />
              <p style={{ marginTop: '0.75rem' }}>Synchronizing configurations...</p>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText className={styles.emptyIcon} size={32} />
              <p>No matching setup variable records found.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Particular Type</th>
                    <th>Description</th>
                    <th>Assigned Bank Account</th>
                    <th>Status</th>
                    {!isFormDisabled && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className={`${styles.badge} ${String(row.particularID) === '1' ? styles.badgeEarning : styles.badgeDeduction}`}>
                          {row.variable_type_name}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{row.description}</td>
                      <td>
                        {row.bankName ? (
                          <div className={styles.bankCell}>
                            <span className={styles.bankName}>{row.bankName}</span>
                            <span className={styles.bankAccount}>
                              {row.account_name ?? 'No Name'} | {row.account_number ?? 'No Number'}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>None</span>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${row.status === 1 ? styles.badgeActive : styles.badgeInactive}`}>
                          {row.status === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {!isFormDisabled && (
                        <td>
                          <div className={styles.rowActions}>
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                              title="Edit record"
                              onClick={() => handleEdit(row)}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                              title="Delete record"
                              onClick={() => handleDeleteTrigger(row.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <span className={styles.paginationText}>
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredRecords.length)} of {filteredRecords.length} configs
                  </span>
                  <div className={styles.paginationButtons}>
                    <button
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                    >
                      Prev
                    </button>
                    <button
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast banners */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}
          >
            {toast.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className={styles.modalOverlay}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={styles.modalContent}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Confirm Deletion</h3>
                <button className={styles.modalCloseBtn} onClick={() => setConfirmDelete(null)}>
                  <X size={16} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <p className={styles.modalText}>
                  Are you sure you want to delete this configuration setup? This action will permanently remove it from the system config list. It will fail if currently in use by staff profiles.
                </p>
                <div className={styles.modalActions}>
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => setConfirmDelete(null)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    style={{ background: '#ef4444' }}
                    onClick={handleDeleteConfirm}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
