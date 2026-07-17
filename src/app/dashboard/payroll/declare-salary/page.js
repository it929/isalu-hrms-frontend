"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Users, Search, Loader2, FileText, AlertCircle, CheckCircle2, Edit2, UploadCloud, Download, AlertTriangle, Plus, Landmark } from 'lucide-react';
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

export default function DeclareSalaryPage() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'bulk'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [warnings, setWarnings] = useState([]);

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown Autocomplete Staff State
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const dropdownRef = useRef(null);

  // Form Fields
  const [declaredSalary, setDeclaredSalary] = useState('');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 30000);
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const headers = buildHeaders();
    try {
      const [staffRes, declareRes] = await Promise.all([
        axios.get(`${API_BASE}/payroll/salary-structures/staff`, { headers }),
        axios.get(`${API_BASE}/payroll/declare-salary`, { headers }),
      ]);

      if (staffRes.data.status === 'success') {
        setStaffList(staffRes.data.data || []);
      }
      if (declareRes.data.status === 'success') {
        setRecords(declareRes.data.data || []);
      }
    } catch (err) {
      showToast('Failed to retrieve setup information.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Filter staff based on autocomplete input
  const filteredStaff = dropdownSearch.trim() === ''
    ? staffList
    : staffList.filter(s =>
        s.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        String(s.id).includes(dropdownSearch)
      );

  // Statistics
  const totalConfigured = records.length;
  const totalDeclaredSalary = records.reduce((sum, item) => sum + parseFloat(item.declare_salary || 0), 0);
  const countWithDeclared = records.filter(item => item.declare_salary !== null && parseFloat(item.declare_salary) > 0).length;

  // Handle Select Staff from Autocomplete list
  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.label);
    setShowDropdown(false);

    // If there is an existing record for this staff, populate form fields
    const existing = records.find(s => s.staffId === staff.id);
    if (existing) {
      setDeclaredSalary(existing.declare_salary || '');
      if (existing.declare_salary) {
        showToast(`Loaded existing declared salary for ${staff.name}.`);
      }
    } else {
      setDeclaredSalary('');
    }
  };

  const handleClearForm = () => {
    setSelectedStaff(null);
    setDropdownSearch('');
    setDeclaredSalary('');
  };

  // Submit manual declared salary
  const handleSubmitManual = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        staffId: selectedStaff.id,
        declare_salary: declaredSalary || 0,
      };

      const res = await axios.post(`${API_BASE}/payroll/declare-salary`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Declared salary updated successfully.');
        handleClearForm();
        fetchData(true); // Silent refetch
      } else {
        showToast(res.data.message || 'Failed to update declared salary.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error updating record. Make sure the staff has a salary structure setup.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Drag and drop event handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  // File upload processing
  const handleFileUpload = async (file) => {
    const fileType = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileType)) {
      showToast('Invalid file format. Please upload Excel (.xlsx, .xls) or CSV.', 'error');
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSizeBytes) {
      showToast('File size is too large. Maximum allowed size is 5MB.', 'error');
      return;
    }

    setUploading(true);
    setWarnings([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE}/payroll/declare-salary/import`, formData, {
        headers: {
          ...buildHeaders(),
          'Content-Type': 'multipart/form-data',
        }
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || `Successfully processed data.`);
        if (res.data.warnings && res.data.warnings.length > 0) {
          setWarnings(res.data.warnings);
          setTimeout(() => setWarnings([]), 30000);
        }
        // Refresh records list
        fetchData(true);
      } else {
        showToast(res.data.message || 'Import failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error importing file.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Download template
  const handleDownloadTemplate = () => {
    const headers = ['staffId', 'declare_salary'];
    const sampleRow = ['1', '1800000.00'];

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), sampleRow.join(',')].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "declared_salaries_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded template file!');
  };

  // Edit from table list
  const handleEditFromList = (row) => {
    const staff = staffList.find(s => s.id === row.staffId) || {
      id: row.staffId,
      name: row.name,
      label: `[ID: ${row.staffId}] ` + row.name
    };

    setSelectedStaff(staff);
    setDropdownSearch(staff.label);
    setDeclaredSalary(row.declare_salary || '');

    setActiveTab('manual');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Loaded ${row.name}'s record for editing.`);
  };

  // Filtered list
  const filteredRecords = records.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(s.staffId).includes(searchQuery)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={styles.container}
    >
      {/* Page Header */}
      <div className={styles.header}>
        <h1>Declared Salary Configuration</h1>
        <p>Define or bulk import the annual declared salary for staff members with active salary structures.</p>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'manual' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          <Plus size={16} />
          Manual Setup
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'bulk' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <UploadCloud size={16} />
          Bulk Upload Spreadsheet
        </button>
      </div>

      {/* Statistics widgets */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            <Users size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Available Structures</div>
            <div className={styles.statValue}>{totalConfigured.toLocaleString()}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            <NairaSign size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Declared Set Count</div>
            <div className={styles.statValue}>{countWithDeclared} / {totalConfigured}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
            <Landmark size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Total Declared Amount</div>
            <div className={styles.statValue}>₦{fmt(totalDeclaredSalary)}</div>
          </div>
        </div>
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        {activeTab === 'manual' ? (
          <motion.div
            key="manual"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className={styles.formCard}
          >
            <h2 className={styles.cardTitle}>Configure Declared Salary</h2>
            <form onSubmit={handleSubmitManual}>
              <div className={styles.formGrid}>
                {/* Searchable Staff autocomplete select */}
                <div className={styles.formGroup} ref={dropdownRef}>
                  <label className={styles.formLabel} htmlFor="staff-select">Select Staff Member *</label>
                  <div className={styles.dropdownContainer}>
                    <input
                      id="staff-select"
                      type="text"
                      className={styles.formInput}
                      placeholder="Type surname, first name, staff ID, or file number to search..."
                      value={dropdownSearch}
                      onChange={(e) => {
                        setDropdownSearch(e.target.value);
                        setShowDropdown(true);
                        if (selectedStaff) setSelectedStaff(null);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      required
                    />
                    {showDropdown && (
                      <div className={styles.dropdownResults}>
                        {filteredStaff.length > 0 ? (
                          filteredStaff.map((staff) => (
                            <div
                              key={staff.id}
                              className={styles.dropdownItem}
                              onClick={() => handleSelectStaff(staff)}
                            >
                              {staff.label} (ID: {staff.id})
                            </div>
                          ))
                        ) : (
                          <div className={styles.dropdownNoResult}>No matching personnel found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Declared Salary */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="declare-salary">Declared Salary (₦) *</label>
                  <input
                    id="declare-salary"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={styles.formInput}
                    value={declaredSalary}
                    onChange={(e) => setDeclaredSalary(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={handleClearForm}
                  disabled={saving}
                >
                  Clear Fields
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={saving}
                >
                  {saving && <Loader2 size={16} className={styles.spinner} />}
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="bulk"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className={styles.formCard}
          >
            <h2 className={styles.cardTitle}>Spreadsheet Bulk Import</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
              Upload an Excel file (.xlsx, .xls) or CSV template that contains multiple staff declared salaries.
              Matching records will be updated directly in the database.
            </p>

            {/* Drag & Drop Area */}
            <div
              className={`${styles.uploadZone} ${dragActive ? styles.uploadZoneActive : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('bulk-file-input').click()}
            >
              <input
                type="file"
                id="bulk-file-input"
                className={styles.fileInput}
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
              />
              {uploading ? (
                <Loader2 size={48} className={styles.spinner} />
              ) : (
                <UploadCloud size={48} />
              )}
              <div>
                <p className={styles.uploadZoneTitle}>
                  {uploading ? 'Processing spreadsheet...' : 'Drag & drop Excel or CSV file here'}
                </p>
                <p className={styles.uploadZoneDesc}>
                  {!uploading && 'or click to browse local files (Supports .xlsx, .xls, .csv)'}
                </p>
              </div>
            </div>

            {/* Download/Help bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                type="button"
                className={styles.btnDownloadTemplate}
                onClick={handleDownloadTemplate}
              >
                <Download size={14} />
                Download CSV Column Template
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Required column titles (or order): <strong>staffId, declare_salary</strong>
              </span>
            </div>

            {/* Warnings Alert */}
            {warnings.length > 0 && (
              <div className={styles.warningCard}>
                <h4>
                  <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
                  Import completed with some warnings:
                </h4>
                <ul className={styles.warningList}>
                  {warnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Searchable List Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>
            <FileText size={18} />
            Declared Salary Schedule
          </h2>
          <div className={styles.tableSearch}>
            <Search size={16} className={styles.tableSearchIcon} />
            <input
              type="text"
              placeholder="Search by staff name or ID..."
              className={styles.tableSearchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.tableWrapper}>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 size={40} className={styles.spinner} />
              <span>Fetching declared salaries...</span>
            </div>
          ) : filteredRecords.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Staff Name</th>
                  <th>Gross Salary (₦)</th>
                  <th>Declared Salary (₦)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.tdPrimary}>{row.staffId}</td>
                    <td>{row.name}</td>
                    <td className={styles.tdNum}>{fmt(row.gross_salary)}</td>
                    <td className={styles.tdNum}>{row.declare_salary !== null ? fmt(row.declare_salary) : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.btnEdit}
                        onClick={() => handleEditFromList(row)}
                        title="Edit Declared Salary"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyState}>
              <FileText size={48} />
              <h3>No Structures Found</h3>
              <p>
                {searchQuery
                  ? "No configurations matched your search filters."
                  : "No staff members with salary structures found."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toast Feedback */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${
              toast.type === 'success' ? styles.toastSuccess : styles.toastError
            }`}
            initial={{ opacity: 0, y: 48, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.9 }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} className={styles.toastSuccessIcon} />
            ) : (
              <AlertCircle size={18} className={styles.toastErrorIcon} />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
