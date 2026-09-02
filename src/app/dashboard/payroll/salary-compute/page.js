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
  Lock,
  Unlock,
  Send,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  AlertTriangle,
  UserCheck
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
  const [actionLoading, setActionLoading] = useState(false);
  const [fetchingActive, setFetchingActive] = useState(true);
  
  // Active period status details
  const [activePeriod, setActivePeriod] = useState(null);
  const [totalComputed, setTotalComputed] = useState(0);
  const [maxVstage, setMaxVstage] = useState(0);
  const [lockStatus, setLockStatus] = useState('Not Computed');
  const [userCtx, setUserCtx] = useState(null);

  // Result & Modals
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [modalConfig, setModalConfig] = useState(null); // { type: 'recompute'|'lock'|'unlock'|'forward', title, description }

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const loadActivePeriod = useCallback(async () => {
    try {
      setFetchingActive(true);
      const res = await axios.get(`${API_BASE}/payroll/lock-active-month`, {
        headers: buildHeaders(),
      });
      if (res.data.status === 'success') {
        const { activePeriod: ap, total_computed: tc, max_vstage: mv, lock_status: ls, userCtx: uctx } = res.data;
        setActivePeriod(ap);
        setTotalComputed(tc || 0);
        setMaxVstage(mv || 0);
        setLockStatus(ls || 'Not Computed');
        setUserCtx(uctx || null);

        if (ap) {
          setMonth(ap.month);
          setYear(String(ap.year));
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('hrms_active_payroll_period_cache', JSON.stringify({
              month: ap.month,
              year: String(ap.year),
            }));
          }
        }
      } else {
        showToast('No active payroll period found.', 'error');
      }
    } catch (err) {
      showToast('Failed to load active payroll period.', 'error');
    } finally {
      setFetchingActive(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadActivePeriod();
  }, [loadActivePeriod]);

  // Handle salary computation or recomputation
  const executeCompute = async (forceUnlock = false) => {
    if (!month || !year) {
      showToast('Active Month and Year are required.', 'error');
      return;
    }

    setLoading(true);
    setResult(null);
    setModalConfig(null);

    try {
      const res = await axios.post(
        `${API_BASE}/payroll/compute`,
        { 
          month, 
          year: parseInt(year),
          force_unlock: forceUnlock
        },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        const isRecompute = totalComputed > 0;
        setResult({
          message: res.data.message || (isRecompute ? 'Salary payroll run recomputed successfully!' : 'Salary payroll run computed successfully!'),
          payrollRunId: res.data.payroll_run_id,
          monthName: MONTHS.find(m => m.id === month)?.name || month,
          year: year,
          count: res.data.total_processed || totalComputed,
        });
        showToast(isRecompute ? 'Payroll recomputed successfully!' : 'Salary computation completed successfully!', 'success');

        // Clear cached payroll report to fetch fresh results
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('hrms_payroll_last_search_cache');
        }

        // Refresh active period status
        await loadActivePeriod();
      } else {
        showToast(res.data.message || 'Computation failed.', 'error');
      }
    } catch (err) {
      const isLocked = err.response?.data?.is_locked;
      const errMsg = err.response?.data?.message || 'Server error during compute. Please try again.';
      
      if (isLocked) {
        // Prompt to unlock & recompute
        setModalConfig({
          type: 'recompute_force_unlock',
          title: 'Period is Locked — Unlock and Recompute?',
          description: `The active period ${month} ${year} is currently locked. Would you like to automatically unlock and recompute all employee salaries now?`,
          actionBtnText: 'Unlock & Recompute',
          actionBtnStyle: styles.btnActionWarning
        });
      } else {
        showToast(errMsg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Open confirmation modal for compute / recompute
  const handleComputeClick = (e) => {
    if (e) e.preventDefault();
    if (lockStatus === 'Locked' && maxVstage < 4) {
      setModalConfig({
        type: 'recompute_force_unlock',
        title: 'Recompute Locked Period',
        description: `Active period ${month} ${year} is currently locked. Proceeding will unlock the month and recalculate all active salaries, statutory reliefs, taxes, pensions, and loan deductions.`,
        actionBtnText: 'Unlock & Recompute Salaries',
        actionBtnStyle: styles.btnActionWarning
      });
      return;
    }

    if (totalComputed > 0) {
      setModalConfig({
        type: 'recompute',
        title: 'Confirm Salary Recomputation',
        description: `This will recalculate basic salaries, allowances, leave pro-rations, tax deductions, pension contributions, and loan repayments for all active staff in ${month} ${year}. Existing payroll records for this period will be updated.`,
        actionBtnText: 'Recompute Salaries',
        actionBtnStyle: styles.btnActionPrimary
      });
      return;
    }

    // First time compute
    executeCompute(false);
  };

  // Handle Lock Action
  const executeLock = async () => {
    if (!month || !year) return;
    setActionLoading(true);
    setModalConfig(null);

    try {
      const res = await axios.post(
        `${API_BASE}/payroll/lock-active-month/lock`,
        { year: parseInt(year), month },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Active month locked successfully!', 'success');
        await loadActivePeriod();
      } else {
        showToast(res.data.message || 'Failed to lock active month.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error locking active month.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Unlock Action
  const executeUnlock = async () => {
    if (!month || !year) return;
    setActionLoading(true);
    setModalConfig(null);

    try {
      const res = await axios.post(
        `${API_BASE}/payroll/lock-active-month/unlock`,
        { year: parseInt(year), month },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Active month unlocked successfully!', 'success');
        await loadActivePeriod();
      } else {
        showToast(res.data.message || 'Failed to unlock active month.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error unlocking active month.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Forward to Audit Head Action
  const executeForwardToAudit = async () => {
    if (!month || !year) return;
    setActionLoading(true);
    setModalConfig(null);

    try {
      // If period is not yet locked, lock it first then forward
      if (lockStatus !== 'Locked' && maxVstage < 1) {
        await axios.post(
          `${API_BASE}/payroll/lock-active-month/lock`,
          { year: parseInt(year), month },
          { headers: buildHeaders() }
        );
      }

      const res = await axios.post(
        `${API_BASE}/payroll/lock-active-month/forward-to-audit`,
        { year: parseInt(year), month },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast('Payroll successfully submitted and forwarded to Audit Head!', 'success');
        await loadActivePeriod();
      } else {
        showToast(res.data.message || 'Failed to forward payroll to Audit Head.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error forwarding payroll to Audit Head.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Modal confirm dispatcher
  const handleModalConfirm = () => {
    if (!modalConfig) return;
    if (modalConfig.type === 'recompute') {
      executeCompute(false);
    } else if (modalConfig.type === 'recompute_force_unlock') {
      executeCompute(true);
    } else if (modalConfig.type === 'lock') {
      executeLock();
    } else if (modalConfig.type === 'unlock') {
      executeUnlock();
    } else if (modalConfig.type === 'forward') {
      executeForwardToAudit();
    }
  };

  const handleViewReport = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('hrms_payroll_last_search_cache', JSON.stringify({
        filters: { month, year, divisionID: '', bankID: '' },
        results: null
      }));
    }
    router.push('/dashboard/payroll');
  };

  // Stage badge resolver
  const renderStatusBadge = () => {
    if (maxVstage === 4) {
      return (
        <span className={`${styles.statusBadge} ${styles.badgePaid}`}>
          <CheckCircle2 size={14} /> Disbursed / Paid (Stage 4)
        </span>
      );
    }
    if (maxVstage === 3) {
      return (
        <span className={`${styles.statusBadge} ${styles.badgeApproved}`}>
          <ShieldCheck size={14} /> Audit Approved (Stage 3)
        </span>
      );
    }
    if (maxVstage === 2) {
      return (
        <span className={`${styles.statusBadge} ${styles.badgeForwarded}`}>
          <Send size={14} /> Forwarded to Audit Head (Stage 2)
        </span>
      );
    }
    if (lockStatus === 'Locked' || maxVstage === 1) {
      return (
        <span className={`${styles.statusBadge} ${styles.badgeLocked}`}>
          <Lock size={14} /> Locked (Stage 1)
        </span>
      );
    }
    if (totalComputed > 0) {
      return (
        <span className={`${styles.statusBadge} ${styles.badgeOpen}`}>
          <Unlock size={14} /> Computed & Open (Stage 0)
        </span>
      );
    }
    return (
      <span className={`${styles.statusBadge} ${styles.badgeNotComputed}`}>
        <AlertTriangle size={14} /> Not Computed
      </span>
    );
  };

  const isLocked = lockStatus === 'Locked' || maxVstage >= 1;
  const isForwarded = maxVstage >= 2;
  const isPaid = maxVstage >= 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={styles.container}
    >
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div className={styles.headerTitles}>
          <div className={styles.titleRow}>
            <h1>Salary Compute & Workflow</h1>
            <div className={styles.roleTag}>
              <UserCheck size={14} />
              <span>Finance Head Management</span>
            </div>
          </div>
          <p>Compute, recompute, lock active month, and forward finalized payroll directly to Audit Head for verification.</p>
        </div>
      </div>

      {/* ── Live Period Status Banner / Card ── */}
      <div className={styles.statusCard}>
        <div className={styles.statusCardHeader}>
          <div className={styles.periodMeta}>
            <Calendar size={18} className="text-primary" />
            <span className={styles.periodTitle}>Active Payroll Period:</span>
            <strong className={styles.periodValue}>
              {fetchingActive ? 'Loading...' : `${month || '—'} ${year || '—'}`}
            </strong>
          </div>
          <div>{renderStatusBadge()}</div>
        </div>

        <div className={styles.statusStatsGrid}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>Total Staff Computed</span>
            <span className={styles.statValue}>
              {fetchingActive ? '...' : `${totalComputed} Staff`}
            </span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>Period Status</span>
            <span className={styles.statValue}>
              {fetchingActive ? '...' : lockStatus}
            </span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>Verification Stage</span>
            <span className={styles.statValue}>
              {maxVstage === 4 ? 'Disbursed' : maxVstage === 3 ? 'Audit Approved' : maxVstage === 2 ? 'Audit Review' : maxVstage === 1 ? 'Finance Locked' : 'Draft / Open'}
            </span>
          </div>
        </div>

        {/* Workflow steps timeline */}
        <div className={styles.workflowTimeline}>
          <div className={`${styles.timelineStep} ${totalComputed > 0 ? styles.stepDone : styles.stepActive}`}>
            <div className={styles.stepDot}>1</div>
            <span className={styles.stepText}>Salary Compute</span>
          </div>
          <div className={styles.timelineDivider} />
          <div className={`${styles.timelineStep} ${isLocked ? styles.stepDone : totalComputed > 0 ? styles.stepActive : ''}`}>
            <div className={styles.stepDot}>2</div>
            <span className={styles.stepText}>Lock Month</span>
          </div>
          <div className={styles.timelineDivider} />
          <div className={`${styles.timelineStep} ${isForwarded ? styles.stepDone : isLocked ? styles.stepActive : ''}`}>
            <div className={styles.stepDot}>3</div>
            <span className={styles.stepText}>Forward to Audit</span>
          </div>
          <div className={styles.timelineDivider} />
          <div className={`${styles.timelineStep} ${maxVstage >= 3 ? styles.stepDone : isForwarded ? styles.stepActive : ''}`}>
            <div className={styles.stepDot}>4</div>
            <span className={styles.stepText}>Audit Approval</span>
          </div>
          <div className={styles.timelineDivider} />
          <div className={`${styles.timelineStep} ${isPaid ? styles.stepDone : ''}`}>
            <div className={styles.stepDot}>5</div>
            <span className={styles.stepText}>Disbursement</span>
          </div>
        </div>
      </div>

      {/* ── Main Action Card ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Calculator size={20} className="text-primary" />
          <h2 className={styles.cardTitle}>Salary Computation & Controls</h2>
        </div>

        <form onSubmit={handleComputeClick}>
          <div className={styles.grid}>
            {/* Month Readonly */}
            <div className={styles.formGroup}>
              <label htmlFor="compute-month" className={styles.label}>Active Month</label>
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
              <label htmlFor="compute-year" className={styles.label}>Active Year</label>
              <input
                type="text"
                id="compute-year"
                className={styles.inputReadOnly}
                value={fetchingActive ? 'Loading...' : year || '—'}
                readOnly
              />
            </div>
          </div>

          {/* Process Notice */}
          <div className={styles.infoBox}>
            <Info size={20} className={styles.infoIcon} />
            <div className={styles.infoText}>
              <strong>Computation Rules:</strong> Running computation calculates basic salaries, prorates leave of absence deductions (from 30 days base), determines progressive PAYE taxes, calculates statutory pensions, and deducts approved loan repayments and coop savings. Existing records for <strong>{month} {year}</strong> will be refreshed.
            </div>
          </div>

          {/* ── Primary Action Row ── */}
          <div className={styles.primaryActionRow}>
            {/* 1. Compute / Recompute Button */}
            <button
              id="compute-submit-btn"
              type="submit"
              className={totalComputed > 0 ? styles.btnRecompute : styles.btnCompute}
              disabled={loading || actionLoading || isPaid}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className={styles.spinner} />
                  <span>Computing Salaries...</span>
                </>
              ) : totalComputed > 0 ? (
                <>
                  <RefreshCw size={18} />
                  <span>Recompute Salaries</span>
                </>
              ) : (
                <>
                  <Settings size={18} />
                  <span>Run Salary Computation</span>
                </>
              )}
            </button>

            {/* 2. Lock Month Button (when computed & open) */}
            {totalComputed > 0 && !isLocked && !isPaid && (
              <button
                type="button"
                className={styles.btnLock}
                onClick={() => setModalConfig({
                  type: 'lock',
                  title: 'Lock Active Month',
                  description: `Locking ${month} ${year} will freeze all salary setups, deductions, and prevent accidental changes until unlocked. This prepares the payroll for Audit Head submission.`,
                  actionBtnText: 'Lock Active Month',
                  actionBtnStyle: styles.btnActionLock
                })}
                disabled={loading || actionLoading}
              >
                <Lock size={18} />
                <span>Lock Active Month</span>
              </button>
            )}

            {/* 3. Unlock Month Button (when locked & not paid) */}
            {isLocked && !isPaid && (
              <button
                type="button"
                className={styles.btnUnlock}
                onClick={() => setModalConfig({
                  type: 'unlock',
                  title: 'Unlock Active Month',
                  description: `Unlocking ${month} ${year} will allow Finance Head to modify allowances, deductions, and recompute salaries.`,
                  actionBtnText: 'Unlock Active Month',
                  actionBtnStyle: styles.btnActionUnlock
                })}
                disabled={loading || actionLoading}
              >
                <Unlock size={18} />
                <span>Unlock Active Month</span>
              </button>
            )}

            {/* 4. Forward to Audit Head Button (when locked or computed) */}
            {totalComputed > 0 && maxVstage < 2 && !isPaid && (
              <button
                type="button"
                className={styles.btnForward}
                onClick={() => setModalConfig({
                  type: 'forward',
                  title: 'Forward Payroll to Audit Head',
                  description: `This will officially submit the ${month} ${year} payroll schedule, tax deductions, and variance report to the Audit Head for formal verification.`,
                  actionBtnText: 'Forward to Audit Head',
                  actionBtnStyle: styles.btnActionForward
                })}
                disabled={loading || actionLoading}
              >
                <Send size={18} />
                <span>Forward Payroll to Audit Head</span>
              </button>
            )}
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
                <li><strong>Computed Records:</strong> {result.count || totalComputed} Employees</li>
                <li><strong>Current Status:</strong> {lockStatus}</li>
              </ul>
              <div className={styles.resultActions}>
                <button
                  onClick={handleViewReport}
                  className={styles.btnReport}
                >
                  <FileSpreadsheet size={15} />
                  <span>View Payroll Schedule</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => router.push('/dashboard/payroll/salary-breakdown')}
                  className={styles.btnSecondary}
                >
                  <Layers size={15} />
                  <span>Salary Breakdown</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick Links / Navigation Grid ── */}
      <div className={styles.quickLinksGrid}>
        <div 
          className={styles.quickLinkCard}
          onClick={() => router.push('/dashboard/payroll')}
        >
          <div className={styles.quickLinkIconBox}>
            <FileSpreadsheet size={20} color="#3b82f6" />
          </div>
          <div className={styles.quickLinkInfo}>
            <h4>Master Payroll Schedule</h4>
            <p>View 34-column itemized payroll breakdown and bank schedules.</p>
          </div>
          <ChevronRight size={18} className={styles.quickLinkArrow} />
        </div>

        <div 
          className={styles.quickLinkCard}
          onClick={() => router.push('/dashboard/payroll/salary-breakdown')}
        >
          <div className={styles.quickLinkIconBox}>
            <Layers size={20} color="#10b981" />
          </div>
          <div className={styles.quickLinkInfo}>
            <h4>Monthly Salary Breakdown</h4>
            <p>Inspect earnings, statutory reliefs, variance summary, and consolidated sheets.</p>
          </div>
          <ChevronRight size={18} className={styles.quickLinkArrow} />
        </div>

        <div 
          className={styles.quickLinkCard}
          onClick={() => router.push('/dashboard/payroll/lock-active-month')}
        >
          <div className={styles.quickLinkIconBox}>
            <Lock size={20} color="#f59e0b" />
          </div>
          <div className={styles.quickLinkInfo}>
            <h4>Lock & Audit Stage Manager</h4>
            <p>Detailed verification stage logs and audit checklist controls.</p>
          </div>
          <ChevronRight size={18} className={styles.quickLinkArrow} />
        </div>
      </div>

      {/* ── Confirmation Modal ── */}
      <AnimatePresence>
        {modalConfig && (
          <div className={styles.modalBackdrop}>
            <motion.div
              className={styles.modal}
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            >
              <div className={styles.modalHeader}>
                {modalConfig.type.startsWith('recompute') ? (
                  <RefreshCw size={22} className="text-primary" />
                ) : modalConfig.type === 'lock' ? (
                  <Lock size={22} color="#ef4444" />
                ) : modalConfig.type === 'unlock' ? (
                  <Unlock size={22} color="#10b981" />
                ) : (
                  <Send size={22} color="#3b82f6" />
                )}
                <h3 className={styles.modalTitle}>{modalConfig.title}</h3>
              </div>

              <p className={styles.modalDescription}>{modalConfig.description}</p>

              <div className={styles.modalSummaryBox}>
                <div className={styles.modalSummaryRow}>
                  <span>Target Period</span>
                  <span className={styles.modalSummaryVal}>{month} {year}</span>
                </div>
                <div className={styles.modalSummaryRow}>
                  <span>Computed Employees</span>
                  <span className={styles.modalSummaryVal}>{totalComputed} Staff</span>
                </div>
                <div className={styles.modalSummaryRow}>
                  <span>Current Lock Status</span>
                  <span className={styles.modalSummaryVal}>{lockStatus}</span>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnModalCancel}
                  onClick={() => setModalConfig(null)}
                  disabled={loading || actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={modalConfig.actionBtnStyle || styles.btnActionPrimary}
                  onClick={handleModalConfirm}
                  disabled={loading || actionLoading}
                >
                  {(loading || actionLoading) && <Loader2 size={16} className={styles.spinner} />}
                  <span>{modalConfig.actionBtnText || 'Confirm'}</span>
                </button>
              </div>
            </motion.div>
          </div>
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
