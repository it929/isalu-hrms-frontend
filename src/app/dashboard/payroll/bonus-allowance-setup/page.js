"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { 
  Gift, 
  Coins, 
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
  Upload, 
  Download, 
  X, 
  Check, 
  Sparkles,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
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

const ALLOWANCE_PRESETS = [
  { id: 'hazard_allowance', name: 'Hazard Allowance' },
  { id: 'overtime_allowance', name: 'Overtime Allowance' },
  { id: 'shift_allowance', name: 'Shift Allowance' },
  { id: 'call_duty_allowance', name: 'Call Duty Allowance' },
  { id: 'responsibility_allowance', name: 'Responsibility Allowance' },
  { id: 'housing_allowance', name: 'Housing Allowance' },
  { id: 'transport_allowance', name: 'Transport Allowance' },
  { id: 'custom', name: 'Custom Allowance' },
];

const BONUS_PRESETS = [
  { id: 'performance_bonus', name: 'Performance Bonus' },
  { id: 'leave_bonus', name: 'Annual Leave Bonus' },
  { id: '13th_month', name: '13th Month Bonus' },
  { id: 'end_of_year', name: 'End of Year Bonus' },
  { id: 'management_discretionary', name: 'Management Discretionary Bonus' },
  { id: 'custom', name: 'Custom Bonus' },
];

export default function BonusAllowanceSetupPage() {
  // Loading & Toast States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({
    totalRecords: 0,
    totalActiveRecords: 0,
    totalAllowances: 0,
    totalBonuses: 0,
    totalMonthlyValue: 0,
    totalBeneficiaries: 0,
  });

  // Filter and Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all, bonus, allowance
  const [freqFilter, setFreqFilter] = useState('all'); // all, one_time, recurring
  const [statusFilter, setStatusFilter] = useState('all'); // all, 1, 0
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('10');

  // Form State
  const [editId, setEditId] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const [formType, setFormType] = useState('allowance'); // allowance, bonus
  const [formCategory, setFormCategory] = useState('hazard_allowance');
  const [formTitle, setFormTitle] = useState('Hazard Allowance');
  const [formAmount, setFormAmount] = useState('');
  const [formFrequency, setFormFrequency] = useState('one_time'); // one_time, recurring
  const [formStartMonth, setFormStartMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [formEndMonth, setFormEndMonth] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Bulk Import State
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch Staff List
  const fetchStaff = useCallback(async () => {
    try {
      const headers = buildHeaders();
      const res = await axios.get(`${API_BASE}/payroll/bonus-allowance-setups/staff`, { headers });
      if (res.data.status === 'success') {
        setStaffList(res.data.data || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Records
  const fetchRecords = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const headers = buildHeaders();
      const params = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      if (freqFilter !== 'all') params.frequency = freqFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;

      const res = await axios.get(`${API_BASE}/payroll/bonus-allowance-setups`, { headers, params });
      if (res.data.status === 'success') {
        setRecords(res.data.data || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch {
      showToast('Failed to retrieve bonuses & allowances records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, freqFilter, statusFilter, searchQuery, showToast]);

  useEffect(() => {
    setMounted(true);
    fetchStaff();
    fetchRecords();
  }, [fetchStaff, fetchRecords]);

  // Click outside autocomplete dropdown handler
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Preset Category Selection
  const handleCategorySelect = (preset) => {
    setFormCategory(preset.id);
    if (preset.id !== 'custom') {
      setFormTitle(preset.name);
    } else {
      setFormTitle('');
    }
  };

  // Change form type (Bonus vs Allowance)
  const handleTypeChange = (newType) => {
    setFormType(newType);
    if (newType === 'allowance') {
      setFormCategory('hazard_allowance');
      setFormTitle('Hazard Allowance');
    } else {
      setFormCategory('performance_bonus');
      setFormTitle('Performance Bonus');
    }
  };

  // Reset Form
  const resetForm = () => {
    setEditId(null);
    setSelectedStaff(null);
    setDropdownSearch('');
    setFormType('allowance');
    setFormCategory('hazard_allowance');
    setFormTitle('Hazard Allowance');
    setFormAmount('');
    setFormFrequency('one_time');
    const now = new Date();
    setFormStartMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setFormEndMonth('');
    setFormNotes('');
  };

  // Populate form for editing
  const handleEdit = (record) => {
    setEditId(record.id);
    const staff = staffList.find(s => s.id === record.staffId) || {
      id: record.staffId,
      staffId: record.staffId,
      name: record.name,
      department: record.department
    };
    setSelectedStaff(staff);
    setDropdownSearch(`[ID: ${record.staffId}] ${record.name}`);
    setFormType(record.type);
    setFormCategory(record.category || 'custom');
    setFormTitle(record.title);
    setFormAmount(record.amount);
    setFormFrequency(record.frequency);
    setFormStartMonth(record.start_month);
    setFormEndMonth(record.end_month || '');
    setFormNotes(record.notes || '');

    // Scroll smoothly to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }
    if (!formTitle.trim()) {
      showToast('Please specify a title/description.', 'error');
      return;
    }
    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount greater than 0.', 'error');
      return;
    }
    if (!formStartMonth) {
      showToast('Please select a start month.', 'error');
      return;
    }

    setSaving(true);
    const headers = buildHeaders();
    const payload = {
      id: editId,
      staffId: selectedStaff.id || selectedStaff.staffId,
      type: formType,
      category: formCategory,
      title: formTitle.trim(),
      amount: amt,
      frequency: formFrequency,
      start_month: formStartMonth,
      end_month: formFrequency === 'recurring' && formEndMonth ? formEndMonth : null,
      notes: formNotes.trim() || null,
      is_active: 1,
    };

    try {
      const res = await axios.post(`${API_BASE}/payroll/bonus-allowance-setups`, payload, { headers });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Saved successfully!');
        resetForm();
        fetchRecords(true);
      } else {
        showToast(res.data.message || 'Failed to save record.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error occurred while saving.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (id) => {
    setActionLoading(true);
    const headers = buildHeaders();
    try {
      const res = await axios.post(`${API_BASE}/payroll/bonus-allowance-setups/toggle/${id}`, {}, { headers });
      if (res.data.status === 'success') {
        showToast(res.data.message);
        fetchRecords(true);
      }
    } catch {
      showToast('Failed to toggle status.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Record
  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setActionLoading(true);
    const headers = buildHeaders();
    try {
      const res = await axios.delete(`${API_BASE}/payroll/bonus-allowance-setups/${confirmDelete}`, { headers });
      if (res.data.status === 'success') {
        showToast('Record deleted successfully.');
        setConfirmDelete(null);
        fetchRecords(true);
      }
    } catch {
      showToast('Failed to delete record.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Import Submit
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      showToast('Please select a spreadsheet file (.xlsx, .csv).', 'error');
      return;
    }

    setImporting(true);
    const headers = { ...buildHeaders(), 'Content-Type': 'multipart/form-data' };
    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const res = await axios.post(`${API_BASE}/payroll/bonus-allowance-setups/import`, formData, { headers });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Import successful!');
        setImportFile(null);
        // Reset file input
        const fileInput = document.getElementById('sba-file-input');
        if (fileInput) fileInput.value = '';
        fetchRecords(true);
      } else {
        showToast(res.data.message || 'Import failed.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error occurred during import.';
      showToast(msg, 'error');
    } finally {
      setImporting(false);
    }
  };

  // Filtered List
  const filteredRecords = records.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      String(r.staffId).includes(q) ||
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.department && r.department.toLowerCase().includes(q)) ||
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.category && r.category.toLowerCase().includes(q));

    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    const matchesFreq = freqFilter === 'all' || r.frequency === freqFilter;
    const matchesStatus = statusFilter === 'all' || String(r.is_active) === statusFilter;

    return matchesSearch && matchesType && matchesFreq && matchesStatus;
  });

  const totalPages = itemsPerPage === 'all'
    ? 1
    : Math.ceil(filteredRecords.length / parseInt(itemsPerPage, 10)) || 1;

  const paginatedRecords = itemsPerPage === 'all'
    ? filteredRecords
    : filteredRecords.slice(
        (currentPage - 1) * parseInt(itemsPerPage, 10),
        currentPage * parseInt(itemsPerPage, 10)
      );

  const filteredStaffDropdown = staffList.filter(s => {
    const q = dropdownSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      String(s.staffId || s.id).includes(q) ||
      (s.department && s.department.toLowerCase().includes(q))
    );
  });

  if (!mounted) {
    return (
      <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '350px' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary, #3b82f6)' }} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Staff Bonuses & Allowances Setup</h1>
        <p className={styles.subtitle}>
          Configure, assign, and manage one-time or recurring allowances and bonuses for employees with automated payroll integration.
        </p>
      </div>

      {/* Summary Statistics Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconTotal}`}>
            <Users size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Beneficiaries</span>
            <span className={styles.statValue}>{summary.totalBeneficiaries || 0} Staff</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconAllowance}`}>
            <Coins size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Allowances</span>
            <span className={styles.statValue}>{summary.totalAllowances || 0}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconBonus}`}>
            <Gift size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Bonuses</span>
            <span className={styles.statValue}>{summary.totalBonuses || 0}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconValue}`}>
            <TrendingUp size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Active Value</span>
            <span className={styles.statValue}>
              <NairaSign />{fmt(summary.totalMonthlyValue || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid: Create Form + Bulk Import Box */}
      <div className="gridTwoCols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 0.85fr)', gap: '1.5rem', marginBottom: '1.75rem' }}>
        
        {/* Form Card */}
        <div className={styles.card} style={{ marginBottom: 0 }}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              {editId ? 'Modify Bonus / Allowance' : 'Create Staff Bonus or Allowance'}
            </h2>
            {editId && (
              <button 
                type="button" 
                onClick={resetForm}
                className={styles.pageBtn}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <X size={14} /> Cancel Edit
              </button>
            )}
          </div>
          <div className={styles.cardBody}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Type Switch: Allowance vs Bonus */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Earning Type *</label>
                <div className={styles.typeSelector}>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('allowance')}
                    className={`${styles.typeButton} ${formType === 'allowance' ? styles.typeButtonActiveAllowance : ''}`}
                  >
                    <Coins size={18} />
                    Allowance
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('bonus')}
                    className={`${styles.typeButton} ${formType === 'bonus' ? styles.typeButtonActiveBonus : ''}`}
                  >
                    <Gift size={18} />
                    Bonus
                  </button>
                </div>
              </div>

              {/* Staff Member Autocomplete */}
              <div className={styles.formGroup} ref={dropdownRef}>
                <label className={styles.label}>Select Staff Member *</label>
                {selectedStaff ? (
                  <div className={styles.selectedStaffBanner}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                      <div>
                        <strong>[ID: {selectedStaff.staffId || selectedStaff.id}]</strong> {selectedStaff.name}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                          ({selectedStaff.department || 'General'})
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStaff(null);
                        setDropdownSearch('');
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className={styles.dropdownContainer}>
                    <input
                      id="sba-staff-search"
                      type="text"
                      className={styles.input}
                      placeholder="Search by department, Staff ID, or name..."
                      value={dropdownSearch}
                      onChange={(e) => {
                        setDropdownSearch(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                    />
                    {showDropdown && filteredStaffDropdown.length > 0 && (
                      <div className={styles.dropdownMenu}>
                        {filteredStaffDropdown.map((s) => (
                          <div
                            key={s.id}
                            className={styles.dropdownItem}
                            onClick={() => {
                              setSelectedStaff(s);
                              setDropdownSearch(`[ID: ${s.staffId}] ${s.name}`);
                              setShowDropdown(false);
                            }}
                          >
                            <strong>[ID: {s.staffId}]</strong> {s.name}
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                              ({s.department})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Category Quick Presets */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Quick Category Preset ({formType === 'allowance' ? 'Allowances' : 'Bonuses'})
                </label>
                <div className={styles.categoryPills}>
                  {(formType === 'allowance' ? ALLOWANCE_PRESETS : BONUS_PRESETS).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleCategorySelect(p)}
                      className={`${styles.categoryPill} ${formCategory === p.id ? styles.categoryPillActive : ''}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title / Description */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Title / Description *</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={`e.g., ${formType === 'allowance' ? 'Night Shift Allowance - Emergency Ward' : 'Annual Management Discretionary Bonus'}`}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              {/* Amount & Frequency Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Amount (₦) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className={styles.input}
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Frequency *</label>
                  <select
                    className={styles.select}
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value)}
                  >
                    <option value="one_time">One-Time (Single Month)</option>
                    <option value="recurring">Recurring (Monthly)</option>
                  </select>
                </div>
              </div>

              {/* Effective Start Month & Optional End Month */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    {formFrequency === 'one_time' ? 'Payment Month *' : 'Effective Start Month *'}
                  </label>
                  <input
                    type="month"
                    className={styles.input}
                    value={formStartMonth}
                    onChange={(e) => setFormStartMonth(e.target.value)}
                    required
                  />
                </div>

                {formFrequency === 'recurring' ? (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>End Month (Optional)</label>
                    <input
                      type="month"
                      className={styles.input}
                      value={formEndMonth}
                      onChange={(e) => setFormEndMonth(e.target.value)}
                      placeholder="Leave blank for ongoing"
                    />
                  </div>
                ) : (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Application Scope</label>
                    <input
                      type="text"
                      className={styles.input}
                      value="Applied once to payroll"
                      disabled
                      style={{ opacity: 0.7, background: 'var(--surface-secondary, rgba(0,0,0,0.02))' }}
                    />
                  </div>
                )}
              </div>

              {/* Remarks / Justification */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Remarks / Approval Justification (Optional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Provide reference or reasons (e.g., Approved by MD via memo ref #104)..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              {/* Submit & Reset Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={saving}
                  className={styles.submitBtn}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : editId ? (
                    <>
                      <Check size={16} />
                      Update Setup
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Save {formType === 'allowance' ? 'Allowance' : 'Bonus'}
                    </>
                  )}
                </button>

                {editId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className={styles.pageBtn}
                    style={{ padding: '0.75rem 1.25rem' }}
                  >
                    Cancel
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>

        {/* Bulk Spreadsheet Import & Template Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Upload size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
                Bulk Spreadsheet Upload
              </h2>
            </div>
            <div className={styles.cardBody}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Upload multiple staff bonuses and allowances at once using an Excel or CSV file. Ideal for batch performance rewards or hospital-wide hazard allowances.
              </p>

              <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className={styles.importBox}>
                  <input
                    id="sba-file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setImportFile(e.target.files[0] || null)}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="sba-file-input" style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload size={32} style={{ color: 'var(--primary, #3b82f6)', margin: '0 auto 0.5rem auto' }} />
                    <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {importFile ? importFile.name : 'Click to select spreadsheet'}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Supports .xlsx, .xls, and .csv
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <a
                    href={`${API_BASE}/payroll/bonus-allowance-setups/template`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.pageBtn}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
                  >
                    <Download size={14} /> Download Template
                  </a>

                  <button
                    type="submit"
                    disabled={importing || !importFile}
                    className={styles.submitBtn}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    {importing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Uploading...
                      </>
                    ) : (
                      'Upload File'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Quick Guide Box */}
          <div className={styles.card} style={{ marginBottom: 0, background: 'rgba(59, 130, 246, 0.03)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
            <div className={styles.cardBody} style={{ padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} style={{ color: 'var(--primary, #3b82f6)' }} />
                Earning Rules & Frequency
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <li><strong>One-Time</strong>: Applies strictly to the specified payroll month, then completes automatically.</li>
                <li><strong>Recurring</strong>: Included in every monthly payroll computation between the Start Month and optional End Month.</li>
                <li>Bonuses and allowances are automatically credited to employee gross income in payroll compute and reflected on payslips.</li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* History & Active Setups Table Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Configured Staff Bonuses & Allowances</h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Showing {paginatedRecords.length} of {filteredRecords.length} records
          </span>
        </div>
        <div className={styles.cardBody}>
          
          {/* Toolbar Filters */}
          <div className={styles.tableToolbar}>
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Filter by staff name, Staff ID, title, department..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className={styles.filterGroup}>
              {/* Type Filter */}
              <select
                className={styles.select}
                style={{ width: 'auto' }}
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Types</option>
                <option value="allowance">Allowances Only</option>
                <option value="bonus">Bonuses Only</option>
              </select>

              {/* Frequency Filter */}
              <select
                className={styles.select}
                style={{ width: 'auto' }}
                value={freqFilter}
                onChange={(e) => {
                  setFreqFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Frequencies</option>
                <option value="one_time">One-Time Only</option>
                <option value="recurring">Recurring Only</option>
              </select>

              {/* Items Per Page */}
              <select
                className={styles.select}
                style={{ width: 'auto' }}
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
                <option value="all">All Records</option>
              </select>
            </div>
          </div>

          {/* Records Table */}
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Staff Name & Dept</th>
                  <th>Type</th>
                  <th>Title & Category</th>
                  <th style={{ textAlign: 'right' }}>Amount (₦)</th>
                  <th>Frequency</th>
                  <th>Effective Period</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}>
                      <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto', color: 'var(--primary, #3b82f6)' }} />
                      <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading records...</p>
                    </td>
                  </tr>
                ) : paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      <AlertCircle size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                      <p style={{ margin: 0, fontWeight: 500 }}>No bonuses or allowances found matching your filter.</p>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>Use the form above to configure a new record.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>#{r.staffId}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.department || 'General'}</div>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${r.type === 'allowance' ? styles.badgeAllowance : styles.badgeBonus}`}>
                          {r.type === 'allowance' ? <Coins size={12} /> : <Gift size={12} />}
                          {r.type}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {r.category?.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <NairaSign />{fmt(r.amount)}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${r.frequency === 'one_time' ? styles.badgeOneTime : styles.badgeRecurring}`}>
                          {r.frequency === 'one_time' ? 'One-Time' : 'Recurring'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8125rem' }}>
                          {r.frequency === 'one_time' ? (
                            r.start_month
                          ) : (
                            `${r.start_month} → ${r.end_month ? r.end_month : 'Ongoing'}`
                          )}
                        </div>
                      </td>
                      <td>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={r.is_active === 1}
                            disabled={actionLoading}
                            onChange={() => handleToggleStatus(r.id)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={styles.actionBtns} style={{ justifyContent: 'center' }}>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            title="Edit Setup"
                            onClick={() => handleEdit(r)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                            title="Delete Setup"
                            onClick={() => setConfirmDelete(r.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Page {currentPage} of {totalPages} ({filteredRecords.length} total entries)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className={styles.modalOverlay}>
            <motion.div
              className={styles.modalContent}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={20} /> Confirm Deletion
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Are you sure you want to delete this bonus/allowance configuration? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className={styles.pageBtn}
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.submitBtn}
                  style={{ background: '#ef4444', borderColor: '#ef4444' }}
                  onClick={handleDeleteConfirm}
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toast.type === 'error' ? (
              <AlertCircle size={18} style={{ color: '#ef4444' }} />
            ) : (
              <CheckCircle2 size={18} style={{ color: '#10b981' }} />
            )}
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
