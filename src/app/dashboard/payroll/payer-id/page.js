"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Upload, 
  Search, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Download, 
  UserPlus, 
  PlusCircle 
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

export default function PayerIdPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'bulk'
  
  // Search and Filter
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffSearchText, setStaffSearchText] = useState('');
  const [payerIdVal, setPayerIdVal] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Drag and Drop
  const [dragActive, setDragActive] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const fileInputRef = useRef(null);

  // Toast notification state
  const [toast, setToast] = useState(null);

  // Stats
  const totalStaff = records.length;
  const staffWithPayerId = records.filter(r => r.payer_id && r.payer_id.trim() !== '').length;
  const staffWithoutPayerId = totalStaff - staffWithPayerId;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/payer-id`, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success') {
        setRecords(res.data.data || []);
      } else {
        showToast(res.data.message || 'Failed to load records.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error loading records.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter records for bottom display list
  const filteredRecords = records.filter(r => {
    const term = searchTerm.toLowerCase();
    return (
      String(r.staffId).includes(term) ||
      r.name?.toLowerCase().includes(term) ||
      r.payer_id?.toLowerCase().includes(term)
    );
  });

  // Filter staff list for autocomplete dropdown (only show staff that matches search input)
  const autocompleteList = records.filter(r => {
    if (!staffSearchText) return false;
    const term = staffSearchText.toLowerCase();
    return (
      String(r.staffId).includes(term) ||
      r.name?.toLowerCase().includes(term)
    );
  });

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setStaffSearchText(`${staff.name} (ID: ${staff.staffId})`);
    setPayerIdVal(staff.payer_id || '');
    setShowDropdown(false);
  };

  const handleClearForm = () => {
    setSelectedStaff(null);
    setStaffSearchText('');
    setPayerIdVal('');
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member first.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        staffId: selectedStaff.staffId,
        payer_id: payerIdVal.trim() || null
      };

      const res = await axios.post(`${API_BASE}/payroll/payer-id`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Payer ID updated successfully.');
        handleClearForm();
        fetchData(true); // Silent refetch
      } else {
        showToast(res.data.message || 'Failed to update Payer ID.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error updating record.', 'error');
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
      const res = await axios.post(`${API_BASE}/payroll/payer-id/import`, formData, {
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
    const headers = ['staffId', 'payer_id'];
    const sampleRow = ['6', 'PAYER-123456'];

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), sampleRow.join(',')].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "payer_id_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <h1>Payer ID Setup</h1>
        <p>Set up and manage LIRS/State Payer IDs for Hospital Staff Members.</p>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon}`} style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)' }}>
            <FileText size={22} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Total Staff</div>
            <div className={styles.statValue}>{loading ? '...' : totalStaff}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon}`} style={{ background: '#d1fae5', color: '#059669' }}>
            <CheckCircle size={22} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Configured Payer IDs</div>
            <div className={styles.statValue}>{loading ? '...' : staffWithPayerId}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon}`} style={{ background: '#fee2e2', color: '#dc2626' }}>
            <AlertCircle size={22} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Missing Payer IDs</div>
            <div className={styles.statValue}>{loading ? '...' : staffWithoutPayerId}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'manual' ? styles.activeTabBtn : ''}`}
          onClick={() => { setActiveTab('manual'); handleClearForm(); }}
        >
          <UserPlus size={18} />
          Manual Entry
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'bulk' ? styles.activeTabBtn : ''}`}
          onClick={() => { setActiveTab('bulk'); handleClearForm(); }}
        >
          <Upload size={18} />
          Bulk Upload
        </button>
      </div>

      {/* Manual Tab Card */}
      {activeTab === 'manual' && (
        <div className={styles.formCard}>
          <h3 className={styles.cardTitle}>
            <PlusCircle size={20} className="text-primary" />
            Assign Payer ID
          </h3>
          <form onSubmit={handleManualSubmit}>
            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.dropdownContainer}`}>
                <label className={styles.formLabel}>Select Staff Member</label>
                <input 
                  type="text" 
                  className={styles.formInput}
                  placeholder="Type name or File number..."
                  value={staffSearchText}
                  onChange={(e) => {
                    setStaffSearchText(e.target.value);
                    setSelectedStaff(null);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  disabled={saving}
                />
                
                {showDropdown && staffSearchText && (
                  <div className={styles.dropdownResults}>
                    {autocompleteList.length > 0 ? (
                      autocompleteList.map(staff => (
                        <div 
                          key={staff.staffId} 
                          className={styles.dropdownItem}
                          onClick={() => handleSelectStaff(staff)}
                        >
                          {staff.name} (ID: {staff.staffId})
                        </div>
                      ))
                    ) : (
                      <div className={styles.dropdownNoResult}>No staff found</div>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Payer ID</label>
                <input 
                  type="text" 
                  className={styles.formInput}
                  placeholder="e.g. N-1234567"
                  value={payerIdVal}
                  onChange={(e) => setPayerIdVal(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button 
                type="button" 
                className={styles.btnSecondary}
                onClick={handleClearForm}
                disabled={saving}
              >
                Clear
              </button>
              <button 
                type="submit" 
                className={styles.btnPrimary}
                disabled={saving || !selectedStaff}
              >
                {saving && <Loader2 size={16} className={styles.spinner} />}
                {saving ? 'Saving...' : 'Save Payer ID'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Upload Tab Card */}
      {activeTab === 'bulk' && (
        <div className={styles.formCard}>
          <h3 className={styles.cardTitle}>
            <Upload size={20} className="text-primary" />
            Excel / CSV Import
          </h3>
          
          <div 
            className={`${styles.uploadZone} ${dragActive ? styles.uploadZoneActive : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              className={styles.fileInput}
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={uploading}
            />
            {uploading ? (
              <Loader2 size={40} className={styles.spinner} />
            ) : (
              <Upload size={40} />
            )}
            <div>
              <p className={styles.uploadZoneTitle}>
                {uploading ? 'Processing file...' : 'Drag and drop your spreadsheet here'}
              </p>
              <p className={styles.uploadZoneDesc}>
                Supports Excel (.xlsx, .xls) and CSV files up to 5MB
              </p>
            </div>
            
            <button 
              type="button" 
              className={styles.btnDownloadTemplate}
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadTemplate();
              }}
            >
              <Download size={14} />
              Download CSV Template
            </button>
          </div>

          {/* Warnings Panel */}
          {warnings.length > 0 && (
            <div className={styles.warningCard}>
              <h4>Import Completed with Warnings:</h4>
              <ul className={styles.warningList}>
                {warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Table Results */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>
            Staff Registry with Payer IDs
          </h3>
          <div className={styles.tableSearch}>
            <Search size={16} className={styles.tableSearchIcon} />
            <input 
              type="text" 
              className={styles.tableSearchInput}
              placeholder="Search by Name, Staff ID, Payer ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.tableWrapper}>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 size={36} className={styles.spinner} />
              <p>Loading registry data...</p>
            </div>
          ) : filteredRecords.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Full Name</th>
                  <th>Payer ID</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(row => (
                  <tr key={row.staffId}>
                    <td className={styles.tdPrimary}>{row.staffId}</td>
                    <td>{row.name}</td>
                    <td>
                      {row.payer_id ? (
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {row.payer_id}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          Not Configured
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className={styles.btnEdit}
                        title="Edit Payer ID"
                        onClick={() => {
                          setActiveTab('manual');
                          handleSelectStaff(row);
                        }}
                      >
                        <UserPlus size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyState}>
              <AlertCircle size={40} />
              <h3>No Records Found</h3>
              <p>No staff matches the search filter criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Toast Feedbacks */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.type === 'error' ? (
            <AlertCircle size={18} className={styles.toastErrorIcon} />
          ) : (
            <CheckCircle size={18} className={styles.toastSuccessIcon} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
