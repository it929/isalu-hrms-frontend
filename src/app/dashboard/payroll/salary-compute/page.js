"use client";

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Settings,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Info,
  ChevronRight,
  Calculator,
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

const MONTHS = [
  { id: 'JANUARY',   name: 'January'   },
  { id: 'FEBRUARY',  name: 'February'  },
  { id: 'MARCH',     name: 'March'     },
  { id: 'APRIL',     name: 'April'     },
  { id: 'MAY',       name: 'May'       },
  { id: 'JUNE',      name: 'June'      },
  { id: 'JULY',      name: 'July'      },
  { id: 'AUGUST',    name: 'August'    },
  { id: 'SEPTEMBER', name: 'September' },
  { id: 'OCTOBER',   name: 'October'   },
  { id: 'NOVEMBER',  name: 'November'  },
  { id: 'DECEMBER',  name: 'December'  },
];

export default function SalaryComputePage() {
  const router = useRouter();
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingActive, setFetchingActive] = useState(true);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    async function loadActivePeriod() {
      const cacheKey = 'hrms_active_payroll_period_cache';
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          setMonth(data.month);
          setYear(data.year);
          setFetchingActive(false);
          return;
        }
      }
      try {
        const res = await axios.get(`${API_BASE}/payroll/lock-active-month`, {
          headers: buildHeaders(),
        });
        if (res.data.status === 'success' && res.data.activePeriod) {
          setMonth(res.data.activePeriod.month);
          setYear(String(res.data.activePeriod.year));
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(cacheKey, JSON.stringify({
              month: res.data.activePeriod.month,
              year: String(res.data.activePeriod.year),
            }));
          }
        } else {
          showToast('No active payroll period found.', 'error');
        }
      } catch (err) {
        showToast('Failed to load active payroll period.', 'error');
      } finally {
        setFetchingActive(false);
      }
    }
    loadActivePeriod();
  }, [showToast]);

  const handleCompute = async (e) => {
    e.preventDefault();
    if (!month) {
      showToast('Please select a Month.', 'error');
      return;
    }
    if (!year) {
      showToast('Please select a Year.', 'error');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await axios.post(
        `${API_BASE}/payroll/compute`,
        { month, year },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        setResult({
          message: res.data.message || 'Salary payroll run computed successfully!',
          payrollRunId: res.data.payroll_run_id,
          monthName: MONTHS.find(m => m.id === month)?.name || month,
          year: year,
        });
        showToast('Salary computation completed successfully!', 'success');

        // Clear any old payroll reports cache so the user gets fresh data when they visit reports
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('hrms_payroll_last_search_cache');
        }
      } else {
        showToast(res.data.message || 'Computation failed.', 'error');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Server error. Please try again.';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = () => {
    if (typeof window !== 'undefined') {
      // Set the cache preloaded so the payroll report automatically fetches this month
      sessionStorage.setItem('hrms_payroll_last_search_cache', JSON.stringify({
        filters: { month, year, divisionID: '', bankID: '' },
        results: null // setting results to null triggers standard fetch on mount
      }));
    }
    router.push('/dashboard/payroll');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={styles.container}
    >
      {/* ── Header ── */}
      <div className={styles.header}>
        <h1>Salary Compute</h1>
        <p>Calculate and generate the monthly consolidated staff salaries, allowances, and deductions.</p>
      </div>

      {/* ── Main Form Card ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Calculator size={20} className="text-primary" />
          <h2 className={styles.cardTitle}>Run Salary Computation</h2>
        </div>

        <form onSubmit={handleCompute}>
          <div className={styles.grid}>
            {/* Month Readonly */}
            <div className={styles.formGroup}>
              <label htmlFor="compute-month" className={styles.label}>Month</label>
              <input
                type="text"
                id="compute-month"
                className={styles.inputReadOnly}
                value={fetchingActive ? 'Loading...' : month || '—'}
                readOnly
              />
            </div>

            {/* Year Readonly */}
            <div className={styles.formGroup}>
              <label htmlFor="compute-year" className={styles.label}>Year</label>
              <input
                type="text"
                id="compute-year"
                className={styles.inputReadOnly}
                value={fetchingActive ? 'Loading...' : year || '—'}
                readOnly
              />
            </div>
          </div>

          {/* Process Warning / Explanation */}
          <div className={styles.infoBox}>
            <Info size={20} className={styles.infoIcon} />
            <div className={styles.infoText}>
              <strong>Important Notice:</strong> Running this action will recalculate basic salaries, prorate based on leave of absences (from 30 days), compute income tax, pension contributions, and deduct loan repayments or coop savings. Existing records for the selected month/year will be <strong>overwritten</strong>.
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button
              id="compute-submit-btn"
              type="submit"
              className={styles.btnCompute}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className={styles.spinner} />
                  <span>Computing Salaries...</span>
                </>
              ) : (
                <>
                  <Settings size={18} />
                  <span>Run Computation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Success result presentation ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={styles.resultCard}
          >
            <CheckCircle2 size={24} className={styles.resultIcon} />
            <div style={{ flex: 1 }}>
              <h3 className={styles.resultTitle}>Computation Complete</h3>
              <p className={styles.resultDesc}>
                {result.message}
              </p>
              <ul className={styles.resultMetaList}>
                <li><strong>Target Month/Year:</strong> {result.monthName} {result.year}</li>
                <li><strong>Payroll Run ID:</strong> #{result.payrollRunId}</li>
                <li><strong>Status:</strong> Processed & Locked</li>
              </ul>
              <div style={{ marginTop: '1rem' }}>
                <button
                  onClick={handleViewReport}
                  className={styles.btnCompute}
                  style={{
                    width: 'auto',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.85rem',
                    background: 'var(--primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>View Payroll Report</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast Notifications ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${
              toast.type === 'success' ? styles.toastSuccess : styles.toastError
            }`}
            initial={{ opacity: 0, y: 48, scale: 0.9 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.9 }}
          >
            {toast.type === 'success'
              ? <CheckCircle2 size={18} className={styles.toastSuccessIcon} />
              : <AlertCircle  size={18} className={styles.toastErrorIcon} />
            }
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
