"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Users, TrendingDown, TrendingUp, Search, Loader2, FileText, AlertCircle, CheckCircle2, Edit2, Trash2, Plus, ChevronDown, X, XCircle, Upload, AlertTriangle, Download } from 'lucide-react';
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

export default function StaffControlVariablePage() {
  // Loading & Toast States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [variableTypes, setVariableTypes] = useState([]);
  const [descriptions, setDescriptions] = useState([]);
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown Autocomplete Staff State
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const dropdownRef = useRef(null);

  // Custom Dropdown Select states & refs
  const [showVarTypeDropdown, setShowVarTypeDropdown] = useState(false);
  const [showDescDropdown, setShowDescDropdown] = useState(false);
  const varTypeDropdownRef = useRef(null);
  const descDropdownRef = useRef(null);

  // User Context State
  const [userCtx, setUserCtx] = useState({
    isSuperAdmin: false,
    isAdminStaff: false,
    isAuditStaff: false,
    isHod: false,
    employee: null,
  });

  // Modal confirm deletion state
  const [confirmDelete, setConfirmDelete] = useState(null); // id of record to delete
  const [actionLoading, setActionLoading] = useState(false);

  // Form Fields
  const [editId, setEditId] = useState(null);
  const [variableType, setVariableType] = useState('');
  const [cvSetupId, setCvSetupId] = useState('');
  const [amount, setAmount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [noLimit, setNoLimit] = useState(false);
  const [oneTime, setOneTime] = useState(false);
  const [status, setStatus] = useState(true);

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Import states
  const [importFile, setImportFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const fileInputRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch static metadata once on mount
  const fetchStaticData = useCallback(async () => {
    const cacheKeyStaff = 'hrms_staff_cv_staff_cache';
    const cacheKeyTypes = 'hrms_staff_cv_types_cache';
    if (typeof window !== 'undefined') {
      const cachedStaff = sessionStorage.getItem(cacheKeyStaff);
      const cachedTypes = sessionStorage.getItem(cacheKeyTypes);
      if (cachedStaff && cachedTypes) {
        setStaffList(JSON.parse(cachedStaff));
        setVariableTypes(JSON.parse(cachedTypes));
        return;
      }
    }
    const headers = buildHeaders();
    try {
      const [staffRes, typesRes] = await Promise.all([
        axios.get(`${API_BASE}/payroll/staff-control-variables/staff`, { headers }),
        axios.get(`${API_BASE}/payroll/staff-control-variables/variable-types`, { headers }),
      ]);

      if (staffRes.data.status === 'success') {
        const freshStaff = staffRes.data.data || [];
        setStaffList(freshStaff);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKeyStaff, JSON.stringify(freshStaff));
        }
      }
      if (typesRes.data.status === 'success') {
        const freshTypes = typesRes.data.data || [];
        setVariableTypes(freshTypes);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKeyTypes, JSON.stringify(freshTypes));
        }
      }
    } catch (err) {
      console.error('Failed to load static dropdown data:', err);
    }
  }, []);

  // Fetch submitted variables list
  const fetchRecords = useCallback(async (silent = false) => {
    const cacheKeyRecords = 'hrms_staff_cv_records_cache';
    let hasCache = false;

    if (!silent) {
      if (typeof window !== 'undefined') {
        const cachedRecords = sessionStorage.getItem(cacheKeyRecords);
        if (cachedRecords) {
          setRecords(JSON.parse(cachedRecords));
          hasCache = true;
        }
      }
      if (!hasCache) setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/staff-control-variables`, { headers });
      if (res.data.status === 'success') {
        const freshRecords = res.data.data || [];
        setRecords(freshRecords);
        setUserCtx({
          isSuperAdmin: res.data.isSuperAdmin || false,
          isAdminStaff: res.data.isAdminStaff || false,
          isAuditStaff: res.data.isAuditStaff || false,
          isHod: res.data.isHod || false,
          employee: res.data.employee || null,
        });
        if (typeof window !== 'undefined') sessionStorage.setItem(cacheKeyRecords, JSON.stringify(freshRecords));
      }
    } catch (err) {
      showToast('Failed to retrieve control variable records.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!(sessionStorage.getItem('hrms_staff_cv_records_cache') && sessionStorage.getItem('hrms_staff_cv_staff_cache') && sessionStorage.getItem('hrms_staff_cv_types_cache'));
    }
    const timer = setTimeout(() => {
      fetchStaticData();
      if (!hasCache) {
        fetchRecords();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [fetchStaticData, fetchRecords]);

  // Click outside dropdown handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (varTypeDropdownRef.current && !varTypeDropdownRef.current.contains(event.target)) {
        setShowVarTypeDropdown(false);
      }
      if (descDropdownRef.current && !descDropdownRef.current.contains(event.target)) {
        setShowDescDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prepopulate employee ID for non-admin users
  useEffect(() => {
    const timer = setTimeout(() => {
      const isSuperAdmin = userCtx.isSuperAdmin;
      const isAdminStaff = userCtx.isAdminStaff;
      const currentEmployee = userCtx.employee;

      if (!(isSuperAdmin || isAdminStaff) && currentEmployee && staffList.length > 0) {
        const matchingStaff = staffList.find(s => s.id === currentEmployee.id);
        if (matchingStaff) {
          setSelectedStaff(matchingStaff);
          setDropdownSearch(matchingStaff.name);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [staffList, userCtx]);

  // Dynamically load descriptions when variable type changes
  const handleVariableTypeChange = useCallback(async (typeId) => {
    setVariableType(typeId);
    setCvSetupId('');
    if (!typeId) {
      setDescriptions([]);
      return;
    }

    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/staff-control-variables/descriptions/${typeId}`, { headers });
      if (res.data.status === 'success') {
        setDescriptions(res.data.data || []);
      }
    } catch (err) {
      showToast('Failed to load descriptions for the selected type.', 'error');
    }
  }, [showToast]);

  // Track One-Time amount autofill
  useEffect(() => {
    const timer = setTimeout(() => {
      if (oneTime) {
        setTargetAmount(amount);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [amount, oneTime]);

  const handleCheckboxChange = (name) => {
    if (name === 'oneTime') {
      const newVal = !oneTime;
      setOneTime(newVal);
      if (newVal) {
        setNoLimit(false);
        setTargetAmount(amount);
      }
    } else if (name === 'noLimit') {
      const newVal = !noLimit;
      setNoLimit(newVal);
      if (newVal) {
        setOneTime(false);
      }
    }
  };

  // Filter staff list
  const filteredStaff = dropdownSearch.trim() === ''
    ? staffList
    : staffList.filter(s =>
        s.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        s.fileNo.toLowerCase().includes(dropdownSearch.toLowerCase())
      );

  // Statistics
  const totalRecords = records.length;
  const totalEarningsAmount = records
    .filter(r => r.variable_type.toLowerCase() === 'earning')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const totalDeductionsAmount = records
    .filter(r => r.variable_type.toLowerCase() === 'deduction')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setShowDropdown(false);
  };

  const handleClearForm = () => {
    setEditId(null);
    const isSuperAdmin = userCtx.isSuperAdmin;
    const isAdminStaff = userCtx.isAdminStaff;
    const currentEmployee = userCtx.employee;

    if (!(isSuperAdmin || isAdminStaff) && currentEmployee) {
      const matchingStaff = staffList.find(s => s.id === currentEmployee.id);
      if (matchingStaff) {
        setSelectedStaff(matchingStaff);
        setDropdownSearch(matchingStaff.name);
      }
    } else {
      setSelectedStaff(null);
      setDropdownSearch('');
    }

    setVariableType('');
    setCvSetupId('');
    setDescriptions([]);
    setAmount('');
    setTargetAmount('');
    setNoLimit(false);
    setOneTime(false);
    setStatus(true);
    setShowVarTypeDropdown(false);
    setShowDescDropdown(false);
  };

  // Submit record
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }
    if (!variableType) {
      showToast('Please select a Variable Type.', 'error');
      return;
    }
    if (!cvSetupId) {
      showToast('Please select a Description.', 'error');
      return;
    }
    if (!amount || isNaN(parseFloat(amount))) {
      showToast('Please specify a valid amount.', 'error');
      return;
    }

    setSaving(true);
    const headers = buildHeaders();
    // Retrieve label of variable type
    const selectedTypeObj = variableTypes.find(t => String(t.id) === String(variableType));
    const typeLabel = selectedTypeObj ? selectedTypeObj.name : 'Earning';

    const payload = {
      id: editId,
      staffId: selectedStaff.id,
      variable_type: typeLabel,
      cv_setup_id: parseInt(cvSetupId),
      amount: parseFloat(amount),
      target_amount: (noLimit || oneTime) ? null : (targetAmount ? parseFloat(targetAmount) : null),
      no_limit: noLimit,
      one_time: oneTime,
      status: status,
    };

    try {
      const res = await axios.post(`${API_BASE}/payroll/staff-control-variables`, payload, { headers });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Record saved successfully.');
        handleClearForm();
        fetchRecords(true); // silent refresh list
      } else {
        showToast(res.data.message || 'An error occurred.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to save staff control variable.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['Staff ID', 'Description', 'Amount', 'Target Amount', 'No Limit', 'One Time'];
    const sampleRow1 = ['10', 'Housing Allowance', '45000.00', '', 'Yes', 'No'];
    const sampleRow2 = ['12', 'Pension', '15000.00', '150000.00', 'No', 'No'];
    const sampleRow3 = ['15', 'Other Deduction', '5000.00', '5000.00', 'No', 'Yes'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + [
          headers.join(','), 
          sampleRow1.join(','), 
          sampleRow2.join(','),
          sampleRow3.join(',')
        ].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "staff_control_variables_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      showToast('Please select a file to import.', 'error');
      return;
    }

    setUploading(true);
    setImportResult(null);
    const headers = buildHeaders();
    
    const formData = new FormData();
    formData.append('excel_file', importFile);

    try {
      const res = await axios.post(`${API_BASE}/payroll/staff-control-variables/import`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Import completed successfully.');
        setImportResult({
          success: true,
          message: res.data.message,
          importedCount: res.data.imported_count,
          warnings: res.data.warnings || [],
        });
        setImportFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        fetchRecords(true);
      } else {
        showToast(res.data.message || 'Import failed.', 'error');
        setImportResult({
          success: false,
          message: res.data.message || 'Import failed.',
          warnings: res.data.warnings || [],
        });
      }
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to import control variables.';
      showToast(msg, 'error');
      setImportResult({
        success: false,
        message: msg,
        warnings: err.response?.data?.warnings || [],
      });
    } finally {
      setUploading(false);
    }
  };

  // Edit action prefill
  const handleEdit = async (record) => {
    setEditId(record.id);

    // Prefill staff
    const matchingStaff = staffList.find(s => s.id === record.staffId);
    if (matchingStaff) {
      setSelectedStaff(matchingStaff);
      setDropdownSearch(matchingStaff.name);
    }

    // Prefill Variable Type ID
    const matchingTypeObj = variableTypes.find(t => t.name.toLowerCase() === record.variable_type.toLowerCase());
    const typeId = matchingTypeObj ? matchingTypeObj.id : '';
    setVariableType(typeId);

    // Trigger Descriptions reload for that type
    if (typeId) {
      const headers = buildHeaders();
      try {
        const res = await axios.get(`${API_BASE}/payroll/staff-control-variables/descriptions/${typeId}`, { headers });
        if (res.data.status === 'success') {
          setDescriptions(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load descriptions during edit:', err);
      }
    }

    setCvSetupId(record.cv_setup_id);
    setAmount(record.amount);
    setNoLimit(record.no_limit === 1);
    setOneTime(record.one_time === 1);
    setStatus(record.status === 1);
    setTargetAmount(record.target_amount ?? '');
  };

  // Delete Action Confirm Trigger
  const handleDeleteTrigger = (id) => {
    setConfirmDelete(id);
  };

  // Perform backend delete with optimistic update
  const handleDeleteConfirm = async () => {
    const id = confirmDelete;
    if (!id) return;

    setActionLoading(true);
    // Optimistic delete from UI
    const originalRecords = [...records];
    setRecords(records.filter(r => r.id !== id));

    const headers = buildHeaders();
    try {
      const res = await axios.delete(`${API_BASE}/payroll/staff-control-variables/${id}`, { headers });
      if (res.data.status === 'success') {
        showToast('Record deleted successfully.');
        setConfirmDelete(null);
        fetchRecords(true); // silent sync
      } else {
        setRecords(originalRecords); // rollback
        showToast(res.data.message || 'Deletion failed.', 'error');
      }
    } catch (err) {
      setRecords(originalRecords); // rollback
      showToast('Failed to delete the control variable.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtering listings table
  const filteredRecords = records.filter(r => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.fileNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.variable_type.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedStaff) {
      return matchesSearch && r.staffId === selectedStaff.id;
    }
    return matchesSearch;
  });

  // Pagination bounds
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const isFormDisabled = !(userCtx.isSuperAdmin || userCtx.isAdminStaff);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Staff Control Variables</h1>
        <p className={styles.subtitle}>Configure monthly staff earnings, deductions, target limits, and one-off adjustments.</p>
      </div>

      {/* Statistics Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconTotal}`}>
            <Users size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Variables</span>
            <span className={styles.statValue}>{totalRecords}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconEarning}`}>
            <TrendingUp size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Earnings</span>
            <span className={styles.statValue}>₦{fmt(totalEarningsAmount)}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconDeduction}`}>
            <TrendingDown size={20} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Deductions</span>
            <span className={styles.statValue}>₦{fmt(totalDeductionsAmount)}</span>
          </div>
        </div>
      </div>

      {/* Input Form Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            {editId ? 'Modify Control Variable' : 'Add New Control Variable'}
          </h2>
        </div>

        <div className={styles.cardBody}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              
              {/* Select Staff (Autocomplete Dropdown) */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Select Staff Member *</label>
                <div className={styles.dropdownContainer} ref={dropdownRef}>
                  <div className={styles.inputGroup}>
                    <Users className={styles.inputIcon} size={16} />
                    <input
                      type="text"
                      className={`${styles.input} ${styles.inputWithIcon}`}
                      placeholder={isFormDisabled ? "Loading profiles..." : "Search staff by name or file number..."}
                      value={dropdownSearch}
                      onChange={(e) => {
                        setDropdownSearch(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => {
                        if (!isFormDisabled) setShowDropdown(true);
                      }}
                      disabled={isFormDisabled}
                    />
                  </div>

                  {showDropdown && filteredStaff.length > 0 && (
                    <ul className={styles.dropdownList}>
                      {filteredStaff.map((staff) => (
                        <li
                          key={staff.id}
                          className={styles.dropdownItem}
                          onClick={() => handleSelectStaff(staff)}
                        >
                          <span className={styles.staffName}>{staff.name}</span>
                          <span className={styles.dropdownItemSub}>File No: {staff.fileNo}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {showDropdown && filteredStaff.length === 0 && (
                    <div className={styles.dropdownList}>
                      <div className={styles.dropdownEmpty}>No staff profiles found</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Variable Type Custom Select */}
              <div className={styles.formGroup} ref={varTypeDropdownRef}>
                <label className={styles.label}>Variable Type *</label>
                <div className={styles.customSelectContainer}>
                  <button
                    type="button"
                    className={`${styles.customSelectTrigger} ${showVarTypeDropdown ? styles.customSelectTriggerActive : ''}`}
                    onClick={() => {
                      if (!isFormDisabled) setShowVarTypeDropdown(!showVarTypeDropdown);
                    }}
                    disabled={isFormDisabled}
                  >
                    <span>
                      {variableType
                        ? (variableTypes.find(t => String(t.id) === String(variableType))?.name ?? '-- Choose Type --')
                        : '-- Choose Type --'}
                    </span>
                    <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  {showVarTypeDropdown && !isFormDisabled && (
                    <ul className={styles.customSelectDropdown}>
                      {variableTypes.map((type) => (
                        <li
                          key={type.id}
                          className={`${styles.customSelectItem} ${String(variableType) === String(type.id) ? styles.customSelectItemActive : ''}`}
                          onClick={() => {
                            handleVariableTypeChange(type.id);
                            setShowVarTypeDropdown(false);
                          }}
                        >
                          {type.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Description Custom Select */}
              <div className={styles.formGroup} ref={descDropdownRef}>
                <label className={styles.label}>Description (CV Setup) *</label>
                <div className={styles.customSelectContainer}>
                  <button
                    type="button"
                    className={`${styles.customSelectTrigger} ${showDescDropdown ? styles.customSelectTriggerActive : ''}`}
                    onClick={() => {
                      if (!isFormDisabled && variableType) setShowDescDropdown(!showDescDropdown);
                    }}
                    disabled={isFormDisabled || !variableType}
                  >
                    <span>
                      {cvSetupId
                        ? (descriptions.find(d => String(d.id) === String(cvSetupId))?.description ?? '-- Choose Description --')
                        : '-- Choose Description --'}
                    </span>
                    <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  {showDescDropdown && !isFormDisabled && variableType && (
                    <ul className={styles.customSelectDropdown}>
                      {descriptions.map((desc) => (
                        <li
                          key={desc.id}
                          className={`${styles.customSelectItem} ${String(cvSetupId) === String(desc.id) ? styles.customSelectItemActive : ''}`}
                          onClick={() => {
                            setCvSetupId(desc.id);
                            setShowDescDropdown(false);
                          }}
                        >
                          {desc.description}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Amount field */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Amount (₦ Monthly) *</label>
                <div className={styles.inputGroup}>
                  <NairaSign className={styles.inputIcon} size={16} />
                  <input
                    type="number"
                    step="0.01"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="Enter monthly amount value"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>

              {/* Checkboxes (No Limit & One-Time) */}
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={noLimit}
                    onChange={() => handleCheckboxChange('noLimit')}
                    disabled={isFormDisabled}
                  />
                  No Limit
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={oneTime}
                    onChange={() => handleCheckboxChange('oneTime')}
                    disabled={isFormDisabled}
                  />
                  One-Time Transaction
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={status}
                    onChange={() => setStatus(!status)}
                    disabled={isFormDisabled}
                  />
                  Active Status
                </label>
              </div>

              {/* Target Amount field */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Target Amount Limit</label>
                <div className={styles.inputGroup}>
                  <NairaSign className={styles.inputIcon} size={16} />
                  <input
                    type="number"
                    step="0.01"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder={oneTime ? "Matches Amount (One-Time)" : "Enter total target limit"}
                    value={oneTime ? amount : targetAmount}
                    onChange={(e) => {
                      if (!oneTime) setTargetAmount(e.target.value);
                    }}
                    disabled={isFormDisabled || oneTime}
                  />
                </div>
              </div>

            </div>

            {/* Actions */}
            {!isFormDisabled && (
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={`${styles.btn} styles.btnSecondary`}
                  onClick={handleClearForm}
                  disabled={saving}
                >
                  Clear Fields
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
                      {editId ? 'Update Record' : 'Save Variable'}
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Bulk Import Card */}
      {!isFormDisabled && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Bulk Import Control Variables</h2>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
              onClick={downloadTemplate}
            >
              <Download size={14} />
              Download CSV Template
            </button>
          </div>
          <div className={styles.cardBody}>
            <form onSubmit={handleImportSubmit} className={styles.importForm}>
              <div className={styles.importInfo}>
                <p className={styles.importInstructions}>
                  Upload an Excel (<code>.xlsx</code>, <code>.xls</code>) or <code>.csv</code> spreadsheet containing employee monthly variable allocations to update or insert records.
                </p>
                <div className={styles.templateRequirements}>
                  <strong>Spreadsheet columns structure (with or without headers):</strong>
                  <ul>
                    <li>Column 1: <code>Staff ID</code> (Numeric ID in system, e.g. <code>12</code>)</li>
                    <li>Column 2: <code>Description</code> (Setup name, e.g. <code>Pension</code>, <code>Overtime</code>, <code>Housing Allowance</code>)</li>
                    <li>Column 3: <code>Amount</code> (Numeric monthly amount, e.g. <code>15000.00</code>)</li>
                    <li>Column 4 (Optional): <code>Target Limit</code> (Total target amount, e.g. <code>50000.00</code>)</li>
                    <li>Column 5 (Optional): <code>No Limit</code> (<code>Yes</code>/<code>No</code> or <code>1</code>/<code>0</code>)</li>
                    <li>Column 6 (Optional): <code>One-Time</code> (<code>Yes</code>/<code>No</code> or <code>1</code>/<code>0</code>)</li>
                  </ul>
                </div>
              </div>

              <div className={styles.dropzoneContainer}>
                <div 
                  className={`${styles.dropzone} ${importFile ? styles.dropzoneActive : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx,.xls,.csv"
                    className={styles.hiddenInput}
                  />
                  <Upload className={styles.uploadIcon} size={24} />
                  {importFile ? (
                    <div className={styles.fileDetails}>
                      <span className={styles.fileName}>{importFile.name}</span>
                      <span className={styles.fileSize}>({(importFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <div className={styles.uploadPlaceholder}>
                      <span>Drag & drop your file here, or <strong className={styles.browseText}>browse</strong></span>
                      <span className={styles.uploadSubtext}>Supports .xlsx, .xls, .csv</span>
                    </div>
                  )}
                </div>

                {importFile && (
                  <button
                    type="button"
                    className={styles.clearFileBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setImportFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className={styles.importActions}>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={uploading || !importFile}
                >
                  {uploading ? (
                    <>
                      <Loader2 className={styles.loadingSpinner} size={16} />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Upload & Import
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Results & warnings summary */}
            {importResult && (
              <div className={`${styles.importResultBox} ${importResult.success ? styles.resultSuccess : styles.resultError}`}>
                <div className={styles.resultHeader}>
                  {importResult.success ? (
                    <CheckCircle2 className={styles.resultIcon} size={20} />
                  ) : (
                    <XCircle className={styles.resultIcon} size={20} />
                  )}
                  <div>
                    <h4 className={styles.resultTitle}>
                      {importResult.success ? 'Import Complete' : 'Import Failed'}
                    </h4>
                    <p className={styles.resultMessage}>{importResult.message}</p>
                  </div>
                </div>

                {importResult.warnings && importResult.warnings.length > 0 && (
                  <div className={styles.warningsSection}>
                    <button
                      type="button"
                      className={styles.toggleWarningsBtn}
                      onClick={() => setShowWarnings(!showWarnings)}
                    >
                      <AlertTriangle size={14} style={{ marginRight: '4px' }} />
                      {showWarnings ? 'Hide' : 'Show'} {importResult.warnings.length} warning(s)/error(s) occurred
                      <ChevronDown size={14} style={{ marginLeft: 'auto', transform: showWarnings ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                    {showWarnings && (
                      <ul className={styles.warningsList}>
                        {importResult.warnings.map((w, idx) => (
                          <li key={idx} className={styles.warningItem}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* listings table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Control Variables Setup Registry</h2>
        </div>

        {/* Search bar */}
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <Search className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search table by name, file number, type, or description..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Table layout */}
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 className={styles.loadingSpinner} size={28} />
              <p style={{ marginTop: '0.75rem' }}>Synchronizing control variables registry...</p>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText className={styles.emptyIcon} size={32} />
              <p>No matching staff control variable records found.</p>
            </div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Staff Profile</th>
                    <th>Dept.</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Monthly Amt.</th>
                    <th>Limit Target</th>
                    <th>No Limit</th>
                    <th>One-Time</th>
                    <th>Status</th>
                    {!isFormDisabled && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className={styles.staffCell}>
                          <span className={styles.staffName}>{row.name}</span>
                          <span className={styles.staffFile}>{row.fileNo}</span>
                        </div>
                      </td>
                      <td>{row.department}</td>
                      <td>
                        <span className={`${styles.badge} ${row.variable_type.toLowerCase() === 'earning' ? styles.badgeEarning : styles.badgeDeduction}`}>
                          {row.variable_type}
                        </span>
                      </td>
                      <td>{row.description}</td>
                      <td style={{ fontWeight: 600 }}>₦{fmt(row.amount)}</td>
                      <td>
                        {row.one_time === 1 ? (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>One-Time</span>
                        ) : row.target_amount !== null ? (
                          `₦${fmt(row.target_amount)}`
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${row.no_limit === 1 ? styles.badgeYes : styles.badgeNo}`}>
                          {row.no_limit === 1 ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${row.one_time === 1 ? styles.badgeYes : styles.badgeNo}`}>
                          {row.one_time === 1 ? 'Yes' : 'No'}
                        </span>
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
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredRecords.length)} of {filteredRecords.length} variables
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
                  Are you sure you want to delete this staff control variable? This action cannot be undone and will stop any scheduled calculations for this variable immediately.
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
