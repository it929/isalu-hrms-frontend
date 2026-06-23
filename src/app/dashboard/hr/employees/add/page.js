"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { UserPlus, X, UploadCloud, Download, AlertTriangle, Loader2 } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

const TITLES = ['Mr', 'Mrs', 'Miss'];
const GENDERS = ['Male', 'Female'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];

const initialForm = {
  title: '', surname: '', firstname: '', othernames: '',
  sex: '', maritalStatus: '', email: '', phoneNo: '',
  date_of_birth: '', date_of_joining: '',
  department_id: '', unit_id: '', designation_id: '',
  address: '',
};

// ── Helper: field row ────────────────────────────────────────────────────
const Field = ({ label, name, type = 'text', placeholder = '', value, onChange, error }) => (
  <div className={styles.fieldGroup}>
    <label className={styles.label}>{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`${styles.input} ${error ? styles.inputError : ''}`}
    />
    {error && <span className={styles.errorMsg}>{error[0]}</span>}
  </div>
);

const Select = ({ label, name, options, placeholder = 'Select…', value, onChange, error }) => (
  <div className={styles.fieldGroup}>
    <label className={styles.label}>{label}</label>
    <CustomSelect
      name={name}
      options={(Array.isArray(options) ? options : []).map(o => ({
        id: o.id ?? o,
        name: o.name ?? o
      }))}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
    {error && <span className={styles.errorMsg}>{error[0]}</span>}
  </div>
);

export default function AddNewStaff() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'bulk'
  const [form, setForm] = useState(initialForm);
  const [departments, setDepartments] = useState([]);
  const [units, setUnits] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});

  // ── Load form data on mount ──────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API_BASE}/hr/add-staff/form-data`)
      .then(res => {
        if (res.data.status === 'success') {
          setDepartments(res.data.departments || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load form data:', err?.response?.data || err.message);
      });
  }, []);

  // ── Cascade: department → designations + units ───────────────────────────
  useEffect(() => {
    if (!form.department_id) {
      const timer = setTimeout(() => {
        setDesignations([]);
        setUnits([]);
      }, 0);
      return () => clearTimeout(timer);
    }
    axios.get(`${API_BASE}/hr/add-staff/designations/${form.department_id}`)
      .then(r => setDesignations(r.data));
    axios.get(`${API_BASE}/hr/add-staff/units/${form.department_id}`)
      .then(r => setUnits(r.data));
  }, [form.department_id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleTextareaResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
    handleChange(e);
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      await axios.post(`${API_BASE}/hr/add-staff`, form);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('hrms_employee_records_cache');
      }
      showToast('Staff record added successfully!');
      setForm(initialForm);
      setDesignations([]);
      setUnits([]);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors || {});
        showToast('Please fix the errors below.', 'error');
      } else {
        showToast(err.response?.data?.message || 'An error occurred.', 'error');
      }
    } finally {
      setSubmitting(false);
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
    formData.append('excel_file', file);

    try {
      const res = await axios.post(`${API_BASE}/hr/add-staff/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      if (res.data.status === 'success') {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('hrms_employee_records_cache');
        }
        showToast(res.data.message || 'Staff spreadsheet imported successfully.');
        if (res.data.warnings && res.data.warnings.length > 0) {
          setWarnings(res.data.warnings);
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

  const handleDownloadTemplate = () => {
    const headers = [
      'staffID', 'title', 'surname', 'firstname', 'othernames', 'sex', 'maritalStatus',
      'date_of_birth', 'phoneNo', 'email', 'address', 'department', 'unit',
      'designation', 'date_of_joining'
    ];
    const sampleRow = [
      '101', 'Mr', 'IBRAHIM', 'AMINU', 'SULEIMAN', 'Male', 'Single',
      '1990-01-01', '08012345678', 'aminu@isalu.gov.ng', '123 Main Street, Abuja', 'Admin', 'Billing',
      'Accountant', '2026-05-26'
    ];

    // Safely wrap each value in double quotes and escape any embedded quotes to prevent column shifting
    const csvContent = "data:text/csv;charset=utf-8,"
      + [
        headers.join(','),
        sampleRow.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "add_staff_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded staff import template CSV!');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* ── Toast ── */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Add New Staff</h1>
          <p className={styles.pageSubtitle}>Register new administrative staff members into the system.</p>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'single' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('single')}
        >
          <UserPlus size={16} />
          Single Registration Form
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'bulk' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <UploadCloud size={16} />
          Bulk Import Spreadsheet
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'single' ? (
          <motion.div
            key="single"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`premium-card ${styles.formCard}`}
          >
            <div className={styles.formCardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <UserPlus size={22} />
                <h2>Staff Registration Form</h2>
              </div>
              <button
                type="button"
                onClick={() => router.push('/dashboard/hr/employees')}
                className={styles.closeBtn}
                title="Close Form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.grid}>
                {/* ─ Personal Info ─ */}
                <Select label="Title *" name="title" options={TITLES.map(t => ({ id: t, name: t }))} value={form.title} onChange={handleChange} error={errors.title} />
                <Field label="Surname *" name="surname" placeholder="e.g. IBRAHIM" value={form.surname} onChange={handleChange} error={errors.surname} />
                <Field label="First Name *" name="firstname" placeholder="e.g. AMINU" value={form.firstname} onChange={handleChange} error={errors.firstname} />
                <Field label="Other Names" name="othernames" placeholder="e.g. SULEIMAN" value={form.othernames} onChange={handleChange} error={errors.othernames} />
                <Select label="Gender *" name="sex" options={GENDERS.map(g => ({ id: g, name: g }))} value={form.sex} onChange={handleChange} error={errors.sex} />
                <Select label="Marital Status *" name="maritalStatus" options={MARITAL.map(m => ({ id: m, name: m }))} value={form.maritalStatus} onChange={handleChange} error={errors.maritalStatus} />
                <Field label="Date of Birth *" name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} error={errors.date_of_birth} />
                <Field label="Phone Number" name="phoneNo" placeholder="e.g. 08012345678" value={form.phoneNo} onChange={handleChange} error={errors.phoneNo} />
                <Field label="Email Address" name="email" type="email" placeholder="e.g. staff@gmail.com" value={form.email} onChange={handleChange} error={errors.email} />

                {/* ─ Address ─ */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Residential Address *</label>
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleTextareaResize}
                    rows={1}
                    placeholder="Enter residential address"
                    className={`${styles.input} ${styles.textarea} ${errors.address ? styles.inputError : ''}`}
                    style={{ overflow: 'hidden', minHeight: '54px' }}
                  />
                  {errors.address && <span className={styles.errorMsg}>{errors.address[0]}</span>}
                </div>

                {/* ─ Appointment Details ─ */}
                <Select
                  label="Department *"
                  name="department_id"
                  options={departments}
                  placeholder="— Select Department —"
                  value={form.department_id} onChange={handleChange} error={errors.department_id}
                />
                <Select
                  label="Unit *"
                  name="unit_id"
                  options={units}
                  placeholder={form.department_id ? '— Select Unit —' : '— Choose Department First —'}
                  value={form.unit_id} onChange={handleChange} error={errors.unit_id}
                />
                <Select
                  label="Designation *"
                  name="designation_id"
                  options={designations}
                  placeholder={form.department_id ? '— Select Designation —' : '— Choose Department First —'}
                  value={form.designation_id} onChange={handleChange} error={errors.designation_id}
                />
                <Field label="Date of Joining *" name="date_of_joining" type="date" value={form.date_of_joining} onChange={handleChange} error={errors.date_of_joining} />
              </div>

              {/* ─ Submit ─ */}
              <div className={styles.formFooter}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => router.push('/dashboard/hr/employees')}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => { setForm(initialForm); setErrors({}); }}
                  >
                    Clear Form
                  </button>
                </div>
                <button type="submit" className={`premium-btn ${styles.btnPrimary}`} disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Staff Record'}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="bulk"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`premium-card ${styles.formCard}`}
            style={{ padding: '2rem' }}
          >
            <div className={styles.formCardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <UploadCloud size={22} />
                <h2>Spreadsheet Staff Import</h2>
              </div>
              <button
                type="button"
                onClick={() => router.push('/dashboard/hr/employees')}
                className={styles.closeBtn}
                title="Close Form"
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--secondary)', marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
              Upload an Excel file (.xlsx, .xls) or CSV template listing staff details to register multiple staff members simultaneously.
            </p>

            {/* Drag & Drop Area */}
            <div
              className={`${styles.uploadZone} ${dragActive ? styles.uploadZoneActive : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('bulk-staff-input').click()}
            >
              <input
                type="file"
                id="bulk-staff-input"
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
                  {uploading ? 'Analyzing spreadsheet...' : 'Drag & drop Excel or CSV file here'}
                </p>
                <p className={styles.uploadZoneDesc}>
                  {!uploading && 'or click to browse local files (Supports .xlsx, .xls, .csv)'}
                </p>
              </div>
            </div>

            {/* Template Download Option */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={styles.btnDownloadTemplate}
                onClick={handleDownloadTemplate}
              >
                <Download size={14} />
                Download CSV Column Template
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                Required columns: <strong>title, surname, firstname, sex, maritalStatus, date_of_birth, address, department, unit, designation, date_of_joining</strong>
              </span>
            </div>

            {/* Warnings Alerts */}
            {warnings.length > 0 && (
              <div className={styles.warningCard} style={{ marginTop: '1.5rem' }}>
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
    </motion.div>
  );
}
