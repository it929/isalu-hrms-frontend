"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, UserCheck, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import axios from 'axios';

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

export default function BankUpdates() {
  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,staffId,Account Number\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bank_details_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [banks, setBanks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Individual update state
  const [selectedStaff, setSelectedStaff] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedBankInd, setSelectedBankInd] = useState('');
  const [accountNumberInd, setAccountNumberInd] = useState('');
  const [submittingInd, setSubmittingInd] = useState(false);

  // Bulk update state
  const [selectedBankBulk, setSelectedBankBulk] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [bulkSummary, setBulkSummary] = useState(null);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const loadMetadata = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/bank-updates/metadata`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setBanks(res.data.banks || []);
        setStaff(res.data.staff || []);
      } else {
        showToast('Failed to load bank setup metadata.', 'error');
      }
    } catch (err) {
      showToast('Error fetching database metadata.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  // Filter staff based on search input
  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.fileNo.toLowerCase().includes(staffSearch.toLowerCase())
  );

  // Individual Form Submit
  const handleIndividualSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff || !selectedBankInd || !accountNumberInd) {
      showToast('Please fill out all fields for individual update.', 'error');
      return;
    }

    setSubmittingInd(true);
    try {
      const res = await axios.post(
        `${API_BASE}/payroll/bank-updates/individual`,
        {
          staff_id: selectedStaff,
          bank_id: selectedBankInd,
          account_number: accountNumberInd,
        },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Individual bank details updated successfully.', 'success');
        setSelectedStaff('');
        setStaffSearch('');
        setSelectedBankInd('');
        setAccountNumberInd('');
      } else {
        showToast(res.data.message || 'Failed to update details.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error occurred while saving details.', 'error');
    } finally {
      setSubmittingInd(false);
    }
  };

  // Bulk Form Submit
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBankBulk || !selectedFile) {
      showToast('Please select a bank and upload an Excel/CSV file.', 'error');
      return;
    }

    setSubmittingBulk(true);
    setBulkSummary(null);

    const formData = new FormData();
    formData.append('excel_file', selectedFile);
    formData.append('bank_id', selectedBankBulk);

    try {
      const res = await axios.post(
        `${API_BASE}/payroll/bank-updates/bulk`,
        formData,
        {
          headers: {
            ...buildHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Bulk update completed!', 'success');
        setBulkSummary(res.data.summary);
        setSelectedBankBulk('');
        setSelectedFile(null);
      } else {
        showToast(res.data.message || 'Bulk update failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error executing bulk update.', 'error');
    } finally {
      setSubmittingBulk(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Update Staff Bank Details</h1>
        <p style={{ color: 'var(--secondary)' }}>Update bank and account numbers individually or in bulk via Excel spreadsheet upload.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        
        {/* Individual Update Card */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserCheck size={20} color="var(--primary)" />
            Individual Update
          </h3>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 size={32} className="spinner" style={{ color: 'var(--primary)' }} />
            </div>
          ) : (
            <form onSubmit={handleIndividualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Search & Select Staff</label>
                <input 
                  type="text" 
                  placeholder="Type to search staff name/File No..." 
                  value={staffSearch}
                  onChange={(e) => {
                    setStaffSearch(e.target.value);
                    setSelectedStaff(''); // Clear selection on type
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    marginBottom: '0.5rem'
                  }}
                />
                
                {staffSearch && !selectedStaff && (
                  <div style={{
                    maxHeight: '150px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface)',
                    boxShadow: 'var(--shadow)'
                  }}>
                    {filteredStaff.length === 0 ? (
                      <div style={{ padding: '0.75rem', color: 'var(--secondary)', fontSize: '0.9rem' }}>No staff found</div>
                    ) : (
                      filteredStaff.map(s => (
                        <div 
                          key={s.id}
                          onClick={() => {
                            setSelectedStaff(s.id);
                            setStaffSearch(`${s.name} (${s.fileNo})`);
                          }}
                          style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.9rem'
                          }}
                          className="sidebar-hover-effect"
                        >
                          {s.name} <span style={{ color: 'var(--secondary)', fontSize: '0.8rem' }}>({s.fileNo})</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Select Bank</label>
                <select
                  value={selectedBankInd}
                  onChange={(e) => setSelectedBankInd(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)'
                  }}
                  required
                >
                  <option value="">-- Select Bank --</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Account Number</label>
                <input 
                  type="text" 
                  placeholder="Enter Account Number..." 
                  value={accountNumberInd}
                  onChange={(e) => setAccountNumberInd(e.target.value)}
                  maxLength={50}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)'
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                className="premium-btn"
                disabled={submittingInd || !selectedStaff || !selectedBankInd || !accountNumberInd}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginTop: '1rem'
                }}
              >
                {submittingInd ? (
                  <Loader2 size={16} className="spinner" />
                ) : (
                  <UserCheck size={16} />
                )}
                {submittingInd ? 'Updating...' : 'Update Individual'}
              </button>
            </form>
          )}
        </div>

        {/* Bulk Update Card */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet size={20} color="var(--primary)" />
            Bulk Excel Update
          </h3>

          <form onSubmit={handleBulkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', flex: 1 }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>1. Select Bank (for all imported staff)</label>
              <select
                value={selectedBankBulk}
                onChange={(e) => setSelectedBankBulk(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--foreground)'
                }}
                required
              >
                <option value="">-- Select Bank --</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>2. Upload Excel / CSV File</label>
              <div 
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '2rem',
                  textAlign: 'center',
                  background: 'var(--background)',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <input 
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                <Upload size={32} style={{ color: 'var(--primary)', marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                  {selectedFile ? selectedFile.name : 'Click to select spreadsheet'}
                </p>
                <span style={{ color: 'var(--secondary)', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>
                  Supports .xlsx, .xls, .csv (Columns: staffId, Account Number)
                </span>
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadTemplate();
                    }}
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      color: 'var(--primary)',
                      padding: '0.4rem 0.8rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      position: 'relative',
                      zIndex: 10
                    }}
                  >
                    <Download size={14} /> Download Template
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="premium-btn"
              disabled={submittingBulk || !selectedBankBulk || !selectedFile}
              style={{
                width: '100%',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: 'auto'
              }}
            >
              {submittingBulk ? (
                <Loader2 size={16} className="spinner" />
              ) : (
                <Upload size={16} />
              )}
              {submittingBulk ? 'Uploading & Processing...' : 'Process Bulk Import'}
            </button>
          </form>

          {/* Bulk Summary Report */}
          {bulkSummary && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                borderRadius: 'var(--radius)',
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid var(--border)'
              }}
            >
              <h4 style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--primary)' }}>Import Result Summary</h4>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                Successfully Updated: <strong>{bulkSummary.updated}</strong> records.
              </p>
              {bulkSummary.not_found.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <p style={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: '500' }}>
                    Staff IDs not found in database ({bulkSummary.not_found.length}):
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--secondary)', wordBreak: 'break-all', marginTop: '0.25rem' }}>
                    {bulkSummary.not_found.join(', ')}
                  </p>
                </div>
              )}
            </motion.div>
          )}

        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              padding: '1rem 1.5rem',
              borderRadius: '8px',
              background: toast.type === 'success' ? '#10b981' : '#ef4444',
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              zIndex: 9999
            }}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
