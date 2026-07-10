"use client";

import { useState, useEffect, useCallback } from 'react';
import { getCache, setCache } from '../../../../utils/dataCache';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Lock,
  Unlock,
  Calendar,
  Building2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
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

export default function LockUnlockActiveMonthPage() {
  const cachedData = getCache('payroll_lock_active_month');
  const [activePeriod, setActivePeriod] = useState(cachedData?.activePeriod || null);
  const [totalComputed, setTotalComputed] = useState(cachedData?.totalComputed || 0);
  const [maxVstage, setMaxVstage] = useState(cachedData?.maxVstage || 0);
  const [lockStatus, setLockStatus] = useState(cachedData?.lockStatus || 'Not Computed');
  const [fetching, setFetching] = useState(!cachedData);

  // Form Selections matching blade
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  // Modal States
  const [showConfirm, setShowConfirm] = useState(false);
  const [modalAction, setModalAction] = useState(''); // 'lock' or 'unlock'
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/payroll/lock-active-month`, {
        headers: buildHeaders(),
      });
      if (res.data.status === 'success') {
        const { activePeriod: ap, total_computed: tc, max_vstage: mv, lock_status: ls } = res.data;
        setActivePeriod(ap);
        setTotalComputed(tc || 0);
        setMaxVstage(mv || 0);
        setLockStatus(ls || 'Not Computed');
        
        if (ap) {
          setSelectedYear((prev) => prev || String(ap.year));
          setSelectedMonth((prev) => prev || ap.month);
        }

        setCache('payroll_lock_active_month', {
          activePeriod: ap,
          totalComputed: tc || 0,
          maxVstage: mv || 0,
          lockStatus: ls || 'Not Computed'
        });
      } else {
        showToast(res.data.message || 'Failed to load lock states.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error communicating with server.', 'error');
    } finally {
      setFetching(false);
    }
  }, [showToast]);

  const handleRefresh = useCallback(() => {
    setFetching(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!cachedData) {
      fetchData();
    }
  }, [fetchData, cachedData]);

  const handleActionClick = (action) => {
    setModalAction(action);
    setShowConfirm(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedYear || !selectedMonth) return;

    setSubmitting(true);
    const urlSuffix = modalAction === 'lock' ? 'lock' : modalAction === 'unlock' ? 'unlock' : 'forward-to-audit';
    try {
      const res = await axios.post(
        `${API_BASE}/payroll/lock-active-month/${urlSuffix}`,
        {
          year: parseInt(selectedYear),
          month: selectedMonth
        },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast(res.data.message || `Period successfully ${urlSuffix}ed!`, 'success');
        setShowConfirm(false);
        setModalAction('');
        // Refresh silently
        fetchData();
      } else {
        showToast(res.data.message || `Failed to ${modalAction} period.`, 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const yearsList = [];
  for (let y = 2025; y < 2060; y++) {
    yearsList.push(y);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={styles.container}
    >
      {/* Header */}
      <div className={styles.header}>
        <h1>Lock/Unlock Active Month</h1>
        <p>Control payroll editing permissions globally by locking or unlocking the active payroll period.</p>
      </div>

      {/* Lock Active Month Panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeading}>
          <h3 className={styles.panelTitle}>Lock Active Month</h3>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.formInline}>
            <div className={styles.formGroup}>
              <label htmlFor="year">Year:</label>
              <select
                name="year"
                id="year"
                className={styles.formControl}
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="">Select Year</option>
                {yearsList.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="month">Month:</label>
              <select
                name="month"
                id="month"
                className={styles.formControl}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="">Select Month</option>
                <option value="JANUARY">January</option>
                <option value="FEBRUARY">February</option>
                <option value="MARCH">March</option>
                <option value="APRIL">April</option>
                <option value="MAY">May</option>
                <option value="JUNE">June</option>
                <option value="JULY">July</option>
                <option value="AUGUST">August</option>
                <option value="SEPTEMBER">September</option>
                <option value="OCTOBER">October</option>
                <option value="NOVEMBER">November</option>
                <option value="DECEMBER">December</option>
              </select>
            </div>

            <div className={styles.formBtns}>
              <button
                type="button"
                className={styles.btnLock}
                onClick={() => handleActionClick('lock')}
                disabled={fetching || !selectedYear || !selectedMonth}
              >
                <Lock size={15} /> Lock
              </button>
              <button
                type="button"
                className={styles.btnUnlock}
                onClick={() => handleActionClick('unlock')}
                disabled={fetching || !selectedYear || !selectedMonth}
              >
                <Unlock size={15} /> Unlock
              </button>
              {fetching && <Loader2 size={16} className={`${styles.spinner} ${styles.inlineLoader}`} />}
            </div>
          </div>
        </div>
      </div>

      {/* Current Active Month Panel */}
      <div className={styles.panelSuccess}>
        <div className={styles.panelHeading}>
          <h3 className={styles.panelTitle}>Current Active Month And Year</h3>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Month</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activePeriod ? (
                  <tr>
                    <td>{activePeriod.year}</td>
                    <td>{activePeriod.month}</td>
                    <td>
                      <span className={styles.statusCell}>
                        {maxVstage === 2 ? (
                          <>
                            <Lock size={15} color="#3b82f6" style={{ display: 'inline' }} />
                            <span style={{ marginLeft: '6px', color: '#3b82f6', fontWeight: 'bold' }}>Forwarded to Audit</span>
                          </>
                        ) : maxVstage === 3 ? (
                          <>
                            <Lock size={15} color="#10b981" style={{ display: 'inline' }} />
                            <span style={{ marginLeft: '6px', color: '#10b981', fontWeight: 'bold' }}>Audit Approved</span>
                          </>
                        ) : maxVstage === 4 ? (
                          <>
                            <CheckCircle2 size={15} color="#10b981" style={{ display: 'inline' }} />
                            <span style={{ marginLeft: '6px', color: '#10b981', fontWeight: 'bold' }}>Paid</span>
                          </>
                        ) : lockStatus === 'Locked' ? (
                          <>
                            <Lock size={15} color="#ef4444" style={{ display: 'inline' }} />
                            <span style={{ marginLeft: '6px', color: '#ef4444', fontWeight: 'bold' }}>Locked</span>
                          </>
                        ) : lockStatus === 'Open' ? (
                          <>
                            <Unlock size={15} color="#449d44" style={{ display: 'inline' }} />
                            <span style={{ marginLeft: '6px', color: '#449d44', fontWeight: 'bold' }}>Open</span>
                          </>
                        ) : lockStatus === 'Partially Locked' ? (
                          <>
                            <Unlock size={15} color="#fbbf24" style={{ display: 'inline' }} />
                            <span style={{ marginLeft: '6px', color: '#fbbf24', fontWeight: 'bold' }}>Partially Locked</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={15} color="#9ca3af" style={{ display: 'inline' }} />
                            <span style={{ marginLeft: '6px', color: '#9ca3af', fontWeight: 'bold' }}>Not Computed</span>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No active period configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && activePeriod && (
          <div className={styles.modalBackdrop}>
            <motion.div
              className={styles.modal}
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            >
              <h3 className={styles.modalTitle}>
                {modalAction === 'lock' ? <Lock size={18} color="#ef4444" /> : <Unlock size={18} color="#10b981" />}
                Confirm {modalAction === 'lock' ? 'Lock' : 'Unlock'} Period
              </h3>
              <p className={styles.modalSubtitle}>
                {modalAction === 'lock'
                  ? 'Locking this active period will freeze payroll modifications globally until unlocked by an administrator.'
                  : 'Unlocking this active period will allow administrators and supervisors to modify salary variables and run computations.'}
              </p>

              <div className={styles.modalSummaryBox}>
                <div className={styles.modalSummaryRow}>
                  <span>Period</span>
                  <span className={styles.modalSummaryValue}>{activePeriod.month} {activePeriod.year}</span>
                </div>
                <div className={styles.modalSummaryRow}>
                  <span>Computed Records</span>
                  <span className={styles.modalSummaryValue}>{totalComputed} staff</span>
                </div>
                <div className={styles.modalSummaryRow}>
                  <span>Verification Stage</span>
                  <span className={styles.modalSummaryValue}>Stage {maxVstage}</span>
                </div>
              </div>

              <div className={styles.modalBtns}>
                <button
                  type="button"
                  className={styles.btnCancel}
                  onClick={() => setShowConfirm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                {modalAction === 'lock' ? (
                  <button
                    type="button"
                    className={styles.btnConfirmLock}
                    onClick={handleConfirmAction}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 size={15} className={styles.spinner} /> : <Lock size={15} />}
                    {submitting ? 'Locking...' : 'Lock Period'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.btnConfirmUnlock}
                    onClick={handleConfirmAction}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 size={15} className={styles.spinner} /> : <Unlock size={15} />}
                    {submitting ? 'Unlocking...' : 'Unlock Period'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${
              toast.type === 'success' ? styles.toastSuccess : styles.toastError
            }`}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
