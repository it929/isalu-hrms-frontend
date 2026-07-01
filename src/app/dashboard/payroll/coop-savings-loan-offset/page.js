"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Wallet,
  CreditCard,
  RefreshCw,
  History,
  ShieldCheck,
  Coins,
  X,
  Upload,
  Paperclip,
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

function fmtN(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleString('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return str; }
}

export default function CoopSavingsLoanOffsetPage() {
  // ── Staff search
  const [searchText,   setSearchText]   = useState('');
  const [staffList,    setStaffList]    = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading,setSearchLoading]= useState(false);
  const searchRef = useRef(null);

  // ── Selected staff + balances
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [balances,       setBalances]      = useState(null);
  const [balancesLoading,setBalancesLoading] = useState(false);

  // ── Offset form
  const [offsetType,   setOffsetType]   = useState('savings'); // 'savings' or 'bank'
  const [offsetAmount, setOffsetAmount] = useState('');
  const [notes,        setNotes]        = useState('');
  const [proofFile,    setProofFile]    = useState(null);
  const fileInputRef = useRef(null);
  const [loanJustCleared, setLoanJustCleared] = useState(false);

  // ── Modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  // ── History
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal,   setHistoryTotal]   = useState(0);

  // ── Toast
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Search staff
  useEffect(() => {
    if (searchText.trim().length < 1) {
      setStaffList([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/payroll/coop-savings-loan-offset/staff-list`, {
          headers: buildHeaders(),
          params: { search: searchText.trim() },
        });
        if (res.data.status === 'success') {
          setStaffList(res.data.data || []);
          setShowDropdown(true);
        }
      } catch {
        /* silent */
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  // ── Load initial staff list (no search filter)
  const loadAllStaff = useCallback(async () => {
    setSearchLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-savings-loan-offset/staff-list`, {
        headers: buildHeaders(),
        params: { search: '' },
      });
      if (res.data.status === 'success') {
        setStaffList(res.data.data || []);
        setShowDropdown(true);
      }
    } catch { /* silent */ }
    finally { setSearchLoading(false); }
  }, []);

  // ── Fetch staff balances
  const fetchBalances = useCallback(async (staffId) => {
    setBalancesLoading(true);
    setBalances(null);
    setOffsetAmount('');
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-savings-loan-offset/staff-balances`, {
        headers: buildHeaders(),
        params: { staffId },
      });
      if (res.data.status === 'success') {
        setBalances(res.data);
      } else {
        showToast(res.data.message || 'Failed to load balances.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error loading balances.', 'error');
    } finally {
      setBalancesLoading(false);
    }
  }, [showToast]);

  // ── Fetch history
  const fetchHistory = useCallback(async (staffId) => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-savings-loan-offset/history`, {
        headers: buildHeaders(),
        params: { staffId, perPage: 10, page: 1 },
      });
      if (res.data.status === 'success') {
        setHistory(res.data.data || []);
        setHistoryTotal(res.data.total || 0);
      }
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, []);

  // ── Select staff from dropdown
  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setSearchText(staff.name.trim());
    setShowDropdown(false);
    setOffsetAmount('');
    setNotes('');
    setOffsetType('savings');
    setProofFile(null);
    setLoanJustCleared(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fetchBalances(staff.staffId);
    fetchHistory(staff.staffId);
  };

  // Auto set offset type to bank if staff has no active savings setup
  useEffect(() => {
    if (balances && !balances.savings) {
      setOffsetType('bank');
    }
  }, [balances]);

  // ── Clear All shortcut
  const handleClearAll = () => {
    if (!balances) return;
    const savingsBal = balances.savings?.saving_balance ?? 0;
    const loanBal    = balances.loan?.balance_remaining ?? 0;
    const max = offsetType === 'savings' ? Math.min(savingsBal, loanBal) : loanBal;
    setOffsetAmount(max > 0 ? String(max.toFixed(2)) : '');
  };

  // ── Derived preview values
  const parsedAmount   = parseFloat(offsetAmount) || 0;
  const savingsBal     = balances?.savings?.saving_balance ?? 0;
  const loanBal        = balances?.loan?.balance_remaining ?? 0;
  const savingsAfter   = Math.max(0, savingsBal - (offsetType === 'savings' ? parsedAmount : 0));
  const loanAfter      = Math.max(0, loanBal    - parsedAmount);
  const canSubmit      = parsedAmount > 0
    && (offsetType === 'savings'
        ? (parsedAmount <= savingsBal && balances?.savings)
        : (offsetType === 'bank' && proofFile)
       )
    && parsedAmount <= loanBal
    && balances?.loan;

  // ── Submit offset
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('staffId', selectedStaff.staffId);
      formData.append('offset_type', offsetType);
      formData.append('loan_setup_id', balances.loan.id);
      formData.append('offset_amount', parsedAmount);
      if (balances.savings) {
        formData.append('savings_setup_id', balances.savings.id);
      }
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }
      if (offsetType === 'bank' && proofFile) {
        formData.append('proof_of_payment', proofFile);
      }

      const res = await axios.post(
        `${API_BASE}/payroll/coop-savings-loan-offset`,
        formData,
        {
          headers: {
            ...buildHeaders(),
            'Content-Type': 'multipart/form-data',
          }
        }
      );
      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        setShowConfirm(false);
        setOffsetAmount('');
        setNotes('');
        setProofFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (res.data.loan_cleared) {
          setLoanJustCleared(true);
        } else {
          setLoanJustCleared(false);
        }
        // Refresh
        await fetchBalances(selectedStaff.staffId);
        await fetchHistory(selectedStaff.staffId);
      } else {
        showToast(res.data.message || 'Offset failed.', 'error');
        setShowConfirm(false);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error. Please try again.', 'error');
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const hasBalances = balances && balances.loan;
  const missingBalances = balances && !balances.loan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={styles.container}
    >
      {/* ── Header ── */}
      <div className={styles.header}>
        <h1>Coop Savings → Loan Offset</h1>
        <p>Use a staff member's cooperative savings balance to clear their cooperative loan balance.</p>
      </div>

      {/* ── Staff Search Card ── */}
      <div className={styles.card}>
        <p className={styles.cardTitle}>Select Staff Member</p>
        <div className={styles.staffSearchRow} ref={searchRef}>
          <div className={styles.searchInputWrap} style={{ position: 'relative' }}>
            <span className={styles.searchIcon}>
              {searchLoading ? <Loader2 size={16} className={styles.spinner} /> : <Search size={16} />}
            </span>
            <input
              id="cso-staff-search"
              type="text"
              className={styles.searchInput}
              placeholder="Search by name or file number…"
              value={searchText}
              onChange={e => { setSearchText(e.target.value); if (e.target.value === '') { setSelectedStaff(null); setBalances(null); setHistory([]); } }}
              onFocus={() => { if (searchText.trim() === '' && staffList.length === 0) loadAllStaff(); else if (staffList.length > 0) setShowDropdown(true); }}
              autoComplete="off"
            />

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  className={styles.staffDropdown}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{ position: 'absolute', top: '100%', left: 0, right: 0 }}
                >
                  {staffList.length === 0 ? (
                    <div className={styles.noResults}>No eligible staff found. Staff must have both an active savings and active loan setup with positive balances.</div>
                  ) : staffList.map(s => (
                    <div
                      key={s.staffId}
                      className={styles.staffOption}
                      onClick={() => handleSelectStaff(s)}
                    >
                      <div>
                        <div className={styles.staffOptionName}>{s.name.trim()}</div>
                        <div className={styles.staffOptionMeta}>{s.department || '—'}</div>
                      </div>
                      <span className={styles.fileNoBadge}>ID: {s.staffId}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Loading balances ── */}
      {balancesLoading && (
        <div className={styles.idleState}>
          <Loader2 size={36} className={styles.spinner} />
          <h3>Loading balances…</h3>
        </div>
      )}

      {/* ── Missing loan / Success cleared card ── */}
      {!balancesLoading && balances && !balances.loan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={styles.card}
          style={
            loanJustCleared
              ? { borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.07)' }
              : { borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.07)' }
          }
        >
          {loanJustCleared ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#34d399' }}>
              <CheckCircle2 size={20} />
              <div>
                <strong>Coop loan cleared:</strong> The staff member's cooperative loan has been fully paid and cleared!
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171' }}>
              <AlertCircle size={20} />
              <div>
                <strong>Cannot process offset:</strong> This staff member has no active coop loan setup.
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Balance Cards + Offset Form ── */}
      <AnimatePresence>
        {!balancesLoading && hasBalances && (
          <motion.div
            key="offset-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Balance Cards */}
            <div className={styles.balanceGrid}>

              {/* ── Coop Savings Card ── */}
              <div className={`${styles.balanceCard} ${styles.balanceCardSavings}`} style={{ opacity: balances.savings ? 1 : 0.55 }}>
                <div className={styles.balanceCardHeader}>
                  <div className={`${styles.balanceIcon} ${styles.balanceIconGreen}`}>
                    <Wallet size={18} color="#10b981" />
                  </div>
                  <span className={styles.balanceLabel}>Coop Savings Balance</span>
                </div>
                <div className={styles.balanceAmountSection}>
                  <span className={`${styles.balanceCurrency} ${styles.balanceCurrencyGreen}`}>₦</span>
                  <span className={`${styles.balanceAmount} ${styles.balanceAmountSavings}`}>
                    {balances.savings
                      ? parseFloat(balances.savings.saving_balance).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '0.00'
                    }
                  </span>
                </div>
                <div className={styles.balanceDivider} />
                <div className={styles.balanceSubRow}>
                  <div className={styles.balanceSubItem}>
                    <span className={styles.balanceSubItemLabel}>Monthly Saving</span>
                    <span className={styles.balanceSubItemValue}>
                      {balances.savings
                        ? `₦${parseFloat(balances.savings.monthly_saving).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
                        : '₦0.00'
                      }
                    </span>
                  </div>
                  <div className={styles.balanceSubItem} style={{ textAlign: 'right' }}>
                    <span className={styles.balanceSubItemLabel}>Status</span>
                    <span className={styles.balanceSubItemValue} style={{ color: balances.savings ? '#10b981' : '#ef4444' }}>
                      {balances.savings ? '● Active' : '● No Setup'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Coop Loan Card ── */}
              <div className={`${styles.balanceCard} ${styles.balanceCardLoan}`}>
                <div className={styles.balanceCardHeader}>
                  <div className={`${styles.balanceIcon} ${styles.balanceIconRed}`}>
                    <CreditCard size={18} color="#ef4444" />
                  </div>
                  <span className={styles.balanceLabel}>Loan Balance Remaining</span>
                </div>
                <div className={styles.balanceAmountSection}>
                  <span className={`${styles.balanceCurrency} ${styles.balanceCurrencyRed}`}>₦</span>
                  <span className={`${styles.balanceAmount} ${styles.balanceAmountLoan}`}>
                    {parseFloat(balances.loan.balance_remaining).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {/* Progress bar: how much of the original loan still remains */}
                {balances.loan.loan_amount > 0 && (
                  <div className={styles.loanProgressWrap}>
                    <div className={styles.loanProgressTrack}>
                      <div
                        className={styles.loanProgressFill}
                        style={{ width: `${Math.min(100, (balances.loan.balance_remaining / balances.loan.loan_amount) * 100).toFixed(1)}%` }}
                      />
                    </div>
                    <div className={styles.loanProgressLabel}>
                      {Math.min(100, (balances.loan.balance_remaining / balances.loan.loan_amount) * 100).toFixed(1)}% of ₦{parseFloat(balances.loan.loan_amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })} remaining
                    </div>
                  </div>
                )}
                <div className={styles.balanceDivider} />
                <div className={styles.balanceSubRow}>
                  <div className={styles.balanceSubItem}>
                    <span className={styles.balanceSubItemLabel}>Monthly Deduction</span>
                    <span className={styles.balanceSubItemValue}>₦{parseFloat(balances.loan.monthly_deduction).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className={styles.balanceSubItem} style={{ textAlign: 'right' }}>
                    <span className={styles.balanceSubItemLabel}>End Month</span>
                    <span className={styles.balanceSubItemValue}>{balances.loan.end_month}</span>
                  </div>
                </div>
              </div>

            </div>


            {/* Offset Form */}
            {/* Offset Form */}
            <div className={styles.card}>
              <p className={styles.cardTitle}>Process Offset</p>

              {/* Offset Method Selector */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Offset Method</label>
                <div className={styles.methodSelector}>
                  <button
                    type="button"
                    className={`${styles.methodBtn} ${offsetType === 'savings' ? styles.methodBtnActive : ''}`}
                    onClick={() => { setOffsetType('savings'); setProofFile(null); }}
                    disabled={!balances?.savings}
                    title={!balances?.savings ? 'No active savings setup available for this employee' : ''}
                  >
                    <Wallet size={16} />
                    Coop Savings Offset
                  </button>
                  <button
                    type="button"
                    className={`${styles.methodBtn} ${offsetType === 'bank' ? styles.methodBtnActive : ''}`}
                    onClick={() => setOffsetType('bank')}
                  >
                    <CreditCard size={16} />
                    Direct Bank Payment
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="cso-amount">
                  Offset Amount (max: {fmtN(offsetType === 'savings' ? Math.min(savingsBal, loanBal) : loanBal)})
                </label>
                <div className={styles.amountRow}>
                  <input
                    id="cso-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className={styles.amountInput}
                    placeholder="0.00"
                    value={offsetAmount}
                    onChange={e => setOffsetAmount(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.clearAllBtn}
                    onClick={handleClearAll}
                    title="Set offset to maximum possible amount"
                  >
                    Clear All
                  </button>
                </div>
                {offsetType === 'savings' && parsedAmount > 0 && parsedAmount > savingsBal && (
                  <p style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                    ⚠ Amount exceeds available savings balance.
                  </p>
                )}
                {parsedAmount > 0 && parsedAmount > loanBal && (offsetType === 'bank' || parsedAmount <= savingsBal) && (
                  <p style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                    ⚠ Amount exceeds outstanding loan balance.
                  </p>
                )}
              </div>

              {/* Attach document for bank offset */}
              {offsetType === 'bank' && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Attach Document (Payment Receipt) *</label>
                  <div className={styles.fileUploadContainer}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className={styles.fileInputHidden}
                      accept=".jpeg,.png,.jpg,.pdf"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            showToast('File size must be less than 2MB.', 'error');
                            setProofFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          } else {
                            setProofFile(file);
                          }
                        }
                      }}
                    />
                    {!proofFile ? (
                      <div
                        className={styles.fileUploadLabel}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={16} />
                        Choose Proof of Payment (Max 2MB)
                      </div>
                    ) : (
                      <div className={styles.fileSelectedName}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                          <Paperclip size={14} style={{ flexShrink: 0 }} />
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {proofFile.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={styles.fileRemoveBtn}
                          onClick={() => {
                            setProofFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="cso-notes">Notes (optional)</label>
                <textarea
                  id="cso-notes"
                  className={styles.textArea}
                  placeholder="Add a note about this offset transaction…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              {/* Live Preview */}
              {parsedAmount > 0 && (offsetType === 'bank' || parsedAmount <= savingsBal) && parsedAmount <= loanBal && (
                <motion.div
                  className={styles.previewBanner}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {offsetType === 'savings' && (
                    <>
                      <div className={styles.previewItem}>
                        <span className={styles.previewItemLabel}>Savings Balance</span>
                        <span className={styles.previewItemValue}>{fmtN(savingsBal)}</span>
                      </div>
                      <div className={styles.arrow}><ArrowRight size={14} /></div>
                      <div className={styles.previewItem}>
                        <span className={styles.previewItemLabel}>After Offset</span>
                        <span className={`${styles.previewItemValue} ${styles.previewItemValueGreen}`}>{fmtN(savingsAfter)}</span>
                      </div>

                      <div style={{ flex: 1, minWidth: '1rem' }} />
                    </>
                  )}

                  <div className={styles.previewItem}>
                    <span className={styles.previewItemLabel}>Loan Balance</span>
                    <span className={styles.previewItemValue}>{fmtN(loanBal)}</span>
                  </div>
                  <div className={styles.arrow}><ArrowRight size={14} /></div>
                  <div className={styles.previewItem}>
                    <span className={styles.previewItemLabel}>After Offset</span>
                    <span className={`${styles.previewItemValue} ${loanAfter <= 0 ? styles.previewItemValueGreen : styles.previewItemValueRed}`}>
                      {loanAfter <= 0 ? '✓ Cleared!' : fmtN(loanAfter)}
                    </span>
                  </div>
                </motion.div>
              )}

              <div className={styles.btnRow}>
                <button
                  id="cso-process-btn"
                  type="button"
                  className={styles.btnProcess}
                  disabled={!canSubmit}
                  onClick={() => setShowConfirm(true)}
                >
                  <ShieldCheck size={16} />
                  Process Offset
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Idle State ── */}
      {!balancesLoading && !balances && !selectedStaff && (
        <motion.div
          className={`${styles.card} ${styles.idleState}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Coins size={48} />
          <h3>Select a Staff Member</h3>
          <p>Search for a staff member above to view their coop savings and loan balances.</p>
        </motion.div>
      )}

      {/* ── Offset History ── */}
      {selectedStaff && (
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className={styles.historyHeader}>
            <h2 className={styles.historyTitle}>
              <History size={18} />
              Offset History
              {historyTotal > 0 && (
                <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  — {historyTotal} transaction{historyTotal !== 1 ? 's' : ''}
                </span>
              )}
            </h2>
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              onClick={() => fetchHistory(selectedStaff.staffId)}
              title="Refresh history"
            >
              <RefreshCw size={15} className={historyLoading ? styles.spinner : ''} />
            </button>
          </div>

          {historyLoading ? (
            <div className={styles.emptyHistory}>
              <Loader2 size={28} className={styles.spinner} />
              <p>Loading history…</p>
            </div>
          ) : history.length === 0 ? (
            <div className={styles.emptyHistory}>
              <History size={32} />
              <p>No offset transactions recorded for this staff member yet.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Staff ID</th>
                    <th>Staff Name</th>
                    <th>Method</th>
                    <th>Offset Amount</th>
                    <th>Savings Before</th>
                    <th>Savings After</th>
                    <th>Loan Before</th>
                    <th>Loan After</th>
                    <th>Processed By</th>
                    <th>Attachment / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => (
                    <tr key={row.id}>
                      <td>{fmtDate(row.created_at)}</td>
                      <td>
                        <span className={styles.fileNoBadge}>ID: {row.staffId}</span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{row.staff_name || '—'}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: row.offset_type === 'bank' ? '#3b82f6' : '#10b981' }}>
                          {row.offset_type === 'bank' ? 'Bank Payment' : 'Savings Offset'}
                        </span>
                      </td>
                      <td><span className={styles.amountChip}>{fmtN(row.offset_amount)}</span></td>
                      <td>{row.savings_balance_before !== null ? fmtN(row.savings_balance_before) : '—'}</td>
                      <td style={{ color: '#34d399' }}>{row.savings_balance_after !== null ? fmtN(row.savings_balance_after) : '—'}</td>
                      <td>{fmtN(row.loan_balance_before)}</td>
                      <td style={{ color: parseFloat(row.loan_balance_after) <= 0 ? '#34d399' : '#f87171' }}>
                        {parseFloat(row.loan_balance_after) <= 0 ? '✓ Cleared' : fmtN(row.loan_balance_after)}
                      </td>
                      <td>{row.processed_by_name?.trim() || '—'}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {row.proof_of_payment && (
                            <a
                              href={row.proof_of_payment}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.fileLink}
                              title="Click to view payment receipt document"
                            >
                              <Paperclip size={12} />
                              Proof of Payment
                            </a>
                          )}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {row.notes || '—'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Confirmation Modal ── */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            className={styles.modalBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.modal}
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <h3 className={styles.modalTitle}>Confirm Offset</h3>
              <p className={styles.modalSubtitle}>
                Please review the details below before processing. This action cannot be undone.
              </p>

              <div className={styles.modalAmountBox}>
                <div className={styles.modalAmountLabel}>Offset Amount</div>
                <div className={styles.modalAmountValue}>{fmtN(parsedAmount)}</div>
              </div>

              <div className={styles.modalSummaryRow}>
                <span>Staff</span>
                <span className={styles.modalSummaryValue}>{selectedStaff?.name?.trim()} (ID: {selectedStaff?.staffId})</span>
              </div>
              <div className={styles.modalSummaryRow}>
                <span>Offset Method</span>
                <span className={styles.modalSummaryValue}>{offsetType === 'savings' ? 'Coop Savings Offset' : 'Direct Bank Payment'}</span>
              </div>
              {offsetType === 'savings' && (
                <div className={styles.modalSummaryRow}>
                  <span>Savings Balance</span>
                  <span className={styles.modalSummaryValue}>{fmtN(savingsBal)} → {fmtN(savingsAfter)}</span>
                </div>
              )}
              {offsetType === 'bank' && proofFile && (
                <div className={styles.modalSummaryRow}>
                  <span>Attached Proof</span>
                  <span className={styles.modalSummaryValue} style={{ color: '#60a5fa' }}>{proofFile.name}</span>
                </div>
              )}
              <div className={styles.modalSummaryRow}>
                <span>Loan Balance</span>
                <span className={styles.modalSummaryValue}>
                  {fmtN(loanBal)} → {loanAfter <= 0 ? <span style={{ color: '#10b981' }}>✓ Cleared</span> : fmtN(loanAfter)}
                </span>
              </div>
              {notes.trim() && (
                <div className={styles.modalSummaryRow}>
                  <span>Notes</span>
                  <span className={styles.modalSummaryValue} style={{ maxWidth: '220px', textAlign: 'right' }}>{notes.trim()}</span>
                </div>
              )}

              <div className={styles.modalBtns}>
                <button
                  id="cso-cancel-btn"
                  type="button"
                  className={styles.btnCancel}
                  onClick={() => setShowConfirm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  id="cso-confirm-btn"
                  type="button"
                  className={styles.btnConfirm}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 size={16} className={styles.spinner} /> : <CheckCircle2 size={16} />}
                  {submitting ? 'Processing…' : 'Confirm Offset'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            {toast.type === 'success'
              ? <CheckCircle2 size={18} />
              : <AlertCircle  size={18} />
            }
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
