"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Landmark, Search, Loader2, RefreshCw, Download, Filter, 
  X, CreditCard, AlertTriangle, CheckCircle2, Edit3, Save, User, Printer
} from 'lucide-react';
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

const isMissingValue = (val) => {
  if (val === null || val === undefined) return true;
  const str = String(val).trim();
  if (
    str === '' ||
    str === '—' ||
    str === '–' ||
    str === '-' ||
    str === '--' ||
    str === '0' ||
    str === 'null' ||
    str === 'undefined' ||
    str.toLowerCase() === 'n/a' ||
    str.toLowerCase() === 'none' ||
    /^0+$/.test(str)
  ) {
    return true;
  }
  return false;
};

const hasAccountNumber = (s) => {
  if (!s) return false;
  return !isMissingValue(s.account_number);
};

const hasPayerId = (s) => {
  if (!s) return false;
  return !isMissingValue(s.payer_id);
};

export default function BankDetailsReport() {
  const [mounted, setMounted] = useState(false);
  const [staff, setStaff] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // Filter States
  const [accountFilter, setAccountFilter] = useState('all'); // 'all', 'missing', 'configured'
  const [payerFilter, setPayerFilter] = useState('all'); // 'all', 'missing', 'configured'

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('10');

  // Edit Modal State
  const [editModal, setEditModal] = useState({
    isOpen: false,
    staffId: null,
    name: '',
    department: '',
    bankId: '',
    accountNumber: '',
    payerId: '',
    submitting: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, metaRes] = await Promise.allSettled([
        axios.get(`${API_BASE}/payroll/bank-updates/list`, { headers: buildHeaders() }),
        axios.get(`${API_BASE}/payroll/bank-updates/metadata`, { headers: buildHeaders() })
      ]);

      if (listRes.status === 'fulfilled' && listRes.value.data.status === 'success') {
        setStaff(listRes.value.data.staff || []);
      } else {
        showToast('Failed to load bank details.', 'error');
      }

      if (metaRes.status === 'fulfilled' && metaRes.value.data.status === 'success') {
        setBanks(metaRes.value.data.banks || []);
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading data from server.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page on search, filter, or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, itemsPerPage, accountFilter, payerFilter]);

  // Statistics
  const totalStaff = staff.length;
  const configuredAccountCount = staff.filter(hasAccountNumber).length;
  const missingAccountCount = totalStaff - configuredAccountCount;
  const configuredPayerCount = staff.filter(hasPayerId).length;
  const missingPayerCount = totalStaff - configuredPayerCount;

  // Filter list
  const filteredList = staff.filter(s => {
    // Account Number filter
    if (accountFilter === 'missing' && hasAccountNumber(s)) return false;
    if (accountFilter === 'configured' && !hasAccountNumber(s)) return false;

    // Payer ID filter
    if (payerFilter === 'missing' && hasPayerId(s)) return false;
    if (payerFilter === 'configured' && !hasPayerId(s)) return false;

    // Search query
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.id && String(s.id).toLowerCase().includes(q)) ||
      (s.department && s.department.toLowerCase().includes(q)) ||
      (s.bank_name && s.bank_name.toLowerCase().includes(q)) ||
      (s.account_number && String(s.account_number).toLowerCase().includes(q)) ||
      (s.payer_id && String(s.payer_id).toLowerCase().includes(q))
    );
  });

  const isFiltered = accountFilter !== 'all' || payerFilter !== 'all' || search.trim() !== '';

  const handleResetFilters = () => {
    setAccountFilter('all');
    setPayerFilter('all');
    setSearch('');
  };

  const handleOpenEdit = (s) => {
    setEditModal({
      isOpen: true,
      staffId: s.id,
      name: s.name,
      department: s.department,
      bankId: s.bank_id ? String(s.bank_id) : '',
      accountNumber: hasAccountNumber(s) ? s.account_number : '',
      payerId: hasPayerId(s) ? s.payer_id : '',
      submitting: false,
    });
  };

  const handleCloseEdit = () => {
    if (editModal.submitting) return;
    setEditModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditModal(prev => ({ ...prev, submitting: true }));

    try {
      const payload = {
        staff_id: editModal.staffId,
        bank_id: editModal.bankId ? parseInt(editModal.bankId, 10) : null,
        account_number: editModal.accountNumber.trim(),
        payer_id: editModal.payerId.trim(),
      };

      const res = await axios.post(`${API_BASE}/payroll/bank-updates/individual`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        const selectedBank = banks.find(b => String(b.id) === String(editModal.bankId));
        const updatedBankName = selectedBank ? selectedBank.name : (editModal.bankId ? 'Configured' : '—');

        setStaff(prev => prev.map(item => {
          if (item.id === editModal.staffId) {
            return {
              ...item,
              bank_id: editModal.bankId ? parseInt(editModal.bankId, 10) : null,
              bank_name: editModal.bankId ? updatedBankName : '—',
              account_number: editModal.accountNumber.trim() || '—',
              payer_id: editModal.payerId.trim() || '—',
            };
          }
          return item;
        }));

        showToast(res.data.message || 'Details updated successfully.');
        setEditModal(prev => ({ ...prev, isOpen: false, submitting: false }));
      } else {
        showToast(res.data.message || 'Failed to update details.', 'error');
        setEditModal(prev => ({ ...prev, submitting: false }));
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Error updating staff details.';
      showToast(errMsg, 'error');
      setEditModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const totalPages = itemsPerPage === 'all'
    ? 1
    : Math.ceil(filteredList.length / parseInt(itemsPerPage, 10)) || 1;

  const displayedList = itemsPerPage === 'all'
    ? filteredList
    : filteredList.slice(
        (currentPage - 1) * parseInt(itemsPerPage, 10),
        currentPage * parseInt(itemsPerPage, 10)
      );

  const handleExportCSV = () => {
    if (filteredList.length === 0) return;
    
    const headers = ['Staff ID', 'Name', 'Department', 'Bank Name', 'Account Number', 'Payer ID'];
    const rows = filteredList.map(s => [
      s.id,
      s.name,
      s.department,
      s.bank_name,
      hasAccountNumber(s) ? s.account_number : 'Missing',
      hasPayerId(s) ? s.payer_id : 'Missing'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `staff_bank_details_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (filteredList.length === 0) {
      showToast('No records available to print.', 'error');
      return;
    }
    window.print();
  };

  const getFilterLabel = () => {
    const parts = [];
    if (accountFilter === 'missing') parts.push('No Account Number');
    if (accountFilter === 'configured') parts.push('Configured Account');
    if (payerFilter === 'missing') parts.push('No Payer ID');
    if (payerFilter === 'configured') parts.push('Configured Payer ID');
    if (search.trim()) parts.push(`Search: "${search.trim()}"`);
    return parts.length > 0 ? parts.join(' | ') : 'All Staff Records';
  };

  return (
    <>
      {/* Dynamic Page Print CSS Overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        .printableArea {
          display: none;
        }

        @media print {
          @page {
            size: portrait;
            margin: 8mm 6mm 10mm 6mm;
          }

          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide all screen interactive UI */
          .screen-content,
          aside,
          nav,
          header,
          footer,
          button,
          .no-print {
            display: none !important;
            visibility: hidden !important;
          }

          /* Display printable report container explicitly matching globals.css visible class */
          .printableArea {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            z-index: 99999 !important;
          }

          .printableArea * {
            visibility: visible !important;
          }
        }
      `}} />

      {/* Printable Report View (Visible only during window.print()) */}
      <div className="printableArea">
        <div style={{ paddingBottom: '8px', borderBottom: '2px solid #0f172a', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '13pt', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.3px', lineHeight: 1.2 }}>
                Staff Account Details & Payer ID Report
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '7.5pt', color: '#475569' }}>
                Payroll Bank Credentials and State Tax Identification Directory
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '7.5pt', color: '#475569', flexShrink: 0, lineHeight: 1.3 }}>
              <div suppressHydrationWarning>
                <strong>Generated:</strong> {mounted ? `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
              </div>
              <div><strong>Scope:</strong> {getFilterLabel()}</div>
            </div>
          </div>

          {/* Print Metrics Summary Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px 12px', marginTop: '8px', padding: '5px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '3px', fontSize: '7.5pt' }}>
            <div>Total Staff: <strong>{totalStaff}</strong></div>
            <div>In Report: <strong>{filteredList.length}</strong></div>
            <div>Has Account: <strong>{configuredAccountCount}</strong></div>
            <div>No Account: <strong style={{ color: '#dc2626' }}>{missingAccountCount}</strong></div>
            <div>No Payer ID: <strong style={{ color: '#d97706' }}>{missingPayerCount}</strong></div>
          </div>
        </div>

        {/* Print Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt', textAlign: 'left', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderTop: '1px solid #000', borderBottom: '1.5px solid #000' }}>
              <th style={{ padding: '4px 5px', width: '4%', textAlign: 'center' }}>S/N</th>
              <th style={{ padding: '4px 5px', width: '9%' }}>Staff ID</th>
              <th style={{ padding: '4px 5px', width: '25%' }}>Full Name</th>
              <th style={{ padding: '4px 5px', width: '19%' }}>Department</th>
              <th style={{ padding: '4px 5px', width: '19%' }}>Bank Name</th>
              <th style={{ padding: '4px 5px', width: '12%' }}>Account No</th>
              <th style={{ padding: '4px 5px', width: '12%' }}>Payer ID</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((s, idx) => {
              const isAccSet = hasAccountNumber(s);
              const isPayerSet = hasPayerId(s);
              return (
                <tr key={s.id} style={{ borderBottom: '0.5px solid #e2e8f0', pageBreakInside: 'avoid', lineHeight: 1.25 }}>
                  <td style={{ padding: '3.5px 5px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                  <td style={{ padding: '3.5px 5px', fontWeight: 'bold' }}>#{s.id}</td>
                  <td style={{ padding: '3.5px 5px', fontWeight: '600', wordBreak: 'break-word' }}>{s.name}</td>
                  <td style={{ padding: '3.5px 5px', color: '#334155', wordBreak: 'break-word' }}>{s.department}</td>
                  <td style={{ padding: '3.5px 5px', color: '#334155', wordBreak: 'break-word' }}>{s.bank_name}</td>
                  <td style={{ padding: '3.5px 5px', fontFamily: 'monospace', fontSize: '7pt', fontWeight: isAccSet ? '600' : 'normal', color: isAccSet ? '#0f172a' : '#dc2626' }}>
                    {isAccSet ? s.account_number : 'MISSING'}
                  </td>
                  <td style={{ padding: '3.5px 5px', fontFamily: 'monospace', fontSize: '7pt', fontWeight: isPayerSet ? '600' : 'normal', color: isPayerSet ? '#0f172a' : '#d97706' }}>
                    {isPayerSet ? s.payer_id : 'MISSING'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Print Signatures Footer */}
        <div style={{ marginTop: '22px', pageBreakInside: 'avoid' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', textAlign: 'center', fontSize: '7.5pt' }}>
            <div>
              <div style={{ borderBottom: '1px solid #475569', marginBottom: '4px', height: '24px' }}></div>
              <strong>Prepared By (Payroll)</strong>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #475569', marginBottom: '4px', height: '24px' }}></div>
              <strong>Checked By (Internal Audit)</strong>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #475569', marginBottom: '4px', height: '24px' }}></div>
              <strong>Approved By (Finance / HR)</strong>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '7pt', color: '#94a3b8' }}>
            System Generated Report • Confidential • HRMS
          </div>
        </div>
      </div>

      {/* Screen Interactive Container (Hidden when printing via CSS) */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="screen-content" style={{ paddingBottom: '3rem' }}>
        
        {/* Toast Notification */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            background: toast.type === 'success' ? '#10b981' : '#ef4444',
            color: '#ffffff',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: '500'
          }}>
            {toast.message}
          </div>
        )}

        {/* Edit Modal */}
        <AnimatePresence>
          {editModal.isOpen && (
            <div style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem'
            }}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: 'var(--background, #ffffff)',
                  color: 'var(--foreground, #1e293b)',
                  borderRadius: '1rem',
                  border: '1px solid var(--border, #e2e8f0)',
                  width: '100%',
                  maxWidth: '520px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  overflow: 'hidden'
                }}
              >
                {/* Modal Header */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid var(--border, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--card-header, rgba(248, 250, 252, 0.5))'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary, #3b82f6)' }}>
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700' }}>Update Account & Payer ID</h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--secondary, #64748b)' }}>Manage bank credentials and tax identification</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseEdit}
                    disabled={editModal.submitting}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--secondary, #64748b)',
                      cursor: 'pointer',
                      padding: '0.4rem',
                      borderRadius: '0.375rem'
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSaveEdit}>
                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    {/* Staff Info Banner */}
                    <div style={{
                      padding: '0.9rem 1rem',
                      borderRadius: '0.6rem',
                      background: 'rgba(59, 130, 246, 0.05)',
                      border: '1px solid rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.8rem'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--primary, #3b82f6)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        <User size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{editModal.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary, #64748b)', display: 'flex', gap: '0.75rem' }}>
                          <span>ID: <strong>#{editModal.staffId}</strong></span>
                          <span>•</span>
                          <span>Dept: <strong>{editModal.department}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Bank Select */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
                        Bank Name
                      </label>
                      <select
                        value={editModal.bankId}
                        onChange={e => setEditModal(prev => ({ ...prev, bankId: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border, #cbd5e1)',
                          background: 'var(--background, #fff)',
                          color: 'var(--foreground, #1e293b)',
                          fontSize: '0.9rem',
                          outline: 'none'
                        }}
                      >
                        <option value="">-- Select Bank --</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Account Number Input */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
                        Account Number
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="e.g. 0123456789"
                          value={editModal.accountNumber}
                          onChange={e => setEditModal(prev => ({ ...prev, accountNumber: e.target.value }))}
                          maxLength={30}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border, #cbd5e1)',
                            background: 'var(--background, #fff)',
                            color: 'var(--foreground, #1e293b)',
                            fontSize: '0.9rem',
                            fontFamily: 'monospace',
                            letterSpacing: '0.5px',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--secondary, #64748b)', marginTop: '0.25rem', display: 'block' }}>
                        Standard NUBAN account number (typically 10 digits)
                      </span>
                    </div>

                    {/* Payer ID Input */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
                        Payer ID (State / Tax Identifier)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. N-123456 or LASG-12345"
                        value={editModal.payerId}
                        onChange={e => setEditModal(prev => ({ ...prev, payerId: e.target.value }))}
                        maxLength={50}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border, #cbd5e1)',
                          background: 'var(--background, #fff)',
                          color: 'var(--foreground, #1e293b)',
                          fontSize: '0.9rem',
                          fontFamily: 'monospace',
                          outline: 'none'
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--secondary, #64748b)', marginTop: '0.25rem', display: 'block' }}>
                        Official Payer ID used for state payroll tax compliance
                      </span>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--border, #e2e8f0)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    background: 'var(--card-footer, rgba(248, 250, 252, 0.5))'
                  }}>
                    <button
                      type="button"
                      onClick={handleCloseEdit}
                      disabled={editModal.submitting}
                      style={{
                        padding: '0.6rem 1.2rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border, #cbd5e1)',
                        background: 'transparent',
                        color: 'var(--foreground, #1e293b)',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: editModal.submitting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editModal.submitting}
                      className="premium-btn"
                      style={{
                        padding: '0.6rem 1.3rem',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        cursor: editModal.submitting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {editModal.submitting ? (
                        <>
                          <Loader2 size={16} className="spinner" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save size={16} /> Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Landmark size={28} /> Staff Account Details
            </h1>
            <p style={{ color: 'var(--secondary)' }}>Comprehensive listing, auditing, and updating of staff bank details, department mappings, and Payer IDs.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handlePrint}
              disabled={loading || filteredList.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.2rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                borderRadius: '0.5rem',
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--background, #fff)',
                color: 'var(--foreground, #1e293b)',
                cursor: loading || filteredList.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
            >
              <Printer size={16} /> Print Report ({filteredList.length})
            </button>
            <button
              onClick={handleExportCSV}
              disabled={loading || filteredList.length === 0}
              className="premium-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
            >
              <Download size={16} /> Export CSV ({filteredList.length})
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {/* Total Staff */}
          <div 
            onClick={() => { setAccountFilter('all'); setPayerFilter('all'); }}
            className="premium-card" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1.25rem',
              cursor: 'pointer',
              border: accountFilter === 'all' && payerFilter === 'all' ? '2px solid var(--primary, #3b82f6)' : '1px solid var(--border, #e2e8f0)',
              transition: 'all 0.2s ease'
            }}
            title="Click to show all staff"
          >
            <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary, #3b82f6)' }}>
              <Landmark size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{totalStaff}</h4>
              <p style={{ margin: 0, color: 'var(--secondary)', fontSize: '0.85rem' }}>Total Staff</p>
            </div>
          </div>

          {/* Configured Accounts */}
          <div 
            onClick={() => { setAccountFilter(accountFilter === 'configured' ? 'all' : 'configured'); }}
            className="premium-card" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1.25rem',
              cursor: 'pointer',
              border: accountFilter === 'configured' ? '2px solid #10b981' : '1px solid var(--border, #e2e8f0)',
              transition: 'all 0.2s ease'
            }}
            title="Click to filter configured accounts"
          >
            <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{configuredAccountCount}</h4>
              <p style={{ margin: 0, color: 'var(--secondary)', fontSize: '0.85rem' }}>Has Account Number</p>
            </div>
          </div>

          {/* Missing Account Number */}
          <div 
            onClick={() => { setAccountFilter(accountFilter === 'missing' ? 'all' : 'missing'); }}
            className="premium-card" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1.25rem',
              cursor: 'pointer',
              border: accountFilter === 'missing' ? '2px solid #ef4444' : '1px solid var(--border, #e2e8f0)',
              background: accountFilter === 'missing' ? 'rgba(239, 68, 68, 0.04)' : undefined,
              transition: 'all 0.2s ease'
            }}
            title="Click to filter staff without account number"
          >
            <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              <CreditCard size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: missingAccountCount > 0 ? '#ef4444' : 'inherit' }}>
                  {missingAccountCount}
                </h4>
                {missingAccountCount > 0 && (
                  <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: '600' }}>
                    Missing
                  </span>
                )}
              </div>
              <p style={{ margin: 0, color: 'var(--secondary)', fontSize: '0.85rem' }}>No Account Number</p>
            </div>
          </div>

          {/* Missing Payer ID */}
          <div 
            onClick={() => { setPayerFilter(payerFilter === 'missing' ? 'all' : 'missing'); }}
            className="premium-card" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1.25rem',
              cursor: 'pointer',
              border: payerFilter === 'missing' ? '2px solid #f59e0b' : '1px solid var(--border, #e2e8f0)',
              background: payerFilter === 'missing' ? 'rgba(245, 158, 11, 0.04)' : undefined,
              transition: 'all 0.2s ease'
            }}
            title="Click to filter staff without Payer ID"
          >
            <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: missingPayerCount > 0 ? '#f59e0b' : 'inherit' }}>
                  {missingPayerCount}
                </h4>
                {missingPayerCount > 0 && (
                  <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontWeight: '600' }}>
                    Missing
                  </span>
                )}
              </div>
              <p style={{ margin: 0, color: 'var(--secondary)', fontSize: '0.85rem' }}>No Payer ID</p>
            </div>
          </div>
        </div>

        {/* Main Table Card */}
        <div className="premium-card">
          {/* Controls Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 'bold' }}>Account Information Directory</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
                Showing {filteredList.length} of {totalStaff} staff records
                {isFiltered && <span style={{ color: 'var(--primary)', fontWeight: '600' }}> (Filtered)</span>}
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Account Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: '500' }}>Account:</span>
                <select
                  value={accountFilter}
                  onChange={e => setAccountFilter(e.target.value)}
                  style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: accountFilter !== 'all' ? '1.5px solid #ef4444' : '1px solid var(--border, #e2e8f0)',
                    background: accountFilter !== 'all' ? 'rgba(239, 68, 68, 0.05)' : 'var(--background, #fff)',
                    color: 'var(--foreground, #1e293b)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none',
                    fontWeight: '500'
                  }}
                >
                  <option value="all">All Accounts</option>
                  <option value="missing">⚠️ No Account Number</option>
                  <option value="configured">✓ Has Account Number</option>
                </select>
              </div>

              {/* Payer ID Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: '500' }}>Payer ID:</span>
                <select
                  value={payerFilter}
                  onChange={e => setPayerFilter(e.target.value)}
                  style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: payerFilter !== 'all' ? '1.5px solid #f59e0b' : '1px solid var(--border, #e2e8f0)',
                    background: payerFilter !== 'all' ? 'rgba(245, 158, 11, 0.05)' : 'var(--background, #fff)',
                    color: 'var(--foreground, #1e293b)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none',
                    fontWeight: '500'
                  }}
                >
                  <option value="all">All Payer IDs</option>
                  <option value="missing">⚠️ No Payer ID</option>
                  <option value="configured">✓ Has Payer ID</option>
                </select>
              </div>

              {/* Show Records */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: '500' }}>Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={e => {
                    setItemsPerPage(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border, #e2e8f0)',
                    background: 'var(--background, #fff)',
                    color: 'var(--foreground, #1e293b)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none',
                    fontWeight: '500'
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="30">30</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="all">All</option>
                </select>
              </div>

              {/* Reset Filters button */}
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  title="Reset all filters"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '0.5rem',
                    padding: '0.55rem 0.75rem',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                  }}
                >
                  <X size={14} /> Clear
                </button>
              )}

              {/* Refresh */}
              <button
                onClick={fetchData}
                title="Refresh Data"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: '0.5rem',
                  padding: '0.6rem',
                  color: 'var(--text-main, #334155)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              </button>

              {/* Search Input */}
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--secondary)' }} />
                <input
                  type="text"
                  placeholder="Search staff, ID, dept..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    padding: '0.6rem 0.6rem 0.6rem 2.2rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border, #e2e8f0)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: '0.9rem',
                    width: '210px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.75rem 1rem', width: '50px' }}>S/N</th>
                  <th style={{ padding: '0.75rem 1rem', width: '90px' }}>Staff ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Department</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Bank Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Account Number</th>
                  <th style={{ padding: '0.75rem 1rem', width: '140px' }}>Payer ID</th>
                  <th style={{ padding: '0.75rem 1rem', width: '90px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <Loader2 size={32} className="spinner" style={{ color: 'var(--primary)' }} />
                        <span style={{ color: 'var(--secondary)' }}>Loading bank details list...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayedList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--secondary)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <Filter size={32} style={{ opacity: 0.5 }} />
                        <span>No matching records found for the selected filter criteria.</span>
                        {isFiltered && (
                          <button
                            onClick={handleResetFilters}
                            style={{
                              marginTop: '0.5rem',
                              background: 'transparent',
                              border: '1px solid var(--primary)',
                              color: 'var(--primary)',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '0.375rem',
                              fontSize: '0.85rem',
                              cursor: 'pointer'
                            }}
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedList.map((s, index) => {
                    const itemIndex = itemsPerPage === 'all' ? index + 1 : (currentPage - 1) * parseInt(itemsPerPage, 10) + index + 1;
                    const isAccountSet = hasAccountNumber(s);
                    const isPayerSet = hasPayerId(s);

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '1rem', color: 'var(--secondary)' }}>{itemIndex}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>#{s.id}</td>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{s.name}</td>
                        <td style={{ padding: '1rem' }}>{s.department}</td>
                        <td style={{ padding: '1rem' }}>{s.bank_name}</td>
                        <td style={{ padding: '1rem' }}>
                          {isAccountSet ? (
                            <span style={{ fontFamily: 'monospace', letterSpacing: '0.5px', fontWeight: '600' }}>
                              {s.account_number}
                            </span>
                          ) : (
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              fontSize: '0.8rem',
                              fontWeight: '600'
                            }}>
                              Missing Acc No
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {isPayerSet ? (
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(99, 102, 241, 0.1)',
                              color: 'var(--primary, #3b82f6)',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              fontFamily: 'monospace'
                            }}>
                              {s.payer_id}
                            </span>
                          ) : (
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.1)',
                              color: '#d97706',
                              fontSize: '0.8rem',
                              fontWeight: '600'
                            }}>
                              Missing Payer ID
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            style={{
                              background: 'rgba(59, 130, 246, 0.08)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              color: 'var(--primary, #3b82f6)',
                              padding: '0.4rem 0.75rem',
                              borderRadius: '0.4rem',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              transition: 'all 0.15s ease'
                            }}
                            title={`Edit ${s.name}'s account and Payer ID`}
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredList.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              paddingTop: '1.25rem',
              marginTop: '1rem',
              borderTop: '1px solid var(--border, #e2e8f0)'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--secondary, #64748b)' }}>
                Showing {filteredList.length === 0 ? 0 : (itemsPerPage === 'all' ? 1 : (currentPage - 1) * parseInt(itemsPerPage, 10) + 1)} to {itemsPerPage === 'all' ? filteredList.length : Math.min(currentPage * parseInt(itemsPerPage, 10), filteredList.length)} of {filteredList.length} entries {itemsPerPage !== 'all' && totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
              </span>

              {itemsPerPage !== 'all' && totalPages > 1 && (
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border, #e2e8f0)',
                      background: currentPage === 1 ? 'var(--background-muted, #f1f5f9)' : 'var(--background, #fff)',
                      color: currentPage === 1 ? 'var(--text-muted, #94a3b8)' : 'var(--foreground, #1e293b)',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    First
                  </button>
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border, #e2e8f0)',
                      background: currentPage === 1 ? 'var(--background-muted, #f1f5f9)' : 'var(--background, #fff)',
                      color: currentPage === 1 ? 'var(--text-muted, #94a3b8)' : 'var(--foreground, #1e293b)',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Prev
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    const isActive = currentPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          minWidth: '30px',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.75rem',
                          borderRadius: '0.375rem',
                          border: '1px solid ' + (isActive ? 'var(--primary, #3b82f6)' : 'var(--border, #e2e8f0)'),
                          background: isActive ? 'var(--primary, #3b82f6)' : 'var(--background, #fff)',
                          color: isActive ? '#fff' : 'var(--foreground, #1e293b)',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border, #e2e8f0)',
                      background: currentPage === totalPages ? 'var(--background-muted, #f1f5f9)' : 'var(--background, #fff)',
                      color: currentPage === totalPages ? 'var(--text-muted, #94a3b8)' : 'var(--foreground, #1e293b)',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border, #e2e8f0)',
                      background: currentPage === totalPages ? 'var(--background-muted, #f1f5f9)' : 'var(--background, #fff)',
                      color: currentPage === totalPages ? 'var(--text-muted, #94a3b8)' : 'var(--foreground, #1e293b)',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Last
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </motion.div>
    </>
  );
}
