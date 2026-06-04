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
  const [offsetAmount, setOffsetAmount] = useState('');
  const [notes,        setNotes]        = useState('');

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
    fetchBalances(staff.staffId);
    fetchHistory(staff.staffId);
  };

  // ── Clear All shortcut
  const handleClearAll = () => {
    if (!balances) return;
    const savingsBal = balances.savings?.saving_balance ?? 0;
    const loanBal    = balances.loan?.balance_remaining ?? 0;
    const max = Math.min(savingsBal, loanBal);
    setOffsetAmount(max > 0 ? String(max.toFixed(2)) : '');
  };

  // ── Derived preview values
  const parsedAmount   = parseFloat(offsetAmount) || 0;
  const savingsBal     = balances?.savings?.saving_balance ?? 0;
  const loanBal        = balances?.loan?.balance_remaining ?? 0;
  const savingsAfter   = Math.max(0, savingsBal - parsedAmount);
  const loanAfter      = Math.max(0, loanBal    - parsedAmount);
  const canSubmit      = parsedAmount > 0
    && parsedAmount <= savingsBal
    && parsedAmount <= loanBal
    && balances?.savings
    && balances?.loan;

  // ── Submit offset
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE}/payroll/coop-savings-loan-offset`,
        {
          staffId:          selectedStaff.staffId,
          savings_setup_id: balances.savings.id,
          loan_setup_id:    balances.loan.id,
          offset_amount:    parsedAmount,
          notes:            notes.trim() || null,
        },
        { headers: buildHeaders() }
      );
      if (res.data.status === 'success') {
        showToast(res.data.message, 'success');
        setShowConfirm(false);
        setOffsetAmount('');
        setNotes('');
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

  const hasBalances = balances && balances.savings && balances.loan;
  const missingBalances = balances && (!balances.savings || !balances.loan);

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
                      <span className={styles.fileNoBadge}>{s.fileNo}</span>
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

      {/* ── Missing balances warning ── */}
      {!balancesLoading && missingBalances && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={styles.card}
          style={{ borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.07)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171' }}>
            <AlertCircle size={20} />
            <div>
              <strong>Cannot process offset:</strong>{' '}
              {!balances.savings
                ? 'This staff member has no active coop savings setup.'
                : 'This staff member has no active coop loan setup.'}
            </div>
          </div>
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
              <div className={`${styles.balanceCard} ${styles.balanceCardSavings}`}>
                <div className={styles.balanceCardHeader}>
                  <div className={`${styles.balanceIcon} ${styles.balanceIconGreen}`}>
                    <Wallet size={18} color="#10b981" />
                  </div>
                  <span className={styles.balanceLabel}>Coop Savings Balance</span>
                </div>
                <div className={styles.balanceAmountSection}>
                  <span className={`${styles.balanceCurrency} ${styles.balanceCurrencyGreen}`}>₦</span>
                  <span className={`${styles.balanceAmount} ${styles.balanceAmountSavings}`}>
                    {parseFloat(balances.savings.saving_balance).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={styles.balanceDivider} />
                <div className={styles.balanceSubRow}>
                  <div className={styles.balanceSubItem}>
                    <span className={styles.balanceSubItemLabel}>Monthly Saving</span>
                    <span className={styles.balanceSubItemValue}>₦{parseFloat(balances.savings.monthly_saving).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className={styles.balanceSubItem} style={{ textAlign: 'right' }}>
                    <span className={styles.balanceSubItemLabel}>Status</span>
                    <span className={styles.balanceSubItemValue} style={{ color: '#10b981' }}>● Active</span>
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
            <div className={styles.card}>
              <p className={styles.cardTitle}>Process Offset</p>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="cso-amount">
                  Offset Amount (max: {fmtN(Math.min(savingsBal, loanBal))})
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
                {parsedAmount > 0 && parsedAmount > savingsBal && (
                  <p style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                    ⚠ Amount exceeds available savings balance.
                  </p>
                )}
                {parsedAmount > 0 && parsedAmount > loanBal && parsedAmount <= savingsBal && (
                  <p style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                    ⚠ Amount exceeds outstanding loan balance.
                  </p>
                )}
              </div>

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
              {parsedAmount > 0 && parsedAmount <= savingsBal && parsedAmount <= loanBal && (
                <motion.div
                  className={styles.previewBanner}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className={styles.previewItem}>
                    <span className={styles.previewItemLabel}>Savings Balance</span>
                    <span className={styles.previewItemValue}>{fmtN(savingsBal)}</span>
                  </div>
                  <div className={styles.arrow}><ArrowRight size={14} /></div>
                  <div className={styles.previewItem}>
                    <span className={styles.previewItemLabel}>After Offset</span>
                    <span className={`${styles.previewItemValue} ${styles.previewItemValueGreen}`}>{fmtN(savingsAfter)}</span>
                  </div>

                  <div style={{ flex: 1 }} />

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
                    <th>Offset Amount</th>
                    <th>Savings Before</th>
                    <th>Savings After</th>
                    <th>Loan Before</th>
                    <th>Loan After</th>
                    <th>Processed By</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => (
                    <tr key={row.id}>
                      <td>{fmtDate(row.created_at)}</td>
                      <td><span className={styles.amountChip}>{fmtN(row.offset_amount)}</span></td>
                      <td>{fmtN(row.savings_balance_before)}</td>
                      <td style={{ color: '#34d399' }}>{fmtN(row.savings_balance_after)}</td>
                      <td>{fmtN(row.loan_balance_before)}</td>
                      <td style={{ color: parseFloat(row.loan_balance_after) <= 0 ? '#34d399' : '#f87171' }}>
                        {parseFloat(row.loan_balance_after) <= 0 ? '✓ Cleared' : fmtN(row.loan_balance_after)}
                      </td>
                      <td>{row.processed_by_name?.trim() || '—'}</td>
                      <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.notes || '—'}</td>
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
                <span className={styles.modalSummaryValue}>{selectedStaff?.name?.trim()} ({selectedStaff?.fileNo})</span>
              </div>
              <div className={styles.modalSummaryRow}>
                <span>Savings Balance</span>
                <span className={styles.modalSummaryValue}>{fmtN(savingsBal)} → {fmtN(savingsAfter)}</span>
              </div>
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
