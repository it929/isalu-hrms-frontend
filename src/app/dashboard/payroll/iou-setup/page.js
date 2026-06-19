"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Search, Settings, ShieldAlert, BadgeInfo, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';
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

const formatCurrency = (value) => {
  if (value === undefined || value === null) return '₦0.00';
  const valNum = typeof value === 'string' ? parseFloat(value) : value;
  return '₦' + valNum.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function IouLimitSetup() {
  // Data states
  const [staffList, setStaffList] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [balances, setBalances] = useState(null);
  
  // Input search
  const [searchQuery, setSearchQuery] = useState('');
  
  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Fields for configuration
  const [canTakeIou, setCanTakeIou] = useState(1);
  const [maxIouAmount, setMaxIouAmount] = useState('0.00');

  // Notifications
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch initial staff configuration list
  const fetchStaffList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/ious/limit-config`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        const list = res.data.data || [];
        setStaffList(list);
        setFilteredStaff(list);
      } else {
        showToast(res.data.message || 'Failed to fetch staff config list.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading staff setup data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStaffList();
  }, [fetchStaffList]);

  // Filter staff list based on query
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = staffList.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.fileNo.toLowerCase().includes(query) ||
      s.id.toString().includes(query)
    );
    setFilteredStaff(filtered);
  }, [searchQuery, staffList]);

  // Handle employee selection
  const handleSelectStaff = async (staff) => {
    setSelectedStaff(staff);
    setCanTakeIou(staff.can_take_iou);
    setMaxIouAmount(staff.max_iou_amount.toFixed(2));
    setLoadingBalances(true);
    setBalances(null);

    try {
      const res = await axios.get(`${API_BASE}/payroll/ious/limit-config/${staff.id}`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setBalances(res.data.data);
      } else {
        showToast('Failed to retrieve outstanding loans.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading outstanding loan details.', 'error');
    } finally {
      setLoadingBalances(false);
    }
  };

  // Handle save configurations
  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;

    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE}/payroll/ious/limit-config`, {
        staff_id: selectedStaff.id,
        can_take_iou: canTakeIou,
        max_iou_amount: parseFloat(maxIouAmount) || 0
      }, { headers: buildHeaders() });

      if (res.data.status === 'success') {
        showToast('IOU configuration saved successfully!', 'success');
        
        // Refresh local list state
        setStaffList(prev => prev.map(s => {
          if (s.id === selectedStaff.id) {
            return {
              ...s,
              can_take_iou: canTakeIou,
              max_iou_amount: parseFloat(maxIouAmount) || 0
            };
          }
          return s;
        }));
      } else {
        showToast(res.data.message || 'Failed to save configuration.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error saving changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.container}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h1>Staff IOU Eligibility & Limits</h1>
        <p>Set employee eligibility rules and custom max IOU request limits.</p>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Loader2 size={36} className={styles.spinner} />
          <p>Loading staff eligibility data...</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Left panel: Search and list */}
          <div className={styles.card} style={{ height: 'max-content' }}>
            <h2 className={styles.cardTitle}>
              <Search size={18} color="var(--primary)" />
              Select Staff Member
            </h2>

            <div className={styles.formGroup} style={{ marginBottom: '1.5rem' }}>
              <input
                type="text"
                className={styles.input}
                placeholder="Search by name or staff ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Scrollable list */}
            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
              {filteredStaff.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No matching employees found
                </div>
              ) : (
                filteredStaff.map(s => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectStaff(s)}
                    style={{
                      padding: '0.85rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: selectedStaff?.id === s.id ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                    className="sidebar-hover-effect"
                  >
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Staff ID: {s.id}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {s.can_take_iou === 0 ? (
                        <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '99px', fontWeight: '700' }}>Blocked</span>
                      ) : s.max_iou_amount > 0 ? (
                        <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#3730a3', padding: '0.2rem 0.5rem', borderRadius: '99px', fontWeight: '700' }}>{formatCurrency(s.max_iou_amount)}</span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', background: '#d1fae5', color: '#065f46', padding: '0.2rem 0.5rem', borderRadius: '99px', fontWeight: '700' }}>50% Limit</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right panel: configuration & details */}
          <div>
            {selectedStaff ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Configuration form */}
                <form onSubmit={handleSave} className={styles.card}>
                  <h3 className={styles.cardTitle}>
                    <Settings size={18} color="var(--primary)" />
                    IOU Rules Setup
                  </h3>

                  {/* Toggle eligibility */}
                  <div className={styles.toggleContainer}>
                    <div className={styles.toggleLabelGroup}>
                      <span className={styles.toggleTitle}>Eligible for IOU</span>
                      <span className={styles.toggleDesc}>Enable or block IOU requests completely</span>
                    </div>
                    <div
                      className={`${styles.toggleSwitch} ${canTakeIou === 1 ? styles.toggleSwitchActive : ''}`}
                      onClick={() => setCanTakeIou(prev => prev === 1 ? 0 : 1)}
                    >
                      <div className={`${styles.toggleHandle} ${canTakeIou === 1 ? styles.toggleHandleActive : ''}`} />
                    </div>
                  </div>

                  {/* Custom Limit */}
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="max-iou-limit">Custom Max IOU Limit (₦)</label>
                    <input
                      type="number"
                      step="0.01"
                      id="max-iou-limit"
                      className={styles.input}
                      value={maxIouAmount}
                      disabled={canTakeIou === 0}
                      onChange={(e) => setMaxIouAmount(e.target.value)}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <BadgeInfo size={14} />
                      Set to 0.00 to fall back to the default 50% gross salary limit.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={saving}
                    style={{ marginTop: '0.5rem' }}
                  >
                    {saving ? (
                      <>
                        <Loader2 size={16} className={styles.spinner} />
                        Saving configurations...
                      </>
                    ) : (
                      'Save IOU Settings'
                    )}
                  </button>
                </form>

                {/* Outstanding balances & info */}
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>
                    <ShieldAlert size={18} color="var(--primary)" />
                    Staff Accounts Summary
                  </h3>

                  {loadingBalances ? (
                    <div className={styles.loading} style={{ padding: '2rem 0' }}>
                      <RefreshCw size={24} className={styles.spinner} />
                      <p style={{ fontSize: '0.8rem' }}>Loading balances...</p>
                    </div>
                  ) : balances ? (
                    <div className={styles.detailGrid}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Staff Member:</span>
                        <span className={styles.detailVal}>{balances.name}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Staff ID:</span>
                        <span className={styles.detailVal}>{balances.id}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Gross Monthly Salary:</span>
                        <span className={`${styles.detailVal} ${styles.highlightVal}`}>
                          {formatCurrency(balances.gross_salary)}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Outstanding Cooperative Loan:</span>
                        <span className={`${styles.detailVal} ${balances.remaining_coop_loan > 0 ? styles.warningVal : ''}`}>
                          {formatCurrency(balances.remaining_coop_loan)}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Outstanding Medical Loan:</span>
                        <span className={`${styles.detailVal} ${balances.remaining_medical_loan > 0 ? styles.warningVal : ''}`}>
                          {formatCurrency(balances.remaining_medical_loan)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Unable to load outstanding balances
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.card} style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
                <Settings size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <h3>No Employee Selected</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Select a staff member from the left panel to configure IOU rules and view outstanding balances.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
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
