"use client";

import { useState, useEffect, useCallback } from 'react';
import { getCache, setCache } from '../../../../utils/dataCache';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Calendar,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  RefreshCw,
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

export default function SetActiveMonthPage() {
  const cachedData = getCache('payroll_active_month');
  const [courtInfo, setCourtInfo] = useState(cachedData?.courtInfo || null);
  const [courts, setCourts] = useState(cachedData?.courts || []);
  const [activeMonths, setActiveMonths] = useState(cachedData?.activeMonths || []);
  const [fetching, setFetching] = useState(!cachedData);

  // Form Fields
  const [selectedCourt, setSelectedCourt] = useState(
    cachedData?.courtInfo && cachedData.courtInfo.courtstatus !== 1
      ? cachedData.courtInfo.courtid
      : ''
  );
  const currentYearStr = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/payroll/active-month`, {
        headers: buildHeaders(),
      });
      if (res.data.status === 'success') {
        const { courtInfo: cInfo, courts: cList, activeMonths: amList } = res.data;
        setCourtInfo(cInfo);
        setCourts(cList || []);
        setActiveMonths(amList || []);
        setCache('payroll_active_month', { courtInfo: cInfo, courts: cList, activeMonths: amList });

        // Default court selection if courtstatus != 1
        if (cInfo && cInfo.courtstatus !== 1) {
          setSelectedCourt(cInfo.courtid);
        }
      } else {
        showToast(res.data.message || 'Failed to load active month parameters.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error communicating with backend.', 'error');
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

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedYear) {
      showToast('Please select a year.', 'error');
      return;
    }
    if (!selectedMonth) {
      showToast('Please select a month.', 'error');
      return;
    }
    if (!selectedCourt) {
      showToast('Please select a court.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE}/payroll/active-month`,
        {
          court: parseInt(selectedCourt),
          year: parseInt(selectedYear),
          month: selectedMonth,
        },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Active month updated successfully!', 'success');
        // Refresh active months list silently without loading screen flashing
        fetchData();
      } else {
        showToast(res.data.message || 'Failed to update active month.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Build Year and Month lists
  const years = [];
  for (let y = 2025; y <= 2040; y++) {
    years.push(y);
  }

  const months = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={styles.container}
    >
      {/* Header */}
      <div className={styles.header}>
        <h1>Set Active Month</h1>
        <p>Configure the active month and year for payroll processing calculations.</p>
      </div>

      {/* Active Month Update Form */}
      <div className={styles.card}>
        <p className={styles.cardTitle}>
          <Calendar size={18} /> Update Active Month Setup
          {fetching && <Loader2 size={14} className={`${styles.spinner} ${styles.inlineLoader}`} />}
        </p>
        <div>
          {fetching && !courtInfo ? (
            <div className={styles.skeletonFormGrid}>
              <div className={styles.skeletonGroup}>
                <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
                <div className={`${styles.skeleton} ${styles.skeletonInput}`} />
              </div>
              <div className={styles.skeletonGroup}>
                <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
                <div className={`${styles.skeleton} ${styles.skeletonInput}`} />
              </div>
              <div className={styles.skeletonGroup}>
                <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
                <div className={`${styles.skeleton} ${styles.skeletonInput}`} />
              </div>
              <div className={styles.skeletonGroup}>
                <div className={`${styles.skeleton} ${styles.skeletonButton}`} />
              </div>
            </div>
          ) : (
            <div className={styles.formGrid}>
              {/* Court Select (Rendered only if courtstatus === 1) */}
              {courtInfo && courtInfo.courtstatus === 1 && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="court-select">
                    Court
                  </label>
                  <select
                    id="court-select"
                    className={styles.selectInput}
                    value={selectedCourt}
                    onChange={(e) => setSelectedCourt(e.target.value)}
                    required
                  >
                    <option value="">Select Court</option>
                    {courts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.court_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Year Select */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="year-select">
                  Year
                </label>
                <select
                  id="year-select"
                  className={styles.selectInput}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  required
                  disabled
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Select */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="month-select">
                  Month
                </label>
                <select
                  id="month-select"
                  className={styles.selectInput}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  required
                >
                  <option value="">Select Month</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m.charAt(0) + m.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Button */}
              <div className={styles.formGroup}>
                <button
                  type="button"
                  className={styles.btnSubmit}
                  disabled={submitting || fetching}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <Loader2 size={16} className={styles.spinner} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {submitting ? 'Updating...' : 'Set Active Month'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Currently Configured Active Months Table */}
      <div className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <p className={styles.cardTitle} style={{ marginBottom: 0 }}>
            <Building2 size={18} /> Current Active Months & Years
          </p>
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            onClick={handleRefresh}
            title="Refresh List"
            disabled={fetching}
          >
            <RefreshCw size={15} className={fetching ? styles.spinner : ''} />
          </button>
        </div>

        {fetching && activeMonths.length === 0 ? (
          <div className={styles.skeletonTable}>
            <div className={`${styles.skeleton} ${styles.skeletonTableRow}`} />
            <div className={`${styles.skeleton} ${styles.skeletonTableRow}`} />
            <div className={`${styles.skeleton} ${styles.skeletonTableRow}`} />
          </div>
        ) : activeMonths.length === 0 ? (
          <div className={styles.idleState} style={{ padding: '2rem' }}>
            <Calendar size={32} />
            <p>No active month configurations defined yet.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Active Month</th>
                  <th>Active Year</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeMonths.map((row) => (
                  <tr key={row.id}>
                    <td>{row.month}</td>
                    <td>{row.year}</td>
                    <td>
                      <span className={styles.badgeActive}>● Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
