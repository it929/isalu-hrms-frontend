"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Search,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Edit2,
  UploadCloud,
  Download,
  AlertTriangle,
  Plus,
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

export default function SalaryStructurePage() {
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
  const [structures, setStructures] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown Autocomplete Staff State
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const dropdownRef = useRef(null);

  // Form Fields
  const [basicSalary, setBasicSalary] = useState('');
  const [declareSalary, setDeclareSalary] = useState('');
  const [housingAllowance, setHousingAllowance] = useState('');
  const [transportAllowance, setTransportAllowance] = useState('');
  const [medicalAllowance, setMedicalAllowance] = useState('');
  const [utilityAllowance, setUtilityAllowance] = useState('');
  const [mealAllowance, setMealAllowance] = useState('');
  const [pensionRate, setPensionRate] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [structureType, setStructureType] = useState('current'); // 'first' | 'current'

  // Effect to autofill form when selected staff changes or structureType switches to 'current'
  useEffect(() => {
    if (structureType === 'current' && selectedStaff) {
      const existing = structures.find(s => s.staffId === selectedStaff.id);
      if (existing) {
        setBasicSalary(existing.basic_salary);
        setDeclareSalary(existing.declare_salary);
        setHousingAllowance(existing.housing_allowance);
        setTransportAllowance(existing.transport_allowance);
        setMedicalAllowance(existing.medical_allowance);
        setUtilityAllowance(existing.utility_allowance);
        setMealAllowance(existing.meal_allowance);
        setPensionRate(existing.pension_rate);
        setTaxRate(existing.tax_rate);
      }
    }
  }, [structureType, selectedStaff, structures]);


  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async (silent = false) => {
    const cacheKeyStaff = 'hrms_salary_struct_staff_cache';
    const cacheKeyStructures = 'hrms_salary_struct_structures_cache';
    let hasCache = false;

    if (typeof window !== 'undefined') {
      const cachedStaff = sessionStorage.getItem(cacheKeyStaff);
      const cachedStruct = sessionStorage.getItem(cacheKeyStructures);
      if (cachedStaff && cachedStruct) {
        setStaffList(JSON.parse(cachedStaff));
        setStructures(JSON.parse(cachedStruct));
        hasCache = true;
      }
    }

    if (!silent && !hasCache) setLoading(true);
    const headers = buildHeaders();
    try {
      const [staffRes, structRes] = await Promise.all([
        axios.get(`${API_BASE}/payroll/salary-structures/staff`, { headers }),
        axios.get(`${API_BASE}/payroll/salary-structures`, { headers }),
      ]);

      if (staffRes.data.status === 'success') {
        const freshStaff = staffRes.data.data || [];
        setStaffList(freshStaff);
        if (typeof window !== 'undefined') sessionStorage.setItem(cacheKeyStaff, JSON.stringify(freshStaff));
      }
      if (structRes.data.status === 'success') {
        const freshStruct = structRes.data.data || [];
        setStructures(freshStruct);
        if (typeof window !== 'undefined') sessionStorage.setItem(cacheKeyStructures, JSON.stringify(freshStruct));
      }
    } catch (err) {
      showToast('Failed to retrieve setup information.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!(sessionStorage.getItem('hrms_salary_struct_staff_cache') && sessionStorage.getItem('hrms_salary_struct_structures_cache'));
    }
    if (!hasCache) {
      fetchData();
    } else {
      const cachedStaff = sessionStorage.getItem('hrms_salary_struct_staff_cache');
      const cachedStruct = sessionStorage.getItem('hrms_salary_struct_structures_cache');
      if (cachedStaff) setStaffList(JSON.parse(cachedStaff));
      if (cachedStruct) setStructures(JSON.parse(cachedStruct));
    }
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
        s.fileNo.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        String(s.id).includes(dropdownSearch)
      );

  // Statistics
  const totalConfigured = structures.length;
  const totalGrossSalary = structures.reduce((sum, item) => {
    return sum +
      parseFloat(item.basic_salary || 0) +
      parseFloat(item.housing_allowance || 0) +
      parseFloat(item.transport_allowance || 0) +
      parseFloat(item.medical_allowance || 0) +
      parseFloat(item.utility_allowance || 0) +
      parseFloat(item.meal_allowance || 0);
  }, 0);
  const avgTaxRate = totalConfigured > 0
    ? structures.reduce((sum, item) => sum + parseFloat(item.tax_rate || 0), 0) / totalConfigured
    : 0;
  const avgPensionRate = totalConfigured > 0
    ? structures.reduce((sum, item) => sum + parseFloat(item.pension_rate || 0), 0) / totalConfigured
    : 0;

  // Handle Select Staff from Autocomplete list
  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.label);
    setShowDropdown(false);

    // If there is an existing structure for this staff, populate form fields
    const existing = structures.find(s => s.staffId === staff.id);
    if (existing) {
      setBasicSalary(existing.basic_salary);
      setDeclareSalary(existing.declare_salary);
      setHousingAllowance(existing.housing_allowance);
      setTransportAllowance(existing.transport_allowance);
      setMedicalAllowance(existing.medical_allowance);
      setUtilityAllowance(existing.utility_allowance);
      setMealAllowance(existing.meal_allowance);
      setPensionRate(existing.pension_rate);
      setTaxRate(existing.tax_rate);
      showToast(`Loaded existing structure for ${staff.name}. Saving will overwrite it.`);
    } else {
      // Clear values if no existing
      resetFormFieldsExceptStaff();
    }
  };

  const resetFormFieldsExceptStaff = () => {
    setBasicSalary('');
    setDeclareSalary('');
    setHousingAllowance('');
    setTransportAllowance('');
    setMedicalAllowance('');
    setUtilityAllowance('');
    setMealAllowance('');
    setPensionRate('');
    setTaxRate('');
  };

  const handleClearForm = () => {
    setSelectedStaff(null);
    setDropdownSearch('');
    resetFormFieldsExceptStaff();
  };

  // Submit manual salary structure
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
        basic_salary: basicSalary || 0,
        declare_salary: declareSalary || 0,
        housing_allowance: housingAllowance || 0,
        transport_allowance: transportAllowance || 0,
        medical_allowance: medicalAllowance || 0,
        utility_allowance: utilityAllowance || 0,
        meal_allowance: mealAllowance || 0,
        pension_rate: pensionRate || 0,
        tax_rate: taxRate || 0,
        structure_type: structureType,
      };


      const res = await axios.post(`${API_BASE}/payroll/salary-structures`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Salary structure saved successfully.');
        handleClearForm();
        fetchData(true); // Silent refetch and update sessionStorage cache
      } else {
        showToast(res.data.message || 'Failed to save salary structure.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error saving record.', 'error');
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

    setUploading(true);
    setWarnings([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE}/payroll/salary-structures/upload`, formData, {
        headers: {
          ...buildHeaders(),
          'Content-Type': 'multipart/form-data',
        }
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || `Successfully processed data.`);
        if (res.data.warnings && res.data.warnings.length > 0) {
          setWarnings(res.data.warnings);
        }
        // Refresh structures list
        const structRes = await axios.get(`${API_BASE}/payroll/salary-structures`, { headers: buildHeaders() });
        if (structRes.data.status === 'success') {
          setStructures(structRes.data.data || []);
        }
      } else {
        showToast(res.data.message || 'Import failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error importing file.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Export/Download Excel Template CSV
  const handleDownloadTemplate = () => {
    const headers = [
      'staffId',
      'basic_salary',
      'declare_salary',
      'housing_allowance',
      'transport_allowance',
      'medical_allowance',
      'utility_allowance',
      'meal_allowance',
      'pension_rate',
      'tax_rate'
    ];

    const sampleRow = [
      '1',
      '120000.00',
      '120000.00',
      '30000.00',
      '15000.00',
      '10000.00',
      '5000.00',
      '8000.00',
      '8.00',
      '12.50'
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), sampleRow.join(',')].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "salary_structures_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded template file!');
  };

  // Trigger form population from existing structures list
  const handleEditFromList = (row) => {
    const staff = staffList.find(s => s.id === row.staffId) || {
      id: row.staffId,
      fileNo: row.fileNo || '',
      name: row.name,
      label: (row.fileNo ? `[${row.fileNo}] ` : '') + row.name
    };

    setSelectedStaff(staff);
    setDropdownSearch(staff.label);
    setBasicSalary(row.basic_salary);
    setDeclareSalary(row.declare_salary);
    setHousingAllowance(row.housing_allowance);
    setTransportAllowance(row.transport_allowance);
    setMedicalAllowance(row.medical_allowance);
    setUtilityAllowance(row.utility_allowance);
    setMealAllowance(row.meal_allowance);
    setPensionRate(row.pension_rate);
    setTaxRate(row.tax_rate);

    setActiveTab('manual');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Loaded ${row.name}'s structure for editing.`);
  };

  // Filtered structures list
  const filteredStructures = structures.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.fileNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
        <h1>Salary Structure Configuration</h1>
        <p>Set up, modify, or upload monthly base salaries and standard allowances for personnel.</p>
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
            <div className={styles.statLabel}>Configured Staff</div>
            <div className={styles.statValue}>{totalConfigured.toLocaleString()}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            <DollarSign size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Total Configured Basic</div>
            <div className={styles.statValue}>₦{fmt(totalGrossSalary)}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <TrendingDown size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Avg. Tax Rate</div>
            <div className={styles.statValue}>{avgTaxRate.toFixed(2)}%</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
            <TrendingUp size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Avg. Pension Rate</div>
            <div className={styles.statValue}>{avgPensionRate.toFixed(2)}%</div>
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
            <h2 className={styles.cardTitle}>Manual Salary Assignment</h2>
            <form onSubmit={handleSubmitManual}>
              <div className={styles.formGrid}>
                {/* Structure Type Select Toggles */}
                <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                  <label className={styles.formLabel}>Structure Assignment Type</label>
                  <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      <input
                        type="radio"
                        name="structureType"
                        value="current"
                        checked={structureType === 'current'}
                        onChange={() => setStructureType('current')}
                      />
                      Current Salary Structure (For Adjustments)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      <input
                        type="radio"
                        name="structureType"
                        value="first"
                        checked={structureType === 'first'}
                        onChange={() => setStructureType('first')}
                      />
                      First Salary Structure
                    </label>
                  </div>
                </div>

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

                {/* Basic Salary */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="basic-salary">Basic Salary (₦) *</label>
                  <input
                    id="basic-salary"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={styles.formInput}
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(e.target.value)}
                    required
                  />
                </div>

                {/* Declared Salary */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="declare-salary">Declared Salary (₦)</label>
                  <input
                    id="declare-salary"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={styles.formInput}
                    value={declareSalary}
                    onChange={(e) => setDeclareSalary(e.target.value)}
                  />
                </div>

                {/* Housing Allowance */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="housing-allowance">Housing Allowance (₦)</label>
                  <input
                    id="housing-allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={styles.formInput}
                    value={housingAllowance}
                    onChange={(e) => setHousingAllowance(e.target.value)}
                  />
                </div>

                {/* Transport Allowance */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="transport-allowance">Transport Allowance (₦)</label>
                  <input
                    id="transport-allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={styles.formInput}
                    value={transportAllowance}
                    onChange={(e) => setTransportAllowance(e.target.value)}
                  />
                </div>

                {/* Medical Allowance */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="medical-allowance">Medical Allowance (₦)</label>
                  <input
                    id="medical-allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={styles.formInput}
                    value={medicalAllowance}
                    onChange={(e) => setMedicalAllowance(e.target.value)}
                  />
                </div>

                {/* Utility Allowance */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="utility-allowance">Utility Allowance (₦)</label>
                  <input
                    id="utility-allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={styles.formInput}
                    value={utilityAllowance}
                    onChange={(e) => setUtilityAllowance(e.target.value)}
                  />
                </div>

                {/* Meal Allowance */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="meal-allowance">Meal Allowance (₦)</label>
                  <input
                    id="meal-allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={styles.formInput}
                    value={mealAllowance}
                    onChange={(e) => setMealAllowance(e.target.value)}
                  />
                </div>

                {/* Pension Rate */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="pension-rate">Pension Contribution Rate (%)</label>
                  <input
                    id="pension-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    className={styles.formInput}
                    value={pensionRate}
                    onChange={(e) => setPensionRate(e.target.value)}
                  />
                </div>

                {/* Tax Rate */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="tax-rate">Income Tax Rate (%)</label>
                  <input
                    id="tax-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    className={styles.formInput}
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
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
                  {saving ? 'Saving...' : 'Save Structure'}
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
              Upload an Excel file (.xlsx, .xls) or CSV template that contains multiple staff salary structures.
              Staff records will be matched and saved directly to the database.
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
                Required column titles (or order): <strong>staffId, basic_salary, declare_salary, housing_allowance, transport_allowance, medical_allowance, utility_allowance, meal_allowance, pension_rate, tax_rate</strong>
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

      {/* Searchable Structures List Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>
            <FileText size={18} />
            Salary Assignment Schedule
          </h2>
          <div className={styles.tableSearch}>
            <Search size={16} className={styles.tableSearchIcon} />
            <input
              type="text"
              placeholder="Search by staff name, ID or file no..."
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
              <span>Fetching salary structures...</span>
            </div>
          ) : filteredStructures.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>File No</th>
                  <th>Staff Name</th>
                  <th>Basic (₦)</th>
                  <th>Declared (₦)</th>
                  <th>Housing (₦)</th>
                  <th>Transport (₦)</th>
                  <th>Medical (₦)</th>
                  <th>Utility (₦)</th>
                  <th>Meal (₦)</th>
                  <th>Pension (%)</th>
                  <th>Tax (%)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStructures.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.tdPrimary}>{row.staffId}</td>
                    <td>{row.fileNo || '—'}</td>
                    <td>{row.name}</td>
                    <td className={styles.tdNum}>{fmt(row.basic_salary)}</td>
                    <td className={styles.tdNum}>{fmt(row.declare_salary)}</td>
                    <td className={styles.tdNum}>{fmt(row.housing_allowance)}</td>
                    <td className={styles.tdNum}>{fmt(row.transport_allowance)}</td>
                    <td className={styles.tdNum}>{fmt(row.medical_allowance)}</td>
                    <td className={styles.tdNum}>{fmt(row.utility_allowance)}</td>
                    <td className={styles.tdNum}>{fmt(row.meal_allowance)}</td>
                    <td className={styles.tdNum}>{parseFloat(row.pension_rate).toFixed(2)}%</td>
                    <td className={styles.tdNum}>{parseFloat(row.tax_rate).toFixed(2)}%</td>
                    <td>
                      <button
                        type="button"
                        className={styles.btnEdit}
                        onClick={() => handleEditFromList(row)}
                        title="Edit Salary Structure"
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
              <h3>No Configurations Found</h3>
              <p>
                {searchQuery
                  ? "No salary structures matched your search filters."
                  : "No salary structures have been set up yet. Choose manual configuration or spreadsheet upload above."}
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
