"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Users, TrendingDown, TrendingUp, Download, Search, Loader2, FileText, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Building2, Landmark } from 'lucide-react';
import NairaSign from '@/components/ui/NairaSign';
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

function fmt(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

const curYear  = new Date().getFullYear();
const YEARS    = Array.from({ length: 6 }, (_, i) => curYear - i).map(y => ({ id: y, name: String(y) }));

const TABLE_COLUMNS = [
  { key: 'IDNO',             label: 'ID No',            cls: '' },
  { key: 'NAME',             label: 'Name',             cls: styles.tdName },
  { key: 'DEPERTMENT',       label: 'Department',       cls: '' },
  { key: 'BASIC',            label: 'Basic',            cls: styles.tdNum },
  { key: 'HOUSING',          label: 'Housing',          cls: styles.tdNum },
  { key: 'TRANSPORT',        label: 'Transport',        cls: styles.tdNum },
  { key: 'MEDICAL',          label: 'Medical',          cls: styles.tdNum },
  { key: 'UTILITY',          label: 'Utility',          cls: styles.tdNum },
  { key: 'MEAL',             label: 'Meal',             cls: styles.tdNum },
  { key: 'TOTAL INCOME',     label: 'Total Income',     cls: styles.tdNum },
  { key: 'DECLARED INCOME',  label: 'Declared Inc.',    cls: styles.tdNum },
  { key: 'PAID DAYS',        label: 'Paid Days',        cls: styles.tdNum },
  { key: 'P.TAX',            label: 'P. Tax',           cls: styles.tdTax, tooltip: 'P. Tax = (Annual Declared - 8% Pension if active) progressive bands / 12. Bands: First 800k @ 0%, next 2.2M @ 15%, next 9M @ 18%, next 13M @ 21%, next 25M @ 23%, above 50M @ 25%.' },
  { key: 'IOU',              label: 'IOU',              cls: styles.tdDeduction },
  { key: 'RETENTION',        label: 'Retention',        cls: styles.tdNum },
  { key: 'LOAN',             label: 'Loan',             cls: styles.tdDeduction },
  { key: 'SURGHARGES',       label: 'Surcharges',       cls: styles.tdNum },
  { key: 'PENSION',          label: 'Pension',          cls: styles.tdDeduction, tooltip: 'Pension = Declared Salary * (Pension Rate / 100) if active' },
  { key: 'MEDICAL LOAN',     label: 'Med. Loan',        cls: styles.tdNum },
  { key: 'COOP. SAVING',     label: 'Coop. Saving',     cls: styles.tdDeduction },
  { key: 'COOP. LOAN RPYT',  label: 'Coop. Loan Rpyt',  cls: styles.tdDeduction },
  { key: 'ABSENCE PENALTY',  label: 'Absence Pen.',     cls: styles.tdNum },
  { key: 'LEAVE OF ABSENCE DEDUCTION', label: 'LOA Dedn.', cls: styles.tdNum },
  { key: 'OTHER DEDUCTION',  label: 'Other Dedn.',      cls: styles.tdDeduction },
  { key: 'TOTAL DEDUCTION',  label: 'Total Dedn.',      cls: styles.tdDeduction },
  { key: 'NETPAY',           label: 'Net Pay',          cls: styles.tdNetPay },
  { key: 'REVOLVING LOAN BAL', label: 'Rev. Loan Bal',  cls: styles.tdNum },
  { key: 'COP.CONTR',        label: 'Cop. Contr.',      cls: styles.tdNum },
  { key: 'COP. LONE BAL',    label: 'Cop. Lone Bal',    cls: styles.tdNum },
  { key: 'COOP.ASSET.',      label: 'Coop. Asset',      cls: styles.tdNum },
  { key: 'COP. ASSET FIN',   label: 'Cop. Asset Fin',   cls: styles.tdNum },
  { key: 'MEDICAL DEBT',     label: 'Med. Debt',        cls: styles.tdNum },
  { key: 'ACC. NO',          label: 'Acc. No',          cls: '' },
  { key: 'BANK',             label: 'Bank',             cls: '' },
  { key: 'CODE',             label: 'Code',             cls: '' },
  { key: 'PAYER ID',         label: 'Payer ID',         cls: '' },
];

export default function PayrollPage() {
  // Metadata
  const [divisions, setDivisions] = useState([]);
  const [banks,     setBanks]     = useState([]);
  const [metaLoaded, setMetaLoaded] = useState(false);

  // Filter state
  const [month,      setMonth]      = useState('');
  const [year,       setYear]       = useState(String(curYear));
  const [divisionID, setDivisionID] = useState('');
  const [bankID,     setBankID]     = useState('');

  // Results
  const [data,     setData]     = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const perPage = 50;

  // UI state
  const [loading,    setLoading]    = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [toast,      setToast]      = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Load metadata (divisions, banks) once
  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('hrms_payroll_metadata_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setDivisions(parsed.divisions || []);
          setBanks(parsed.banks || []);
          setMetaLoaded(true);
          hasCache = true;
        } catch (e) {
          console.error("Failed to parse cached metadata", e);
        }
      }
    }

    axios
      .get(`${API_BASE}/payroll/metadata`, { headers: buildHeaders() })
      .then(res => {
        if (res.data.status === 'success') {
          const divisionsData = res.data.divisions || [];
          const banksData = res.data.banks || [];
          setDivisions(divisionsData);
          setBanks(banksData);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('hrms_payroll_metadata_cache', JSON.stringify({
              divisions: divisionsData,
              banks: banksData
            }));
          }
        }
      })
      .catch(() => {
        if (!hasCache) {
          showToast('Failed to load filter options.', 'error');
        }
      })
      .finally(() => setMetaLoaded(true));
  }, [showToast]);

  // Load cached search results and parameters on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cachedSearch = sessionStorage.getItem('hrms_payroll_last_search_cache');
    if (cachedSearch) {
      try {
        const parsed = JSON.parse(cachedSearch);
        const { filters, results } = parsed;

        if (filters) {
          if (filters.month) setMonth(filters.month);
          if (filters.year) setYear(String(filters.year));
          if (filters.divisionID) setDivisionID(filters.divisionID);
          if (filters.bankID) setBankID(filters.bankID);
        }

        if (results) {
          setData(results.data || []);
          setSummary(results.summary || null);
          setTotal(results.total || 0);
          setPage(results.page || 1);
          setLastPage(results.lastPage || 1);
          setSearched(true);

          // Perform silent background refetch with the restored filters to ensure data freshness
          if (filters.month && filters.year) {
            axios.get(`${API_BASE}/payroll`, {
              headers: buildHeaders(),
              params: {
                month: filters.month,
                year: filters.year,
                divisionID: filters.divisionID || '',
                bankID: filters.bankID || '',
                page: results.page || 1,
                perPage
              },
            }).then(res => {
              if (res.data.status === 'success') {
                setData(res.data.data);
                setSummary(res.data.summary);
                setTotal(res.data.total);
                setPage(res.data.page);
                setLastPage(res.data.lastPage);
                setSearched(true);

                // Update cache
                sessionStorage.setItem('hrms_payroll_last_search_cache', JSON.stringify({
                  filters,
                  results: {
                    data: res.data.data,
                    summary: res.data.summary,
                    total: res.data.total,
                    page: res.data.page,
                    lastPage: res.data.lastPage,
                  }
                }));
              }
            }).catch(e => {
              console.error("Silent background search refetch failed", e);
            });
          }
        }
      } catch (e) {
        console.error("Failed to parse cached search results", e);
      }
    }
  }, []);

  const fetchPage = useCallback(async (pg = 1) => {
    if (!month) { showToast('Please select a Month.', 'error'); return; }
    if (!year)  { showToast('Please select a Year.',  'error'); return; }

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll`, {
        headers: buildHeaders(),
        params: { month, year, divisionID, bankID, page: pg, perPage },
      });

      if (res.data.status === 'success') {
        setData(res.data.data);
        setSummary(res.data.summary);
        setTotal(res.data.total);
        setPage(res.data.page);
        setLastPage(res.data.lastPage);
        setSearched(true);

        // Cache search parameters and results
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('hrms_payroll_last_search_cache', JSON.stringify({
            filters: { month, year, divisionID, bankID },
            results: {
              data: res.data.data,
              summary: res.data.summary,
              total: res.data.total,
              page: res.data.page,
              lastPage: res.data.lastPage,
            }
          }));
        }

        if (res.data.total === 0) showToast('No payroll records found for the selected filters.', 'error');
      } else {
        showToast(res.data.message || 'Failed to load payroll data.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [month, year, divisionID, bankID, showToast]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPage(1);
  };

  const handlePageChange = (pg) => {
    fetchPage(pg);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExport = async () => {
    if (!month) { showToast('Please select a Month before exporting.', 'error'); return; }
    if (!year)  { showToast('Please select a Year before exporting.',  'error'); return; }

    setExporting(true);
    try {
      const params = new URLSearchParams({ month, year });
      if (divisionID) params.append('divisionID', divisionID);
      if (bankID)     params.append('bankID',     bankID);

      const uid = getUserId();
      const res = await fetch(
        `${API_BASE}/payroll/export?${params.toString()}`,
        { headers: uid ? { 'X-User-Id': uid } : {} }
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Export failed.');
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Payroll_${month}_${year}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Payroll exported successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const statCards = summary
    ? [
        {
          label : 'Total Staff',
          value : summary.totalStaff?.toLocaleString() ?? '—',
          icon  : <Users size={22} color="#fff" />,
          bg    : 'linear-gradient(135deg,#6366f1,#4f46e5)',
        },
        {
          label : 'Gross Income',
          value : '₦' + fmt(summary.totalGrossIncome),
          icon  : <TrendingUp size={22} color="#fff" />,
          bg    : 'linear-gradient(135deg,#10b981,#059669)',
        },
        {
          label : 'Total Deductions',
          value : '₦' + fmt(summary.totalDeductions),
          icon  : <TrendingDown size={22} color="#fff" />,
          bg    : 'linear-gradient(135deg,#f59e0b,#d97706)',
        },
        {
          label : 'Net Pay',
          value : '₦' + fmt(summary.totalNetPay),
          icon  : <NairaSign size={22} color="#fff" />,
          bg    : 'linear-gradient(135deg,#3b82f6,#2563eb)',
        },
      ]
    : [];

  const divName = divisionID
    ? (divisions.find(d => String(d.id) === String(divisionID))?.name ?? '')
    : '';
  const periodLabel = [
    MONTHS.find(m => m.id === month)?.name ?? '',
    year,
    divName,
  ].filter(Boolean).join(' · ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={styles.container}
    >
      {/* ── Header ── */}
      <div className={styles.header}>
        <h1>Payroll Report</h1>
        <p>Generate and export the consolidated monthly payroll schedule.</p>
      </div>

      {/* ── Filter Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={styles.filterCard}
      >
        <p className={styles.filterTitle}>Filter Payroll</p>
        <form onSubmit={handleSearch}>
          <div className={styles.filterGrid}>
            {/* Month */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="pr-month">Month *</label>
              <select
                id="pr-month"
                className={styles.formSelect}
                value={month}
                onChange={e => setMonth(e.target.value)}
                required
              >
                <option value="">-- Select Month --</option>
                {MONTHS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="pr-year">Year *</label>
              <select
                id="pr-year"
                className={styles.formSelect}
                value={year}
                onChange={e => setYear(e.target.value)}
                required
              >
                {YEARS.map(y => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>

            {/* Bank */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="pr-bank">Bank</label>
              <select
                id="pr-bank"
                className={styles.formSelect}
                value={bankID}
                onChange={e => setBankID(e.target.value)}
              >
                <option value="">-- All Banks --</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className={styles.filterActions}>
              <button
                id="pr-search-btn"
                type="submit"
                className={styles.btnSearch}
                disabled={loading}
              >
                {loading
                  ? <Loader2 size={16} className={styles.spinner} />
                  : <Search size={16} />
                }
                {loading ? 'Loading…' : 'Generate'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>

      {/* ── Summary Cards (only after search) ── */}
      <AnimatePresence>
        {summary && (
          <motion.div
            key="summary"
            className={styles.statsGrid}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {statCards.map((card, i) => (
              <motion.div
                key={card.label}
                className={styles.statCard}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <div className={styles.statIcon} style={{ background: card.bg }}>
                  {card.icon}
                </div>
                <div className={styles.statInfo}>
                  <div className={styles.statLabel}>{card.label}</div>
                  <div className={styles.statValue}>{card.value}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results Table ── */}
      <AnimatePresence mode="wait">
        {loading && !data.length ? (
          <motion.div
            key="loading"
            className={styles.loadingState}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 size={40} className={styles.spinner} />
            <span>Fetching payroll records…</span>
          </motion.div>
        ) : searched && data.length === 0 ? (
          <motion.div
            key="empty"
            className={styles.emptyState}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <FileText size={56} />
            <h3>No Records Found</h3>
            <p>No payroll data found for the selected period. Try changing the filters.</p>
          </motion.div>
        ) : data.length > 0 ? (
          <motion.div
            key="table"
            className={styles.tableCard}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Table header bar */}
            <div className={styles.tableHeader}>
              <h2 className={styles.tableTitle}>
                <Landmark size={18} />
                Payroll Schedule
                {periodLabel && (
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    — {periodLabel}
                  </span>
                )}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={styles.tableMeta}>
                  {total.toLocaleString()} staff · Page {page}/{lastPage}
                </span>
                <button
                  id="pr-export-btn"
                  type="button"
                  className={styles.btnExport}
                  disabled={exporting}
                  onClick={handleExport}
                  title="Download as CSV"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                  }}
                >
                  {exporting
                    ? <Loader2 size={14} className={styles.spinner} />
                    : <Download size={14} />
                  }
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </button>
              </div>
            </div>

            {/* Scrollable table */}
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {TABLE_COLUMNS.map(col => (
                      <th 
                        key={col.key}
                        className={col.tooltip ? styles.tooltip : ''}
                        data-tooltip={col.tooltip}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={`${row['IDNO']}-${idx}`}>
                      {TABLE_COLUMNS.map(col => {
                        const val = row[col.key];
                        if (col.key === 'BANK') {
                          return (
                            <td key={col.key} className={col.cls}>
                              {val ? <span className={styles.bankBadge}>{val}</span> : '—'}
                            </td>
                          );
                        }
                        let cellTooltip = col.tooltip;
                        if (col.key === 'PENSION') {
                          const decSalary = parseFloat(row['DECLARED INCOME'] || 0);
                          const pensionVal = parseFloat(row['PENSION'] || 0);
                          const pensionRate = decSalary > 0 && pensionVal > 0 ? Math.round((pensionVal / decSalary) * 100) : 8;
                          cellTooltip = `Pension = ${decSalary} * (${pensionRate}/100) if active`;
                        } else if (col.key === 'P.TAX') {
                          const decSalary = parseFloat(row['DECLARED INCOME'] || 0);
                          const pensionVal = parseFloat(row['PENSION'] || 0);
                          const annualGross = decSalary * 12;
                          const annualPension = pensionVal * 12;
                          const annualTaxable = Math.max(0, annualGross - annualPension);
                          cellTooltip = `P. Tax = Progressive bands on annual taxable ₦${annualTaxable.toLocaleString('en-NG')} (₦${annualGross.toLocaleString('en-NG')} Declared - ₦${annualPension.toLocaleString('en-NG')} Pension) / 12`;
                        }
                        return (
                          <td 
                            key={col.key} 
                            className={`${col.cls} ${cellTooltip ? styles.tooltip : ''}`}
                            data-tooltip={cellTooltip}
                          >
                            {val !== undefined && val !== null && val !== '' ? val : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  Showing {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} of {total.toLocaleString()} records
                </span>
                <div className={styles.paginationControls}>
                  <button
                    id="pr-prev-btn"
                    className={styles.pageBtn}
                    disabled={page <= 1 || loading}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    <ChevronLeft size={14} />
                  </button>

                  {/* Page number pills */}
                  {Array.from({ length: Math.min(7, lastPage) }, (_, i) => {
                    let pg;
                    if (lastPage <= 7) {
                      pg = i + 1;
                    } else if (page <= 4) {
                      pg = i + 1;
                    } else if (page >= lastPage - 3) {
                      pg = lastPage - 6 + i;
                    } else {
                      pg = page - 3 + i;
                    }
                    return (
                      <button
                        key={pg}
                        className={`${styles.pageBtn} ${pg === page ? styles.pageBtnActive : ''}`}
                        disabled={loading}
                        onClick={() => handlePageChange(pg)}
                      >
                        {pg}
                      </button>
                    );
                  })}

                  <button
                    id="pr-next-btn"
                    className={styles.pageBtn}
                    disabled={page >= lastPage || loading}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* Initial "idle" state before any search */
          !searched && (
            <motion.div
              key="idle"
              className={styles.emptyState}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Building2 size={56} />
              <h3>Ready to Generate</h3>
              <p>Select a Month and Year above, then click <strong>Generate</strong> to load the payroll report.</p>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
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
