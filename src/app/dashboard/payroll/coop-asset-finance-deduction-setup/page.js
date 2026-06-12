"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Building2,
  DollarSign,
  Search,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Plus,
  Upload,
} from 'lucide-react';
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

export default function CoopAssetFinanceDeductionSetupPage() {
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [importing, setImporting]   = useState(false);
  const [toast, setToast]           = useState(null);
  const [mounted, setMounted]       = useState(false);

  const [staffList, setStaffList]   = useState([]);
  const [setups, setSetups]         = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown]     = useState(false);
  const [selectedStaff, setSelectedStaff]   = useState(null);
  const dropdownRef = useRef(null);

  const [userCtx, setUserCtx] = useState({
    isSuperAdmin: false, isHod: false, isAdminStaff: false, isAuditStaff: false, employee: null,
  });

  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form fields
  const [editSetupId, setEditSetupId]           = useState(null);
  const [totalAmount, setTotalAmount]           = useState('');
  const [durationMonths, setDurationMonths]     = useState('');
  const [monthlyDeduction, setMonthlyDeduction] = useState('');
  const [balanceRemaining, setBalanceRemaining] = useState('');
  const [startMonth, setStartMonth]             = useState('');
  const [endMonth, setEndMonth]                 = useState('');
  const [isActive, setIsActive]                 = useState(1);

  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const fetchStaffData = useCallback(async () => {
    const cacheKeyStaff = 'hrms_coop_loans_staff_cache';
    if (typeof window !== 'undefined') {
      const cachedStaff = sessionStorage.getItem(cacheKeyStaff);
      if (cachedStaff) {
        setStaffList(JSON.parse(cachedStaff));
        return;
      }
    }
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-loans/staff`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        const freshStaff = res.data.data || [];
        setStaffList(freshStaff);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKeyStaff, JSON.stringify(freshStaff));
        }
      }
    } catch (err) {
      console.error('Failed to retrieve staff list:', err);
    }
  }, []);

  const fetchSetups = useCallback(async (silent = false) => {
    const cacheKeySetups = 'hrms_coop_asset_finance_deduction_setups_cache';
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
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-asset-finance-deduction-setups`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        const freshData = res.data.data || [];
        setSetups(freshData);
        setUserCtx({
          isSuperAdmin: res.data.isSuperAdmin || false,
          isHod:        res.data.isHod        || false,
          isAdminStaff: res.data.isAdminStaff || false,
          isAuditStaff: res.data.isAuditStaff || false,
          employee:     res.data.employee     || null,
        });
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKeySetups, JSON.stringify(freshData));
        }
      }
    } catch {
      showToast('Failed to retrieve setups.', 'error');
    } finally {
      if (!silent && !hasCache) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!(sessionStorage.getItem('hrms_coop_asset_finance_deduction_setups_cache') && sessionStorage.getItem('hrms_coop_loans_staff_cache'));
    }
    const timer = setTimeout(() => {
      fetchStaffData();
      fetchSetups(hasCache);
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [fetchStaffData, fetchSetups]);

  // Auto-calculate monthly deduction
  useEffect(() => {
    const amount = parseFloat(totalAmount);
    const months = parseInt(durationMonths);
    if (!isNaN(amount) && amount > 0 && !isNaN(months) && months > 0) {
      setMonthlyDeduction((amount / months).toFixed(2));
    } else {
      setMonthlyDeduction('');
    }
  }, [totalAmount, durationMonths]);

  // Auto-calculate end month
  useEffect(() => {
    const months = parseInt(durationMonths);
    if (startMonth && !isNaN(months) && months > 0) {
      const parts = startMonth.split('-');
      if (parts.length === 2) {
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
        date.setMonth(date.getMonth() + months - 1);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        setEndMonth(`${y}-${m}`);
      }
    } else {
      setEndMonth('');
    }
  }, [startMonth, durationMonths]);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setShowDropdown(false);
  };

  const handleClearForm = () => {
    setEditSetupId(null);
    setSelectedStaff(null);
    setDropdownSearch('');
    setTotalAmount('');
    setDurationMonths('');
    setMonthlyDeduction('');
    setBalanceRemaining('');
    setStartMonth('');
    setEndMonth('');
    setIsActive(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) { showToast('Please select a staff member.', 'error'); return; }
    const amt = parseFloat(totalAmount);
    if (isNaN(amt) || amt <= 0) { showToast('Please enter a valid total amount.', 'error'); return; }
    const months = parseInt(durationMonths);
    if (isNaN(months) || months <= 0) { showToast('Please enter a valid duration.', 'error'); return; }
    if (!startMonth) { showToast('Please select a start month.', 'error'); return; }

    setSaving(true);
    try {
      const payload = {
        id:                editSetupId,
        staffId:           selectedStaff.id,
        total_amount:      amt,
        duration_months:   months,
        monthly_deduction: parseFloat(monthlyDeduction),
        balance_remaining: balanceRemaining !== '' ? parseFloat(balanceRemaining) : amt,
        start_month:       startMonth,
        end_month:         endMonth,
        is_active:         isActive,
      };
      const res = await axios.post(`${API_BASE}/payroll/coop-asset-finance-deduction-setups`, payload, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Coop asset finance setup saved successfully.');
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

  const handleEdit = (setup) => {
    setEditSetupId(setup.id);
    const staff = staffList.find(s => s.id === setup.staffId)
      || { id: setup.staffId, name: setup.name || 'Unknown Staff', fileNo: setup.fileNo || '' };
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setTotalAmount(String(setup.total_amount));
    setDurationMonths(String(setup.duration_months));
    setMonthlyDeduction(String(setup.monthly_deduction));
    setBalanceRemaining(String(setup.balance_remaining));
    setStartMonth(setup.start_month || '');
    setEndMonth(setup.end_month || '');
    setIsActive(setup.is_active);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleStatus = async (id) => {
    try {
      const res = await axios.post(`${API_BASE}/payroll/coop-asset-finance-deduction-setups/toggle/${id}`, {}, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        fetchSetups(true);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to toggle status.', 'error');
    }
  };

  const handleDelete = (id) => {
    setConfirmAction({ type: 'delete', id, label: 'Delete Coop Asset Finance Setup' });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const res = await axios.delete(`${API_BASE}/payroll/coop-asset-finance-deduction-setups/${confirmAction.id}`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Setup deleted successfully.', 'success');
        fetchSetups(true);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error processing request.', 'error');
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  // Drag-and-drop
  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) uploadFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) uploadFile(e.target.files[0]);
  };

  const uploadFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      showToast('Unsupported format. Please upload Excel (.xlsx, .xls) or CSV.', 'error');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setImporting(true);
    try {
      const res = await axios.post(`${API_BASE}/payroll/coop-asset-finance-deduction-setups/import`, formData, {
        headers: { ...buildHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Bulk import completed successfully.');
        fetchSetups(true);
      } else {
        showToast(res.data.message || 'Bulk import failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error processing file.', 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredStaff = dropdownSearch.trim() === ''
    ? staffList
    : staffList.filter(s =>
        s.name?.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        s.fileNo?.toLowerCase().includes(dropdownSearch.toLowerCase())
      );

  const filteredSetups = setups.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.fileNo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSetups.length / itemsPerPage);
  const paginatedSetups = filteredSetups.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const isConfigurator = userCtx.isSuperAdmin || userCtx.isAdminStaff;

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
        <h1 className={styles.title}>Coop Asset Finance Deduction Setup</h1>
        <p className={styles.subtitle}>
          Configure monthly deductions for cooperative asset finance schemes. Supports individual setups and bulk Excel/CSV importing.
        </p>
      </div>

      {/* Form + Import Panel — only for admins */}
      {isConfigurator && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>

          {/* Setup Form */}
          <div className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                {editSetupId ? 'Modify Coop Asset Finance Setup' : 'Create Coop Asset Finance Setup'}
              </h2>
            </div>
            <div className={styles.cardBody}>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* Staff Autocomplete */}
                  <div className={styles.formGroup} ref={dropdownRef}>
                    <label className={styles.label}>Select Staff Member *</label>
                    <div className={styles.dropdownContainer}>
                      <input
                        id="cafd-staff-search"
                        type="text"
                        className={styles.input}
                        placeholder="Search by name or file number..."
                        value={dropdownSearch}
                        onChange={(e) => {
                          setDropdownSearch(e.target.value);
                          setShowDropdown(true);
                          if (selectedStaff && e.target.value !== selectedStaff.name) setSelectedStaff(null);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        autoComplete="off"
                      />
                      {showDropdown && (
                        <ul className={styles.dropdownList}>
                          {filteredStaff.length > 0 ? (
                            filteredStaff.slice(0, 20).map((staff) => (
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
                            <li className={styles.dropdownEmpty}>No staff members found</li>
                          )}
                        </ul>
                      )}
                    </div>
                    {selectedStaff && (
                      <span style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle2 size={12} /> {selectedStaff.name} ({selectedStaff.fileNo})
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Total Amount */}
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Total Amount (₦) *</label>
                      <div className={styles.inputGroup}>
                        <DollarSign size={16} className={styles.inputIcon} />
                        <input
                          id="cafd-total-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          className={`${styles.input} ${styles.inputWithIcon}`}
                          placeholder="e.g. 120000"
                          value={totalAmount}
                          onChange={(e) => setTotalAmount(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Duration */}
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Duration (Months) *</label>
                      <input
                        id="cafd-duration"
                        type="number"
                        min="1"
                        className={styles.input}
                        placeholder="e.g. 12"
                        value={durationMonths}
                        onChange={(e) => setDurationMonths(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Monthly Deduction (auto) */}
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Monthly Deduction (₦)</label>
                      <div className={styles.inputGroup}>
                        <DollarSign size={16} className={styles.inputIcon} />
                        <input
                          id="cafd-monthly"
                          type="text"
                          className={`${styles.input} ${styles.inputWithIcon}`}
                          placeholder="Calculated automatically"
                          value={monthlyDeduction}
                          onChange={(e) => setMonthlyDeduction(e.target.value)}
                          style={{ backgroundColor: 'var(--bg-disabled, #f1f5f9)' }}
                        />
                      </div>
                    </div>

                    {/* Balance Remaining */}
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Balance Remaining (₦)</label>
                      <div className={styles.inputGroup}>
                        <DollarSign size={16} className={styles.inputIcon} />
                        <input
                          id="cafd-balance"
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
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Start Month */}
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Start Month *</label>
                      <input
                        id="cafd-start-month"
                        type="month"
                        className={styles.input}
                        value={startMonth}
                        onChange={(e) => setStartMonth(e.target.value)}
                        required
                      />
                    </div>

                    {/* End Month (auto) */}
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
                  </div>

                  {/* Status */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Status</label>
                    <select
                      id="cafd-status"
                      className={styles.select}
                      value={isActive}
                      onChange={(e) => setIsActive(parseInt(e.target.value))}
                    >
                      <option value={1}>Active</option>
                      <option value={0}>Deactivated</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formActions} style={{ marginTop: '1.5rem' }}>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleClearForm}>
                    Clear Form
                  </button>
                  <button id="cafd-save-btn" type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {editSetupId ? 'Update Configuration' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Import Panel */}
          <div className={styles.card} style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Bulk Import Excel/CSV</h2>
            </div>
            <div className={styles.cardBody} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragActive ? 'var(--primary, #6366f1)' : 'var(--border-color, #e2e8f0)'}`,
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
                    <p style={{ fontWeight: 500 }}>Processing spreadsheet…</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <Upload size={36} style={{ color: 'var(--primary)' }} />
                    <p style={{ fontWeight: 500, fontSize: '0.95rem' }}>Drag &amp; drop file here or click to browse</p>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Supports Excel (.xlsx, .xls) and CSV (.csv)</span>
                  </div>
                )}
              </div>
              <div style={{ marginTop: '1.25rem', fontSize: '0.825rem', color: '#64748b', lineHeight: '1.4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <p style={{ fontWeight: 600, margin: 0 }}>Spreadsheet Format:</p>
                  <a
                    href={`${API_BASE}/payroll/coop-asset-finance-deduction-setups/template`}
                    download="coop_asset_finance_import_template.csv"
                    style={{ color: 'var(--primary, #6366f1)', textDecoration: 'underline', fontSize: '0.8rem', fontWeight: 500 }}
                  >
                    Download Template
                  </a>
                </div>
                <ul style={{ listStyleType: 'disc', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <li>Column 1: Staff ID or File Number</li>
                  <li>Column 2: Total Amount</li>
                  <li>Column 3: Duration Months</li>
                  <li>Column 4: Monthly Deduction</li>
                  <li>Column 5: Start Month (YYYY-MM)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setups Table */}
      <div className={styles.card}>
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <Search size={18} className={styles.inputIcon} />
            <input
              id="cafd-search"
              type="text"
              className={`${styles.input} ${styles.inputWithIcon}`}
              placeholder="Search setups by staff name or file number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.cardBody} style={{ padding: 0 }}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 size={32} className="animate-spin" />
              <p>Retrieving configurations…</p>
            </div>
          ) : paginatedSetups.length > 0 ? (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Staff Info</th>
                    <th>Department</th>
                    <th>Total Amount</th>
                    <th>Duration</th>
                    <th>Monthly Deduction</th>
                    <th>Balance Remaining</th>
                    <th>Period (Start – End)</th>
                    <th>Status</th>
                    {isConfigurator && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedSetups.map((s, idx) => (
                    <tr key={s.id}>
                      <td>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                      <td>
                        <div className={styles.staffCell}>
                          <span className={styles.staffName}>{s.name}</span>
                          <span className={styles.staffFile}>ID: {s.staffId} | File: {s.fileNo}</span>
                        </div>
                      </td>
                      <td>{s.department || '—'}</td>
                      <td>₦{fmt(s.total_amount)}</td>
                      <td>{s.duration_months} Months</td>
                      <td>₦{fmt(s.monthly_deduction)}</td>
                      <td style={{ color: parseFloat(s.balance_remaining) <= 0 ? '#ef4444' : 'inherit', fontWeight: parseFloat(s.balance_remaining) <= 0 ? 600 : 400 }}>
                        ₦{fmt(s.balance_remaining)}
                      </td>
                      <td>{s.start_month} to {s.end_month || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className={`${styles.badge} ${s.is_active === 1 ? styles.badgeApproved : styles.badgeRejected}`}
                          onClick={() => isConfigurator && handleToggleStatus(s.id)}
                          style={{ border: 'none', cursor: isConfigurator ? 'pointer' : 'default' }}
                          title={isConfigurator ? (s.is_active ? 'Click to deactivate' : 'Click to activate') : ''}
                        >
                          {s.is_active === 1 ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      {isConfigurator && (
                        <td>
                          <div className={styles.rowActions}>
                            <button
                              id={`cafd-edit-${s.id}`}
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                              onClick={() => handleEdit(s)}
                              title="Edit Setup"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              id={`cafd-delete-${s.id}`}
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
              <Building2 size={32} className={styles.emptyIcon} />
              <p>No coop asset finance configurations found.</p>
              {isConfigurator && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Use the form above to add a configuration.
                </p>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <span className={styles.paginationText}>Page {currentPage} of {totalPages}</span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  style={{ padding: '0.4rem 0.8rem' }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  style={{ padding: '0.4rem 0.8rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete Modal */}
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
                Are you sure you want to delete this coop asset finance configuration? This action cannot be undone.
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
                  id="cafd-confirm-delete"
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
