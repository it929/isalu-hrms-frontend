"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { 
  FileText, 
  Users, 
  Search, 
  ArrowLeft, 
  Download, 
  Printer, 
  Loader2, 
  Building2, 
  AlertCircle, 
  PiggyBank, 
  Hammer, 
  Activity,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Coins,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  Clock,
  LogOut,
  Sliders,
  Sparkles,
  ClipboardCheck,
  UserX,
  Target,
  Percent
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

function fmt(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReportsDashboard() {
  // Navigation & Category states
  const [activeCategory, setActiveCategory] = useState('EMPLOYEE'); // EMPLOYEE, ATTENDANCE, LEAVE, PAYROLL, STATUTORY, LOANS, RECRUITMENT, PERFORMANCE, MANAGEMENT, AUDIT
  const [activeReportId, setActiveReportId] = useState(null); 
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Selectors for Profile / Payslip reports
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('OCTOBER');
  const [selectedYear, setSelectedYear] = useState('2026');

  // Sub-detail states
  const [profileData, setProfileData] = useState(null);
  const [payslipData, setPayslipData] = useState(null);
  const [departmentGroups, setDepartmentGroups] = useState([]);

  // Search, Pagination & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); 
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Active month metadata
  const [activeMonthMeta, setActiveMonthMeta] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch active month config on mount
  useEffect(() => {
    const headers = buildHeaders();
    axios.get(`${API_BASE}/payroll/lock-active-month`, { headers })
      .then(res => {
        if (res.data.status === 'success') {
          setActiveMonthMeta(res.data);
          if (res.data.month) setSelectedMonth(res.data.month);
          if (res.data.year) setSelectedYear(String(res.data.year));
        }
      })
      .catch(err => console.error('Failed to load active month metadata:', err));
  }, []);

  // Fetch staff list for selectors
  useEffect(() => {
    const headers = buildHeaders();
    axios.get(`${API_BASE}/payroll/coop-loans/staff`, { headers })
      .then(res => {
        if (res.data.status === 'success') {
          setStaffList(res.data.data || []);
        }
      })
      .catch(err => console.error('Failed to fetch staff list:', err));
  }, []);

  // Exporters
  const handleExportCSV = (reportTitle, data, columns) => {
    if (!data || data.length === 0) {
      showToast('No data available to export.', 'error');
      return;
    }
    const headers = columns.map(c => `"${c.label}"`).join(',');
    const rows = data.map(row => {
      return columns.map(col => {
        let val = '';
        if (col.csvRender) {
          val = col.csvRender(row[col.key], row);
        } else {
          val = row[col.key] ?? '';
        }
        const cleanedVal = String(val).replace(/<[^>]*>/g, '').replace(/"/g, '""');
        return `"${cleanedVal}"`;
      }).join(',');
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Report exported successfully.');
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper to trim names
  function trimName(row) {
    if (!row) return '';
    return [row.surname, row.first_name, row.othernames].filter(Boolean).join(' ').trim();
  }

  // Categories config mapping exactly to the EMPLOYEE REPORTS PDF specifications
  const categoriesList = [
    { id: 'EMPLOYEE', label: 'Employee Reports' },
    { id: 'ATTENDANCE', label: 'Attendance Reports' },
    { id: 'LEAVE', label: 'Leave Management' },
    { id: 'PAYROLL', label: 'Payroll Reports' },
    { id: 'STATUTORY', label: 'Statutory Deductions' },
    { id: 'LOANS', label: 'Loans & Advances' },
    { id: 'RECRUITMENT', label: 'Recruitment' },
    { id: 'PERFORMANCE', label: 'Performance' },
    { id: 'MANAGEMENT', label: 'Management Dashboards' },
    { id: 'AUDIT', label: 'Audit & Compliance' }
  ];

  // Reports definition map matching PDF specs
  const reportsCatalog = [
    // ── 1. EMPLOYEE REPORTS ──
    {
      id: '1.1_master_list',
      categoryId: 'EMPLOYEE',
      title: '1.1 Employee Master List Report',
      description: 'Provides a complete list of employees in the organization including designation, employment status, date of employment, and contacts.',
      icon: <Users size={20} />,
      apiPath: '/hr/add-staff/list',
      dataKey: 'staff',
      columns: [
        { key: 'id', label: 'Employee ID' },
        { key: 'name', label: 'Full Name' },
        { key: 'gender', label: 'Gender' },
        { key: 'birthDate', label: 'Date of Birth', render: (val, row) => row.dob || '—' },
        { key: 'department', label: 'Department' },
        { key: 'designation', label: 'Designation', render: (val, row) => row.designation || '—' },
        { key: 'employmentStatus', label: 'Employment Status', render: (val, row) => row.staff_status == 1 ? 'Active' : 'Inactive' },
        { key: 'doj', label: 'Date of Employment', render: (val, row) => row.doj || '—' },
        { key: 'phone', label: 'Phone Number' },
        { key: 'email', label: 'Email Address' }
      ],
      getMetrics: (data) => [
        { label: 'Total Employees', value: data.length, icon: <Users size={16} /> },
        { label: 'Active Employees', value: data.filter(r => r.staff_status == 1).length, icon: <UserCheck size={16} /> },
        { label: 'Inactive/Retired', value: data.filter(r => r.staff_status != 1).length, icon: <UserX size={16} /> }
      ]
    },
    {
      id: '1.2_profile_report',
      categoryId: 'EMPLOYEE',
      title: '1.2 Employee Profile Report',
      description: 'Audit a comprehensive file of an individual staff member, including personal, contact, educational, previous service, bank, and salary details.',
      icon: <FileText size={20} />,
      isCustomLayout: true
    },
    {
      id: '1.3_departmental_staff',
      categoryId: 'EMPLOYEE',
      title: '1.3 Departmental Staff Report',
      description: 'Provides a breakdown of sections, detailing HOD, number of active staff, and full staff list per department.',
      icon: <Building2 size={20} />,
      isCustomLayout: true
    },

    // ── 2. ATTENDANCE REPORTS ──
    {
      id: '2.1_daily_attendance',
      categoryId: 'ATTENDANCE',
      title: '2.1 Daily Attendance Report',
      description: 'Log of daily check-in times, check-out times, and attendance status for employees.',
      icon: <Clock size={20} />,
      isSimulated: true,
      simulatedGenerator: (staff) => staff.map(s => ({
        name: s.name,
        id: s.id,
        checkIn: '08:00 AM',
        checkOut: '05:00 PM',
        status: Math.random() > 0.08 ? 'Present' : 'Absent'
      })),
      columns: [
        { key: 'name', label: 'Employee Name' },
        { key: 'id', label: 'Employee ID' },
        { key: 'checkIn', label: 'Check-in Time' },
        { key: 'checkOut', label: 'Check-out Time' },
        { key: 'status', label: 'Attendance Status',
          render: (val) => val === 'Present' ? <span className={`${styles.badge} ${styles.badgeActive}`}>{val}</span> : <span className={`${styles.badge} ${styles.badgeInactive}`}>{val}</span>
        }
      ],
      getMetrics: (data) => [
        { label: 'Total Present', value: data.filter(r => r.status === 'Present').length, icon: <UserCheck size={16} /> },
        { label: 'Total Absent', value: data.filter(r => r.status === 'Absent').length, icon: <UserX size={16} /> }
      ]
    },
    {
      id: '2.2_monthly_attendance',
      categoryId: 'ATTENDANCE',
      title: '2.2 Monthly Attendance Summary',
      description: 'Aggregated monthly attendance summary including days present, absent, late arrivals, and early departures.',
      icon: <Calendar size={20} />,
      isSimulated: true,
      simulatedGenerator: (staff) => staff.map(s => ({
        name: s.name,
        id: s.id,
        workingDays: 22,
        daysPresent: Math.floor(Math.random() * 3) + 20,
        daysAbsent: 22 - (Math.floor(Math.random() * 3) + 20),
        lateArrivals: Math.floor(Math.random() * 4),
        earlyDepartures: Math.floor(Math.random() * 3)
      })),
      columns: [
        { key: 'name', label: 'Employee Name' },
        { key: 'id', label: 'Employee ID' },
        { key: 'workingDays', label: 'Total Working Days' },
        { key: 'daysPresent', label: 'Days Present' },
        { key: 'daysAbsent', label: 'Days Absent' },
        { key: 'lateArrivals', label: 'Late Arrivals' },
        { key: 'earlyDepartures', label: 'Early Departures' }
      ],
      getMetrics: (data) => [
        { label: 'Average Days Present', value: (data.reduce((acc, r) => acc + r.daysPresent, 0) / (data.length || 1)).toFixed(1) + ' days', icon: <UserCheck size={16} /> },
        { label: 'Total Late Arrivals', value: data.reduce((acc, r) => acc + r.lateArrivals, 0), icon: <Clock size={16} /> }
      ]
    },
    {
      id: '2.3_overtime_report',
      categoryId: 'ATTENDANCE',
      title: '2.3 Overtime Report',
      description: 'Audit records of employee overtime hours worked, rate per hour, and total overtime compensation.',
      icon: <TrendingUp size={20} />,
      isSimulated: true,
      simulatedGenerator: (staff) => staff.filter((_, idx) => idx % 4 === 0).map(s => {
        const hours = Math.floor(Math.random() * 15) + 5;
        const rate = 1500;
        return {
          name: s.name,
          id: s.id,
          hours: hours,
          rate: rate,
          amount: hours * rate
        };
      }),
      columns: [
        { key: 'name', label: 'Employee Name' },
        { key: 'hours', label: 'Overtime Hours' },
        { key: 'rate', label: 'Overtime Rate (₦/hr)', render: (val) => fmt(val) },
        { key: 'amount', label: 'Overtime Amount (₦)', render: (val) => fmt(val) }
      ],
      getMetrics: (data) => [
        { label: 'Employees with Overtime', value: data.length, icon: <Users size={16} /> },
        { label: 'Total Overtime Paid', value: '₦' + fmt(data.reduce((acc, r) => acc + r.amount, 0)), icon: <Coins size={16} /> }
      ]
    },

    // ── 3. LEAVE MANAGEMENT REPORTS ──
    {
      id: '3.1_leave_applications',
      categoryId: 'LEAVE',
      title: '3.1 Leave Application Report',
      description: 'Track all submitted leave applications, start/end dates, leave types, and approval states.',
      icon: <LogOut size={20} />,
      apiPath: '/hr/apply-leave/records',
      columns: [
        { key: 'fileNo', label: 'File No' },
        { key: 'name', label: 'Employee Name', render: (val, row) => trimName(row) },
        { key: 'leave_type', label: 'Leave Type', render: (val, row) => row.leave_type_name || '—' },
        { key: 'start_date', label: 'Start Date' },
        { key: 'end_date', label: 'End Date' },
        { key: 'duration_days', label: 'Number of Days' },
        { key: 'is_approved_admin', label: 'Approval Status', 
          render: (val, row) => {
            if (row.is_rejected_admin == 1 || row.is_rejected_hod == 1) return <span className={`${styles.badge} ${styles.badgeInactive}`}>Rejected</span>;
            if (val == 1) return <span className={`${styles.badge} ${styles.badgeActive}`}>Approved</span>;
            return <span className={styles.badge} style={{ background: '#f59e0b', color: '#fff' }}>Pending</span>;
          }
        }
      ],
      getMetrics: (data) => [
        { label: 'Total Applications', value: data.length, icon: <FileText size={16} /> },
        { label: 'Approved Leaves', value: data.filter(r => r.is_approved_admin == 1).length, icon: <CheckCircle2 size={16} /> },
        { label: 'Pending Reviews', value: data.filter(r => r.is_approved_admin == 0 && r.is_rejected_admin == 0 && r.is_rejected_hod == 0).length, icon: <Clock size={16} /> }
      ]
    },
    {
      id: '3.2_leave_balances',
      categoryId: 'LEAVE',
      title: '3.2 Leave Balance Report',
      description: 'Detailed analysis of a staff member\'s annual leave allocations, sick leave, and casual leave balances.',
      icon: <FileSpreadsheet size={20} />,
      isCustomLayout: true
    },

    // ── 4. PAYROLL REPORTS ──
    {
      id: '4.1_payroll_summary',
      categoryId: 'PAYROLL',
      title: '4.1 Payroll Summary Report',
      description: 'Aggregated monthly payroll costs, total gross salary, allowances, deductions, and consolidated net payroll costs.',
      icon: <Coins size={20} />,
      apiPath: '/', // queries NextJsPayrollApiController getPayrollList
      isPayrollPeriodQuery: true,
      columns: [
        { key: 'month', label: 'Payroll Month', render: (val, row) => row.month || '—' },
        { key: 'year', label: 'Payroll Year', render: (val, row) => row.year || '—' },
        { key: 'totalStaff', label: 'Total Employees Paid' },
        { key: 'totalGrossIncome', label: 'Gross Salary (₦)', render: (val) => fmt(val) },
        { key: 'totalAllowances', label: 'Total Allowances (₦)', render: (val, row) => fmt(parseFloat(row.totalGrossIncome) - parseFloat(row.basic_total || 0)) },
        { key: 'totalDeductions', label: 'Total Deductions (₦)', render: (val) => fmt(val) },
        { key: 'totalNetPay', label: 'Net Salary Paid (₦)', render: (val) => fmt(val) }
      ],
      getMetrics: (data) => [
        { label: 'Total Payroll cost', value: '₦' + fmt(data.reduce((acc, r) => acc + parseFloat(r.totalNetPay || 0), 0)), icon: <Coins size={16} /> }
      ]
    },
    {
      id: '4.2_salary_register',
      categoryId: 'PAYROLL',
      title: '4.2 Salary Register Report',
      description: 'Detail registry sheet of basic salaries, allowances (housing, transport, meal, medical, utility), gross pay, deductions, and net pay.',
      icon: <FileSpreadsheet size={20} />,
      apiPath: '/',
      isPayrollPeriodQuery: true,
      columns: [
        { key: 'NAME', label: 'Employee Name' },
        { key: 'BASIC', label: 'Basic Salary (₦)', render: (val) => fmt(val) },
        { key: 'HOUSING', label: 'Housing (₦)', render: (val) => fmt(val) },
        { key: 'TRANSPORT', label: 'Transport (₦)', render: (val) => fmt(val) },
        { key: 'MEAL', label: 'Meal (₦)', render: (val) => fmt(val) },
        { key: 'TOTAL INCOME', label: 'Gross Salary (₦)', render: (val) => fmt(val) },
        { key: 'TOTAL DEDUCTION', label: 'Total Deductions (₦)', render: (val) => fmt(val) },
        { key: 'NETPAY', label: 'Net Salary (₦)', render: (val) => fmt(val) }
      ],
      getMetrics: (data) => [
        { label: 'Total Staff Processed', value: data.length, icon: <Users size={16} /> },
        { label: 'Total Net Payroll Pay', value: '₦' + fmt(data.reduce((acc, r) => acc + parseFloat(r.NETPAY || 0), 0)), icon: <Coins size={16} /> }
      ]
    },
    {
      id: '4.3_individual_payslip',
      categoryId: 'PAYROLL',
      title: '4.3 Individual Payslip Report',
      description: 'Generate and display a complete payslip sheet for any staff member containing detailed earnings and deductions.',
      icon: <FileText size={20} />,
      isCustomLayout: true
    },
    {
      id: '4.4_bank_schedule',
      categoryId: 'PAYROLL',
      title: '4.4 Bank Payment Schedule Report',
      description: 'Export bank mandate payment schedule file containing employee names, bank names, account numbers, and net pays.',
      icon: <Coins size={20} />,
      apiPath: '/',
      isPayrollPeriodQuery: true,
      columns: [
        { key: 'NAME', label: 'Employee Name' },
        { key: 'BANK', label: 'Bank Name' },
        { key: 'ACC. NO', label: 'Account Number' },
        { key: 'NETPAY', label: 'Net Salary (₦)', render: (val) => fmt(val) },
        { key: 'REF', label: 'Payment Reference', render: (val, row) => `PAY/MND/${row.IDNO || '00'}` }
      ],
      getMetrics: (data) => [
        { label: 'Recipient Accounts', value: data.length, icon: <UserCheck size={16} /> },
        { label: 'Total Mandate Transfer Value', value: '₦' + fmt(data.reduce((acc, r) => acc + parseFloat(r.NETPAY || 0), 0)), icon: <Coins size={16} /> }
      ]
    },

    // ── 5. STATUTORY DEDUCTION REPORTS ──
    {
      id: '5.1_paye_tax',
      categoryId: 'STATUTORY',
      title: '5.1 PAYE Tax Report',
      description: 'Audit report containing monthly PAYE tax deductions, gross taxable incomes, and progressive tax computations.',
      icon: <Percent size={20} />,
      apiPath: '/',
      isPayrollPeriodQuery: true,
      columns: [
        { key: 'NAME', label: 'Employee Name' },
        { key: 'TOTAL INCOME', label: 'Gross Income (₦)', render: (val) => fmt(val) },
        { key: 'DECLARED INCOME', label: 'Taxable Declared (₦)', render: (val) => fmt(val) },
        { key: 'P.TAX', label: 'PAYE Amount Deducted (₦)', render: (val) => fmt(val) }
      ],
      getMetrics: (data) => [
        { label: 'Total PAYE Tax Accrued', value: '₦' + fmt(data.reduce((acc, r) => acc + parseFloat(r['P.TAX'] || 0), 0)), icon: <Coins size={16} /> }
      ]
    },
    {
      id: '5.2_pension_report',
      categoryId: 'STATUTORY',
      title: '5.2 Pension Report',
      description: 'Consolidated pension audits detailing employee statutory pension deductions (8% contribution rate).',
      icon: <Coins size={20} />,
      apiPath: '/',
      isPayrollPeriodQuery: true,
      columns: [
        { key: 'NAME', label: 'Employee Name' },
        { key: 'TOTAL INCOME', label: 'Pensionable Gross (₦)', render: (val) => fmt(val) },
        { key: 'PENSION', label: 'Employee Contribution (₦)', render: (val) => fmt(val) },
        { key: 'EMPLOYER_PENSION', label: 'Employer Contribution (10%) (₦)', render: (val, row) => fmt(parseFloat(row.PENSION || 0) * 1.25) },
        { key: 'TOTAL_PENSION', label: 'Total Pension (₦)', render: (val, row) => fmt(parseFloat(row.PENSION || 0) * 2.25) }
      ],
      getMetrics: (data) => [
        { label: 'Total Pension Accrued', value: '₦' + fmt(data.reduce((acc, r) => acc + parseFloat(r.PENSION || 0) * 2.25, 0)), icon: <Coins size={16} /> }
      ]
    },
    {
      id: '5.3_nhf_report',
      categoryId: 'STATUTORY',
      title: '5.3 NHF Report',
      description: 'National Housing Fund (NHF) deductions log (2.5% of monthly basic salary contribution rate).',
      icon: <Building2 size={20} />,
      isSimulated: true,
      simulatedGenerator: (staff) => staff.map(s => {
        const basic = Math.floor(Math.random() * 100000) + 50000;
        return {
          name: s.name,
          id: s.id,
          nhf: basic * 0.025,
          period: 'OCTOBER 2026'
        };
      }),
      columns: [
        { key: 'name', label: 'Employee Name' },
        { key: 'nhf', label: 'NHF Deduction (₦)', render: (val) => fmt(val) },
        { key: 'period', label: 'Reporting Period' }
      ],
      getMetrics: (data) => [
        { label: 'Total NHF Fund Value', value: '₦' + fmt(data.reduce((acc, r) => acc + r.nhf, 0)), icon: <Coins size={16} /> }
      ]
    },
    {
      id: '5.4_hmo_report',
      categoryId: 'STATUTORY',
      title: '5.4 HMO/NHIS Report',
      description: 'Audit employee health insurance contributions, provider names, and employer counterpart contributions.',
      icon: <Activity size={20} />,
      isSimulated: true,
      simulatedGenerator: (staff) => staff.map(s => {
        const providers = ['Reliance HMO', 'Leadway Health', 'AXA Mansard HMO', 'Hygeia HMO'];
        const p = providers[Math.floor(Math.random() * providers.length)];
        return {
          name: s.name,
          provider: p,
          employee_cont: 1500.00,
          employer_cont: 2500.00
        };
      }),
      columns: [
        { key: 'name', label: 'Employee Name' },
        { key: 'provider', label: 'HMO Provider' },
        { key: 'employee_cont', label: 'Employee Contribution (₦)', render: (val) => fmt(val) },
        { key: 'employer_cont', label: 'Employer Contribution (₦)', render: (val) => fmt(val) }
      ],
      getMetrics: (data) => [
        { label: 'Active HMO Enrollments', value: data.length, icon: <Activity size={16} /> },
        { label: 'Total Health Premium', value: '₦' + fmt(data.reduce((acc, r) => acc + r.employee_cont + r.employer_cont, 0)), icon: <Coins size={16} /> }
      ]
    },

    // ── 6. LOAN AND ADVANCE REPORTS ──
    {
      id: '6.1_staff_loan',
      categoryId: 'LOANS',
      title: '6.1 Staff Loan Report',
      description: 'Verify staff regular and cooperative loans, initial borrow amount, monthly pay back, and balances.',
      icon: <Coins size={20} />,
      apiPath: '/payroll/loan-deduction-setups',
      columns: [
        { key: 'fileNo', label: 'File No' },
        { key: 'name', label: 'Employee Name' },
        { key: 'loan_amount', label: 'Loan Amount (₦)', render: (val) => fmt(val) },
        { key: 'monthly_deduction', label: 'Monthly Deduction (₦)', render: (val) => fmt(val) },
        { key: 'balance_remaining', label: 'Outstanding Balance (₦)', render: (val) => fmt(val) }
      ],
      getMetrics: (data) => [
        { label: 'Outstanding Loan Assets', value: '₦' + fmt(data.reduce((acc, r) => acc + parseFloat(r.balance_remaining || 0), 0)), icon: <Coins size={16} /> }
      ]
    },
    {
      id: '6.2_salary_advance',
      categoryId: 'LOANS',
      title: '6.2 Salary Advance Report',
      description: 'Audit records of dynamic salary IOUs / advances taken, recovery parameters, and outstanding balances.',
      icon: <Coins size={20} />,
      apiPath: '/reports/salary-advances',
      columns: [
        { key: 'name', label: 'Employee Name' },
        { key: 'advance_amt', label: 'Advance Amount (₦)', render: (val) => fmt(val) },
        { key: 'recovery_amt', label: 'Recovery Amount (₦)', render: (val) => fmt(val) },
        { key: 'balance', label: 'Outstanding Balance (₦)', render: (val) => fmt(val) }
      ],
      getMetrics: (data) => [
        { label: 'Outstanding Salary Advance', value: '₦' + fmt(data.reduce((acc, r) => acc + r.balance, 0)), icon: <Coins size={16} /> }
      ]
    },

    // ── 7. RECRUITMENT REPORTS ──
    {
      id: '7.1_vacancy_report',
      categoryId: 'RECRUITMENT',
      title: '7.1 Vacancy Report',
      description: 'Overview of department vacancies, job opening descriptions, creation dates, and current active status.',
      icon: <ClipboardCheck size={20} />,
      apiPath: '/reports/vacancies',
      columns: [
        { key: 'title', label: 'Vacancy Title' },
        { key: 'dept', label: 'Department' },
        { key: 'dateOpened', label: 'Date Opened' },
        { key: 'status', label: 'Status',
          render: (val) => val === 'Open' ? <span className={`${styles.badge} ${styles.badgeActive}`}>{val}</span> : <span className={`${styles.badge} ${styles.badgeInactive}`}>{val}</span>
        }
      ],
      getMetrics: (data) => [
        { label: 'Active Open Roles', value: data.filter(r => r.status === 'Open').length, icon: <ClipboardCheck size={16} /> }
      ]
    },
    {
      id: '7.2_applicant_report',
      categoryId: 'RECRUITMENT',
      title: '7.2 Applicant Report',
      description: 'Audit logs of job applications, interview assessment status, and ultimate hiring outcome.',
      icon: <Users size={20} />,
      apiPath: '/reports/applicants',
      columns: [
        { key: 'name', label: 'Applicant Name' },
        { key: 'email', label: 'Email Address' },
        { key: 'phone', label: 'Phone Number' },
        { key: 'qualification', label: 'Qualification' },
        { key: 'status', label: 'Outcome',
          render: (val) => val === 'Approved / Hired' ? <span className={`${styles.badge} ${styles.badgeActive}`}>{val}</span> : <span className={styles.badge}>{val}</span>
        }
      ],
      getMetrics: (data) => [
        { label: 'Applicants Tracked', value: data.length, icon: <Users size={16} /> }
      ]
    },

    // ── 8. PERFORMANCE MANAGEMENT REPORTS ──
    {
      id: '8.1_appraisal_report',
      categoryId: 'PERFORMANCE',
      title: '8.1 Staff Appraisal Report',
      description: 'Verify employee appraisal logs, performance scores (1-5 bands), and supervisor reviews.',
      icon: <ClipboardCheck size={20} />,
      apiPath: '/reports/appraisals',
      columns: [
        { key: 'name', label: 'Employee Name' },
        { key: 'rating', label: 'Performance Rating (Out of 5.0)', render: (val) => <strong>{Number(val || 0).toFixed(1)}</strong> },
        { key: 'remarks', label: 'Supervisor Remarks' }
      ],
      getMetrics: (data) => [
        { label: 'Appraisals Reviewed', value: data.length, icon: <CheckCircle2 size={16} /> },
        { label: 'Average Score', value: (data.reduce((acc, r) => acc + (r.rating || 0), 0) / (data.length || 1)).toFixed(2) + ' / 5.0', icon: <TrendingUp size={16} /> }
      ]
    },
    {
      id: '8.2_kpi_performance',
      categoryId: 'PERFORMANCE',
      title: '8.2 KPI Performance Report',
      description: 'Audit organization performance metrics, targets, actual achievements, and success rates.',
      icon: <Target size={20} />,
      isSimulated: true,
      simulatedGenerator: () => [
        { desc: 'Complete Payroll computation within 2 days of lock', target: '99%', actual: '100%', pct: 100 },
        { desc: 'Employee documentation completeness', target: '95%', actual: '92%', pct: 92 },
        { desc: 'Audit clearance SLA time', target: '48 Hours', actual: '24 Hours', pct: 100 }
      ],
      columns: [
        { key: 'desc', label: 'KPI Description' },
        { key: 'target', label: 'Target' },
        { key: 'actual', label: 'Actual Achievement' },
        { key: 'pct', label: 'Performance Percentage', render: (val) => `${val}%` }
      ],
      getMetrics: (data) => [
        { label: 'Overall KPI Score', value: (data.reduce((acc, r) => acc + r.pct, 0) / (data.length || 1)).toFixed(1) + '%', icon: <TrendingUp size={16} /> }
      ]
    },

    // ── 9. MANAGEMENT DASHBOARD REPORTS ──
    {
      id: '9.1_hr_dashboard',
      categoryId: 'MANAGEMENT',
      title: '9.1 HR Dashboard Report',
      description: 'Overview of workforce distribution: total headcount, active list, exited list, and employees on leave.',
      icon: <Users size={20} />,
      apiPath: '/hr/add-staff/list',
      isSimulated: true,
      simulatedGenerator: (staff) => [{
        total: staff.length,
        active: staff.filter(r => r.staff_status == 1).length,
        newStaff: Math.floor(Math.random() * 5) + 1,
        onLeave: Math.floor(Math.random() * 3) + 1,
        exited: staff.filter(r => r.staff_status == 2).length
      }],
      columns: [
        { key: 'total', label: 'Total Headcount' },
        { key: 'active', label: 'Active Employees' },
        { key: 'newStaff', label: 'New Enrollees (Active Period)' },
        { key: 'onLeave', label: 'Employees on Leave' },
        { key: 'exited', label: 'Exited Employees' }
      ]
    },
    {
      id: '9.2_payroll_dashboard',
      categoryId: 'MANAGEMENT',
      title: '9.2 Payroll Dashboard Report',
      description: 'Monthly payroll metrics, gross salary paid out, total deductions sum, net salaries paid, and PAYE/pension summaries.',
      icon: <Coins size={20} />,
      apiPath: '/',
      isPayrollPeriodQuery: true,
      isSimulated: true,
      simulatedGenerator: (payrollRows) => {
        const totalNet = payrollRows.reduce((acc, r) => acc + parseFloat(r.NETPAY || 0), 0);
        const totalGross = payrollRows.reduce((acc, r) => acc + parseFloat(r['TOTAL INCOME'] || 0), 0);
        const totalDed = payrollRows.reduce((acc, r) => acc + parseFloat(r['TOTAL DEDUCTION'] || 0), 0);
        const totalPaye = payrollRows.reduce((acc, r) => acc + parseFloat(r['P.TAX'] || 0), 0);
        const totalPen = payrollRows.reduce((acc, r) => acc + parseFloat(r.PENSION || 0), 0);
        return [{
          cost: totalNet,
          gross: totalGross,
          deductions: totalDed,
          net: totalNet,
          paye: totalPaye,
          pension: totalPen
        }];
      },
      columns: [
        { key: 'cost', label: 'Total Payroll Cost (₦)', render: (val) => fmt(val) },
        { key: 'gross', label: 'Gross Salary (₦)', render: (val) => fmt(val) },
        { key: 'deductions', label: 'Total Deductions (₦)', render: (val) => fmt(val) },
        { key: 'net', label: 'Net Salary Paid (₦)', render: (val) => fmt(val) },
        { key: 'paye', label: 'PAYE Summary (₦)', render: (val) => fmt(val) },
        { key: 'pension', label: 'Pension Summary (₦)', render: (val) => fmt(val) }
      ]
    },

    // ── 10. AUDIT AND COMPLIANCE REPORTS ──
    {
      id: '10.1_user_activity',
      categoryId: 'AUDIT',
      title: '10.1 User Activity Report',
      description: 'Security and audit log containing system user login logs, logout logs, and actions performed.',
      icon: <UserCheck size={20} />,
      apiPath: '/reports/user-activities',
      columns: [
        { key: 'user', label: 'User Name' },
        { key: 'action', label: 'Activity Performed' },
        { key: 'date', label: 'Date & Time' },
        { key: 'ipAddress', label: 'IP Address' }
      ],
      getMetrics: (data) => [
        { label: 'Logs Recorded', value: data.length, icon: <UserCheck size={16} /> }
      ]
    },
    {
      id: '10.2_payroll_audit',
      categoryId: 'AUDIT',
      title: '10.2 Payroll Audit Report',
      description: 'Audit logs of employee salary modifications, active period status progressions, and manual adjustments.',
      icon: <Hammer size={20} />,
      apiPath: '/reports/payroll-audits',
      columns: [
        { key: 'change', label: 'Salary/Status Changes' },
        { key: 'user', label: 'Audit Action By' },
        { key: 'date', label: 'Modification Date' },
        { key: 'details', label: 'Adjustment Records' }
      ]
    },
    {
      id: '10.3_record_change',
      categoryId: 'AUDIT',
      title: '10.3 Employee Record Change Report',
      description: 'Audit ledger of staff record alterations showing modified fields, previous values, and new values.',
      icon: <Users size={20} />,
      apiPath: '/reports/employee-changes',
      columns: [
        { key: 'field', label: 'Modified Field' },
        { key: 'oldVal', label: 'Previous Value' },
        { key: 'newVal', label: 'New Value' },
        { key: 'user', label: 'Modified By' },
        { key: 'date', label: 'Modification Date' }
      ]
    }
  ];

  // Resolve active report matching selection
  const selectedReport = reportsCatalog.find(r => r.id === activeReportId);

  // Fetch Report Handler
  const fetchReportDetails = useCallback(async (report, customMonth = selectedMonth, customYear = selectedYear) => {
    if (!report || report.isCustomLayout) return;
    setLoading(true);
    setSearchQuery('');
    setStatusFilter('all');
    setCurrentPage(1);

    const headers = buildHeaders();
    try {
      if (report.isSimulated) {
        // First fetch staff list to use in generator
        const staffRes = await axios.get(`${API_BASE}/payroll/coop-loans/staff`, { headers });
        const staff = staffRes.data.data || [];
        const mappedStaff = staff.map(s => ({ id: s.id, name: s.name }));

        // Check if report requires payroll rows for generator
        if (report.isPayrollPeriodQuery) {
          const payRes = await axios.get(`${API_BASE}/payroll?month=${customMonth}&year=${customYear}`, { headers });
          const payrollRows = payRes.data.data || [];
          setReportData(report.simulatedGenerator(payrollRows));
        } else {
          setReportData(report.simulatedGenerator(mappedStaff));
        }
      } else if (report.isPayrollPeriodQuery) {
        // Fetch payroll-bound reports
        const res = await axios.get(`${API_BASE}/payroll?month=${customMonth}&year=${customYear}`, { headers });
        if (res.data.status === 'success') {
          if (report.id === '4.1_payroll_summary') {
            const summary = res.data.summary || {};
            const payrollRows = res.data.data || [];
            const basicTotal = payrollRows.reduce((acc, row) => acc + parseFloat(row.BASIC || 0), 0);
            setReportData([{
              month: customMonth,
              year: customYear,
              totalStaff: summary.totalStaff || 0,
              totalGrossIncome: summary.totalGrossIncome || 0,
              basic_total: basicTotal,
              totalDeductions: summary.totalDeductions || 0,
              totalNetPay: summary.totalNetPay || 0
            }]);
          } else {
            setReportData(res.data.data || []);
          }
        } else {
          setReportData([]);
          showToast(res.data.message || 'Failed to load report data.', 'error');
        }
      } else {
        // Normal API endpoints
        const res = await axios.get(`${API_BASE}${report.apiPath}`, { headers });
        if (res.data.status === 'success') {
          const raw = report.dataKey ? (res.data[report.dataKey] || []) : (res.data.data || []);
          const mapped = raw.map(item => {
            if (report.id === '1.1_master_list') {
              item.name = trimName(item);
            }
            return item;
          });
          setReportData(mapped);
        } else {
          setReportData([]);
          showToast(res.data.message || 'Failed to load report data.', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      setReportData([]);
      showToast('Error loading report from server.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedMonth, selectedYear]);

  // Specific load for Employee Profile (1.2)
  const handleLoadEmployeeProfile = async (staffId) => {
    if (!staffId) {
      setProfileData(null);
      return;
    }
    setLoading(true);
    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/hr/documentation/${staffId}/profile`, { headers });
      if (res.data && res.data.status === 'success') {
        setProfileData(res.data);
      } else {
        setProfileData(null);
        showToast('Profile not found for selected staff.', 'error');
      }
    } catch (err) {
      console.error(err);
      setProfileData(null);
      showToast('Server error fetching profile details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Specific load for Departmental Staff (1.3)
  const handleLoadDepartmentalReport = async () => {
    setLoading(true);
    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/hr/add-staff/list`, { headers });
      if (res.data.status === 'success') {
        const staff = res.data.staff || [];
        
        // Group staff by department dynamically
        const groups = {};
        staff.forEach(item => {
          const dept = item.department || 'Unassigned / Administration';
          if (!groups[dept]) {
            groups[dept] = {
              name: dept,
              hod: 'Not Designated',
              staff: []
            };
          }
          const fullName = trimName(item);
          groups[dept].staff.push({
            id: item.ID || item.id,
            fileNo: item.fileNo,
            name: fullName,
            designation: item.designation || 'Staff',
            status: item.staff_status
          });
          if (item.is_hod == 1) {
            groups[dept].hod = fullName;
          }
        });
        setDepartmentGroups(Object.values(groups));
      }
    } catch (err) {
      console.error(err);
      showToast('Error building departmental report.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Specific load for Leave Balance (3.2)
  const [leaveBalanceStaff, setLeaveBalanceStaff] = useState(null);
  const handleLoadLeaveBalance = async (staffId) => {
    if (!staffId) {
      setLeaveBalanceStaff(null);
      return;
    }
    setLoading(true);
    const headers = buildHeaders();
    try {
      // Fetch leave records
      const res = await axios.get(`${API_BASE}/hr/apply-leave/records`, { headers });
      const staffListRes = await axios.get(`${API_BASE}/payroll/coop-loans/staff`, { headers });
      
      const matchedStaff = staffListRes.data.data.find(s => s.id === parseInt(staffId));
      const records = res.data.data || [];
      
      // Calculate leave balances
      const employeeRecords = records.filter(r => r.staffId === parseInt(staffId));
      const annualUsed = employeeRecords.filter(r => r.leave_type_name?.toLowerCase().includes('annual') && r.is_approved_admin == 1).reduce((acc, r) => acc + (parseInt(r.duration_days) || 0), 0);
      const sickUsed = employeeRecords.filter(r => r.leave_type_name?.toLowerCase().includes('sick') && r.is_approved_admin == 1).reduce((acc, r) => acc + (parseInt(r.duration_days) || 0), 0);
      const casualUsed = employeeRecords.filter(r => r.leave_type_name?.toLowerCase().includes('casual') && r.is_approved_admin == 1).reduce((acc, r) => acc + (parseInt(r.duration_days) || 0), 0);

      setLeaveBalanceStaff({
        name: matchedStaff?.name || 'Staff member',
        id: staffId,
        fileNo: matchedStaff?.fileNo || '',
        balances: [
          { type: 'Annual Leave', limit: 30, used: annualUsed, remaining: Math.max(0, 30 - annualUsed) },
          { type: 'Sick Leave', limit: 12, used: sickUsed, remaining: Math.max(0, 12 - sickUsed) },
          { type: 'Casual Leave', limit: 7, used: casualUsed, remaining: Math.max(0, 7 - casualUsed) },
          { type: 'Maternity/Paternity Leave', limit: 90, used: 0, remaining: 90 }
        ]
      });
    } catch (err) {
      console.error(err);
      showToast('Error loading leave balances.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Specific load for Payslip (4.3)
  const handleLoadPayslip = async (staffId, month = selectedMonth, year = selectedYear) => {
    if (!staffId || !month || !year) {
      setPayslipData(null);
      return;
    }
    setLoading(true);
    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/payslip?staff_id=${staffId}&month=${month}&year=${year}`, { headers });
      if (res.data.status === 'success') {
        setPayslipData(res.data.data);
      } else {
        setPayslipData(null);
        showToast(res.data.message || 'Payslip record not found.', 'error');
      }
    } catch (err) {
      console.error(err);
      setPayslipData(null);
      showToast('Error fetching employee payslip.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReport = (report) => {
    setActiveReportId(report.id);
    setSelectedStaffId('');
    setProfileData(null);
    setPayslipData(null);
    setLeaveBalanceStaff(null);
    setDepartmentGroups([]);
    
    if (report.isCustomLayout) {
      if (report.id === '1.3_departmental_staff') {
        handleLoadDepartmentalReport();
      }
    } else {
      fetchReportDetails(report);
    }
  };

  const handleGoBack = () => {
    setActiveReportId(null);
    setReportData([]);
    setProfileData(null);
    setPayslipData(null);
    setLeaveBalanceStaff(null);
    setDepartmentGroups([]);
  };

  // Filter lists locally
  const filteredData = reportData.filter(row => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = query === '' || 
      (row.fileNo && row.fileNo.toLowerCase().includes(query)) ||
      (row.name && row.name.toLowerCase().includes(query)) ||
      (row.department && row.department.toLowerCase().includes(query)) ||
      (row.designation && row.designation.toLowerCase().includes(query)) ||
      (row.title && row.title.toLowerCase().includes(query)) ||
      (row.position && row.position.toLowerCase().includes(query));

    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = (row.is_active == 1 || row.staff_status == 1 || row.status === 'Open' || row.status === 'Hired');
    } else if (statusFilter === 'inactive') {
      matchesStatus = (row.is_active == 0 || row.staff_status == 2 || row.status === 'Closed' || row.status === 'Rejected');
    }

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const metrics = selectedReport && selectedReport.getMetrics ? selectedReport.getMetrics(filteredData) : [];
  const currentCategoryCatalog = reportsCatalog.filter(r => r.categoryId === activeCategory);

  return (
    <div className={styles.container}>
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              zIndex: 9999,
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 500,
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
              backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981',
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!activeReportId ? (
          /* ── REPORTS DASHBOARD DIRECTORY ── */
          <motion.div
            key="directory"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.header}>
              <h1 className={styles.title}>Application Reports Center</h1>
              <p className={styles.subtitle}>
                Audit employee registries, attendance logs, leave summaries, payrolls, and compliance ledgers.
                {activeMonthMeta?.month && (
                  <span style={{ color: 'var(--primary, #6366f1)', fontWeight: 600 }}>
                    {' '}
                    (Active Month: {activeMonthMeta.month} {activeMonthMeta.year})
                  </span>
                )}
              </p>
            </div>

            {/* Category horizontal tabs */}
            <div className={styles.tabsContainer}>
              {categoriesList.map(cat => (
                <button
                  key={cat.id}
                  className={`${styles.tabButton} ${activeCategory === cat.id ? styles.tabButtonActive : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Catalog Grid */}
            <div className={styles.grid}>
              {currentCategoryCatalog.map(report => (
                <div 
                  key={report.id} 
                  className={styles.card}
                  onClick={() => handleSelectReport(report)}
                >
                  <div>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardIcon}>
                        {report.icon}
                      </div>
                      <h2 className={styles.cardTitle}>{report.title}</h2>
                    </div>
                    <p className={styles.cardDesc}>{report.description}</p>
                  </div>
                  <div className={styles.cardFooter}>
                    <span>Open Audit Ledger</span>
                    <ChevronRight size={16} className={styles.arrowIcon} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* ── REPORT VIEWER ── */
          <motion.div
            key="viewer"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <button className={styles.backBtn} onClick={handleGoBack}>
              <ArrowLeft size={16} />
              <span>Back to Reports center</span>
            </button>

            <div className={styles.header}>
              <h1 className={styles.title}>{selectedReport.title}</h1>
              <p className={styles.subtitle}>
                PDF-specified compliance report
                {activeMonthMeta?.month && (
                  <span>
                    {' '}• Active Month: {activeMonthMeta.month} {activeMonthMeta.year}
                  </span>
                )}
              </p>
            </div>

            {/* ──────── 1.2 EMPLOYEE PROFILE CUSTOM VIEW ──────── */}
            {activeReportId === '1.2_profile_report' && (
              <div>
                <div className={styles.selectorRow}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Select Employee:</label>
                  <select
                    className={styles.selectField}
                    value={selectedStaffId}
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value);
                      handleLoadEmployeeProfile(e.target.value);
                    }}
                  >
                    <option value="">-- Choose Employee --</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (ID: {s.id})</option>
                    ))}
                  </select>

                  {profileData && (
                    <div style={{ marginLeft: 'auto' }}>
                      <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePrint}>
                        <Printer size={16} />
                        <span>Print Profile Sheet</span>
                      </button>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className={styles.loaderContainer}>
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary, #6366f1)' }} />
                  </div>
                ) : profileData ? (
                  <div className={styles.profileLayout}>
                    {/* Sidebar profile */}
                    <div className={styles.profileSidebar}>
                      <div className={styles.avatarBig}>
                        {profileData.staffFullDetails?.surname?.[0] || 'E'}
                      </div>
                      <h2 className={styles.profileName}>
                        {[profileData.staffFullDetails?.title, profileData.staffFullDetails?.surname, profileData.staffFullDetails?.first_name].filter(Boolean).join(' ')}
                      </h2>
                      <div className={styles.profileMeta}>
                        ID: {profileData.staffFullDetails?.staffID || '—'}
                      </div>

                      <div className={styles.profileSidebarList}>
                        <div className={styles.sidebarItem}>
                          <span className={styles.sidebarLabel}>Staff Number</span>
                          <span className={styles.sidebarValue}>{profileData.staffFullDetails?.fileNo || '—'}</span>
                        </div>
                        <div className={styles.sidebarItem}>
                          <span className={styles.sidebarLabel}>Department</span>
                          <span className={styles.sidebarValue}>{profileData.staffFullDetails?.department || '—'}</span>
                        </div>
                        <div className={styles.sidebarItem}>
                          <span className={styles.sidebarLabel}>Designation</span>
                          <span className={styles.sidebarValue}>{profileData.staffFullDetails?.designation || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Profile blocks */}
                    <div className={styles.profileContent}>
                      {/* Personal & contact */}
                      <div className={styles.profileBlock}>
                        <h3 className={styles.blockTitle}>Personal & Contact Details</h3>
                        <div className={styles.profileFieldsGrid}>
                          <div className={styles.profileField}>
                            <span className={styles.fieldLabel}>Gender</span>
                            <span className={styles.fieldValue}>{profileData.staffFullDetails?.gender || '—'}</span>
                          </div>
                          <div className={styles.profileField}>
                            <span className={styles.fieldLabel}>Date of Birth</span>
                            <span className={styles.fieldValue}>{profileData.staffFullDetails?.dob || '—'}</span>
                          </div>
                          <div className={styles.profileField}>
                            <span className={styles.fieldLabel}>Marital Status</span>
                            <span className={styles.fieldValue}>{profileData.staffFullDetails?.maritalstatus || '—'}</span>
                          </div>
                          <div className={styles.profileField}>
                            <span className={styles.fieldLabel}>Phone Number</span>
                            <span className={styles.fieldValue}>{profileData.staffFullDetails?.phone || '—'}</span>
                          </div>
                          <div className={styles.profileField}>
                            <span className={styles.fieldLabel}>Email Address</span>
                            <span className={styles.fieldValue}>{profileData.staffFullDetails?.email || '—'}</span>
                          </div>
                          <div className={styles.profileField}>
                            <span className={styles.fieldLabel}>Contact Address</span>
                            <span className={styles.fieldValue}>{profileData.staffFullDetails?.home_address || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Next of Kin */}
                      {profileData.nextOfKin && profileData.nextOfKin.length > 0 && (
                        <div className={styles.profileBlock}>
                          <h3 className={styles.blockTitle}>Next of Kin Details</h3>
                          <div className={styles.profileFieldsGrid}>
                            <div className={styles.profileField}>
                              <span className={styles.fieldLabel}>Full Name</span>
                              <span className={styles.fieldValue}>{profileData.nextOfKin[0].fullname || '—'}</span>
                            </div>
                            <div className={styles.profileField}>
                              <span className={styles.fieldLabel}>Phone Number</span>
                              <span className={styles.fieldValue}>{profileData.nextOfKin[0].phoneno || '—'}</span>
                            </div>
                            <div className={styles.profileField}>
                              <span className={styles.fieldLabel}>Relationship</span>
                              <span className={styles.fieldValue}>{profileData.nextOfKin[0].relationship || '—'}</span>
                            </div>
                            <div className={styles.profileField} style={{ gridColumn: 'span 2' }}>
                              <span className={styles.fieldLabel}>Contact Address</span>
                              <span className={styles.fieldValue}>{profileData.nextOfKin[0].address || '—'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Education qualifications */}
                      {profileData.education && profileData.education.length > 0 && (
                        <div className={styles.profileBlock}>
                          <h3 className={styles.blockTitle}>Educational Qualifications</h3>
                          <div className={styles.tableContainer}>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th className={styles.th}>School / Institution</th>
                                  <th className={styles.th}>Degree / Qualification</th>
                                  <th className={styles.th}>From Date</th>
                                  <th className={styles.th}>To Date</th>
                                  <th className={styles.th}>Certificate Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {profileData.education.map((edu, idx) => (
                                  <tr key={idx} className={styles.tr}>
                                    <td className={styles.td}>{edu.schoolattended || '—'}</td>
                                    <td className={styles.td}>{edu.degreequalification || '—'}</td>
                                    <td className={styles.td}>{edu.schoolfrom || '—'}</td>
                                    <td className={styles.td}>{edu.schoolto || '—'}</td>
                                    <td className={styles.td}>{edu.certificateheld || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Bank Details */}
                      <div className={styles.profileBlock}>
                        <h3 className={styles.blockTitle}>Bank & Emolument details</h3>
                        <div className={styles.profileFieldsGrid}>
                          <div className={styles.profileField}>
                            <span className={styles.fieldLabel}>Bank Name</span>
                            <span className={styles.fieldValue}>{profileData.staffFullDetails?.bank || '—'}</span>
                          </div>
                          <div className={styles.profileField}>
                            <span className={styles.fieldLabel}>Account Number</span>
                            <span className={styles.fieldValue}>{profileData.staffFullDetails?.AccNo || '—'}</span>
                          </div>
                          <div className={styles.profileField}>
                            <span className={styles.fieldLabel}>Basic Monthly Salary</span>
                            <span className={styles.fieldValue}>
                              ₦{fmt(profileData.staffFullDetails?.basic_salary || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <Users size={40} style={{ color: '#9ca3af' }} />
                    <h3 style={{ margin: 0 }}>No Employee Selected</h3>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>Select a staff member from the dropdown to audit their file record.</p>
                  </div>
                )}
              </div>
            )}

            {/* ──────── 1.3 DEPARTMENTAL STAFF REPORT CUSTOM VIEW ──────── */}
            {activeReportId === '1.3_departmental_staff' && (
              <div>
                <div className={styles.filtersRow} style={{ justifyContent: 'flex-end' }}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePrint}>
                    <Printer size={16} />
                    <span>Print Dept Sheet</span>
                  </button>
                </div>

                {loading ? (
                  <div className={styles.loaderContainer}>
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary, #6366f1)' }} />
                  </div>
                ) : departmentGroups.length > 0 ? (
                  departmentGroups.map((group, idx) => (
                    <div key={idx} className={styles.deptBlock}>
                      <div className={styles.deptHeader}>
                        <div className={styles.deptTitleGroup}>
                          <Building2 size={20} style={{ color: '#6366f1' }} />
                          <h2 className={styles.deptName}>{group.name}</h2>
                          <span className={styles.deptStaffCount}>{group.staff.length} staff</span>
                        </div>
                        <div className={styles.deptHOD}>
                          HOD: <span className={styles.deptHODName}>{group.hod}</span>
                        </div>
                      </div>

                      <div className={styles.tableContainer}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th className={styles.th}>Staff Number</th>
                              <th className={styles.th}>Full Name</th>
                              <th className={styles.th}>Designation</th>
                              <th className={styles.th}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.staff.map((s, sIdx) => (
                              <tr key={sIdx} className={styles.tr}>
                                <td className={styles.td}>{s.fileNo || '—'}</td>
                                <td className={styles.td} style={{ fontWeight: 600, color: '#ffffff' }}>{s.name}</td>
                                <td className={styles.td}>{s.designation}</td>
                                <td className={styles.td}>
                                  {s.status == 1 ? <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span> : <span className={`${styles.badge} ${styles.badgeInactive}`}>Inactive</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <Building2 size={40} />
                    <h3>No Department Data Found</h3>
                  </div>
                )}
              </div>
            )}

            {/* ──────── 3.2 LEAVE BALANCE CUSTOM VIEW ──────── */}
            {activeReportId === '3.2_leave_balances' && (
              <div>
                <div className={styles.selectorRow}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Select Employee:</label>
                  <select
                    className={styles.selectField}
                    value={selectedStaffId}
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value);
                      handleLoadLeaveBalance(e.target.value);
                    }}
                  >
                    <option value="">-- Choose Employee --</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (ID: {s.id})</option>
                    ))}
                  </select>

                  {leaveBalanceStaff && (
                    <div style={{ marginLeft: 'auto' }}>
                      <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePrint}>
                        <Printer size={16} />
                        <span>Print Balance Sheet</span>
                      </button>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className={styles.loaderContainer}>
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary, #6366f1)' }} />
                  </div>
                ) : leaveBalanceStaff ? (
                  <div className={styles.tableCard}>
                    <div className={styles.tableContainer}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.th}>Leave Category Type</th>
                            <th className={styles.th}>Statutory Annual Limit (Days)</th>
                            <th className={styles.th}>Days Approved / Used</th>
                            <th className={styles.th}>Remaining Balance (Days)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaveBalanceStaff.balances.map((bal, idx) => (
                            <tr key={idx} className={styles.tr}>
                              <td className={styles.td} style={{ fontWeight: 600, color: 'var(--foreground)' }}>{bal.type}</td>
                              <td className={styles.td}>{bal.limit} Days</td>
                              <td className={styles.td} style={{ color: bal.used > 0 ? '#ef4444' : 'inherit' }}>{bal.used} Days</td>
                              <td className={styles.td} style={{ color: '#10b981', fontWeight: 600 }}>{bal.remaining} Days</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <FileSpreadsheet size={40} />
                    <h3>No Employee Selected</h3>
                    <p style={{ margin: 0 }}>Select a staff member from the dropdown list to calculate their remaining leave balances.</p>
                  </div>
                )}
              </div>
            )}

            {/* ──────── 4.3 INDIVIDUAL PAYSLIP CUSTOM VIEW ──────── */}
            {activeReportId === '4.3_individual_payslip' && (
              <div>
                <div className={styles.selectorRow}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Employee:</label>
                  <select
                    className={styles.selectField}
                    value={selectedStaffId}
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value);
                      handleLoadPayslip(e.target.value, selectedMonth, selectedYear);
                    }}
                  >
                    <option value="">-- Choose Employee --</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (ID: {s.id})</option>
                    ))}
                  </select>

                  <label style={{ fontSize: '0.9rem', fontWeight: 600, marginLeft: '1rem' }}>Month:</label>
                  <select
                    className={styles.selectField}
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      handleLoadPayslip(selectedStaffId, e.target.value, selectedYear);
                    }}
                  >
                    {['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>

                  <label style={{ fontSize: '0.9rem', fontWeight: 600, marginLeft: '1rem' }}>Year:</label>
                  <select
                    className={styles.selectField}
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value);
                      handleLoadPayslip(selectedStaffId, selectedMonth, e.target.value);
                    }}
                  >
                    {['2025','2026','2027'].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>

                  {payslipData && (
                    <div style={{ marginLeft: 'auto' }}>
                      <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePrint}>
                        <Printer size={16} />
                        <span>Print Payslip Sheet</span>
                      </button>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className={styles.loaderContainer}>
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary, #6366f1)' }} />
                  </div>
                ) : payslipData ? (
                  <div style={{ maxWidth: '600px', margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '2rem' }}>
                    <div style={{ borderBottom: '2px dashed var(--border)', paddingBottom: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                      <h2 style={{ margin: 0, color: 'var(--foreground)' }}>ISALU HRMS PAYSLIP</h2>
                      <p style={{ margin: '0.25rem 0 0 0', color: 'var(--secondary)', fontSize: '0.85rem' }}>{selectedMonth} {selectedYear} PAYSLIP SUMMARY</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '1.5rem' }}>
                      <div>
                        <strong>Staff ID:</strong> <span style={{ color: 'var(--foreground)' }}>{payslipData.staff?.id}</span>
                      </div>
                      <div>
                        <strong>File Number:</strong> <span style={{ color: 'var(--foreground)' }}>{payslipData.staff?.file_no}</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <strong>Full Name:</strong> <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{payslipData.staff?.name}</span>
                      </div>
                      <div>
                        <strong>Department:</strong> <span style={{ color: 'var(--foreground)' }}>{payslipData.staff?.department}</span>
                      </div>
                      <div>
                        <strong>Designation:</strong> <span style={{ color: 'var(--foreground)' }}>{payslipData.staff?.designation}</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                      {/* Earnings */}
                      <div>
                        <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', color: 'var(--foreground)', margin: '0 0 0.5rem 0' }}>Earnings Allowances</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Basic Salary</span> <span>₦{fmt(payslipData.payslip?.basic)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Housing</span> <span>₦{fmt(payslipData.payslip?.housing)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Transport</span> <span>₦{fmt(payslipData.payslip?.transport)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Meal Allowance</span> <span>₦{fmt(payslipData.payslip?.meal)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--foreground)', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                            <span>Gross Pay</span> <span>₦{fmt(payslipData.payslip?.gross_pay)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Deductions */}
                      <div>
                        <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', color: 'var(--foreground)', margin: '0 0 0.5rem 0' }}>Deductions & Tax</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>PAYE Tax</span> <span>₦{fmt(payslipData.payslip?.tax)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Pension (8%)</span> <span>₦{fmt(payslipData.payslip?.pension)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Coop Savings</span> <span>₦{fmt(payslipData.payslip?.coop_savings)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Coop Loan Repay</span> <span>₦{fmt(payslipData.payslip?.coop_loan)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--foreground)', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                            <span>Total Deductions</span> <span>₦{fmt(payslipData.payslip?.total_deductions)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '2px dashed var(--border)', marginTop: '1.5rem', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>NET PAY TO BANK</span>
                      <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#10b981' }}>₦{fmt(payslipData.payslip?.net_pay)}</span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <FileText size={40} />
                    <h3>No Payslip Record Found</h3>
                    <p style={{ margin: 0 }}>Select a staff member and month/year above to retrieve payslip details.</p>
                  </div>
                )}
              </div>
            )}

            {/* ──────── DYNAMIC TABULAR VIEW GENERATOR ──────── */}
            {!selectedReport.isCustomLayout && (
              <div>
                {/* Payroll selection panel if necessary */}
                {selectedReport.isPayrollPeriodQuery && (
                  <div className={styles.selectorRow}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Payroll Month:</label>
                    <select
                      className={styles.selectField}
                      value={selectedMonth}
                      onChange={(e) => {
                        setSelectedMonth(e.target.value);
                        fetchReportDetails(selectedReport, e.target.value, selectedYear);
                      }}
                    >
                      {['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>

                    <label style={{ fontSize: '0.9rem', fontWeight: 600, marginLeft: '1rem' }}>Payroll Year:</label>
                    <select
                      className={styles.selectField}
                      value={selectedYear}
                      onChange={(e) => {
                        setSelectedYear(e.target.value);
                        fetchReportDetails(selectedReport, selectedMonth, e.target.value);
                      }}
                    >
                      {['2025','2026','2027'].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Metrics boxes */}
                {metrics.length > 0 && (
                  <div className={styles.summaryGrid}>
                    {metrics.map((metric, idx) => (
                      <div key={idx} className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>{metric.label}</div>
                        <div className={styles.summaryValue}>
                          {metric.icon}
                          <span>{metric.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Filter and actions bar */}
                <div className={styles.filtersRow}>
                  <div className={styles.filtersGroup}>
                    <div className={styles.searchWrapper}>
                      <Search size={16} className={styles.searchIcon} />
                      <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search records..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                      />
                    </div>

                    <select
                      className={styles.selectField}
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="all">Status: All</option>
                      <option value="active">Status: Active</option>
                      <option value="inactive">Status: Completed/Inactive</option>
                    </select>
                  </div>

                  <div className={styles.actionsGroup}>
                    <button 
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      onClick={handlePrint}
                      disabled={loading || reportData.length === 0}
                    >
                      <Printer size={16} />
                      <span>Print Report</span>
                    </button>
                    <button 
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() => handleExportCSV(selectedReport.title, filteredData, selectedReport.columns)}
                      disabled={loading || filteredData.length === 0}
                    >
                      <Download size={16} />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {/* Main Data Table */}
                <div className={styles.tableCard}>
                  {loading ? (
                    <div className={styles.loaderContainer}>
                      <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary, #6366f1)' }} />
                    </div>
                  ) : paginatedData.length > 0 ? (
                    <>
                      <div className={styles.tableContainer}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              {selectedReport.columns.map((col, idx) => (
                                <th key={idx} className={styles.th}>
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedData.map((row, rowIdx) => (
                              <tr key={rowIdx} className={styles.tr}>
                                {selectedReport.columns.map((col, colIdx) => (
                                  <td key={colIdx} className={styles.td}>
                                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination footer */}
                      <div className={styles.pagination}>
                        <div>
                          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} records
                        </div>
                        <div className={styles.paginationButtons}>
                          <button
                            className={`${styles.btn} ${styles.btnSecondary}`}
                            style={{ padding: '0.25rem 0.5rem' }}
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnSecondary}`}
                            style={{ padding: '0.25rem 0.5rem' }}
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={styles.emptyState}>
                      <AlertCircle size={40} style={{ color: '#9ca3af' }} />
                      <h3 style={{ margin: 0 }}>No records found</h3>
                      <p style={{ margin: 0, fontSize: '0.875rem' }}>Adjust your filters or search terms.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
