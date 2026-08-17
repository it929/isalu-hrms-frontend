"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Landmark, Search, Loader2, AlertCircle, RefreshCw, Download } from 'lucide-react';
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

export default function BankDetailsReport() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('10');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/bank-updates/list`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setStaff(res.data.staff || []);
      } else {
        showToast('Failed to load bank details.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading bank details from server.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page on search or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, itemsPerPage]);

  // Statistics
  const totalStaff = staff.length;
  const configuredCount = staff.filter(s => s.account_number && s.account_number !== '—').length;
  const pendingCount = totalStaff - configuredCount;

  // Filter list
  const filteredList = staff.filter(s => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      String(s.id).toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q) ||
      s.bank_name.toLowerCase().includes(q) ||
      s.account_number.toLowerCase().includes(q) ||
      (s.payer_id && s.payer_id.toLowerCase().includes(q))
    );
  });

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
      s.account_number,
      s.payer_id
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingBottom: '3rem' }}>
      
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

      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Landmark size={28} /> Staff Account Details
          </h1>
          <p style={{ color: 'var(--secondary)' }}>Comprehensive listing of staff bank details, department mappings, and Payer IDs.</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={loading || filteredList.length === 0}
          className="premium-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>
            <Landmark size={24} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{totalStaff}</h4>
            <p style={{ margin: 0, color: 'var(--secondary)', fontSize: '0.85rem' }}>Total Staff</p>
          </div>
        </div>

        <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <Landmark size={24} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{configuredCount}</h4>
            <p style={{ margin: 0, color: 'var(--secondary)', fontSize: '0.85rem' }}>Configured Accounts</p>
          </div>
        </div>

        <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <Landmark size={24} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{pendingCount}</h4>
            <p style={{ margin: 0, color: 'var(--secondary)', fontSize: '0.85rem' }}>Pending Bank Details</p>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="premium-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontWeight: 'bold' }}>Account Information Directory</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                <option value="10">10 records</option>
                <option value="20">20 records</option>
                <option value="30">30 records</option>
                <option value="50">50 records</option>
                <option value="100">100 records</option>
                <option value="all">All Records</option>
              </select>
            </div>

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

            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--secondary)' }} />
              <input
                type="text"
                placeholder="Search staff details..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '0.6rem 0.6rem 0.6rem 2.2rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border, #e2e8f0)',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  width: '240px'
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '0.75rem 1rem', width: '60px' }}>S/N</th>
                <th style={{ padding: '0.75rem 1rem', width: '100px' }}>Staff ID</th>
                <th style={{ padding: '0.75rem 1rem' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Department</th>
                <th style={{ padding: '0.75rem 1rem' }}>Bank Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Account Number</th>
                <th style={{ padding: '0.75rem 1rem', width: '140px' }}>Payer ID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Loader2 size={32} className="spinner" style={{ color: 'var(--primary)' }} />
                      <span style={{ color: 'var(--secondary)' }}>Loading bank details list...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--secondary)' }}>
                    No matching records found.
                  </td>
                </tr>
              ) : (
                displayedList.map((s, index) => {
                  const itemIndex = itemsPerPage === 'all' ? index + 1 : (currentPage - 1) * parseInt(itemsPerPage, 10) + index + 1;
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '1rem', color: 'var(--secondary)' }}>{itemIndex}</td>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{s.id}</td>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>{s.name}</td>
                      <td style={{ padding: '1rem' }}>{s.department}</td>
                      <td style={{ padding: '1rem' }}>{s.bank_name}</td>
                      <td style={{ padding: '1rem', fontFamily: 'monospace', letterSpacing: '0.5px' }}>{s.account_number}</td>
                      <td style={{ padding: '1rem', fontFamily: 'monospace' }}>
                        {s.payer_id && s.payer_id !== '—' ? (
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            color: 'var(--primary)',
                            fontSize: '0.8rem',
                            fontWeight: '600'
                          }}>
                            {s.payer_id}
                          </span>
                        ) : (
                          '—'
                        )}
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
  );
}
