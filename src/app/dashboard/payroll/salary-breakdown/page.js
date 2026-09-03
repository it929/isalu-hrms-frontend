"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { 
  FileText, 
  Printer, 
  Search, 
  Calendar, 
  User, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Loader2, 
  Clock, 
  Sparkles,
  Users,
  Download,
  X,
  FileSpreadsheet,
  Layers,
  Filter,
  PiggyBank,
  Wallet,
  CreditCard,
  ShoppingBag,
  HeartPulse,
  Eye
} from 'lucide-react';
import NairaSign from '../../../../components/ui/NairaSign';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

const MONTHS = [
  { id: 1, name: 'January' },
  { id: 2, name: 'February' },
  { id: 3, name: 'March' },
  { id: 4, name: 'April' },
  { id: 5, name: 'May' },
  { id: 6, name: 'June' },
  { id: 7, name: 'July' },
  { id: 8, name: 'August' },
  { id: 9, name: 'September' },
  { id: 10, name: 'October' },
  { id: 11, name: 'November' },
  { id: 12, name: 'December' },
];

function getUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hrms_user') || sessionStorage.getItem('hrms_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.id || parsed?.userId || parsed?.ID || null;
    }
    return localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || null;
  } catch { /* ignore */ }
  return null;
}

function getStoredUserRole() {
  if (typeof window === 'undefined') return { can_generate_all_staff: false };
  try {
    const rawRole = localStorage.getItem('hrms_role') || sessionStorage.getItem('hrms_role');
    const rawUser = localStorage.getItem('hrms_user') || sessionStorage.getItem('hrms_user');
    const uid = getUserId();
    const cachedSidebar = uid ? sessionStorage.getItem(`hrms_sidebar_links_cache_${uid}`) : null;
    
    let isSuper = false;
    let isHr = false;
    let isAudit = false;
    let isFinance = false;

    if (rawRole) {
      const parsed = JSON.parse(rawRole);
      const roleName = String(parsed?.rolename || parsed?.name || '').toLowerCase();
      const roleId = Number(parsed?.roleID || parsed?.id || 0);
      if (roleId === 1 || roleName.includes('super admin') || roleName.includes('super administrator')) {
        isSuper = true;
      }
      if (roleId === 48 || roleName.includes('hr head') || roleName.includes('human resource head')) {
        isHr = true;
      }
      if (roleId === 34 || roleId === 35 || roleName.includes('audit head') || roleName.includes('internal audit')) {
        isAudit = true;
      }
      if (roleId === 36 || roleId === 37 || roleName.includes('finance head') || roleName.includes('head of finance')) {
        isFinance = true;
      }
    }

    if (rawUser) {
      const parsedUser = JSON.parse(rawUser);
      const uRole = String(parsedUser.role_name || parsedUser.rolename || '').toLowerCase();
      const uRoleId = Number(parsedUser.role_id || parsedUser.roleID || 0);
      if (uRoleId === 1 || uRole.includes('super admin') || uRole.includes('super administrator')) {
        isSuper = true;
      }
      if (uRoleId === 48 || uRole.includes('hr head') || uRole.includes('human resource head')) {
        isHr = true;
      }
      if (uRoleId === 34 || uRoleId === 35 || uRole.includes('audit head') || uRole.includes('internal audit')) {
        isAudit = true;
      }
      if (uRoleId === 36 || uRoleId === 37 || uRole.includes('finance head') || uRole.includes('head of finance')) {
        isFinance = true;
      }
    }

    if (cachedSidebar) {
      const parsedSb = JSON.parse(cachedSidebar);
      if (parsedSb.is_admin || parsedSb.is_super_admin) isSuper = true;
      if (parsedSb.is_hr || parsedSb.is_hr_head) isHr = true;
      if (parsedSb.is_audit_head) isAudit = true;
      if (parsedSb.is_finance_head) isFinance = true;
    }

    const canGenerateAll = isSuper || isHr || isAudit || isFinance;

    return {
      can_generate_all_staff: canGenerateAll,
      is_admin: isSuper || isHr,
      is_super_admin: isSuper,
      is_hr_head: isHr,
      is_audit_head: isAudit,
      is_finance_head: isFinance,
    };
  } catch {
    return { can_generate_all_staff: false };
  }
}

function buildHeaders() {
  const uid = getUserId();
  return uid ? { 'X-User-Id': uid } : {};
}

function formatCurrency(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return '0.00';
  if (num < 0) {
    return '-' + Math.abs(num).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNaira(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return '₦0.00';
  if (num < 0) {
    return `-₦${Math.abs(num).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDaysInMonth(month, year) {
  if (!month || !year) return 30;
  return new Date(year, month, 0).getDate();
}

export default function SalaryBreakdownPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [staffList, setStaffList] = useState([]);
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedStaffId, setSelectedStaffId] = useState('');
  
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Individual Staff Payroll Sheet Modal State
  const [showStaffSheetModal, setShowStaffSheetModal] = useState(false);

  // All Staff Payroll Sheet Modal State
  const [showAllStaffModal, setShowAllStaffModal] = useState(false);
  const [loadingAllStaff, setLoadingAllStaff] = useState(false);
  const [allStaffData, setAllStaffData] = useState(null);
  const [allStaffSearch, setAllStaffSearch] = useState('');
  const [allStaffDeptFilter, setAllStaffDeptFilter] = useState('');
  const [allStaffPerPage, setAllStaffPerPage] = useState('all');
  const [allStaffCurrentPage, setAllStaffCurrentPage] = useState(1);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingStaffExcel, setExportingStaffExcel] = useState(false);

  // Individual Staff Breakdown Popup (from All Staff modal)
  const [showStaffBreakdownModal, setShowStaffBreakdownModal] = useState(false);
  const [modalStaffBreakdown, setModalStaffBreakdown] = useState(null);
  const [loadingStaffBreakdownModal, setLoadingStaffBreakdownModal] = useState(false);

  // Variance Modal State
  const [allStaffActiveTab, setAllStaffActiveTab] = useState('sheet'); // 'sheet' or 'variance'
  const [varianceData, setVarianceData] = useState(null);
  const [loadingVariance, setLoadingVariance] = useState(false);
  const [exportingVariance, setExportingVariance] = useState(false);
  const [varianceSubTab, setVarianceSubTab] = useState('summary'); // 'summary' | 'components' | 'staff'
  const [varianceStaffFilter, setVarianceStaffFilter] = useState('all'); // 'all' | 'increased' | 'decreased' | 'new_joiner' | 'exited' | 'unchanged'
  const [varianceStaffSearch, setVarianceStaffSearch] = useState('');

  useEffect(() => {
    setAllStaffCurrentPage(1);
  }, [allStaffSearch, allStaffDeptFilter, allStaffPerPage]);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [userRoles, setUserRoles] = useState({
    can_generate_all_staff: false,
    is_admin: false,
    is_super_admin: false,
    is_hr_head: false,
    is_finance_head: false,
    is_audit_head: false,
  });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4500);
  }, []);

  // Fetch single staff breakdown
  const fetchBreakdown = useCallback(async (staffIdParam, monthParam, yearParam) => {
    if (!staffIdParam) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('staff_id', staffIdParam);
      if (monthParam) params.append('month', monthParam);
      if (yearParam) params.append('year', yearParam);

      const res = await axios.get(`${API_BASE}/payroll/salary-breakdown?${params.toString()}`, {
        headers: buildHeaders()
      });

      if (res.data?.status === 'success' && res.data?.staff) {
        setData(res.data);
        if (res.data.can_generate_all_staff || res.data.is_admin || res.data.is_super_admin || res.data.is_hr_head || res.data.is_finance_head || res.data.is_audit_head) {
          setUserRoles(prev => ({
            ...prev,
            can_generate_all_staff: !!res.data.can_generate_all_staff,
            is_admin: !!res.data.is_admin,
            is_super_admin: !!res.data.is_super_admin,
            is_hr_head: !!res.data.is_hr_head,
            is_finance_head: !!res.data.is_finance_head,
            is_audit_head: !!res.data.is_audit_head,
          }));
        }
        if (res.data.staff?.id) {
          setSelectedStaffId(res.data.staff.id);
          setStaffSearchQuery(`${res.data.staff.name} (ID: ${res.data.staff.id})`);
        }
      } else if (res.data?.message) {
        showToast(res.data.message, 'info');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load monthly salary breakdown.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Fetch staff list for selector (Admins, HR, HODs)
  const fetchStaffList = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/payroll/salary-breakdown/staff`, {
        headers: buildHeaders()
      });
      if (res.data?.status === 'success') {
        const list = res.data.data || [];
        setStaffList(list);
        if (res.data.can_generate_all_staff || res.data.is_admin || res.data.is_super_admin || res.data.is_hr_head || res.data.is_finance_head || res.data.is_audit_head) {
          setUserRoles(prev => ({
            ...prev,
            can_generate_all_staff: !!res.data.can_generate_all_staff,
            is_admin: !!res.data.is_admin,
            is_super_admin: !!res.data.is_super_admin,
            is_hr_head: !!res.data.is_hr_head,
            is_finance_head: !!res.data.is_finance_head,
            is_audit_head: !!res.data.is_audit_head,
          }));
        } else if (list.length === 1 && !res.data.is_admin) {
          // Regular staff: auto-load own breakdown
          setSelectedStaffId(list[0].id);
          setStaffSearchQuery(`${list[0].name} (ID: ${list[0].id})`);
          fetchBreakdown(list[0].id, selectedMonth, selectedYear);
        }
      }
    } catch (err) {
      console.error('Error loading staff list:', err);
    }
  }, [selectedMonth, selectedYear, fetchBreakdown]);

  // Fetch All Staff Sheet (for Super Admin, HR Head, Finance Head, Audit Head)
  const fetchAllStaffSheet = useCallback(async (deptId = '', searchQ = '') => {
    setLoadingAllStaff(true);
    try {
      const params = new URLSearchParams();
      params.append('month', selectedMonth);
      params.append('year', selectedYear);
      if (deptId) params.append('department_id', deptId);
      if (searchQ) params.append('search', searchQ);

      const res = await axios.get(`${API_BASE}/payroll/salary-breakdown/all-staff?${params.toString()}`, {
        headers: buildHeaders()
      });

      if (res.data?.status === 'success') {
        setAllStaffData(res.data);
        if (res.data?.variance_summary) {
          setVarianceData(prev => prev ? { ...prev, executive_summary: { ...prev.executive_summary, ...res.data.variance_summary } } : null);
        }
      } else {
        showToast(res.data?.message || 'Failed to load all staff payroll sheet.', 'error');
      }

    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load all staff payroll sheet.', 'error');
    } finally {
      setLoadingAllStaff(false);
    }
  }, [selectedMonth, selectedYear, showToast]);

  // Fetch Payroll Variance Data comparing previous and current month
  const fetchVarianceData = useCallback(async (deptId = '', searchQ = '') => {
    setLoadingVariance(true);
    try {
      const params = new URLSearchParams();
      params.append('month', selectedMonth);
      params.append('year', selectedYear);
      if (deptId) params.append('department_id', deptId);
      if (searchQ) params.append('search', searchQ);

      const res = await axios.get(`${API_BASE}/payroll/salary-breakdown/variance?${params.toString()}`, {
        headers: buildHeaders()
      });

      if (res.data?.status === 'success' && res.data?.data) {
        setVarianceData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load variance analysis', err);
    } finally {
      setLoadingVariance(false);
    }
  }, [selectedMonth, selectedYear]);

  const handleExportVarianceReport = async () => {
    setExportingVariance(true);
    try {
      const params = new URLSearchParams();
      params.append('month', selectedMonth);
      params.append('year', selectedYear);
      if (allStaffDeptFilter) params.append('department_id', allStaffDeptFilter);
      if (allStaffSearch) params.append('search', allStaffSearch);

      const res = await axios.get(`${API_BASE}/payroll/salary-breakdown/variance/export?${params.toString()}`, {
        headers: buildHeaders(),
        responseType: 'blob'
      });

      const monthName = MONTHS.find(m => m.id === selectedMonth)?.name || selectedMonth;
      const selectedDept = allStaffData?.departments?.find(d => String(d.id) === String(allStaffDeptFilter))?.name;
      const deptSuffix = selectedDept ? `_${selectedDept.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const filename = `Payroll_Variance_Summary_${monthName}_${selectedYear}${deptSuffix}.csv`;

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          link.remove();
          window.URL.revokeObjectURL(url);
        } catch { /* ignore */ }
      }, 150);

      showToast(`Payroll Variance Summary CSV ${selectedDept ? `for ${selectedDept} ` : ''}downloaded successfully!`, 'success');
    } catch (err) {
      showToast('Failed to download variance summary report.', 'error');
    } finally {
      setExportingVariance(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    setUserRoles(getStoredUserRole());
    fetchStaffList();
  }, [fetchStaffList]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowStaffDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStaffSelect = (staff) => {
    setSelectedStaffId(staff.id);
    setStaffSearchQuery(`${staff.name} (ID: ${staff.id})`);
    setShowStaffDropdown(false);
    fetchBreakdown(staff.id, selectedMonth, selectedYear);
  };

  const handlePeriodChange = (month, year) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    fetchBreakdown(selectedStaffId, month, year);
    if (showAllStaffModal) {
      fetchAllStaffSheet(allStaffDeptFilter, allStaffSearch);
      fetchVarianceData(allStaffDeptFilter, allStaffSearch);
    }
  };

  const handleOpenAllStaffModal = (defaultTab = 'sheet') => {
    setShowAllStaffModal(true);
    setAllStaffActiveTab(defaultTab);
    setAllStaffPerPage('all');
    setAllStaffCurrentPage(1);
    fetchAllStaffSheet(allStaffDeptFilter, allStaffSearch);
    fetchVarianceData(allStaffDeptFilter, allStaffSearch);
  };

  const handleAllStaffSearchChange = (val) => {
    setAllStaffSearch(val);
    fetchAllStaffSheet(allStaffDeptFilter, val);
    fetchVarianceData(allStaffDeptFilter, val);
  };

  const handleAllStaffDeptChange = (deptId) => {
    setAllStaffDeptFilter(deptId);
    fetchAllStaffSheet(deptId, allStaffSearch);
    fetchVarianceData(deptId, allStaffSearch);
  };


  const handleViewStaffBreakdown = async (staffId) => {
    if (!staffId) return;
    setLoadingStaffBreakdownModal(true);
    setShowStaffBreakdownModal(true);
    try {
      const params = new URLSearchParams();
      params.append('staff_id', staffId);
      params.append('month', selectedMonth);
      params.append('year', selectedYear);

      const res = await axios.get(`${API_BASE}/payroll/salary-breakdown?${params.toString()}`, {
        headers: buildHeaders()
      });

      if (res.data?.status === 'success' && res.data?.staff) {
        setModalStaffBreakdown(res.data);
      } else {
        showToast(res.data?.message || 'Failed to load staff salary breakdown.', 'error');
        setShowStaffBreakdownModal(false);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error loading staff salary breakdown.', 'error');
      setShowStaffBreakdownModal(false);
    } finally {
      setLoadingStaffBreakdownModal(false);
    }
  };

  const handleExportStaffExcel = async () => {
    setExportingStaffExcel(true);
    try {
      const params = new URLSearchParams();
      params.append('month', selectedMonth);
      params.append('year', selectedYear);
      if (selectedStaffId || staff?.id) {
        params.append('staff_id', selectedStaffId || staff.id);
      }

      const res = await axios.get(`${API_BASE}/payroll/salary-breakdown/staff/export?${params.toString()}`, {
        headers: buildHeaders(),
        responseType: 'blob'
      });

      const monthName = MONTHS.find(m => m.id === selectedMonth)?.name || selectedMonth;
      const safeName = (staff?.name || 'Staff').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Payroll_${safeName}_${monthName}_${selectedYear}.csv`;

      const blob = new Blob([res.data], { 
        type: 'text/csv;charset=utf-8;' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          link.remove();
          window.URL.revokeObjectURL(url);
        } catch { /* ignore */ }
      }, 150);

      showToast('Staff Payroll Spreadsheet (.csv) downloaded successfully!', 'success');
    } catch (err) {
      let errMsg = 'Failed to export staff spreadsheet.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.message) errMsg = json.message;
        } catch { /* ignore */ }
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      }
      showToast(errMsg, 'error');
    } finally {
      setExportingStaffExcel(false);
    }
  };

  const handleExportAllStaffExcel = async () => {
    setExportingExcel(true);
    try {
      const params = new URLSearchParams();
      params.append('month', selectedMonth);
      params.append('year', selectedYear);
      if (allStaffDeptFilter) params.append('department_id', allStaffDeptFilter);
      if (allStaffSearch) params.append('search', allStaffSearch);

      const res = await axios.get(`${API_BASE}/payroll/salary-breakdown/all-staff/export?${params.toString()}`, {
        headers: buildHeaders(),
        responseType: 'blob'
      });

      const monthName = MONTHS.find(m => m.id === selectedMonth)?.name || selectedMonth;
      const filename = `Payroll_${monthName}_${selectedYear}.csv`;
      
      const blob = new Blob([res.data], { 
        type: 'text/csv;charset=utf-8;' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          link.remove();
          window.URL.revokeObjectURL(url);
        } catch { /* ignore */ }
      }, 150);

      showToast('All Staff Payroll Spreadsheet (.csv) downloaded successfully!', 'success');
    } catch (err) {
      let errMsg = 'Failed to export payroll spreadsheet.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.message) errMsg = json.message;
        } catch { /* ignore */ }
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      }
      showToast(errMsg, 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCSV = () => {
    if (!allStaffData?.data || allStaffData.data.length === 0) {
      showToast('No records to export.', 'error');
      return;
    }

    const headers = [
      'ID NO', 'STAFF NAME', 'DEPARTMENT', 'DESIGNATION', 'BASIC SALARY',
      'HOUSING', 'TRANSPORT', 'MEDICAL', 'UTILITY', 'MEAL', 'VARIABLE ALLOWANCES',
      'STAFF ALLOWANCES', 'STAFF BONUSES',
      'TOTAL GROSS INCOME', 'DECLARED SALARY', 'PAYE TAX', 'PENSION (8%)', 'RETENTION (5%)', 'IOU / ADVANCES',
      'MEDICAL LOAN', 'COOP. LOAN RPYT', 'COOP. SAVINGS', 'COOP. ASSET FIN.',
      'SURCHARGES', 'ABSENCE PENALTY', 'LEAVE OF ABSENCE', 'EMPLOYEE LOAN',
      'OTHER DEDUCTIONS', 'TOTAL DEDUCTIONS', 'ESTIMATED NET PAY',
      'BANK NAME', 'ACCOUNT NO.', 'PAYER ID'
    ];

    const sortedData = [...allStaffData.data].sort((a, b) => {
      const deptA = (a.department || '').toLowerCase();
      const deptB = (b.department || '').toLowerCase();
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return (a.name || '').localeCompare(b.name || '');
    });

    const rows = sortedData.map(r => [
      `"${r.id}"`,
      `"${r.name}"`,
      `"${r.department}"`,
      `"${r.designation}"`,
      r.basic_salary,
      r.housing_allowance,
      r.transport_allowance,
      r.medical_allowance,
      r.utility_allowance,
      r.meal_allowance,
      r.variable_allowances,
      r.custom_allowances ?? 0,
      r.bonuses ?? 0,
      r.gross_pay,
      r.declare_salary ?? r.gross_pay ?? 0,
      r.paye_tax,
      r.pension,
      r.retention,
      r.iou,
      r.medical_loan,
      r.coop_loan,
      r.coop_savings,
      r.coop_asset_finance,
      r.surcharges,
      r.absence_penalty,
      r.leave_of_absence,
      r.regular_loan,
      r.other_deductions,
      r.total_deductions,
      r.net_pay,
      `"${r.bank_name}"`,
      `"${r.account_number}"`,
      `"${r.payer_id}"`
    ]);

    const csvContent = headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const monthName = MONTHS.find(m => m.id === selectedMonth)?.name || selectedMonth;
    const filename = `Payroll_Sheet_${monthName}_${selectedYear}.csv`;
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch { /* ignore */ }
    }, 150);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredStaffList = staffList.filter(s => 
    s.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
    String(s.id).includes(staffSearchQuery)
  );

  const yearsList = [];
  const currentY = new Date().getFullYear();
  for (let y = currentY - 3; y <= currentY + 2; y++) {
    yearsList.push(y);
  }

  const staff = data?.staff;
  const earnings = data?.earnings;
  const deductions = data?.deductions;
  const summary = data?.summary;
  const period = data?.period;

  const canGenerateAllStaff = mounted && Boolean(
    userRoles.can_generate_all_staff || 
    userRoles.is_super_admin || 
    userRoles.is_hr_head || 
    userRoles.is_finance_head || 
    userRoles.is_audit_head ||
    data?.can_generate_all_staff || 
    data?.is_super_admin || 
    data?.is_hr_head || 
    data?.is_finance_head || 
    data?.is_audit_head
  );

  const allStaffRecords = allStaffData?.data || [];
  const totalAllStaffPages = allStaffPerPage === 'all'
    ? 1
    : Math.ceil(allStaffRecords.length / parseInt(allStaffPerPage, 10)) || 1;
  const paginatedAllStaff = allStaffPerPage === 'all'
    ? allStaffRecords
    : allStaffRecords.slice(
        (allStaffCurrentPage - 1) * parseInt(allStaffPerPage, 10),
        allStaffCurrentPage * parseInt(allStaffPerPage, 10)
      );

  return (
    <div className={styles.container}>
      {toast?.show && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <Sparkles size={24} style={{ color: 'var(--primary, #6366f1)' }} />
            Monthly Salary Breakdown
          </h1>
          <p className={styles.subtitle}>
            View comprehensive salary breakdown, earnings, itemized deductions, and generate payroll sheet even before monthly compute.
          </p>
        </div>

        <div className={styles.headerRight}>
          {/* 1. Generate All Staff Payroll Sheet (Super Admin, HR Head, Finance Head, Audit Head) */}
          {canGenerateAllStaff && (
            <button 
              type="button" 
              className={`${styles.btn} ${styles.btnPrimaryGradient}`} 
              onClick={handleOpenAllStaffModal}
              title="Generate Consolidated Payroll Sheet for All Staff Before Compute"
            >
              <Users size={16} />
              Generate All Staff Payroll Sheet
            </button>
          )}

          {/* 2. Generate Staff Payroll Sheet (Accessible to Staff / Admin for selected staff) */}
          <button 
            type="button" 
            className={`${styles.btn} ${styles.btnPrimary}`} 
            onClick={() => setShowStaffSheetModal(true)}
            disabled={!data || loading}
            title="Generate & View Individual Payroll Sheet"
          >
            <FileText size={16} />
            Generate Staff Payroll Sheet
          </button>

          {/* Print Breakdown */}
          <button 
            type="button" 
            className={`${styles.btn} ${styles.btnOutline}`} 
            onClick={handlePrint}
            disabled={!data || loading}
          >
            <Printer size={16} />
            Print View
          </button>
        </div>
      </div>

      {/* Filter / Selector Card */}
      <div className={styles.filterCard}>
        {/* Month Selector */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Select Month</label>
          <select
            className={styles.select}
            value={selectedMonth}
            onChange={(e) => handlePeriodChange(parseInt(e.target.value), selectedYear)}
          >
            {MONTHS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Year Selector */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Select Year</label>
          <select
            className={styles.select}
            value={selectedYear}
            onChange={(e) => handlePeriodChange(selectedMonth, parseInt(e.target.value))}
          >
            {yearsList.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Staff Selector (Admins / HODs) */}
        {(mounted && (canGenerateAllStaff || userRoles.is_admin || userRoles.is_super_admin || data?.is_admin || data?.is_hod || staffList.length > 1)) && (
          <div className={`${styles.formGroup} ${styles.formGroupStaff}`} ref={dropdownRef}>
            <label className={styles.label}>Select Staff Member</label>
            <div className={styles.dropdownContainer}>
              <input
                type="text"
                className={styles.input}
                placeholder="Search staff by name or ID..."
                value={staffSearchQuery}
                onChange={(e) => {
                  setStaffSearchQuery(e.target.value);
                  setShowStaffDropdown(true);
                }}
                onFocus={() => setShowStaffDropdown(true)}
              />
              {showStaffDropdown && (
                <div className={styles.dropdownMenu}>
                  {filteredStaffList.length > 0 ? (
                    filteredStaffList.map(s => (
                      <div
                        key={s.id}
                        className={styles.dropdownItem}
                        onClick={() => handleStaffSelect(s)}
                      >
                        <strong>{s.name}</strong> <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>(ID: {s.id})</span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.dropdownItem} style={{ color: 'var(--text-secondary)' }}>
                      No staff found matching &quot;{staffSearchQuery}&quot;
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px', gap: '1rem' }}>
          <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary, #6366f1)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Calculating salary structure & itemized deductions...</p>
        </div>
      ) : data && staff ? (
        <div className={`${styles.printableArea} ${styles.paperContainer} ${styles.printCard}`}>
          {/* Status Banner */}
          <div className={`${styles.statusBanner} ${period?.is_computed ? styles.bannerComputed : styles.bannerEstimate}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {period?.is_computed ? (
                <>
                  <CheckCircle2 size={18} />
                  <span><strong>Finalized Payroll Record</strong>: Salary for {period?.period_str} has been computed and locked.</span>
                </>
              ) : (
                <>
                  <Clock size={18} />
                  <span><strong>Pre-Compute Estimate</strong>: Live projection of {period?.period_str} salary based on active earnings, setups, and approved deductions.</span>
                </>
              )}
            </div>
            <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>Period: <strong>{period?.period_str}</strong></span>
          </div>

          {/* Staff Info Card */}
          <div className={styles.staffCard}>
            <div className={styles.staffLeft}>
              <div className={styles.avatarCircle}>
                {staff.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.staffMeta}>
                <h3>{staff.name}</h3>
                <div className={styles.staffDetails}>
                  <div className={styles.staffDetailItem}>
                    <User size={14} />
                    <span>Staff ID: <strong>{staff.id}</strong></span>
                  </div>
                  <div className={styles.staffDetailItem}>
                    <Building2 size={14} />
                    <span>Dept: <strong>{staff.department}</strong></span>
                  </div>
                  <div className={styles.staffDetailItem}>
                    <ShieldCheck size={14} />
                    <span>Designation: <strong>{staff.designation}</strong></span>
                  </div>
                  <div className={styles.staffDetailItem}>
                    <Calendar size={14} />
                    <span>Paid Days: <strong style={{ color: ((deductions?.leave_of_absence?.days_absent || 0) > 0 || (deductions?.mid_month_adjustment?.unworked_days || 0) > 0) ? '#ea580c' : 'inherit' }}>
                      {period?.paid_days ?? summary?.paid_days ?? ((period?.days_in_month || summary?.days_in_month || getDaysInMonth(selectedMonth, selectedYear)) - (deductions?.leave_of_absence?.days_absent || 0) - (deductions?.mid_month_adjustment?.unworked_days || 0))} Days
                      {(deductions?.mid_month_adjustment?.unworked_days || 0) > 0 && (
                        <span style={{ fontSize: '0.78rem', color: '#6366f1', marginLeft: '5px' }}>
                          ({deductions.mid_month_adjustment.unworked_days} unworked days before appointment)
                        </span>
                      )}
                      {(deductions?.leave_of_absence?.days_absent || 0) > 0 && (
                        <span style={{ fontSize: '0.78rem', color: '#dc2626', marginLeft: '5px' }}>
                          ({deductions.leave_of_absence.days_absent} LOA)
                        </span>
                      )}
                    </strong></span>
                  </div>
                </div>
              </div>
            </div>

            {staff.bank_name && staff.account_number && (
              <div className={styles.bankBadge}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{staff.bank_name}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Acc No: <strong>{staff.account_number}</strong></div>
              </div>
            )}
          </div>

          {/* Top Metric Cards */}
          <div className={styles.metricsGrid}>
            {/* Gross Salary */}
            <div className={styles.metricCard}>
              <div className={`${styles.metricIcon} ${styles.metricIconGross}`}>
                <TrendingUp size={24} />
              </div>
              <div className={styles.metricContent}>
                <div className={styles.metricLabel}>Total Gross Salary</div>
                <div className={`${styles.metricValue} ${styles.metricValueGross}`}>
                  ₦{formatCurrency(summary?.gross_pay)}
                </div>
                {((earnings?.custom_allowances && earnings.custom_allowances.length > 0) || (earnings?.bonuses && earnings.bonuses.length > 0)) && (
                  <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {earnings.custom_allowances && earnings.custom_allowances.map((ca) => (
                      <span key={ca.id} style={{ fontSize: '0.73rem', fontWeight: 600, color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>
                        + ₦{formatCurrency(ca.amount)} {ca.title || 'Allowance'}
                      </span>
                    ))}
                    {earnings.bonuses && earnings.bonuses.map((b) => (
                      <span key={b.id} style={{ fontSize: '0.73rem', fontWeight: 600, color: '#d97706', background: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>
                        + ₦{formatCurrency(b.amount)} {b.title || 'Bonus'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Total Deductions */}
            <div className={styles.metricCard}>
              <div className={`${styles.metricIcon} ${styles.metricIconDeductions}`}>
                <TrendingDown size={24} />
              </div>
              <div className={styles.metricContent}>
                <div className={styles.metricLabel}>Total Monthly Deductions</div>
                <div className={`${styles.metricValue} ${styles.metricValueDeductions}`}>
                  - ₦{formatCurrency(summary?.total_deductions)}
                </div>
              </div>
            </div>

            {/* Net Pay */}
            <div className={styles.metricCard} style={summary?.net_pay < 0 ? { borderColor: '#ef4444' } : {}}>
              <div className={`${styles.metricIcon} ${styles.metricIconNet}`} style={summary?.net_pay < 0 ? { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' } : {}}>
                <NairaSign size={24} />
              </div>
              <div className={styles.metricContent}>
                <div className={styles.metricLabel}>Estimated Net Take-Home Pay</div>
                <div className={`${styles.metricValue} ${styles.metricValueNet}`} style={summary?.net_pay < 0 ? { color: '#ef4444' } : {}}>
                  {formatNaira(summary?.net_pay)}
                </div>
                {summary?.net_pay < 0 && (
                  <div style={{ marginTop: '0.35rem', fontSize: '0.74rem', fontWeight: 600, color: '#dc2626', background: 'rgba(239, 68, 68, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={13} /> Deficit Balance: Total deductions exceed salary
                  </div>
                )}
                {((earnings?.custom_allowances && earnings.custom_allowances.length > 0) || (earnings?.bonuses && earnings.bonuses.length > 0)) && (
                  <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {earnings.custom_allowances && earnings.custom_allowances.map((ca) => (
                      <span key={ca.id} style={{ fontSize: '0.73rem', fontWeight: 600, color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>
                        + ₦{formatCurrency(ca.amount)} {ca.title || 'Allowance'}
                      </span>
                    ))}
                    {earnings.bonuses && earnings.bonuses.map((b) => (
                      <span key={b.id} style={{ fontSize: '0.73rem', fontWeight: 600, color: '#d97706', background: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>
                        + ₦{formatCurrency(b.amount)} {b.title || 'Bonus'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dual Column Breakdown */}
          <div className={styles.breakdownGrid}>
            {/* Earnings Breakdown Card */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionCardHeader}>
                <h2 className={`${styles.sectionTitle} ${styles.titleEarnings}`}>
                  <TrendingUp size={18} />
                  Earnings & Allowances
                </h2>
                <span className={`${styles.sectionTotal} ${styles.titleEarnings}`}>
                  ₦{formatCurrency(earnings?.gross_pay)}
                </span>
              </div>

              <div className={styles.listGroup}>
                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>Basic Salary</span>
                    <span className={styles.itemSubtext}>Base Monthly Emolument</span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountEarning}`}>
                      ₦{formatCurrency(earnings?.basic_salary)}
                    </span>
                  </div>
                </div>

                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>Housing Allowance</span>
                    <span className={styles.itemSubtext}>Residential Allowance</span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountEarning}`}>
                      ₦{formatCurrency(earnings?.housing_allowance)}
                    </span>
                  </div>
                </div>

                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>Transport Allowance</span>
                    <span className={styles.itemSubtext}>Commuting Allowance</span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountEarning}`}>
                      ₦{formatCurrency(earnings?.transport_allowance)}
                    </span>
                  </div>
                </div>

                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>Medical Allowance</span>
                    <span className={styles.itemSubtext}>Healthcare Support</span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountEarning}`}>
                      ₦{formatCurrency(earnings?.medical_allowance)}
                    </span>
                  </div>
                </div>

                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>Utility Allowance</span>
                    <span className={styles.itemSubtext}>Utilities & Maintenance</span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountEarning}`}>
                      ₦{formatCurrency(earnings?.utility_allowance)}
                    </span>
                  </div>
                </div>

                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>Meal Allowance</span>
                    <span className={styles.itemSubtext}>Daily Meal Subsidy</span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountEarning}`}>
                      ₦{formatCurrency(earnings?.meal_allowance)}
                    </span>
                  </div>
                </div>

                {/* Additional / Variable Earnings */}
                {earnings?.earning_variables && earnings.earning_variables.length > 0 && (
                  earnings.earning_variables.map((ev, index) => (
                    <div key={index} className={styles.listItem}>
                      <div className={styles.itemLeft}>
                        <span className={styles.itemName}>{ev.name}</span>
                        <span className={styles.itemSubtext}>Additional Monthly Allowance</span>
                      </div>
                      <div className={styles.itemRight}>
                        <span className={`${styles.itemAmount} ${styles.itemAmountEarning}`}>
                          ₦{formatCurrency(ev.amount)}
                        </span>
                        <span className={`${styles.badge} ${styles.badgeInfo}`}>Variable</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Deductions Breakdown Card */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionCardHeader}>
                <h2 className={`${styles.sectionTitle} ${styles.titleDeductions}`}>
                  <TrendingDown size={18} />
                  Itemized Monthly Deductions
                </h2>
                <span className={`${styles.sectionTotal} ${styles.titleDeductions}`}>
                  - ₦{formatCurrency(deductions?.total_deductions)}
                </span>
              </div>

              <div className={styles.listGroup}>
                {/* 1. PAYE Tax */}
                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>PAYE Tax</span>
                    <span className={styles.itemSubtext}>Nigeria Progressive Tax Act 2025/2026</span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                      {deductions?.paye_tax?.amount > 0 ? `- ₦${formatCurrency(deductions.paye_tax.amount)}` : '₦0.00'}
                    </span>
                    {deductions?.paye_tax?.amount === 0 && (
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>Tax Exempt</span>
                    )}
                  </div>
                </div>

                {/* 2. Pension */}
                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>Pension Contribution</span>
                    <span className={styles.itemSubtext}>8% Statutory Pension</span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                      {deductions?.pension?.amount > 0 ? `- ₦${formatCurrency(deductions.pension.amount)}` : '₦0.00'}
                    </span>
                    {deductions?.pension?.is_active ? (
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>Active ({deductions.pension.rate}%)</span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeMuted}`}>Not Active</span>
                    )}
                  </div>
                </div>

                {/* 3. Retention */}
                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>Staff Retention (5%)</span>
                    <span className={styles.itemSubtext}>
                      {deductions?.retention?.num_rente_months >= 20 
                        ? 'Completed (20/20 months)'
                        : `Progress: Month ${deductions?.retention?.num_rente_months || 0} of 20 (${deductions?.retention?.remaining_months || 0} mos remaining)`
                      }
                    </span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                      {deductions?.retention?.amount > 0 ? `- ₦${formatCurrency(deductions.retention.amount)}` : '₦0.00'}
                    </span>
                    {deductions?.retention?.num_rente_months >= 20 ? (
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>Completed</span>
                    ) : deductions?.retention?.is_active ? (
                      <span className={`${styles.badge} ${styles.badgeWarning}`}>Active (5%)</span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeMuted}`}>Inactive</span>
                    )}
                  </div>
                </div>

                {/* 4. IOU / Salary Advance */}
                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>IOU / Salary Advances</span>
                    <span className={styles.itemSubtext}>
                      {deductions?.iou?.count > 0 ? `${deductions.iou.count} Approved IOU application(s)` : 'No active IOU this month'}
                    </span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                      {deductions?.iou?.amount > 0 ? `- ₦${formatCurrency(deductions.iou.amount)}` : '₦0.00'}
                    </span>
                    {deductions?.iou?.count > 0 && (
                      <span className={`${styles.badge} ${styles.badgeWarning}`}>Approved</span>
                    )}
                  </div>
                </div>

                {/* 5. Medical Loan */}
                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>Medical Loan Repayment</span>
                    <span className={styles.itemSubtext}>
                      {deductions?.medical_loan?.balance_remaining > 0
                        ? `Balance Remaining: ₦${formatCurrency(deductions.medical_loan.balance_remaining)}`
                        : 'No active medical loan'
                      }
                    </span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                      {deductions?.medical_loan?.amount > 0 ? `- ₦${formatCurrency(deductions.medical_loan.amount)}` : '₦0.00'}
                    </span>
                    {deductions?.medical_loan?.is_active && (
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>Active Loan</span>
                    )}
                  </div>
                </div>

                {/* 6. Cooperative Loan */}
                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>Cooperative Loan Repayment</span>
                    <span className={styles.itemSubtext}>
                      {deductions?.coop_loan?.balance_remaining > 0
                        ? `Balance Remaining: ₦${formatCurrency(deductions.coop_loan.balance_remaining)}`
                        : 'No active coop loan'
                      }
                    </span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                      {deductions?.coop_loan?.amount > 0 ? `- ₦${formatCurrency(deductions.coop_loan.amount)}` : '₦0.00'}
                    </span>
                    {deductions?.coop_loan?.is_active && (
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>Active</span>
                    )}
                  </div>
                </div>

                {/* 7. Cooperative Savings */}
                <div className={styles.listItem}>
                  <div className={styles.itemLeft}>
                    <span className={styles.itemName}>Cooperative Monthly Savings</span>
                    <span className={styles.itemSubtext}>
                      Cumulative Savings Balance: <strong style={{ color: '#059669', fontWeight: 600 }}>₦{formatCurrency(deductions?.coop_savings?.saving_balance ?? deductions?.coop_savings?.balance ?? deductions?.coop_savings?.balance_remaining ?? data?.balances?.coop_savings_balance ?? 0)}</strong>
                    </span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                      {deductions?.coop_savings?.amount > 0 ? `- ₦${formatCurrency(deductions.coop_savings.amount)}` : '₦0.00'}
                    </span>
                    {deductions?.coop_savings?.is_active ? (
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>Active</span>
                    ) : (
                      ((deductions?.coop_savings?.saving_balance || 0) > 0 || (data?.balances?.coop_savings_balance || 0) > 0) ? (
                        <span className={`${styles.badge} ${styles.badgeInfo}`}>Balance on Record</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeMuted}`}>Not Active</span>
                      )
                    )}
                  </div>
                </div>

                {/* 8. Cooperative Asset Finance */}
                {deductions?.coop_asset_finance?.amount > 0 && (
                  <div className={styles.listItem}>
                    <div className={styles.itemLeft}>
                      <span className={styles.itemName}>Cooperative Asset Finance</span>
                      <span className={styles.itemSubtext}>
                        Balance Remaining: ₦{formatCurrency(deductions.coop_asset_finance.balance_remaining)}
                      </span>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                        - ₦{formatCurrency(deductions.coop_asset_finance.amount)}
                      </span>
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>Active</span>
                    </div>
                  </div>
                )}

                {/* 9. Surcharges */}
                {deductions?.surcharges?.amount > 0 && (
                  <div className={styles.listItem}>
                    <div className={styles.itemLeft}>
                      <span className={styles.itemName}>Surcharges</span>
                      <span className={styles.itemSubtext}>
                        Balance Remaining: ₦{formatCurrency(deductions.surcharges.balance_remaining)}
                      </span>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                        - ₦{formatCurrency(deductions.surcharges.amount)}
                      </span>
                      <span className={`${styles.badge} ${styles.badgeWarning}`}>Surcharge</span>
                    </div>
                  </div>
                )}

                {/* 10. Absence Penalty */}
                {deductions?.absence_penalty?.amount > 0 && (
                  <div className={styles.listItem}>
                    <div className={styles.itemLeft}>
                      <span className={styles.itemName}>Absence Penalty</span>
                      <span className={styles.itemSubtext}>
                        Balance: ₦{formatCurrency(deductions.absence_penalty.balance_remaining)}
                      </span>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                        - ₦{formatCurrency(deductions.absence_penalty.amount)}
                      </span>
                      <span className={`${styles.badge} ${styles.badgeWarning}`}>Penalty</span>
                    </div>
                  </div>
                )}

                {/* 11. Leave of Absence */}
                {deductions?.leave_of_absence?.amount > 0 && (
                  <div className={styles.listItem}>
                    <div className={styles.itemLeft}>
                      <span className={styles.itemName}>Leave of Absence (Unpaid Days)</span>
                      <span className={styles.itemSubtext}>
                        {deductions.leave_of_absence.days_absent} unpaid day(s) deducted
                      </span>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                        - ₦{formatCurrency(deductions.leave_of_absence.amount)}
                      </span>
                      <span className={`${styles.badge} ${styles.badgeWarning}`}>LOA</span>
                    </div>
                  </div>
                )}

                {/* 11b. Mid-Month Appointment Adjustment */}
                {deductions?.mid_month_adjustment?.amount > 0 && (
                  <div className={styles.listItem}>
                    <div className={styles.itemLeft}>
                      <span className={styles.itemName}>Mid-Month Appointment Adjustment</span>
                      <span className={styles.itemSubtext}>
                        Joined {deductions.mid_month_adjustment.appointment_date ? new Date(deductions.mid_month_adjustment.appointment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'mid-month'} ({deductions.mid_month_adjustment.unworked_days} unworked day(s) prorated deduction)
                      </span>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                        - ₦{formatCurrency(deductions.mid_month_adjustment.amount)}
                      </span>
                      <span className={`${styles.badge}`} style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.25)' }}>Prorated</span>
                    </div>
                  </div>
                )}

                {/* 12. Employee Loans / Other Deductions */}
                {deductions?.regular_loan?.amount > 0 && (
                  <div className={styles.listItem}>
                    <div className={styles.itemLeft}>
                      <span className={styles.itemName}>Employee Loan</span>
                      <span className={styles.itemSubtext}>
                        Balance: ₦{formatCurrency(deductions.regular_loan.balance_remaining)}
                      </span>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                        - ₦{formatCurrency(deductions.regular_loan.amount)}
                      </span>
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>Loan</span>
                    </div>
                  </div>
                )}

                {deductions?.other_deductions?.amount > 0 && (
                  <div className={styles.listItem}>
                    <div className={styles.itemLeft}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className={styles.itemName}>Other Deductions</span>
                        {deductions.other_deductions.remarks && (
                          <span
                            className={styles.badge}
                            style={{
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#b45309',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textTransform: 'none',
                              letterSpacing: 'normal',
                              padding: '2px 8px',
                              borderRadius: '4px'
                            }}
                          >
                            {deductions.other_deductions.remarks}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={`${styles.itemAmount} ${styles.itemAmountDeduction}`}>
                        - ₦{formatCurrency(deductions.other_deductions.amount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Standalone Non-Gross Additions (Allowances & Bonuses) */}
          {((earnings?.custom_allowances && earnings.custom_allowances.length > 0) ||
            (earnings?.bonuses && earnings.bonuses.length > 0) ||
            ((earnings?.total_custom_allowances || 0) + (earnings?.total_bonuses || 0) > 0)) && (
            <div className={styles.balancesOverviewCard} style={{ border: '1px solid #bfdbfe', background: '#f8fafc' }}>
              <div className={styles.balancesOverviewHeader}>
                <h3 className={styles.balancesOverviewTitle}>
                  <TrendingUp size={20} style={{ color: '#2563eb' }} />
                  <span>Standalone Additions (Non-Gross Allowances & Bonuses)</span>
                </h3>
                <span className={styles.balancesOverviewSub} style={{ fontWeight: 700, color: '#2563eb' }}>
                  Total Standalone Additions: + ₦{formatCurrency((earnings?.total_custom_allowances || 0) + (earnings?.total_bonuses || 0))}
                </span>
              </div>
              <div className={styles.listGroup}>
                {earnings?.custom_allowances && earnings.custom_allowances.map((ca) => (
                  <div key={ca.id} className={styles.listItem} style={{ background: '#ffffff' }}>
                    <div className={styles.itemLeft}>
                      <span className={styles.itemName}>{ca.title}</span>
                      <span className={styles.itemSubtext}>
                        {ca.frequency === 'one_time' ? 'One-Time' : 'Recurring'} Custom Allowance
                      </span>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={`${styles.itemAmount} ${styles.itemAmountEarning}`} style={{ color: '#059669', fontSize: '1rem' }}>
                        + ₦{formatCurrency(ca.amount)}
                      </span>
                      <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ textTransform: 'capitalize' }}>
                        {ca.category ? ca.category.replace(/_/g, ' ') : 'Allowance'}
                      </span>
                    </div>
                  </div>
                ))}
                {earnings?.bonuses && earnings.bonuses.map((b) => (
                  <div key={b.id} className={styles.listItem} style={{ background: '#ffffff' }}>
                    <div className={styles.itemLeft}>
                      <span className={styles.itemName}>{b.title}</span>
                      <span className={styles.itemSubtext}>
                        {b.frequency === 'one_time' ? 'One-Time' : 'Recurring'} Bonus
                      </span>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={`${styles.itemAmount} ${styles.itemAmountEarning}`} style={{ color: '#d97706', fontSize: '1rem' }}>
                        + ₦{formatCurrency(b.amount)}
                      </span>
                      <span className={`${styles.badge}`} style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.25)', textTransform: 'capitalize' }}>
                        {b.category ? b.category.replace(/_/g, ' ') : 'Bonus'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Balances & Outstanding Overview */}
          <div className={styles.balancesOverviewCard}>
            <div className={styles.balancesOverviewHeader}>
              <h3 className={styles.balancesOverviewTitle}>
                <PiggyBank size={20} style={{ color: '#059669' }} />
                <span>Savings & Outstanding Balances Summary</span>
              </h3>
              <span className={styles.balancesOverviewSub}>
                Real-time snapshot of cooperative savings accumulation & active loan balances
              </span>
            </div>

            <div className={styles.balancesOverviewGrid}>
              {/* 1. Cooperative Savings Balance */}
              <div className={`${styles.overviewCardItem} ${styles.overviewCardSavings}`}>
                <div className={`${styles.overviewIconWrap} ${styles.overviewIconSavings}`}>
                  <Wallet size={22} />
                </div>
                <div className={styles.overviewItemInfo}>
                  <div className={styles.overviewItemLabel}>Cooperative Savings Balance</div>
                  <div className={styles.overviewItemValueSavings}>
                    ₦{formatCurrency(deductions?.coop_savings?.saving_balance ?? deductions?.coop_savings?.balance ?? deductions?.coop_savings?.balance_remaining ?? data?.balances?.coop_savings_balance ?? 0)}
                  </div>
                  <div className={styles.overviewItemDetail}>
                    {deductions?.coop_savings?.amount > 0 ? (
                      <span style={{ color: '#047857', fontWeight: 600 }}>
                        + ₦{formatCurrency(deductions.coop_savings.amount)}/mo deduction
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>Cumulative savings balance</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Cooperative Loan Balance */}
              <div className={styles.overviewCardItem}>
                <div className={`${styles.overviewIconWrap} ${styles.overviewIconLoan}`}>
                  <CreditCard size={22} />
                </div>
                <div className={styles.overviewItemInfo}>
                  <div className={styles.overviewItemLabel}>Cooperative Loan Balance</div>
                  <div className={styles.overviewItemValue}>
                    ₦{formatCurrency(deductions?.coop_loan?.balance_remaining ?? data?.balances?.coop_loan_balance ?? 0)}
                  </div>
                  <div className={styles.overviewItemDetail}>
                    {deductions?.coop_loan?.amount > 0 ? (
                      <span>- ₦{formatCurrency(deductions.coop_loan.amount)}/mo repayment</span>
                    ) : (
                      <span style={{ color: '#64748b' }}>No active coop loan balance</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Cooperative Asset Finance */}
              <div className={styles.overviewCardItem}>
                <div className={`${styles.overviewIconWrap} ${styles.overviewIconAsset}`}>
                  <ShoppingBag size={22} />
                </div>
                <div className={styles.overviewItemInfo}>
                  <div className={styles.overviewItemLabel}>Coop Asset Finance Balance</div>
                  <div className={styles.overviewItemValue}>
                    ₦{formatCurrency(deductions?.coop_asset_finance?.balance_remaining ?? data?.balances?.coop_asset_finance_balance ?? 0)}
                  </div>
                  <div className={styles.overviewItemDetail}>
                    {deductions?.coop_asset_finance?.amount > 0 ? (
                      <span>- ₦{formatCurrency(deductions.coop_asset_finance.amount)}/mo deduction</span>
                    ) : (
                      <span style={{ color: '#64748b' }}>No active asset finance</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Medical Loan Balance */}
              <div className={styles.overviewCardItem}>
                <div className={`${styles.overviewIconWrap} ${styles.overviewIconMedical}`}>
                  <HeartPulse size={22} />
                </div>
                <div className={styles.overviewItemInfo}>
                  <div className={styles.overviewItemLabel}>Medical Loan Balance</div>
                  <div className={styles.overviewItemValue}>
                    ₦{formatCurrency(deductions?.medical_loan?.balance_remaining ?? data?.balances?.medical_loan_balance ?? 0)}
                  </div>
                  <div className={styles.overviewItemDetail}>
                    {deductions?.medical_loan?.amount > 0 ? (
                      <span>- ₦{formatCurrency(deductions.medical_loan.amount)}/mo deduction</span>
                    ) : (
                      <span style={{ color: '#64748b' }}>No active medical loan</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '0.85rem',
          padding: '3.5rem 1.5rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          marginTop: '1rem'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.1)',
            color: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto'
          }}>
            <Users size={30} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: '0 0 0.5rem 0' }}>
            Select a Staff Member
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #64748b)', margin: '0 auto', maxWidth: '480px', lineHeight: 1.5 }}>
            Search and select an employee above to preview their individual salary breakdown, or click <strong>Generate All Staff Payroll Sheet</strong> to view the consolidated schedule.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. INDIVIDUAL STAFF PAYROLL SHEET MODAL */}
      {/* ========================================================================= */}
      {showStaffSheetModal && data && staff && (
        <div className={styles.modalOverlay} onClick={() => setShowStaffSheetModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <FileText size={20} style={{ color: 'var(--primary, #6366f1)' }} />
                Staff Monthly Payroll Sheet
              </h2>
              <button 
                type="button" 
                className={styles.closeBtn}
                onClick={() => setShowStaffSheetModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={`${styles.sheetPaper} ${styles.paperContainer} ${styles.printCard}`}>
                {/* Company Header */}
                <div className={styles.companyHeader}>
                  <h2>ISALU HOSPITALS LIMITED</h2>
                  <div className={styles.sheetSubtitle}>MONTHLY PAYROLL BREAKDOWN SHEET</div>
                  <div className={styles.sheetPeriodMeta}>
                    <span>Period: <strong>{period?.period_str}</strong></span>
                    <span>Status: <strong>{period?.is_computed ? 'Finalized Payroll' : 'Pre-Compute Estimate'}</strong></span>
                    <span>Date Generated: <strong>{new Date().toLocaleDateString('en-GB')}</strong></span>
                  </div>
                </div>

                {/* Staff Information Box */}
                <div className={styles.sheetStaffBox}>
                  <div className={styles.sheetField}>
                    <span className={styles.sheetFieldLabel}>Staff Name:</span>
                    <span className={styles.sheetFieldValue}>{staff.name}</span>
                  </div>
                  <div className={styles.sheetField}>
                    <span className={styles.sheetFieldLabel}>Staff ID:</span>
                    <span className={styles.sheetFieldValue}>{staff.id}</span>
                  </div>
                  <div className={styles.sheetField}>
                    <span className={styles.sheetFieldLabel}>Department:</span>
                    <span className={styles.sheetFieldValue}>{staff.department}</span>
                  </div>
                  <div className={styles.sheetField}>
                    <span className={styles.sheetFieldLabel}>Designation:</span>
                    <span className={styles.sheetFieldValue}>{staff.designation}</span>
                  </div>
                  {staff.bank_name && (
                    <div className={styles.sheetField}>
                      <span className={styles.sheetFieldLabel}>Bank:</span>
                      <span className={styles.sheetFieldValue}>{staff.bank_name}</span>
                    </div>
                  )}
                  {staff.account_number && (
                    <div className={styles.sheetField}>
                      <span className={styles.sheetFieldLabel}>Account No:</span>
                      <span className={styles.sheetFieldValue}>{staff.account_number}</span>
                    </div>
                  )}
                  <div className={styles.sheetField}>
                    <span className={styles.sheetFieldLabel}>Paid Days:</span>
                    <span className={styles.sheetFieldValue} style={{ fontWeight: 700, color: (deductions?.leave_of_absence?.days_absent || 0) > 0 ? '#ea580c' : 'inherit' }}>
                      {period?.paid_days ?? summary?.paid_days ?? ((period?.days_in_month || summary?.days_in_month || getDaysInMonth(selectedMonth, selectedYear)) - (deductions?.leave_of_absence?.days_absent || 0))} / {period?.days_in_month ?? summary?.days_in_month ?? getDaysInMonth(selectedMonth, selectedYear)} Days
                      {(deductions?.leave_of_absence?.days_absent || 0) > 0 && (
                        <span style={{ fontSize: '0.78rem', color: '#dc2626', marginLeft: '6px', fontWeight: 600 }}>
                          ({deductions.leave_of_absence.days_absent} Unpaid Day(s) LOA)
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Dual Column Structure */}
                <div className={styles.sheetGrid}>
                  {/* Earnings */}
                  <div className={styles.sheetSection}>
                    <div className={styles.sheetSectionHeader}>
                      <span>EARNINGS & ALLOWANCES</span>
                      <span>AMOUNT (₦)</span>
                    </div>
                    <div className={styles.sheetRow}>
                      <span>Basic Salary</span>
                      <span>{formatCurrency(earnings?.basic_salary)}</span>
                    </div>
                    <div className={styles.sheetRow}>
                      <span>Housing Allowance</span>
                      <span>{formatCurrency(earnings?.housing_allowance)}</span>
                    </div>
                    <div className={styles.sheetRow}>
                      <span>Transport Allowance</span>
                      <span>{formatCurrency(earnings?.transport_allowance)}</span>
                    </div>
                    <div className={styles.sheetRow}>
                      <span>Medical Allowance</span>
                      <span>{formatCurrency(earnings?.medical_allowance)}</span>
                    </div>
                    <div className={styles.sheetRow}>
                      <span>Utility Allowance</span>
                      <span>{formatCurrency(earnings?.utility_allowance)}</span>
                    </div>
                    <div className={styles.sheetRow}>
                      <span>Meal Allowance</span>
                      <span>{formatCurrency(earnings?.meal_allowance)}</span>
                    </div>
                    {earnings?.earning_variables && earnings.earning_variables.map((ev, i) => (
                      <div key={i} className={styles.sheetRow}>
                        <span>{ev.name}</span>
                        <span>{formatCurrency(ev.amount)}</span>
                      </div>
                    ))}
                    {earnings?.custom_allowances && earnings.custom_allowances.map((ca) => (
                      <div key={ca.id} className={styles.sheetRow}>
                        <span>{ca.title} (Allowance)</span>
                        <span>{formatCurrency(ca.amount)}</span>
                      </div>
                    ))}
                    {earnings?.bonuses && earnings.bonuses.map((b) => (
                      <div key={b.id} className={styles.sheetRow}>
                        <span>{b.title} (Bonus)</span>
                        <span>{formatCurrency(b.amount)}</span>
                      </div>
                    ))}
                    <div className={`${styles.sheetRow} ${styles.sheetRowTotal}`}>
                      <span>TOTAL GROSS INCOME</span>
                      <span>₦{formatCurrency(earnings?.gross_pay)}</span>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className={styles.sheetSection}>
                    <div className={styles.sheetSectionHeader}>
                      <span>ITEMIZED DEDUCTIONS</span>
                      <span>AMOUNT (₦)</span>
                    </div>
                    <div className={styles.sheetRow}>
                      <span>PAYE Tax</span>
                      <span>{formatCurrency(deductions?.paye_tax?.amount)}</span>
                    </div>
                    <div className={styles.sheetRow}>
                      <span>Pension Contribution (8%)</span>
                      <span>{formatCurrency(deductions?.pension?.amount)}</span>
                    </div>
                    <div className={styles.sheetRow}>
                      <span>Staff Retention (5%)</span>
                      <span>{formatCurrency(deductions?.retention?.amount)}</span>
                    </div>
                    {deductions?.iou?.amount > 0 && (
                      <div className={styles.sheetRow}>
                        <span>IOU / Salary Advances</span>
                        <span>{formatCurrency(deductions.iou.amount)}</span>
                      </div>
                    )}
                    {deductions?.medical_loan?.amount > 0 && (
                      <div className={styles.sheetRow}>
                        <span>Medical Loan Repayment</span>
                        <span>{formatCurrency(deductions.medical_loan.amount)}</span>
                      </div>
                    )}
                    {deductions?.coop_loan?.amount > 0 && (
                      <div className={styles.sheetRow}>
                        <span>Coop Loan Repayment</span>
                        <span>{formatCurrency(deductions.coop_loan.amount)}</span>
                      </div>
                    )}
                    {deductions?.coop_savings?.amount > 0 && (
                      <div className={styles.sheetRow}>
                        <span>
                          Cooperative Monthly Savings
                          <span style={{ display: 'block', fontSize: '0.685rem', color: '#059669', fontWeight: 600 }}>
                            (Cumulative Savings Balance: ₦{formatCurrency(deductions?.coop_savings?.saving_balance ?? deductions?.coop_savings?.balance ?? deductions?.coop_savings?.balance_remaining ?? data?.balances?.coop_savings_balance ?? 0)})
                          </span>
                        </span>
                        <span>{formatCurrency(deductions.coop_savings.amount)}</span>
                      </div>
                    )}
                    {deductions?.coop_asset_finance?.amount > 0 && (
                      <div className={styles.sheetRow}>
                        <span>Coop Asset Finance</span>
                        <span>{formatCurrency(deductions.coop_asset_finance.amount)}</span>
                      </div>
                    )}
                    {deductions?.surcharges?.amount > 0 && (
                      <div className={styles.sheetRow}>
                        <span>Surcharges</span>
                        <span>{formatCurrency(deductions.surcharges.amount)}</span>
                      </div>
                    )}
                    {deductions?.absence_penalty?.amount > 0 && (
                      <div className={styles.sheetRow}>
                        <span>Absence Penalty</span>
                        <span>{formatCurrency(deductions.absence_penalty.amount)}</span>
                      </div>
                    )}
                    {deductions?.leave_of_absence?.amount > 0 && (
                      <div className={styles.sheetRow}>
                        <span>Leave of Absence ({deductions.leave_of_absence.days_absent} days)</span>
                        <span>{formatCurrency(deductions.leave_of_absence.amount)}</span>
                      </div>
                    )}
                    {deductions?.mid_month_adjustment?.amount > 0 && (
                      <div className={styles.sheetRow}>
                        <span>Mid-Month Appointment Adjustment ({deductions.mid_month_adjustment.unworked_days} unworked days)</span>
                        <span>{formatCurrency(deductions.mid_month_adjustment.amount)}</span>
                      </div>
                    )}
                    {deductions?.regular_loan?.amount > 0 && (
                      <div className={styles.sheetRow}>
                        <span>Employee Loan</span>
                        <span>{formatCurrency(deductions.regular_loan.amount)}</span>
                      </div>
                    )}
                    {deductions?.other_deductions?.amount > 0 && (
                      <div className={styles.sheetRow}>
                        <span>
                          Other Deductions
                          {deductions.other_deductions.remarks && (
                            <span style={{ fontSize: '0.75rem', color: '#b45309', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '2px 8px', borderRadius: '4px', marginLeft: '6px', fontWeight: 600 }}>
                              {deductions.other_deductions.remarks}
                            </span>
                          )}
                        </span>
                        <span>{formatCurrency(deductions.other_deductions.amount)}</span>
                      </div>
                    )}
                    <div className={`${styles.sheetRow} ${styles.sheetRowTotal}`}>
                      <span>TOTAL DEDUCTIONS</span>
                      <span>₦{formatCurrency(deductions?.total_deductions)}</span>
                    </div>
                  </div>
                </div>

                {/* Balances & Outstanding Information Section */}
                <div className={styles.sheetBalancesContainer}>
                  <div className={styles.sheetBalancesHeader}>
                    BALANCES & OUTSTANDING INFORMATION
                  </div>
                  <div className={styles.sheetBalancesGrid}>
                    <div className={styles.sheetBalanceItem}>
                      <span className={styles.sheetBalanceLabel}>Cop. Contr. (Savings Bal):</span>
                      <span className={styles.sheetBalanceVal} style={{ color: '#047857', fontWeight: 700 }}>
                        ₦{formatCurrency(deductions?.coop_savings?.saving_balance ?? deductions?.coop_savings?.balance ?? deductions?.coop_savings?.balance_remaining ?? data?.balances?.coop_savings_balance ?? 0)}
                      </span>
                    </div>
                    <div className={styles.sheetBalanceItem}>
                      <span className={styles.sheetBalanceLabel}>Cop. Loan Bal:</span>
                      <span className={styles.sheetBalanceVal}>
                        ₦{formatCurrency(deductions?.coop_loan?.balance_remaining ?? data?.balances?.coop_loan_balance ?? 0)}
                      </span>
                    </div>
                    <div className={styles.sheetBalanceItem}>
                      <span className={styles.sheetBalanceLabel}>Cop. Asset Fin Bal:</span>
                      <span className={styles.sheetBalanceVal}>
                        ₦{formatCurrency(deductions?.coop_asset_finance?.balance_remaining ?? data?.balances?.coop_asset_finance_balance ?? 0)}
                      </span>
                    </div>
                    <div className={styles.sheetBalanceItem}>
                      <span className={styles.sheetBalanceLabel}>Med. Debt Bal:</span>
                      <span className={styles.sheetBalanceVal}>
                        ₦{formatCurrency(deductions?.medical_loan?.balance_remaining ?? data?.balances?.medical_loan_balance ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Net Pay Banner */}
                <div className={styles.netPayBanner} style={summary?.net_pay < 0 ? { borderLeftColor: '#ef4444' } : {}}>
                  <div>
                    <h3>Estimated Net Take-Home Pay</h3>
                    <span>{summary?.net_pay < 0 ? 'Deficit balance payable / carryover' : 'Monthly payment payable to employee'}</span>
                  </div>
                  <div className={styles.netAmount} style={summary?.net_pay < 0 ? { color: '#dc2626' } : {}}>
                    {formatNaira(summary?.net_pay)}
                  </div>
                </div>

                {/* Signatures */}
                <div className={styles.sheetFooterSign}>
                  <div className={styles.signBox}>
                    <div className={styles.signLine}></div>
                    <span>Prepared By (HR)</span>
                  </div>
                  <div className={styles.signBox}>
                    <div className={styles.signLine}></div>
                    <span>Checked By (Audit)</span>
                  </div>
                  <div className={styles.signBox}>
                    <div className={styles.signLine}></div>
                    <span>Approved By (Finance/MD)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                type="button" 
                className={`${styles.btn} ${styles.btnSuccess}`} 
                onClick={handleExportStaffExcel}
                disabled={exportingStaffExcel}
              >
                {exportingStaffExcel ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                {exportingStaffExcel ? 'Generating...' : 'Download Spreadsheet (.csv)'}
              </button>
              <button 
                type="button" 
                className={`${styles.btn} ${styles.btnPrimary}`} 
                onClick={() => window.print()}
              >
                <Printer size={16} />
                Print Sheet
              </button>
              <button 
                type="button" 
                className={`${styles.btn} ${styles.btnOutline}`} 
                onClick={() => setShowStaffSheetModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ALL STAFF CONSOLIDATED PAYROLL SHEET & VARIANCE SUMMARY MODAL */}
      {/* ========================================================================= */}
      {showAllStaffModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAllStaffModal(false)}>
          <div className={`${styles.modalContent} ${styles.allStaffModalContent}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2 className={styles.modalTitle}>
                  {allStaffActiveTab === 'sheet' ? (
                    <>
                      <Users size={22} style={{ color: 'var(--primary, #6366f1)' }} />
                      All Staff Monthly Payroll Sheet ({MONTHS.find(m => m.id === selectedMonth)?.name} {selectedYear})
                    </>
                  ) : (
                    <>
                      <TrendingUp size={22} style={{ color: '#0284c7' }} />
                      Monthly Payroll Variance Summary ({varianceData?.previous_period?.period_str || 'Previous Month'} vs {varianceData?.current_period?.period_str || `${MONTHS.find(m => m.id === selectedMonth)?.name} ${selectedYear}`})
                    </>
                  )}
                </h2>
              </div>
              <button 
                type="button" 
                className={styles.closeBtn}
                onClick={() => setShowAllStaffModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className={styles.modalTabsContainer}>
              <button
                type="button"
                className={`${styles.modalTabBtn} ${allStaffActiveTab === 'sheet' ? styles.modalTabBtnActive : ''}`}
                onClick={() => setAllStaffActiveTab('sheet')}
              >
                <FileSpreadsheet size={16} />
                All Staff Payroll Sheet
              </button>

              <button
                type="button"
                className={`${styles.modalTabBtn} ${allStaffActiveTab === 'variance' ? styles.modalTabBtnActive : ''}`}
                onClick={() => {
                  setAllStaffActiveTab('variance');
                  if (!varianceData) fetchVarianceData(allStaffDeptFilter, allStaffSearch);
                }}
              >
                <TrendingUp size={16} />
                Variance Summary (Previous vs Current Month)
                {varianceData?.executive_summary?.total_net_pay?.diff !== undefined && (
                  <span className={`${styles.varianceDeltaBadge} ${varianceData.executive_summary.total_net_pay.diff >= 0 ? styles.diffPositive : styles.diffNegative}`}>
                    {varianceData.executive_summary.total_net_pay.diff >= 0 ? '+' : ''}
                    ₦{formatCurrency(varianceData.executive_summary.total_net_pay.diff)}
                  </span>
                )}
              </button>
            </div>

            {allStaffActiveTab === 'variance' ? (
              /* ========================================================================= */
              /* VARIANCE SUMMARY VIEW */
              /* ========================================================================= */
              <div className={styles.varianceContainer}>
                {/* Variance Banner */}
                <div className={styles.varianceBanner}>
                  <div>
                    <h3>
                      <TrendingUp size={20} style={{ color: '#38bdf8' }} />
                      Payroll Variance Analysis ({varianceData?.previous_period?.period_str || 'Previous Month'} ➔ {varianceData?.current_period?.period_str || 'Current Month'})
                    </h3>
                    <p>
                      Reconciliation of employee headcounts, total gross compensation, statutory/loan deductions, and net payroll payouts.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSuccess}`}
                      onClick={handleExportVarianceReport}
                      disabled={exportingVariance || loadingVariance}
                    >
                      {exportingVariance ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                      {exportingVariance ? 'Exporting...' : 'Download Variance Report (.csv)'}
                    </button>
                  </div>
                </div>

                {loadingVariance ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '280px', gap: '1rem' }}>
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary, #6366f1)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Analyzing payroll deltas and variance drivers...</p>
                  </div>
                ) : varianceData ? (
                  <>
                    {/* Executive KPI Variance Cards */}
                    <div className={styles.varianceKpiGrid}>
                      {/* 1. Staff Count */}
                      <div className={styles.varianceKpiCard}>
                        <div className={styles.varianceKpiHeader}>
                          <span className={styles.varianceKpiLabel}>Total Active Staff</span>
                          <span className={`${styles.varianceDeltaBadge} ${varianceData.executive_summary.total_staff.diff > 0 ? styles.diffPositive : (varianceData.executive_summary.total_staff.diff < 0 ? styles.diffNegative : styles.diffNeutral)}`}>
                            {varianceData.executive_summary.total_staff.diff >= 0 ? '+' : ''}{varianceData.executive_summary.total_staff.diff} ({varianceData.executive_summary.total_staff.percent_change}%)
                          </span>
                        </div>
                        <div className={styles.varianceKpiVal}>
                          {varianceData.executive_summary.total_staff.current}
                        </div>
                        <div className={styles.varianceKpiSubtext}>
                          <span>Previous: <strong>{varianceData.executive_summary.total_staff.previous}</strong></span>
                        </div>
                      </div>

                      {/* 2. Total Gross */}
                      <div className={styles.varianceKpiCard}>
                        <div className={styles.varianceKpiHeader}>
                          <span className={styles.varianceKpiLabel}>Total Gross Income</span>
                          <span className={`${styles.varianceDeltaBadge} ${varianceData.executive_summary.total_gross.diff > 0 ? styles.diffPositive : (varianceData.executive_summary.total_gross.diff < 0 ? styles.diffNegative : styles.diffNeutral)}`}>
                            {varianceData.executive_summary.total_gross.diff >= 0 ? '+' : ''}₦{formatCurrency(varianceData.executive_summary.total_gross.diff)} ({varianceData.executive_summary.total_gross.percent_change}%)
                          </span>
                        </div>
                        <div className={styles.varianceKpiVal} style={{ color: '#0284c7' }}>
                          ₦{formatCurrency(varianceData.executive_summary.total_gross.current)}
                        </div>
                        <div className={styles.varianceKpiSubtext}>
                          <span>Previous: <strong>₦{formatCurrency(varianceData.executive_summary.total_gross.previous)}</strong></span>
                        </div>
                      </div>

                      {/* 3. Total Deductions */}
                      <div className={styles.varianceKpiCard}>
                        <div className={styles.varianceKpiHeader}>
                          <span className={styles.varianceKpiLabel}>Total Deductions</span>
                          <span className={`${styles.varianceDeltaBadge} ${varianceData.executive_summary.total_deductions.diff > 0 ? styles.diffNegative : (varianceData.executive_summary.total_deductions.diff < 0 ? styles.diffPositive : styles.diffNeutral)}`}>
                            {varianceData.executive_summary.total_deductions.diff >= 0 ? '+' : ''}₦{formatCurrency(varianceData.executive_summary.total_deductions.diff)} ({varianceData.executive_summary.total_deductions.percent_change}%)
                          </span>
                        </div>
                        <div className={styles.varianceKpiVal} style={{ color: '#dc2626' }}>
                          - ₦{formatCurrency(varianceData.executive_summary.total_deductions.current)}
                        </div>
                        <div className={styles.varianceKpiSubtext}>
                          <span>Previous: <strong>- ₦{formatCurrency(varianceData.executive_summary.total_deductions.previous)}</strong></span>
                        </div>
                      </div>

                      {/* 4. Estimated Net Pay */}
                      <div className={styles.varianceKpiCard}>
                        <div className={styles.varianceKpiHeader}>
                          <span className={styles.varianceKpiLabel}>Estimated Net Pay</span>
                          <span className={`${styles.varianceDeltaBadge} ${varianceData.executive_summary.total_net_pay.diff >= 0 ? styles.diffPositive : styles.diffNegative}`}>
                            {varianceData.executive_summary.total_net_pay.diff >= 0 ? '+' : ''}₦{formatCurrency(varianceData.executive_summary.total_net_pay.diff)} ({varianceData.executive_summary.total_net_pay.percent_change}%)
                          </span>
                        </div>
                        <div className={styles.varianceKpiVal} style={{ color: varianceData.executive_summary.total_net_pay.current < 0 ? '#dc2626' : '#059669' }}>
                          ₦{formatCurrency(varianceData.executive_summary.total_net_pay.current)}
                        </div>
                        <div className={styles.varianceKpiSubtext}>
                          <span>Previous: <strong>₦{formatCurrency(varianceData.executive_summary.total_net_pay.previous)}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Sub-view Navigation Bar */}
                    <div className={styles.varianceSubNav}>
                      <div className={styles.varianceSubTabs}>
                        <button
                          type="button"
                          className={`${styles.varianceSubTabBtn} ${varianceSubTab === 'summary' ? styles.varianceSubTabBtnActive : ''}`}
                          onClick={() => setVarianceSubTab('summary')}
                        >
                          <Layers size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          Component Breakdown
                        </button>
                        <button
                          type="button"
                          className={`${styles.varianceSubTabBtn} ${varianceSubTab === 'staff' ? styles.varianceSubTabBtnActive : ''}`}
                          onClick={() => setVarianceSubTab('staff')}
                        >
                          <Users size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          Staff-Level Variance Register ({varianceData.staff_variances?.length || 0})
                        </button>
                      </div>

                      {varianceSubTab === 'staff' && (
                        <div className={styles.varianceFilterPills}>
                          <button
                            type="button"
                            className={`${styles.filterPill} ${varianceStaffFilter === 'all' ? styles.filterPillActive : ''}`}
                            onClick={() => setVarianceStaffFilter('all')}
                          >
                            All ({varianceData.counts?.total_compared || 0})
                          </button>
                          <button
                            type="button"
                            className={`${styles.filterPill} ${varianceStaffFilter === 'increased' ? styles.filterPillActive : ''}`}
                            onClick={() => setVarianceStaffFilter('increased')}
                          >
                            Net Increased ({varianceData.counts?.increased || 0})
                          </button>
                          <button
                            type="button"
                            className={`${styles.filterPill} ${varianceStaffFilter === 'decreased' ? styles.filterPillActive : ''}`}
                            onClick={() => setVarianceStaffFilter('decreased')}
                          >
                            Net Decreased ({varianceData.counts?.decreased || 0})
                          </button>
                          <button
                            type="button"
                            className={`${styles.filterPill} ${varianceStaffFilter === 'new_joiner' ? styles.filterPillActive : ''}`}
                            onClick={() => setVarianceStaffFilter('new_joiner')}
                          >
                            New Joiners ({varianceData.counts?.new_joiners || 0})
                          </button>
                          <button
                            type="button"
                            className={`${styles.filterPill} ${varianceStaffFilter === 'exited' ? styles.filterPillActive : ''}`}
                            onClick={() => setVarianceStaffFilter('exited')}
                          >
                            Exited ({varianceData.counts?.exited || 0})
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Sub Tab 1: Component Breakdown Table */}
                    {varianceSubTab === 'summary' && (
                      <div className={styles.varianceTableCard}>
                        <table className={styles.varianceTable}>
                          <thead>
                            <tr>
                              <th>Payroll Metric / Component</th>
                              <th>Category</th>
                              <th style={{ textAlign: 'right' }}>Previous Month ({varianceData.previous_period?.period_str})</th>
                              <th style={{ textAlign: 'right' }}>Current Month ({varianceData.current_period?.period_str})</th>
                              <th style={{ textAlign: 'right' }}>Variance (Diff ₦)</th>
                              <th style={{ textAlign: 'right' }}>% Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {varianceData.component_breakdown?.map((c) => {
                              const isNetOrGross = ['gross_pay', 'net_pay', 'total_deductions'].includes(c.key);
                              const isPositiveDiff = c.is_deduction ? c.diff <= 0 : c.diff >= 0;
                              return (
                                <tr key={c.key} style={isNetOrGross ? { background: '#f8fafc', fontWeight: 700 } : {}}>
                                  <td style={{ fontWeight: isNetOrGross ? 700 : 600, color: isNetOrGross ? '#1e293b' : '#334155' }}>
                                    {c.label}
                                  </td>
                                  <td>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '0.25rem', background: c.is_deduction ? '#fee2e2' : '#eff6ff', color: c.is_deduction ? '#b91c1c' : '#1e40af' }}>
                                      {c.is_deduction ? 'Deduction' : 'Earning'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    ₦{formatCurrency(c.previous)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                    ₦{formatCurrency(c.current)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: isPositiveDiff ? '#16a34a' : '#dc2626' }}>
                                    {c.diff > 0 ? '+' : ''}₦{formatCurrency(c.diff)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    <span className={`${styles.varianceDeltaBadge} ${isPositiveDiff ? styles.diffPositive : styles.diffNegative}`}>
                                      {c.diff > 0 ? '↑' : (c.diff < 0 ? '↓' : '—')} {Math.abs(c.percent_change)}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Sub Tab 2: Staff-Level Variance Register */}
                    {varianceSubTab === 'staff' && (
                      <div className={styles.varianceTableCard}>
                        {/* Search in staff table */}
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <Search size={16} color="#94a3b8" />
                          <input
                            type="text"
                            placeholder="Filter staff by name, ID or department in variance list..."
                            value={varianceStaffSearch}
                            onChange={(e) => setVarianceStaffSearch(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                          />
                        </div>

                        <table className={styles.varianceTable}>
                          <thead>
                            <tr>
                              <th>Staff Member</th>
                              <th>Department</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Prev Net</th>
                              <th style={{ textAlign: 'right' }}>Curr Net</th>
                              <th style={{ textAlign: 'right' }}>Net Variance</th>
                              <th style={{ textAlign: 'right' }}>Gross Diff</th>
                              <th style={{ textAlign: 'right' }}>Deduct Diff</th>
                              <th>Key Reason(s) / Changes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {varianceData.staff_variances
                              ?.filter(s => {
                                if (varianceStaffFilter !== 'all' && s.status_type !== varianceStaffFilter) return false;
                                if (varianceStaffSearch) {
                                  const q = varianceStaffSearch.toLowerCase();
                                  const nameMatch = (s.name || '').toLowerCase().includes(q);
                                  const idMatch = String(s.id).includes(q);
                                  const deptMatch = (s.department || '').toLowerCase().includes(q);
                                  if (!nameMatch && !idMatch && !deptMatch) return false;
                                }
                                return true;
                              })
                              .map(s => {
                                const isPositive = s.net_diff >= 0;
                                return (
                                  <tr 
                                    key={s.id} 
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleViewStaffBreakdown(s.id)}
                                    title={`Click to view monthly salary breakdown for ${s.name}`}
                                  >
                                    <td>
                                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{s.name}</div>
                                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {s.id} • {s.designation}</div>
                                    </td>
                                    <td>{s.department}</td>
                                    <td>
                                      <span className={`${styles.varianceDeltaBadge} ${
                                        s.status_type === 'increased' ? styles.diffPositive :
                                        s.status_type === 'decreased' ? styles.diffNegative :
                                        s.status_type === 'new_joiner' ? styles.diffPositive :
                                        styles.diffNeutral
                                      }`} style={{ textTransform: 'capitalize' }}>
                                        {s.status_type.replace(/_/g, ' ')}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                      ₦{formatCurrency(s.prev_net)}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                      ₦{formatCurrency(s.curr_net)}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: isPositive ? '#16a34a' : '#dc2626' }}>
                                      {s.net_diff > 0 ? '+' : ''}₦{formatCurrency(s.net_diff)}
                                      <div style={{ fontSize: '0.725rem', fontWeight: 500 }}>({s.percent_net_change}%)</div>
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: s.gross_diff >= 0 ? '#16a34a' : '#dc2626' }}>
                                      {s.gross_diff > 0 ? '+' : ''}₦{formatCurrency(s.gross_diff)}
                                    </td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: s.deductions_diff > 0 ? '#dc2626' : '#16a34a' }}>
                                      {s.deductions_diff > 0 ? '+' : ''}₦{formatCurrency(s.deductions_diff)}
                                    </td>
                                    <td>
                                      {s.reasons?.map((r, i) => (
                                        <span key={i} className={styles.reasonTag}>
                                          {r}
                                        </span>
                                      ))}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No variance data available for this cycle.
                  </div>
                )}
              </div>
            ) : (
              /* ========================================================================= */
              /* STANDARD MONTHLY PAYROLL SHEET VIEW */
              /* ========================================================================= */
              <div className={styles.modalBody}>
                {/* Controls Bar: Search, Department Filter, Export Buttons */}
                <div className={styles.allStaffControls}>
                  <div className={styles.filterInputs}>
                    <div className={styles.searchBox}>
                      <Search size={16} className={styles.searchIcon} />
                      <input 
                        type="text"
                        className={styles.searchInput}
                        placeholder="Filter staff by name or ID..."
                        value={allStaffSearch}
                        onChange={(e) => handleAllStaffSearchChange(e.target.value)}
                      />
                    </div>

                    {allStaffData?.departments && (
                      <select
                        className={styles.deptFilterSelect}
                        value={allStaffDeptFilter}
                        onChange={(e) => handleAllStaffDeptChange(e.target.value)}
                      >
                        <option value="">All Departments</option>
                        {allStaffData.departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    )}

                    <div className={styles.perPageGroup}>
                      <span className={styles.perPageLabel}>Show:</span>
                      <select
                        className={styles.perPageSelect}
                        value={allStaffPerPage}
                        onChange={(e) => {
                          setAllStaffPerPage(e.target.value);
                          setAllStaffCurrentPage(1);
                        }}
                      >
                        <option value="all">All Records</option>
                        <option value="10">10 records</option>
                        <option value="20">20 records</option>
                        <option value="30">30 records</option>
                        <option value="50">50 records</option>
                        <option value="100">100 records</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSuccess}`}
                      onClick={handleExportAllStaffExcel}
                      disabled={exportingExcel || loadingAllStaff}
                    >
                      {exportingExcel ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                      {exportingExcel ? 'Exporting...' : 'Download Spreadsheet (.csv)'}
                    </button>

                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnOutline}`}
                      onClick={handleExportCSV}
                      disabled={loadingAllStaff}
                    >
                      <Download size={16} />
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* Status and KPIs */}
                <div className={styles.allStaffSummaryRow}>
                  <div className={styles.miniKpiCard}>
                    <span className={styles.miniKpiLabel}>Total Staff Active</span>
                    <span className={styles.miniKpiVal}>{allStaffData?.summary?.total_staff ?? '—'}</span>
                  </div>
                  <div className={styles.miniKpiCard}>
                    <span className={styles.miniKpiLabel}>Total Gross Income</span>
                    <span className={styles.miniKpiVal} style={{ color: '#0284c7' }}>
                      ₦{formatCurrency(allStaffData?.summary?.total_gross)}
                    </span>
                  </div>
                  <div className={styles.miniKpiCard}>
                    <span className={styles.miniKpiLabel}>Total Deductions</span>
                    <span className={styles.miniKpiVal} style={{ color: '#dc2626' }}>
                      - ₦{formatCurrency(allStaffData?.summary?.total_deductions)}
                    </span>
                  </div>
                  <div className={styles.miniKpiCard}>
                    <span className={styles.miniKpiLabel}>Estimated Net Pay</span>
                    <span className={styles.miniKpiVal} style={{ color: (allStaffData?.summary?.total_net_pay ?? 0) < 0 ? '#dc2626' : '#059669' }}>
                      {formatNaira(allStaffData?.summary?.total_net_pay)}
                    </span>
                  </div>
                </div>

                {/* Table */}
                {loadingAllStaff ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '280px', gap: '1rem' }}>
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary, #6366f1)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Compiling all staff monthly payroll sheet...</p>
                  </div>
                ) : allStaffData?.data && allStaffData.data.length > 0 ? (
                  <div className={`${styles.tableWrapper} ${styles.paperContainer} ${styles.printCard}`}>
                    <table className={styles.allStaffTable}>
                      <thead>
                        <tr>
                          <th style={{ minWidth: '85px', textAlign: 'center' }}>Action</th>
                          <th>ID No</th>
                          <th>Staff Name</th>
                          <th>Department</th>
                          <th>Designation</th>
                          <th className={styles.thMoney}>Basic (₦)</th>
                          <th className={styles.thMoney}>Housing (₦)</th>
                          <th className={styles.thMoney}>Transport (₦)</th>
                          <th className={styles.thMoney}>Medical (₦)</th>
                          <th className={styles.thMoney}>Utility (₦)</th>
                          <th className={styles.thMoney}>Meal (₦)</th>
                          <th className={styles.thMoney}>Variable (₦)</th>
                          <th className={styles.thMoney}>Allowance (₦)</th>
                          <th className={styles.thMoney}>Bonus (₦)</th>
                          <th className={styles.thMoney}>Gross Pay (₦)</th>
                          <th className={styles.thMoney}>Declared Sal. (₦)</th>
                          <th className={styles.thMoney}>PAYE Tax (₦)</th>
                          <th className={styles.thMoney}>Pension (₦)</th>
                          <th className={styles.thMoney}>Retention (₦)</th>
                          <th className={styles.thMoney}>IOU (₦)</th>
                          <th className={styles.thMoney}>Med. Loan (₦)</th>
                          <th className={styles.thMoney}>Coop. Loan (₦)</th>
                          <th className={styles.thMoney}>Coop. Sav. (₦)</th>
                          <th className={styles.thMoney}>Asset Fin. (₦)</th>
                          <th className={styles.thMoney}>Surcharges (₦)</th>
                          <th className={styles.thMoney}>Absence Pen. (₦)</th>
                          <th className={styles.thMoney}>LOA Ded. (₦)</th>
                          <th className={styles.thMoney}>Loan (₦)</th>
                          <th className={styles.thMoney}>Other Ded. (₦)</th>
                          <th className={styles.thMoney}>Total Ded. (₦)</th>
                          <th className={styles.thMoney}>Net Pay (₦)</th>
                          <th>Bank</th>
                          <th>Account No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedAllStaff.map((r) => (
                          <tr 
                            key={r.id}
                            className={styles.clickableStaffRow}
                            onClick={() => handleViewStaffBreakdown(r.id)}
                            title={`Click anywhere on this row to view salary breakdown for ${r.name}`}
                          >
                            <td style={{ textAlign: 'center' }} onClick={(e) => { e.stopPropagation(); handleViewStaffBreakdown(r.id); }}>
                              <button
                                type="button"
                                className={styles.viewStaffBreakdownBtn}
                                onClick={(e) => { e.stopPropagation(); handleViewStaffBreakdown(r.id); }}
                                title={`View full salary breakdown for ${r.name}`}
                              >
                                <Eye size={12} /> Breakdown
                              </button>
                            </td>
                            <td style={{ fontWeight: 600 }}>{r.id}</td>
                            <td>
                              <button
                                type="button"
                                className={styles.staffLinkBtn}
                                onClick={(e) => { e.stopPropagation(); handleViewStaffBreakdown(r.id); }}
                                title={`Click to view monthly salary breakdown for ${r.name}`}
                              >
                                <Eye size={13} style={{ color: 'var(--primary, #4f46e5)', opacity: 0.8 }} />
                                <strong>{r.name}</strong>
                              </button>
                            </td>
                            <td>{r.department}</td>
                            <td>{r.designation}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.basic_salary)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.housing_allowance)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.transport_allowance)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.medical_allowance)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.utility_allowance)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.meal_allowance)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.variable_allowances)}</td>
                            <td className={styles.tdMoney} style={{ color: '#059669', fontWeight: 600 }}>
                              {formatCurrency(r.custom_allowances || 0)}
                            </td>
                            <td className={styles.tdMoney} style={{ color: '#d97706', fontWeight: 600 }}>
                              {formatCurrency(r.bonuses || 0)}
                            </td>
                            <td className={styles.tdMoney} style={{ fontWeight: 700, color: '#0369a1' }}>
                              {formatCurrency(r.gross_pay)}
                            </td>
                            <td className={styles.tdMoney}>{formatCurrency(r.declare_salary)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.paye_tax)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.pension)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.retention)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.iou)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.medical_loan)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.coop_loan)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.coop_savings)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.coop_asset_finance)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.surcharges)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.absence_penalty)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.leave_of_absence)}</td>
                            <td className={styles.tdMoney}>{formatCurrency(r.regular_loan)}</td>
                            <td className={styles.tdMoney}>
                              <div>{formatCurrency(r.other_deductions)}</div>
                              {r.other_deductions_remarks && (
                                <div style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 600, background: 'rgba(245, 158, 11, 0.12)', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '2px', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.other_deductions_remarks}>
                                  {r.other_deductions_remarks}
                                </div>
                              )}
                            </td>
                            <td className={styles.tdMoney} style={{ color: '#dc2626', fontWeight: 600 }}>
                              - {formatCurrency(r.total_deductions)}
                            </td>
                            <td className={`${styles.tdMoney} ${styles.tdNetPayCol}`} style={r.net_pay < 0 ? { color: '#dc2626', fontWeight: 700 } : {}}>
                              {formatNaira(r.net_pay)}
                            </td>
                            <td>{r.bank_name}</td>
                            <td>{r.account_number}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className={styles.allStaffTotalRow}>
                          <td colSpan={5} style={{ fontWeight: 700, textAlign: 'left', paddingLeft: '1rem' }}>
                            TOTALS ({allStaffRecords.length} STAFF)
                          </td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.basic_salary, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.housing_allowance, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.transport_allowance, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.medical_allowance, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.utility_allowance, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.meal_allowance, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.variable_allowances, 0))}</td>
                          <td className={styles.tdMoney} style={{ color: '#059669', fontWeight: 600 }}>
                            {formatCurrency(allStaffRecords.reduce((a, c) => a + (c.custom_allowances || 0), 0))}
                          </td>
                          <td className={styles.tdMoney} style={{ color: '#d97706', fontWeight: 600 }}>
                            {formatCurrency(allStaffRecords.reduce((a, c) => a + (c.bonuses || 0), 0))}
                          </td>
                          <td className={styles.tdMoney} style={{ color: '#0284c7' }}>
                            ₦{formatCurrency(allStaffData.summary?.total_gross)}
                          </td>
                          <td className={styles.tdMoney}>
                            {formatCurrency(allStaffRecords.reduce((a, c) => a + (c.declare_salary || 0), 0))}
                          </td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.paye_tax, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.pension, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.retention, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.iou, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.medical_loan, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.coop_loan, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.coop_savings, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.coop_asset_finance, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.surcharges, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.absence_penalty, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.leave_of_absence, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.regular_loan, 0))}</td>
                          <td className={styles.tdMoney}>{formatCurrency(allStaffRecords.reduce((a, c) => a + c.other_deductions, 0))}</td>
                          <td className={styles.tdMoney} style={{ color: '#dc2626' }}>
                            - ₦{formatCurrency(allStaffData.summary?.total_deductions)}
                          </td>
                          <td className={`${styles.tdMoney} ${styles.tdNetPayCol}`} style={(allStaffData.summary?.total_net_pay ?? 0) < 0 ? { color: '#dc2626', fontWeight: 700 } : {}}>
                            {formatNaira(allStaffData.summary?.total_net_pay)}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>

                    {/* Pagination Footer */}
                    {allStaffRecords.length > 0 && (
                      <div className={styles.pagination}>
                        <span className={styles.paginationText}>
                          Showing {allStaffRecords.length === 0 ? 0 : (allStaffPerPage === 'all' ? 1 : (allStaffCurrentPage - 1) * parseInt(allStaffPerPage, 10) + 1)} to {allStaffPerPage === 'all' ? allStaffRecords.length : Math.min(allStaffCurrentPage * parseInt(allStaffPerPage, 10), allStaffRecords.length)} of {allStaffRecords.length} entries {allStaffPerPage !== 'all' && totalAllStaffPages > 1 && `(Page ${allStaffCurrentPage} of ${totalAllStaffPages})`}
                        </span>
                        {allStaffPerPage !== 'all' && totalAllStaffPages > 1 && (
                          <div className={styles.paginationButtons}>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnSecondary}`}
                              style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                              disabled={allStaffCurrentPage === 1}
                              onClick={() => setAllStaffCurrentPage(1)}
                            >
                              First
                            </button>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnSecondary}`}
                              style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                              disabled={allStaffCurrentPage === 1}
                              onClick={() => setAllStaffCurrentPage(c => Math.max(1, c - 1))}
                            >
                              Prev
                            </button>

                            {Array.from({ length: Math.min(5, totalAllStaffPages) }, (_, i) => {
                              let pageNum;
                              if (totalAllStaffPages <= 5) {
                                pageNum = i + 1;
                              } else if (allStaffCurrentPage <= 3) {
                                pageNum = i + 1;
                              } else if (allStaffCurrentPage >= totalAllStaffPages - 2) {
                                pageNum = totalAllStaffPages - 4 + i;
                              } else {
                                pageNum = allStaffCurrentPage - 2 + i;
                              }
                              return (
                                <button
                                  key={pageNum}
                                  type="button"
                                  className={`${styles.btn} ${allStaffCurrentPage === pageNum ? styles.btnPrimary : styles.btnSecondary}`}
                                  style={{ minWidth: '30px', padding: '0.375rem 0.5rem', fontSize: '0.75rem' }}
                                  onClick={() => setAllStaffCurrentPage(pageNum)}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnSecondary}`}
                              style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                              disabled={allStaffCurrentPage === totalAllStaffPages}
                              onClick={() => setAllStaffCurrentPage(c => Math.min(totalAllStaffPages, c + 1))}
                            >
                              Next
                            </button>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnSecondary}`}
                              style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                              disabled={allStaffCurrentPage === totalAllStaffPages}
                              onClick={() => setAllStaffCurrentPage(totalAllStaffPages)}
                            >
                              Last
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No staff records found for the selected period.
                  </div>
                )}
              </div>
            )}

            <div className={styles.modalFooter}>
              <button 
                type="button" 
                className={`${styles.btn} ${styles.btnOutline}`} 
                onClick={() => setShowAllStaffModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INDIVIDUAL STAFF BREAKDOWN POPUP MODAL (CLICKED FROM ALL STAFF SHEET) */}
      {/* ========================================================================= */}
      {showStaffBreakdownModal && (
        <div className={`${styles.modalOverlay} ${styles.nestedModalOverlay}`} onClick={() => setShowStaffBreakdownModal(false)}>
          <div className={`${styles.modalContent} ${styles.staffBreakdownModalContent}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <FileText size={20} style={{ color: 'var(--primary, #6366f1)' }} />
                Monthly Salary Breakdown — {modalStaffBreakdown?.staff?.name || 'Staff'} ({MONTHS.find(m => m.id === selectedMonth)?.name} {selectedYear})
              </h2>
              <button 
                type="button" 
                className={styles.closeBtn}
                onClick={() => setShowStaffBreakdownModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {loadingStaffBreakdownModal ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '280px', gap: '1rem' }}>
                  <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary, #6366f1)' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>Loading staff salary breakdown...</p>
                </div>
              ) : modalStaffBreakdown?.staff ? (
                <div className={`${styles.sheetPaper} ${styles.paperContainer}`}>
                  {/* Company Header */}
                  <div className={styles.companyHeader}>
                    <h2>ISALU HOSPITALS LIMITED</h2>
                    <div className={styles.sheetSubtitle}>MONTHLY PAYROLL BREAKDOWN SHEET</div>
                    <div className={styles.sheetPeriodMeta}>
                      <span>Period: <strong>{modalStaffBreakdown.period?.period_str}</strong></span>
                      <span>Status: <strong>{modalStaffBreakdown.period?.is_computed ? 'Finalized Payroll' : 'Pre-Compute Estimate'}</strong></span>
                      <span>Date Generated: <strong>{new Date().toLocaleDateString('en-GB')}</strong></span>
                    </div>
                  </div>

                  {/* Staff Information Box */}
                  <div className={styles.sheetStaffBox}>
                    <div className={styles.sheetField}>
                      <span className={styles.sheetFieldLabel}>Staff Name:</span>
                      <span className={styles.sheetFieldValue}>{modalStaffBreakdown.staff.name}</span>
                    </div>
                    <div className={styles.sheetField}>
                      <span className={styles.sheetFieldLabel}>Staff ID:</span>
                      <span className={styles.sheetFieldValue}>{modalStaffBreakdown.staff.id}</span>
                    </div>
                    <div className={styles.sheetField}>
                      <span className={styles.sheetFieldLabel}>Department:</span>
                      <span className={styles.sheetFieldValue}>{modalStaffBreakdown.staff.department}</span>
                    </div>
                    <div className={styles.sheetField}>
                      <span className={styles.sheetFieldLabel}>Designation:</span>
                      <span className={styles.sheetFieldValue}>{modalStaffBreakdown.staff.designation}</span>
                    </div>
                    {modalStaffBreakdown.staff.bank_name && (
                      <div className={styles.sheetField}>
                        <span className={styles.sheetFieldLabel}>Bank:</span>
                        <span className={styles.sheetFieldValue}>{modalStaffBreakdown.staff.bank_name}</span>
                      </div>
                    )}
                    {modalStaffBreakdown.staff.account_number && (
                      <div className={styles.sheetField}>
                        <span className={styles.sheetFieldLabel}>Account No:</span>
                        <span className={styles.sheetFieldValue}>{modalStaffBreakdown.staff.account_number}</span>
                      </div>
                    )}
                    <div className={styles.sheetField}>
                      <span className={styles.sheetFieldLabel}>Paid Days:</span>
                      <span className={styles.sheetFieldValue} style={{ fontWeight: 700, color: (modalStaffBreakdown.deductions?.leave_of_absence?.days_absent || 0) > 0 ? '#ea580c' : 'inherit' }}>
                        {modalStaffBreakdown.period?.paid_days ?? modalStaffBreakdown.summary?.paid_days ?? modalStaffBreakdown.staff?.paid_days ?? ((modalStaffBreakdown.period?.days_in_month || modalStaffBreakdown.summary?.days_in_month || getDaysInMonth(selectedMonth, selectedYear)) - (modalStaffBreakdown.deductions?.leave_of_absence?.days_absent || 0))} / {modalStaffBreakdown.period?.days_in_month ?? modalStaffBreakdown.summary?.days_in_month ?? modalStaffBreakdown.staff?.days_in_month ?? getDaysInMonth(selectedMonth, selectedYear)} Days
                        {(modalStaffBreakdown.deductions?.leave_of_absence?.days_absent || 0) > 0 && (
                          <span style={{ fontSize: '0.78rem', color: '#dc2626', marginLeft: '6px', fontWeight: 600 }}>
                            ({modalStaffBreakdown.deductions.leave_of_absence.days_absent} Unpaid Day(s) LOA)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Top Metric Cards */}
                  <div className={styles.metricsGrid} style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
                    {/* Gross Salary */}
                    <div className={styles.metricCard}>
                      <div className={`${styles.metricIcon} ${styles.metricIconGross}`}>
                        <TrendingUp size={24} />
                      </div>
                      <div className={styles.metricContent}>
                        <div className={styles.metricLabel}>Total Gross Salary</div>
                        <div className={`${styles.metricValue} ${styles.metricValueGross}`}>
                          ₦{formatCurrency(modalStaffBreakdown.summary?.gross_pay)}
                        </div>
                        {((modalStaffBreakdown.earnings?.custom_allowances && modalStaffBreakdown.earnings.custom_allowances.length > 0) || (modalStaffBreakdown.earnings?.bonuses && modalStaffBreakdown.earnings.bonuses.length > 0)) && (
                          <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {modalStaffBreakdown.earnings.custom_allowances && modalStaffBreakdown.earnings.custom_allowances.map((ca) => (
                              <span key={ca.id} style={{ fontSize: '0.73rem', fontWeight: 600, color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>
                                + ₦{formatCurrency(ca.amount)} {ca.title || 'Allowance'}
                              </span>
                            ))}
                            {modalStaffBreakdown.earnings.bonuses && modalStaffBreakdown.earnings.bonuses.map((b) => (
                              <span key={b.id} style={{ fontSize: '0.73rem', fontWeight: 600, color: '#d97706', background: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>
                                + ₦{formatCurrency(b.amount)} {b.title || 'Bonus'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Total Deductions */}
                    <div className={styles.metricCard}>
                      <div className={`${styles.metricIcon} ${styles.metricIconDeductions}`}>
                        <TrendingDown size={24} />
                      </div>
                      <div className={styles.metricContent}>
                        <div className={styles.metricLabel}>Total Monthly Deductions</div>
                        <div className={`${styles.metricValue} ${styles.metricValueDeductions}`}>
                          - ₦{formatCurrency(modalStaffBreakdown.summary?.total_deductions)}
                        </div>
                      </div>
                    </div>

                    {/* Net Pay */}
                    <div className={styles.metricCard} style={(modalStaffBreakdown.summary?.net_pay ?? 0) < 0 ? { borderColor: '#ef4444' } : {}}>
                      <div className={`${styles.metricIcon} ${styles.metricIconNet}`} style={(modalStaffBreakdown.summary?.net_pay ?? 0) < 0 ? { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' } : {}}>
                        <NairaSign size={24} />
                      </div>
                      <div className={styles.metricContent}>
                        <div className={styles.metricLabel}>Estimated Net Take-Home Pay</div>
                        <div className={`${styles.metricValue} ${styles.metricValueNet}`} style={(modalStaffBreakdown.summary?.net_pay ?? 0) < 0 ? { color: '#ef4444' } : {}}>
                          {formatNaira(modalStaffBreakdown.summary?.net_pay)}
                        </div>
                        {(modalStaffBreakdown.summary?.net_pay ?? 0) < 0 && (
                          <div style={{ marginTop: '0.35rem', fontSize: '0.74rem', fontWeight: 600, color: '#dc2626', background: 'rgba(239, 68, 68, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={13} /> Deficit Balance: Total deductions exceed salary
                          </div>
                        )}
                        {((modalStaffBreakdown.earnings?.custom_allowances && modalStaffBreakdown.earnings.custom_allowances.length > 0) || (modalStaffBreakdown.earnings?.bonuses && modalStaffBreakdown.earnings.bonuses.length > 0)) && (
                          <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {modalStaffBreakdown.earnings.custom_allowances && modalStaffBreakdown.earnings.custom_allowances.map((ca) => (
                              <span key={ca.id} style={{ fontSize: '0.73rem', fontWeight: 600, color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>
                                + ₦{formatCurrency(ca.amount)} {ca.title || 'Allowance'}
                              </span>
                            ))}
                            {modalStaffBreakdown.earnings.bonuses && modalStaffBreakdown.earnings.bonuses.map((b) => (
                              <span key={b.id} style={{ fontSize: '0.73rem', fontWeight: 600, color: '#d97706', background: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>
                                + ₦{formatCurrency(b.amount)} {b.title || 'Bonus'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dual Column Structure */}
                  <div className={styles.sheetGrid}>
                    {/* Earnings */}
                    <div className={styles.sheetSection}>
                      <div className={styles.sheetSectionHeader}>
                        <span>EARNINGS & ALLOWANCES</span>
                        <span>AMOUNT (₦)</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Basic Salary</span>
                        <span>{formatCurrency(modalStaffBreakdown.earnings?.basic_salary)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Housing Allowance</span>
                        <span>{formatCurrency(modalStaffBreakdown.earnings?.housing_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Transport Allowance</span>
                        <span>{formatCurrency(modalStaffBreakdown.earnings?.transport_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Medical Allowance</span>
                        <span>{formatCurrency(modalStaffBreakdown.earnings?.medical_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Utility Allowance</span>
                        <span>{formatCurrency(modalStaffBreakdown.earnings?.utility_allowance)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Meal Allowance</span>
                        <span>{formatCurrency(modalStaffBreakdown.earnings?.meal_allowance)}</span>
                      </div>
                      {modalStaffBreakdown.earnings?.earning_variables && modalStaffBreakdown.earnings.earning_variables.map((ev, i) => (
                        <div key={i} className={styles.sheetRow}>
                          <span>{ev.name}</span>
                          <span>{formatCurrency(ev.amount)}</span>
                        </div>
                      ))}
                      {modalStaffBreakdown.earnings?.custom_allowances && modalStaffBreakdown.earnings.custom_allowances.map((ca) => (
                        <div key={ca.id} className={styles.sheetRow}>
                          <span>{ca.title} (Allowance)</span>
                          <span>{formatCurrency(ca.amount)}</span>
                        </div>
                      ))}
                      {modalStaffBreakdown.earnings?.bonuses && modalStaffBreakdown.earnings.bonuses.map((b) => (
                        <div key={b.id} className={styles.sheetRow}>
                          <span>{b.title} (Bonus)</span>
                          <span>{formatCurrency(b.amount)}</span>
                        </div>
                      ))}
                      <div className={`${styles.sheetRow} ${styles.sheetTotalRow}`}>
                        <span>GROSS SALARY</span>
                        <span>₦{formatCurrency(modalStaffBreakdown.summary?.gross_pay)}</span>
                      </div>
                    </div>

                    {/* Deductions */}
                    <div className={styles.sheetSection}>
                      <div className={styles.sheetSectionHeader} style={{ background: '#7f1d1d', color: '#ffffff' }}>
                        <span>ITEMIZED DEDUCTIONS</span>
                        <span>AMOUNT (₦)</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>PAYE Tax</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.paye_tax?.amount ?? modalStaffBreakdown.deductions?.paye_tax?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Pension (Employee Contribution)</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.pension?.amount ?? modalStaffBreakdown.deductions?.pension?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Retention Savings</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.retention?.amount ?? modalStaffBreakdown.deductions?.retention?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>IOU Repayment</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.iou?.amount ?? modalStaffBreakdown.deductions?.iou?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Medical Loan</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.medical_loan?.amount ?? modalStaffBreakdown.deductions?.medical_loan?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Cooperative Loan</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.coop_loan?.amount ?? modalStaffBreakdown.deductions?.coop_loan?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Cooperative Savings</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.coop_savings?.amount ?? modalStaffBreakdown.deductions?.coop_savings?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Coop. Asset Financing</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.coop_asset_finance?.amount ?? modalStaffBreakdown.deductions?.coop_asset_finance?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Surcharges / Penalties</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.surcharges?.amount ?? modalStaffBreakdown.deductions?.surcharges?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Absence Penalty</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.absence_penalty?.amount ?? modalStaffBreakdown.deductions?.absence_penalty?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Leave of Absence (Unpaid Days)</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.leave_of_absence?.amount ?? modalStaffBreakdown.deductions?.leave_of_absence?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>Regular Loan Repayment</span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.regular_loan?.amount ?? modalStaffBreakdown.deductions?.regular_loan?.monthly_deduction)}</span>
                      </div>
                      <div className={styles.sheetRow}>
                        <span>
                          Other Deductions
                          {modalStaffBreakdown.deductions?.other_deductions?.remarks && (
                            <span style={{ fontSize: '0.75rem', color: '#b45309', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '2px 8px', borderRadius: '4px', marginLeft: '6px', fontWeight: 600 }}>
                              {modalStaffBreakdown.deductions.other_deductions.remarks}
                            </span>
                          )}
                        </span>
                        <span>{formatCurrency(modalStaffBreakdown.deductions?.other_deductions?.amount ?? modalStaffBreakdown.deductions?.other_deductions?.monthly_deduction)}</span>
                      </div>
                      <div className={`${styles.sheetRow} ${styles.sheetTotalRow}`} style={{ color: '#dc2626' }}>
                        <span>TOTAL DEDUCTIONS</span>
                        <span>- ₦{formatCurrency(modalStaffBreakdown.summary?.total_deductions)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Pay Callout */}
                  <div className={styles.sheetNetRow} style={{ marginTop: '1rem', padding: '0.85rem 1.25rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block' }}>ESTIMATED NET TAKE-HOME PAY</span>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Gross Income minus Total Deductions</span>
                    </div>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: (modalStaffBreakdown.summary?.net_pay ?? 0) < 0 ? '#dc2626' : '#059669' }}>
                      {formatNaira(modalStaffBreakdown.summary?.net_pay)}
                    </span>
                  </div>

                  {/* Balances & Outstanding Overview */}
                  <div className={styles.balancesOverviewCard} style={{ marginTop: '1.25rem' }}>
                    <div className={styles.balancesOverviewHeader}>
                      <h3 className={styles.balancesOverviewTitle}>
                        <PiggyBank size={20} style={{ color: '#059669' }} />
                        <span>Savings & Outstanding Balances Summary</span>
                      </h3>
                      <span className={styles.balancesOverviewSub}>
                        Real-time snapshot of cooperative savings accumulation & active loan balances
                      </span>
                    </div>

                    <div className={styles.balancesOverviewGrid}>
                      {/* 1. Cooperative Savings Balance */}
                      <div className={`${styles.overviewCardItem} ${styles.overviewCardSavings}`}>
                        <div className={`${styles.overviewIconWrap} ${styles.overviewIconSavings}`}>
                          <Wallet size={22} />
                        </div>
                        <div className={styles.overviewItemInfo}>
                          <div className={styles.overviewItemLabel}>Cooperative Savings Balance</div>
                          <div className={styles.overviewItemValueSavings}>
                            ₦{formatCurrency(modalStaffBreakdown.deductions?.coop_savings?.saving_balance ?? modalStaffBreakdown.deductions?.coop_savings?.balance ?? modalStaffBreakdown.deductions?.coop_savings?.balance_remaining ?? modalStaffBreakdown.balances?.coop_savings_balance ?? 0)}
                          </div>
                          <div className={styles.overviewItemDetail}>
                            {modalStaffBreakdown.deductions?.coop_savings?.amount > 0 ? (
                              <span style={{ color: '#047857', fontWeight: 600 }}>
                                + ₦{formatCurrency(modalStaffBreakdown.deductions.coop_savings.amount)}/mo deduction
                              </span>
                            ) : (
                              <span style={{ color: '#64748b' }}>Cumulative savings balance</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 2. Cooperative Loan Balance */}
                      <div className={styles.overviewCardItem}>
                        <div className={`${styles.overviewIconWrap} ${styles.overviewIconLoan}`}>
                          <CreditCard size={22} />
                        </div>
                        <div className={styles.overviewItemInfo}>
                          <div className={styles.overviewItemLabel}>Cooperative Loan Balance</div>
                          <div className={styles.overviewItemValue}>
                            ₦{formatCurrency(modalStaffBreakdown.deductions?.coop_loan?.balance_remaining ?? modalStaffBreakdown.balances?.coop_loan_balance ?? 0)}
                          </div>
                          <div className={styles.overviewItemDetail}>
                            {modalStaffBreakdown.deductions?.coop_loan?.amount > 0 ? (
                              <span>- ₦{formatCurrency(modalStaffBreakdown.deductions.coop_loan.amount)}/mo repayment</span>
                            ) : (
                              <span style={{ color: '#64748b' }}>No active coop loan balance</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 3. Cooperative Asset Finance */}
                      <div className={styles.overviewCardItem}>
                        <div className={`${styles.overviewIconWrap} ${styles.overviewIconAsset}`}>
                          <ShoppingBag size={22} />
                        </div>
                        <div className={styles.overviewItemInfo}>
                          <div className={styles.overviewItemLabel}>Coop Asset Finance Balance</div>
                          <div className={styles.overviewItemValue}>
                            ₦{formatCurrency(modalStaffBreakdown.deductions?.coop_asset_finance?.balance_remaining ?? modalStaffBreakdown.balances?.coop_asset_finance_balance ?? 0)}
                          </div>
                          <div className={styles.overviewItemDetail}>
                            {modalStaffBreakdown.deductions?.coop_asset_finance?.amount > 0 ? (
                              <span>- ₦{formatCurrency(modalStaffBreakdown.deductions.coop_asset_finance.amount)}/mo deduction</span>
                            ) : (
                              <span style={{ color: '#64748b' }}>No active asset finance</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 4. Medical Loan Balance */}
                      <div className={styles.overviewCardItem}>
                        <div className={`${styles.overviewIconWrap} ${styles.overviewIconMedical}`}>
                          <HeartPulse size={22} />
                        </div>
                        <div className={styles.overviewItemInfo}>
                          <div className={styles.overviewItemLabel}>Medical Loan Balance</div>
                          <div className={styles.overviewItemValue}>
                            ₦{formatCurrency(modalStaffBreakdown.deductions?.medical_loan?.balance_remaining ?? modalStaffBreakdown.balances?.medical_loan_balance ?? 0)}
                          </div>
                          <div className={styles.overviewItemDetail}>
                            {modalStaffBreakdown.deductions?.medical_loan?.amount > 0 ? (
                              <span>- ₦{formatCurrency(modalStaffBreakdown.deductions.medical_loan.amount)}/mo repayment</span>
                            ) : (
                              <span style={{ color: '#64748b' }}>No active medical loan</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.modalFooter}>
              <button 
                type="button" 
                className={`${styles.btn} ${styles.btnOutline}`} 
                onClick={() => setShowStaffBreakdownModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
