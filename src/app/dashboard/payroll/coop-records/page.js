"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  CreditCard,
  FileText,
  CheckCircle2,
  Clock,
  Search,
  Download,
  Printer,
  RefreshCw,
  Loader2,
  UserCheck,
  ChevronDown,
  X,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Check,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
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

function fmtN(n) {
  const clean = typeof n === 'string' ? n.replace(/,/g, '') : n;
  const num = parseFloat(clean);
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function CoopRecordsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // User privileges
  const [userCtx, setUserCtx] = useState({
    isPrivileged: false,
  });

  // Staff List State
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null); // null = All staff
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const staffDropdownRef = useRef(null);

  // Filter States
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'savings_deductions' | 'loan_deductions' | 'top_ups' | 'withdrawals' | 'hr_approved'
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [records, setRecords] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  // Executive Summary Stats
  const [summary, setSummary] = useState({
    total_savings_deducted: 0,
    savings_deduction_count: 0,
    total_loan_deducted: 0,
    loan_deduction_count: 0,
    total_top_ups: 0,
    top_up_count: 0,
    total_withdrawals: 0,
    withdrawal_count: 0,
    total_hr_approved_count: 0,
    total_hr_approved_amount: 0,
    current_savings_balance: 0,
    current_loan_outstanding: 0,
    active_members_count: 0,
  });

  // Modal States
  const [viewRecord, setViewRecord] = useState(null);
  const [statementModalData, setStatementModalData] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Load Staff List
  const loadStaffList = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-records/staff-list`, {
        headers: buildHeaders(),
      });
      if (res.data.status === 'success') {
        setStaffList(res.data.data || []);
        setUserCtx({ isPrivileged: res.data.isPrivileged });

        // If regular staff, auto-select their own profile
        if (!res.data.isPrivileged && res.data.data?.length === 1) {
          setSelectedStaff(res.data.data[0]);
        }
      }
    } catch (err) {
      console.error('Error loading staff list:', err);
    }
  }, []);

  // ── Load Summary Stats
  const loadSummary = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-records/summary`, {
        headers: buildHeaders(),
        params: {
          staff_id: selectedStaff?.id || '',
        }
      });
      if (res.data.status === 'success') {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Error loading summary:', err);
    }
  }, [selectedStaff]);

  // ── Load Ledger Records
  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-records/ledger`, {
        headers: buildHeaders(),
        params: {
          category: activeCategory,
          staff_id: selectedStaff?.id || '',
          year: selectedYear,
          month: selectedMonth,
          from_date: fromDate,
          to_date: toDate,
          search: searchQuery,
          page: currentPage,
          per_page: perPage,
        }
      });
      if (res.data.status === 'success') {
        setRecords(res.data.data || []);
        setTotalCount(res.data.total || 0);
      }
    } catch (err) {
      console.error('Error loading ledger:', err);
      showToast('Could not load cooperative records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, selectedStaff, selectedYear, selectedMonth, fromDate, toDate, searchQuery, currentPage, perPage, showToast]);

  useEffect(() => {
    setMounted(true);
    loadStaffList();
  }, [loadStaffList]);

  useEffect(() => {
    loadSummary();
    loadLedger();
  }, [loadSummary, loadLedger]);

  // Click outside listener for staff dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(e.target)) {
        setShowStaffDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Filtered Staff Options in Dropdown
  const filteredStaffOptions = staffList.filter((s) => {
    const q = staffSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.fileNo && s.fileNo.toLowerCase().includes(q)) ||
      (s.department && s.department.toLowerCase().includes(q)) ||
      String(s.id).includes(q)
    );
  });

  // ── Export CSV
  const handleExportCSV = () => {
    if (records.length === 0) {
      showToast('No records to export.', 'error');
      return;
    }

    const headers = ['Ref Code', 'Staff ID', 'Staff Name', 'Department', 'Category', 'Period', 'Date', 'Flow', 'Amount (NGN)', 'Status', 'Notes'];
    const rows = records.map((r) => [
      `"${r.reference}"`,
      `"${r.staff_id}"`,
      `"${r.staff_name}"`,
      `"${r.department}"`,
      `"${r.type_label}"`,
      `"${r.period}"`,
      `"${r.date}"`,
      `"${r.flow_type.toUpperCase()}"`,
      r.amount.toFixed(2),
      `"${r.status_label}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Cooperative_Records_${activeCategory}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Cooperative records exported to CSV.', 'success');
  };

  // ── Load Member Passbook Statement for Print
  const handleOpenStatement = async () => {
    const targetStaffId = selectedStaff?.id || (staffList.length > 0 ? staffList[0].id : null);
    if (!targetStaffId) {
      showToast('Please select a staff member to generate their official statement.', 'error');
      return;
    }

    setStatementLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/coop-records/statement-print`, {
        headers: buildHeaders(),
        params: { staff_id: targetStaffId }
      });
      if (res.data.status === 'success') {
        setStatementModalData(res.data.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not load member statement.', 'error');
    } finally {
      setStatementLoading(false);
    }
  };

  // ── Print Passbook Statement
  const handlePrintStatement = () => {
    if (!statementModalData) return;

    let iframe = document.getElementById('coop-statement-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'coop-statement-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const { staff, transactions, loan_transactions, closing_balance, total_credited, total_debited, total_loan_repaid, printed_at } = statementModalData;

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cooperative Statement - ${staff.name}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; font-size: 11px; }
            .header-sec { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
            .org-title { font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; }
            .coop-title { font-size: 12px; font-weight: 700; color: #059669; margin-top: 2px; }
            .doc-badge { display: inline-block; margin-top: 4px; font-size: 10px; font-weight: 700; background: #0f172a; color: #fff; padding: 2px 10px; border-radius: 12px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 10px; }
            .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; text-align: center; }
            .card { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 6px; }
            .card.highlight { background: #ecfdf5; border-color: #a7f3d0; }
            .card-label { font-size: 9px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 2px; }
            .card-val { font-size: 13px; font-weight: 800; color: #0f172a; }
            .card.highlight .card-val { color: #059669; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px; }
            th { background: #f1f5f9; color: #334155; border-bottom: 1.5px solid #cbd5e1; padding: 5px 6px; text-align: left; font-size: 9px; text-transform: uppercase; }
            td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
            .text-right { text-align: right; }
            .credit { color: #059669; font-weight: 700; }
            .debit { color: #dc2626; font-weight: 700; }
            .signatures-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 24px; padding-top: 10px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 10px; }
            .sig-name { font-weight: 700; color: #0f172a; margin-bottom: 24px; }
            .sig-line { border-top: 1px solid #94a3b8; padding-top: 2px; color: #475569; font-size: 9px; }
            .footer-audit { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header-sec">
            <div class="org-title">ISALU HOSPITALS LIMITED</div>
            <div class="coop-title">STAFF COOPERATIVE MULTIPURPOSE SOCIETY</div>
            <div class="doc-badge">MEMBER OFFICIAL COOPERATIVE STATEMENT & PASSBOOK</div>
          </div>

          <div class="meta-grid">
            <div><strong>Member Name:</strong><br>${staff.name}</div>
            <div><strong>Staff ID:</strong><br>#${staff.staffId}</div>
            <div><strong>Department:</strong><br>${staff.department || 'General'}</div>
            <div><strong>Monthly Savings Target:</strong><br>${fmtN(staff.monthly_saving)} / mo</div>
            <div><strong>Active Loan Repayment:</strong><br>${fmtN(staff.loan_monthly_deduction)} / mo</div>
            <div><strong>Printed On:</strong><br>${fmtDate(printed_at)}</div>
          </div>

          <div class="summary-cards">
            <div class="card">
              <div class="card-label">Total Savings Contributed</div>
              <div class="card-val">${fmtN(total_credited)}</div>
            </div>
            <div class="card">
              <div class="card-label">Total Withdrawn</div>
              <div class="card-val" style="color: #dc2626;">-${fmtN(total_debited)}</div>
            </div>
            <div class="card highlight">
              <div class="card-label">Net Savings Balance</div>
              <div class="card-val">${fmtN(closing_balance)}</div>
            </div>
            <div class="card">
              <div class="card-label">Total Loan Repaid</div>
              <div class="card-val" style="color: #2563eb;">${fmtN(total_loan_repaid)}</div>
            </div>
          </div>

          <strong>COOPERATIVE SAVINGS & ACTIVITY TRANSACTIONS</strong>
          <table>
            <thead>
              <tr>
                <th style="width: 75px;">Date</th>
                <th style="width: 100px;">Reference</th>
                <th>Transaction Description</th>
                <th class="text-right" style="width: 85px;">Credit (+)</th>
                <th class="text-right" style="width: 85px;">Debit (-)</th>
                <th class="text-right" style="width: 95px;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; padding: 12px; color: #64748b;">No cooperative savings transactions recorded.</td></tr>
              ` : transactions.map(t => `
                <tr>
                  <td>${fmtDate(t.date)}</td>
                  <td style="font-family: monospace;">${t.reference}</td>
                  <td>${t.description}</td>
                  <td class="text-right credit">${t.credit > 0 ? fmtN(t.credit) : '—'}</td>
                  <td class="text-right debit">${t.debit > 0 ? '-' + fmtN(t.debit) : '—'}</td>
                  <td class="text-right" style="font-weight: 700;">${fmtN(t.balance)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${loan_transactions.length > 0 ? `
            <strong>COOPERATIVE LOAN REPAYMENT DEDUCTIONS</strong>
            <table>
              <thead>
                <tr>
                  <th style="width: 75px;">Date</th>
                  <th style="width: 100px;">Reference</th>
                  <th>Description</th>
                  <th class="text-right" style="width: 95px;">Repayment Deducted</th>
                </tr>
              </thead>
              <tbody>
                ${loan_transactions.map(lr => `
                  <tr>
                    <td>${fmtDate(lr.date)}</td>
                    <td style="font-family: monospace;">${lr.reference}</td>
                    <td>${lr.description}</td>
                    <td class="text-right" style="color: #2563eb; font-weight: 700;">${fmtN(lr.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <div class="signatures-grid">
            <div>
              <div class="sig-name">${staff.name}</div>
              <div class="sig-line">Member Signature</div>
            </div>
            <div>
              <div class="sig-name">HR Head</div>
              <div class="sig-line">HR Head Certified</div>
            </div>
            <div>
              <div class="sig-name">Finance Officer</div>
              <div class="sig-line">Finance Verified</div>
            </div>
          </div>

          <div class="footer-audit">
            Printed on ${fmtDate(printed_at)} • Official Isalu HRMS Cooperative Ledger Statement
          </div>
        </body>
      </html>
    `;

    try {
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(printHtml);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 350);
    } catch (e) {
      console.error('Print iframe failed', e);
      window.print();
    }
  };

  if (!mounted) return null;

  return (
    <>
      <div className={styles.container}>
        {/* ── Page Header ── */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1>
              <Wallet size={26} className="text-emerald-400" />
              Cooperative Records & Statements
            </h1>
            <p>
              Unified master ledger tracking monthly loan deductions, monthly savings contributions, voluntary top-ups, withdrawals disbursed, and HR Head approved applications with running member passbook statements.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleOpenStatement}
              disabled={statementLoading}
            >
              {statementLoading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              Print Passbook Statement
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleExportCSV}
              disabled={records.length === 0}
            >
              <Download size={16} /> Export CSV
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                loadSummary();
                loadLedger();
              }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* ── Executive Stat Cards Grid ── */}
        <div className={styles.statsGrid}>
          {/* Card 1: Monthly Savings Deductions */}
          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <TrendingUp size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Monthly Savings Deductions</span>
              <span className={styles.statValue}>{fmtN(summary.total_savings_deducted)}</span>
              <span className={styles.statSubtext}>{summary.savings_deduction_count} payroll deductions</span>
            </div>
          </div>

          {/* Card 2: Monthly Loan Deductions */}
          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <CreditCard size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Monthly Loan Deductions</span>
              <span className={styles.statValue}>{fmtN(summary.total_loan_deducted)}</span>
              <span className={styles.statSubtext}>{summary.loan_deduction_count} loan repayments</span>
            </div>
          </div>

          {/* Card 3: Savings Top-Ups */}
          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8' }}>
              <ArrowUpRight size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Savings Top-Ups</span>
              <span className={styles.statValue}>{fmtN(summary.total_top_ups)}</span>
              <span className={styles.statSubtext}>{summary.top_up_count} direct top-up payments</span>
            </div>
          </div>

          {/* Card 4: Savings Withdrawals */}
          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <ArrowDownRight size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Withdrawals Disbursed</span>
              <span className={styles.statValue}>{fmtN(summary.total_withdrawals)}</span>
              <span className={styles.statSubtext}>{summary.withdrawal_count} payouts settled</span>
            </div>
          </div>

          {/* Card 5: HR Head Approved Applications */}
          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              <UserCheck size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>HR Head Approved Apps</span>
              <span className={styles.statValue}>{summary.total_hr_approved_count}</span>
              <span className={styles.statSubtext}>{fmtN(summary.total_hr_approved_amount)} approved value</span>
            </div>
          </div>

          {/* Card 6: Current Savings Balance */}
          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
              <NairaSign size={24} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>
                {selectedStaff ? 'Member Savings Balance' : 'Total Cooperative Savings'}
              </span>
              <span className={styles.statValue}>{fmtN(summary.current_savings_balance)}</span>
              <span className={styles.statSubtext}>
                {selectedStaff ? `Target: ${fmtN(selectedStaff.monthly_saving)}/mo` : `${summary.active_members_count} active members`}
              </span>
            </div>
          </div>
        </div>

        {/* ── Filter Controls Bar ── */}
        <div className={styles.filterBar}>
          <div className={styles.filterControls}>
            {/* Staff Autocomplete Dropdown Selector */}
            {userCtx.isPrivileged && (
              <div className={styles.staffSelectorContainer} ref={staffDropdownRef}>
                <button
                  type="button"
                  className={styles.staffSelectBtn}
                  onClick={() => setShowStaffDropdown(!showStaffDropdown)}
                >
                  <span className="truncate">
                    {selectedStaff ? `${selectedStaff.name} (ID: #${selectedStaff.id})` : '👥 All Cooperative Members'}
                  </span>
                  <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
                </button>

                {showStaffDropdown && (
                  <div className={styles.staffDropdown}>
                    <input
                      type="text"
                      placeholder="Search member name or ID..."
                      value={staffSearchQuery}
                      onChange={(e) => setStaffSearchQuery(e.target.value)}
                      className={styles.staffSearchInput}
                      autoFocus
                    />
                    <div
                      className={`${styles.staffOption} ${!selectedStaff ? styles.staffOptionActive : ''}`}
                      onClick={() => {
                        setSelectedStaff(null);
                        setShowStaffDropdown(false);
                        setCurrentPage(1);
                      }}
                    >
                      <strong>👥 All Cooperative Members (All Staff)</strong>
                      <span className={styles.staffOptionMeta}>View organization-wide cooperative transactions</span>
                    </div>

                    {filteredStaffOptions.map((st) => (
                      <div
                        key={st.id}
                        className={`${styles.staffOption} ${selectedStaff?.id === st.id ? styles.staffOptionActive : ''}`}
                        onClick={() => {
                          setSelectedStaff(st);
                          setShowStaffDropdown(false);
                          setCurrentPage(1);
                        }}
                      >
                        <strong>{st.name}</strong>
                        <span className={styles.staffOptionMeta}>
                          ID: #{st.id} • {st.department} • Bal: {fmtN(st.saving_balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setCurrentPage(1);
              }}
              className={styles.selectInput}
            >
              <option value="all">All Years</option>
              <option value="2027">2027</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>

            {/* Month Selector */}
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setCurrentPage(1);
              }}
              className={styles.selectInput}
            >
              <option value="all">All Months</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>

            {/* Date Range Inputs */}
            <div className={styles.dateInputGroup}>
              <span>From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                className={styles.dateInput}
              />
              <span>To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                className={styles.dateInput}
              />
            </div>
          </div>

          {/* Quick Search */}
          <div className={styles.searchBox}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search ref, staff, note..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className={styles.searchInput}
            />
          </div>
        </div>

        {/* ── Interactive Category Tabs ── */}
        <div className={styles.tabsNav}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeCategory === 'all' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveCategory('all');
              setCurrentPage(1);
            }}
          >
            <Layers size={14} /> Unified Statement
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeCategory === 'loan_deductions' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveCategory('loan_deductions');
              setCurrentPage(1);
            }}
          >
            <CreditCard size={14} /> Monthly Loan Deductions
            <span className={styles.tabCount}>{summary.loan_deduction_count}</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeCategory === 'savings_deductions' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveCategory('savings_deductions');
              setCurrentPage(1);
            }}
          >
            <TrendingUp size={14} /> Monthly Savings Deductions
            <span className={styles.tabCount}>{summary.savings_deduction_count}</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeCategory === 'top_ups' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveCategory('top_ups');
              setCurrentPage(1);
            }}
          >
            <ArrowUpRight size={14} /> Savings Top-Ups
            <span className={styles.tabCount}>{summary.top_up_count}</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeCategory === 'withdrawals' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveCategory('withdrawals');
              setCurrentPage(1);
            }}
          >
            <ArrowDownRight size={14} /> Withdrawals Disbursed
            <span className={styles.tabCount}>{summary.withdrawal_count}</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeCategory === 'hr_approved' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveCategory('hr_approved');
              setCurrentPage(1);
            }}
          >
            <UserCheck size={14} /> HR Head Approved Applications
            <span className={styles.tabCount}>{summary.total_hr_approved_count}</span>
          </button>
        </div>

        {/* ── Main Ledger Table Card ── */}
        <div className={styles.tableCard}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ref Code</th>
                  <th>Staff Member</th>
                  <th>Department</th>
                  <th>Category / Transaction</th>
                  <th>Period</th>
                  <th>Date</th>
                  <th className={styles.thRight}>Amount</th>
                  <th className={styles.thCenter}>Status</th>
                  <th className={styles.thRight}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12">
                      <Loader2 size={24} className="animate-spin text-emerald-400 mx-auto mb-2" />
                      <span className="text-xs text-slate-400">Loading cooperative records & transactions...</span>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan="9">
                      <div className={styles.emptyState}>
                        <FileText size={32} className="mx-auto text-slate-500 opacity-50 mb-2" />
                        <strong>No cooperative records found</strong>
                        <p>No transactions match your current search, period, or member filter.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((r) => {
                    const isCredit = r.flow_type === 'credit';
                    const isDebit = r.flow_type === 'debit_savings' || r.flow_type === 'debit_payroll';
                    const isApproval = r.flow_type === 'approval';

                    let catBadgeClass = styles.catSavings;
                    if (r.category === 'loan_deductions') catBadgeClass = styles.catLoan;
                    if (r.category === 'top_ups') catBadgeClass = styles.catTopUp;
                    if (r.category === 'withdrawals') catBadgeClass = styles.catWithdrawal;
                    if (r.category === 'hr_approved') catBadgeClass = styles.catHrApproved;

                    return (
                      <tr key={r.id}>
                        <td>
                          <span className={styles.refCode}>{r.reference}</span>
                        </td>
                        <td>
                          <div className={styles.staffCell}>
                            <div className={styles.avatar}>
                              {(r.staff_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className={styles.staffName}>{r.staff_name}</div>
                              <div className={styles.staffMeta}>ID: #{r.staff_id}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-xs text-slate-300">{r.department}</span>
                        </td>
                        <td>
                          <span className={`${styles.badgeCategory} ${catBadgeClass}`}>
                            {r.type_label}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-300 font-medium">{r.period}</span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-400">{fmtDate(r.date)}</span>
                        </td>
                        <td className={styles.cellRight}>
                          <span className={isCredit ? styles.amountCredit : (isDebit ? styles.amountDebit : styles.amountNeutral)}>
                            {isCredit ? '+' : (isDebit ? '-' : '')}{fmtN(r.amount)}
                          </span>
                        </td>
                        <td className={styles.cellCenter}>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                            {r.status_label}
                          </span>
                        </td>
                        <td className={styles.cellRight}>
                          <button
                            type="button"
                            className={styles.btnViewDetails}
                            onClick={() => setViewRecord(r)}
                          >
                            <FileText size={12} /> Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={styles.paginationBar}>
            <div>
              Showing {records.length} of {totalCount} records
            </div>
            <div className={styles.paginationControls}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>Page {currentPage} of {Math.max(1, Math.ceil(totalCount / perPage))}</span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage >= Math.ceil(totalCount / perPage)}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transaction Details Modal ── */}
      <AnimatePresence>
        {viewRecord && (
          <div className={styles.modalBackdrop}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <FileText size={18} className="text-emerald-400" />
                  Transaction Details: {viewRecord.reference}
                </h3>
                <button type="button" className={styles.btnCloseModal} onClick={() => setViewRecord(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff Member</span>
                    <span className={styles.detailValue}>{viewRecord.staff_name}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff ID / Department</span>
                    <span className={styles.detailValue}>ID: #{viewRecord.staff_id} • {viewRecord.department}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Transaction Type</span>
                    <span className={styles.detailValue}>{viewRecord.type_label}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Transaction Period</span>
                    <span className={styles.detailValue}>{viewRecord.period}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Effective Date</span>
                    <span className={styles.detailValue}>{fmtDate(viewRecord.date)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Transaction Amount</span>
                    <span className={styles.detailValue} style={{ color: '#34d399', fontSize: '1.1rem' }}>
                      {fmtN(viewRecord.amount)}
                    </span>
                  </div>
                  <div className={`${styles.detailItem} ${styles.detailItemFull}`}>
                    <span className={styles.detailLabel}>Description & Notes</span>
                    <span className={styles.detailValue} style={{ fontWeight: 'normal', color: '#cbd5e1' }}>
                      {viewRecord.notes}
                    </span>
                  </div>

                  {viewRecord.extra && Object.keys(viewRecord.extra).map((k) => (
                    <div key={k} className={styles.detailItem}>
                      <span className={styles.detailLabel}>{k.replace(/_/g, ' ')}</span>
                      <span className={styles.detailValue}>
                        {typeof viewRecord.extra[k] === 'number' && k.includes('amount') ? fmtN(viewRecord.extra[k]) : String(viewRecord.extra[k] || '—')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setViewRecord(null)}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Official Printable Member Passbook Statement Modal ── */}
      <AnimatePresence>
        {statementModalData && (
          <div className={styles.modalBackdrop}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className={`${styles.modalContent} ${styles.statementModal}`}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <Printer size={18} className="text-emerald-400" />
                  Official Cooperative Passbook Statement: {statementModalData.staff.name}
                </h3>
                <button type="button" className={styles.btnCloseModal} onClick={() => setStatementModalData(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.statementPaper}>
                  <div className={styles.stmtHeader}>
                    <div className={styles.stmtOrg}>ISALU HOSPITALS LIMITED</div>
                    <div className={styles.stmtCoop}>STAFF COOPERATIVE MULTIPURPOSE SOCIETY</div>
                    <div className={styles.stmtBadge}>MEMBER OFFICIAL COOPERATIVE STATEMENT & PASSBOOK</div>
                  </div>

                  <div className={styles.stmtMetaGrid}>
                    <div><strong>Member Name:</strong><br />{statementModalData.staff.name}</div>
                    <div><strong>Staff ID:</strong><br />#{statementModalData.staff.staffId}</div>
                    <div><strong>Department:</strong><br />{statementModalData.staff.department || 'General'}</div>
                    <div><strong>Monthly Savings Target:</strong><br />{fmtN(statementModalData.staff.monthly_saving)} / mo</div>
                    <div><strong>Active Loan Repayment:</strong><br />{fmtN(statementModalData.staff.loan_monthly_deduction)} / mo</div>
                    <div><strong>Printed On:</strong><br />{fmtDate(statementModalData.printed_at)}</div>
                  </div>

                  <div className={styles.stmtBalanceBox}>
                    <div className={styles.stmtBalItem}>
                      <div className={styles.stmtBalLabel}>Total Savings Contributed</div>
                      <div className={styles.stmtBalVal}>{fmtN(statementModalData.total_credited)}</div>
                    </div>
                    <div className={styles.stmtBalItem}>
                      <div className={styles.stmtBalLabel}>Total Withdrawn</div>
                      <div className={styles.stmtBalVal} style={{ color: '#dc2626' }}>-{fmtN(statementModalData.total_debited)}</div>
                    </div>
                    <div className={`${styles.stmtBalItem} ${styles.stmtBalItemPrimary}`}>
                      <div className={styles.stmtBalLabel}>Net Savings Balance</div>
                      <div className={styles.stmtBalVal}>{fmtN(statementModalData.closing_balance)}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '11px', color: '#0f172a' }}>
                    COOPERATIVE SAVINGS & ACTIVITY TRANSACTIONS
                  </div>
                  <table className={styles.stmtTable}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Description</th>
                        <th className="text-right">Credit (+)</th>
                        <th className="text-right">Debit (-)</th>
                        <th className="text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementModalData.transactions.length === 0 ? (
                        <tr><td colSpan="6" className="text-center py-4 text-slate-500">No cooperative savings transactions recorded.</td></tr>
                      ) : (
                        statementModalData.transactions.map((t, idx) => (
                          <tr key={idx}>
                            <td>{fmtDate(t.date)}</td>
                            <td style={{ fontFamily: 'monospace' }}>{t.reference}</td>
                            <td>{t.description}</td>
                            <td className="text-right" style={{ color: '#059669', fontWeight: 700 }}>
                              {t.credit > 0 ? fmtN(t.credit) : '—'}
                            </td>
                            <td className="text-right" style={{ color: '#dc2626', fontWeight: 700 }}>
                              {t.debit > 0 ? '-' + fmtN(t.debit) : '—'}
                            </td>
                            <td className="text-right" style={{ fontWeight: 800 }}>{fmtN(t.balance)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {statementModalData.loan_transactions.length > 0 && (
                    <>
                      <div style={{ marginTop: '14px', marginBottom: '8px', fontWeight: 'bold', fontSize: '11px', color: '#0f172a' }}>
                        COOPERATIVE LOAN REPAYMENT DEDUCTIONS (Total Repaid: {fmtN(statementModalData.total_loan_repaid)})
                      </div>
                      <table className={styles.stmtTable}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Reference</th>
                            <th>Description</th>
                            <th className="text-right">Repayment Deducted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statementModalData.loan_transactions.map((lr, idx) => (
                            <tr key={idx}>
                              <td>{fmtDate(lr.date)}</td>
                              <td style={{ fontFamily: 'monospace' }}>{lr.reference}</td>
                              <td>{lr.description}</td>
                              <td className="text-right" style={{ color: '#2563eb', fontWeight: 700 }}>
                                {fmtN(lr.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  <div className={styles.stmtSignatures}>
                    <div>
                      <div className={styles.stmtSigName}>{statementModalData.staff.name}</div>
                      <div className={styles.stmtSigLine}>Member Signature</div>
                    </div>
                    <div>
                      <div className={styles.stmtSigName}>HR Head</div>
                      <div className={styles.stmtSigLine}>HR Head Certified</div>
                    </div>
                    <div>
                      <div className={styles.stmtSigName}>Finance Officer</div>
                      <div className={styles.stmtSigLine}>Finance Verified</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setStatementModalData(null)}>
                  Close
                </button>
                <button type="button" className={styles.btnPrimary} onClick={handlePrintStatement}>
                  <Printer size={16} /> Print Official Document
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
