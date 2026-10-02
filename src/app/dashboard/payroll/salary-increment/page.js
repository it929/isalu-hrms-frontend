'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  Building2, 
  DollarSign, 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Search, 
  RefreshCw, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Percent, 
  ChevronRight,
  ArrowUpRight,
  Sparkles,
  Sliders,
  Layers,
  Eye,
  Info,
  Check,
  FileText
} from 'lucide-react';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

function getUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hrms_user') || sessionStorage.getItem('hrms_user');
    if (raw) {
      const user = JSON.parse(raw);
      return user?.id ?? user?.UserID ?? user?.ID ?? null;
    }
  } catch { /* ignore */ }
  return localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || null;
}

function buildHeaders() {
  const userId = getUserId();
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'X-User-Id': userId } : {}),
  };
}

const formatCurrency = (val) => {
  if (val === null || val === undefined || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumberWithCommas = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const strVal = String(val).replace(/,/g, '');
  const parts = strVal.split('.');
  const integerPart = parts[0].replace(/\D/g, '');
  if (!integerPart && parts.length === 1) return '';
  
  const formattedInteger = integerPart ? Number(integerPart).toLocaleString('en-US') : '0';
  if (parts.length > 1) {
    const decimalPart = parts[1].replace(/\D/g, '').slice(0, 2);
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
};

const parseCleanNumber = (val) => {
  if (!val && val !== 0) return 0;
  const clean = String(val).replace(/,/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

export default function SalaryIncrementPage() {
  // Tabs: 'single' | 'bulk' | 'upload'
  const [activeTab, setActiveTab] = useState('single');

  // Loading States
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exportingHistory, setExportingHistory] = useState(false);

  // Staff & Departments Data
  const [staffList, setStaffList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [overviewStats, setOverviewStats] = useState({ total_staff: 0, total_payroll: 0 });

  // Single Staff Form State
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const [singleMode, setSingleMode] = useState('percentage'); // 'percentage' | 'fixed_amount' | 'new_gross'
  const [percentageInput, setPercentageInput] = useState('10');
  const [fixedAmountInput, setFixedAmountInput] = useState('');
  const [newGrossInput, setNewGrossInput] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  // Bulk Form State
  const [bulkScopeMode, setBulkScopeMode] = useState('uniform'); // 'uniform' | 'matrix'
  const [bulkTarget, setBulkTarget] = useState('all'); // 'all' | 'department'
  const [bulkDeptId, setBulkDeptId] = useState('');
  const [bulkMode, setBulkMode] = useState('percentage'); // 'percentage' | 'fixed_amount'
  const [bulkPercentage, setBulkPercentage] = useState('10');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkEffectiveDate, setBulkEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkReason, setBulkReason] = useState('');

  // Department-by-Department Matrix State
  const [matrixSettings, setMatrixSettings] = useState({});
  const [matrixBaselineType, setMatrixBaselineType] = useState('fixed_amount');
  const [matrixBaselineValue, setMatrixBaselineValue] = useState('');

  // Template Download State
  const [templateDeptId, setTemplateDeptId] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // File Upload & Interactive Preview State
  const [dragActive, setDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [showPreviewRows, setShowPreviewRows] = useState(true);
  const [uploadWarnings, setUploadWarnings] = useState([]);
  const [lastUploadResult, setLastUploadResult] = useState(null);

  // History State
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [historySummary, setHistorySummary] = useState({ total_increments: 0, total_increase_amount: 0 });
  const [historySearch, setHistorySearch] = useState('');
  const [historyDeptFilter, setHistoryDeptFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  // Revert Modal State
  const [revertTarget, setRevertTarget] = useState(null);
  const [reverting, setReverting] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  }, []);

  // Fetch initial staff and departments
  const fetchStaffData = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/salary-increments/staff`, {
        headers: buildHeaders(),
      });
      if (res.data.status === 'success') {
        setStaffList(res.data.data.staff || []);
        setDepartments(res.data.data.departments || []);
        setOverviewStats({
          total_staff: res.data.data.total_staff || 0,
          total_payroll: res.data.data.total_payroll || 0,
        });
      }
    } catch (err) {
      showToast('Failed to load staff list.', 'error');
    } finally {
      setLoadingStaff(false);
    }
  }, [showToast]);

  // Fetch increment history
  const fetchHistory = useCallback(async (page = 1) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      if (historySearch) params.append('search', historySearch);
      if (historyDeptFilter) params.append('department_id', historyDeptFilter);

      const res = await axios.get(`${API_BASE}/payroll/salary-increments/history?${params.toString()}`, {
        headers: buildHeaders(),
      });
      if (res.data.status === 'success') {
        setHistoryRecords(res.data.data || []);
        setHistoryPagination(res.data.pagination || { current_page: 1, last_page: 1, total: 0 });
        setHistorySummary(res.data.summary || { total_increments: 0, total_increase_amount: 0 });
      }
    } catch (err) {
      showToast('Failed to load increment history.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  }, [historySearch, historyDeptFilter, showToast]);

  useEffect(() => {
    fetchStaffData();
    fetchHistory(1);
  }, [fetchStaffData, fetchHistory]);

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

  // Filter staff list
  const filteredStaffList = staffList.filter(s =>
    s.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
    String(s.id).includes(staffSearchQuery)
  );

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setStaffSearchQuery(staff.name);
    setShowStaffDropdown(false);

    // Default the direct new gross to current gross
    if (staff.current_gross > 0) {
      setNewGrossInput(formatNumberWithCommas(staff.current_gross));
    } else {
      setNewGrossInput('');
    }
  };

  // Calculate Single Staff Projected New Gross
  // Calculate Single Staff Projected New Gross
  const calculateSingleProjectedGross = () => {
    if (!selectedStaff) return 0;
    const current = selectedStaff.current_gross || 0;

    if (singleMode === 'percentage') {
      const p = parseFloat(percentageInput) || 0;
      return current * (1 + (p / 100));
    } else if (singleMode === 'decrement_percentage') {
      const p = parseFloat(percentageInput) || 0;
      return Math.max(0, current * (1 - (p / 100)));
    } else if (singleMode === 'fixed_amount') {
      const amt = parseCleanNumber(fixedAmountInput);
      return current + amt;
    } else if (singleMode === 'decrement_fixed') {
      const amt = parseCleanNumber(fixedAmountInput);
      return Math.max(0, current - amt);
    } else { // new_gross
      return parseCleanNumber(newGrossInput);
    }
  };

  const projectedSingleGross = calculateSingleProjectedGross();
  const singleDifference = selectedStaff ? projectedSingleGross - selectedStaff.current_gross : 0;
  const singlePercentDiff = (selectedStaff && selectedStaff.current_gross > 0)
    ? ((Math.abs(singleDifference) / selectedStaff.current_gross) * 100).toFixed(1)
    : 0;

  // Allowance preview breakdown (20% Basic, 20% Housing, 10% Transport, 10% Medical, 20% Utility, 20% Meal)
  const previewBreakdown = {
    basic: round2(projectedSingleGross * 0.20),
    housing: round2(projectedSingleGross * 0.20),
    transport: round2(projectedSingleGross * 0.10),
    medical: round2(projectedSingleGross * 0.10),
    utility: round2(projectedSingleGross * 0.20),
    meal: round2(projectedSingleGross * 0.20),
  };

  function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  // Handle Single Staff Increment / Decrement Submit
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }

    if (projectedSingleGross <= 0) {
      showToast('Projected new gross salary must be greater than 0.', 'error');
      return;
    }

    const isDecrement = singleMode.startsWith('decrement_');

    setSubmitting(true);
    try {
      const payload = {
        staff_id: selectedStaff.id,
        increment_type: singleMode,
        percentage: (singleMode === 'percentage' || singleMode === 'decrement_percentage') ? parseFloat(percentageInput) : null,
        amount: (singleMode === 'fixed_amount' || singleMode === 'decrement_fixed') ? parseCleanNumber(fixedAmountInput) : null,
        new_gross: singleMode === 'new_gross' ? parseCleanNumber(newGrossInput) : null,
        effective_date: effectiveDate,
        reason: reason || (isDecrement ? 'Individual salary decrement adjustment' : 'Individual salary increment adjustment'),
      };

      const res = await axios.post(`${API_BASE}/payroll/salary-increments/single`, payload, {
        headers: buildHeaders(),
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Salary adjustment saved successfully!');
        setSelectedStaff(null);
        setStaffSearchQuery('');
        setReason('');
        fetchStaffData();
        fetchHistory(1);
      } else {
        showToast(res.data.message || 'Failed to apply adjustment.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error applying adjustment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk calculation
  const bulkFilteredStaff = bulkTarget === 'department' && bulkDeptId
    ? staffList.filter(s => String(s.department_id) === String(bulkDeptId))
    : staffList;

  const currentBulkPayroll = bulkFilteredStaff.reduce((sum, s) => sum + (s.current_gross || 0), 0);
  const projectedBulkPayroll = bulkFilteredStaff.reduce((sum, s) => {
    const cur = s.current_gross || 0;
    if (bulkMode === 'percentage') {
      const p = parseFloat(bulkPercentage) || 0;
      return sum + (cur * (1 + (p / 100)));
    } else if (bulkMode === 'decrement_percentage') {
      const p = parseFloat(bulkPercentage) || 0;
      return sum + Math.max(0, cur * (1 - (p / 100)));
    } else if (bulkMode === 'decrement_fixed') {
      const amt = parseCleanNumber(bulkAmount);
      return sum + Math.max(0, cur - amt);
    } else {
      const amt = parseCleanNumber(bulkAmount);
      return sum + (cur + amt);
    }
  }, 0);

  const bulkTotalIncrease = projectedBulkPayroll - currentBulkPayroll;

  // Handle Bulk Submit
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (bulkFilteredStaff.length === 0) {
      showToast('No active staff found for the selected criteria.', 'error');
      return;
    }

    const isDecrement = bulkMode.startsWith('decrement_');
    const isPct = bulkMode.includes('percentage');

    if (isPct && (!bulkPercentage || parseFloat(bulkPercentage) <= 0)) {
      showToast(`Please enter a valid percentage ${isDecrement ? 'reduction' : 'increase'}.`, 'error');
      return;
    }

    if (!isPct && (!bulkAmount || parseCleanNumber(bulkAmount) <= 0)) {
      showToast(`Please enter a valid fixed ${isDecrement ? 'reduction' : 'increase'} amount.`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        target_type: bulkTarget,
        department_id: bulkTarget === 'department' ? bulkDeptId : null,
        increment_type: bulkMode,
        percentage: isPct ? parseFloat(bulkPercentage) : null,
        amount: !isPct ? parseCleanNumber(bulkAmount) : null,
        effective_date: bulkEffectiveDate,
        reason: bulkReason || `Bulk ${isDecrement ? 'decrement' : 'increment'} across ${bulkTarget}`,
      };

      const res = await axios.post(`${API_BASE}/payroll/salary-increments/bulk`, payload, {
        headers: buildHeaders(),
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Bulk adjustment processed successfully!');
        setBulkReason('');
        fetchStaffData();
        fetchHistory(1);
      } else {
        showToast(res.data.message || 'Bulk adjustment failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error processing bulk adjustment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Multi-Department Matrix Helpers
  const handleApplyBaselineToAll = () => {
    if (!matrixBaselineValue) {
      showToast('Please enter a baseline value first.', 'error');
      return;
    }
    const updated = { ...matrixSettings };
    departments.forEach(d => {
      updated[d.id] = {
        enabled: true,
        type: matrixBaselineType,
        value: matrixBaselineValue,
        reason: `${d.name} Salary Adjustment`,
      };
    });
    setMatrixSettings(updated);
    showToast(`Applied baseline to all departments.`);
  };

  const handleUpdateDeptMatrix = (deptId, field, val) => {
    setMatrixSettings(prev => ({
      ...prev,
      [deptId]: {
        ...(prev[deptId] || { enabled: false, type: 'fixed_amount', value: '', reason: '' }),
        [field]: val,
      }
    }));
  };

  const handleToggleDeptMatrix = (deptId) => {
    setMatrixSettings(prev => {
      const current = prev[deptId] || { enabled: false, type: 'fixed_amount', value: '', reason: '' };
      return {
        ...prev,
        [deptId]: {
          ...current,
          enabled: !current.enabled,
        }
      };
    });
  };

  // Matrix Projected Statistics
  const matrixStats = departments.reduce((acc, d) => {
    const setting = matrixSettings[d.id];
    const deptStaff = staffList.filter(s => String(s.department_id) === String(d.id));
    const deptCount = deptStaff.length;
    const currentDeptPayroll = deptStaff.reduce((sum, s) => sum + (s.current_gross || 0), 0);

    if (!setting || !setting.enabled || !setting.value) {
      return {
        ...acc,
        totalDeptPayroll: acc.totalDeptPayroll + currentDeptPayroll,
        projectedDeptPayroll: acc.projectedDeptPayroll + currentDeptPayroll,
      };
    }

    const val = parseCleanNumber(setting.value);
    let deptIncrease = 0;
    if (setting.type === 'percentage') {
      deptIncrease = currentDeptPayroll * (val / 100);
    } else if (setting.type === 'decrement_percentage') {
      deptIncrease = -(currentDeptPayroll * (val / 100));
    } else if (setting.type === 'decrement_fixed') {
      deptIncrease = -(deptCount * val);
    } else {
      deptIncrease = deptCount * val;
    }

    return {
      activeDepts: acc.activeDepts + 1,
      affectedStaff: acc.affectedStaff + deptCount,
      totalDeptPayroll: acc.totalDeptPayroll + currentDeptPayroll,
      projectedDeptPayroll: acc.projectedDeptPayroll + currentDeptPayroll + deptIncrease,
      totalIncrease: acc.totalIncrease + deptIncrease,
    };
  }, { activeDepts: 0, affectedStaff: 0, totalDeptPayroll: 0, projectedDeptPayroll: 0, totalIncrease: 0 });

  // Handle Multi-Department Matrix Submit
  const handleMultiDeptSubmit = async (e) => {
    e.preventDefault();
    const deptsToApply = Object.entries(matrixSettings)
      .filter(([_, s]) => s.enabled && parseCleanNumber(s.value) > 0)
      .map(([deptId, s]) => ({
        department_id: parseInt(deptId, 10),
        increment_type: s.type,
        amount: (s.type === 'fixed_amount' || s.type === 'decrement_fixed') ? parseCleanNumber(s.value) : null,
        percentage: (s.type === 'percentage' || s.type === 'decrement_percentage') ? parseCleanNumber(s.value) : null,
        reason: s.reason || 'Multi-department salary review',
      }));

    if (deptsToApply.length === 0) {
      showToast('Please enable and enter an adjustment for at least one department.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        effective_date: bulkEffectiveDate,
        default_reason: bulkReason || 'Departmental salary review',
        departments: deptsToApply,
      };

      const res = await axios.post(`${API_BASE}/payroll/salary-increments/multi-department`, payload, {
        headers: buildHeaders(),
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Multi-department increments applied successfully!');
        setMatrixSettings({});
        fetchStaffData();
        fetchHistory(1);
      } else {
        showToast(res.data.message || 'Failed to apply multi-department increments.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error applying increments.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Template Download
  const handleDownloadTemplate = async (format = 'xlsx') => {
    setDownloadingTemplate(true);
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (templateDeptId) params.append('department_id', templateDeptId);

      const res = await axios.get(`${API_BASE}/payroll/salary-increments/template?${params.toString()}`, {
        headers: buildHeaders(),
        responseType: 'blob',
      });

      const blob = new Blob([res.data], {
        type: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=UTF-8'
      });
      const filename = `Salary_Increment_Bulk_Template_${new Date().toISOString().split('T')[0]}.${format}`;
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

      showToast(`Increment template (${format.toUpperCase()}) downloaded successfully!`);
    } catch (err) {
      showToast('Failed to download template spreadsheet.', 'error');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Handle Drag & Drop Upload
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelectAndPreview(e.dataTransfer.files[0]);
    }
  };

  // File Select & Preview
  const handleFileSelectAndPreview = async (file) => {
    if (!file) return;
    setUploadFile(file);
    setPreviewData(null);
    setUploadWarnings([]);
    setLastUploadResult(null);
    setShowPreviewRows(true);
    setPreviewing(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const userId = getUserId();
      const headers = userId ? { 'X-User-Id': userId } : {};

      const res = await axios.post(`${API_BASE}/payroll/salary-increments/preview-upload`, formData, {
        headers,
      });

      if (res.data.status === 'success') {
        setPreviewData(res.data.data);
        setShowPreviewRows(true);
        if (res.data.data.warnings && res.data.data.warnings.length > 0) {
          setUploadWarnings(res.data.data.warnings);
        }
        showToast(`Spreadsheet analyzed: ${res.data.data.valid_count} staff records processed.`);
      } else {
        showToast(res.data.message || 'Failed to inspect spreadsheet.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error parsing spreadsheet file.', 'error');
    } finally {
      setPreviewing(false);
    }
  };

  // Handle Confirm Upload Submit
  const handleConfirmUpload = async () => {
    if (!uploadFile) {
      showToast('Please select an Excel or CSV file.', 'error');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const userId = getUserId();
      const headers = userId ? { 'X-User-Id': userId } : {};

      const res = await axios.post(`${API_BASE}/payroll/salary-increments/upload`, formData, {
        headers,
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Spreadsheet bulk adjustment applied successfully!');
        setLastUploadResult(res.data.data);
        setUploadFile(null);
        setPreviewData(null);
        setUploadWarnings([]);
        fetchStaffData();
        fetchHistory(1);
      } else {
        showToast(res.data.message || 'Upload failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error uploading spreadsheet.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetUpload = () => {
    setUploadFile(null);
    setPreviewData(null);
    setUploadWarnings([]);
    setLastUploadResult(null);
  };

  // Revert Increment
  const handleConfirmRevert = async () => {
    if (!revertTarget) return;
    setReverting(true);
    try {
      const res = await axios.post(`${API_BASE}/payroll/salary-increments/revert`, {
        increment_id: revertTarget.id,
      }, {
        headers: buildHeaders(),
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Salary increment reverted successfully!');
        setRevertTarget(null);
        fetchStaffData();
        fetchHistory(historyPagination.current_page);
      } else {
        showToast(res.data.message || 'Failed to revert salary.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error reverting increment.', 'error');
    } finally {
      setReverting(false);
    }
  };

  // Export History to Excel
  const handleExportHistoryExcel = async () => {
    setExportingHistory(true);
    try {
      const params = new URLSearchParams();
      if (historySearch) params.append('search', historySearch);
      if (historyDeptFilter) params.append('department_id', historyDeptFilter);

      const res = await axios.get(`${API_BASE}/payroll/salary-increments/export?${params.toString()}`, {
        headers: buildHeaders(),
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `Salary_Increments_Audit_${new Date().toISOString().split('T')[0]}.xlsx`;

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

      showToast('Salary increment audit spreadsheet exported!', 'success');
    } catch (err) {
      showToast('Failed to export history spreadsheet.', 'error');
    } finally {
      setExportingHistory(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Toast alert */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '0.85rem 1.25rem',
          borderRadius: '0.5rem',
          background: toast.type === 'error' ? '#dc2626' : '#059669',
          color: '#ffffff',
          fontWeight: 600,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>
            <TrendingUp size={28} className={styles.titleIcon} />
            Salary Increment Management
          </h1>
          <p className={styles.subtitle}>
            Adjust staff gross salaries individually, across departments, or in bulk via spreadsheet with full audit logs.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={() => { fetchStaffData(); fetchHistory(1); }}
            disabled={loadingStaff || loadingHistory}
          >
            <RefreshCw size={16} className={loadingStaff || loadingHistory ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconBlue}`}>
            <Users size={22} />
          </div>
          <div>
            <div className={styles.kpiLabel}>Active Personnel</div>
            <div className={styles.kpiValue}>{overviewStats.total_staff} Staff</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconGreen}`}>
            <DollarSign size={22} />
          </div>
          <div>
            <div className={styles.kpiLabel}>Current Total Payroll</div>
            <div className={styles.kpiValue}>₦{formatCurrency(overviewStats.total_payroll)}</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconPurple}`}>
            <Sparkles size={22} />
          </div>
          <div>
            <div className={styles.kpiLabel}>Total Increments Applied</div>
            <div className={styles.kpiValue}>{historySummary.total_increments} Records</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'single' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('single')}
        >
          <TrendingUp size={16} />
          Single Staff Increment
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'bulk' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <Users size={16} />
          Bulk / Department Increment
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'upload' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <FileSpreadsheet size={16} />
          Spreadsheet Bulk Upload
        </button>
      </div>

      {/* TAB 1: Single Staff Increment */}
      {activeTab === 'single' && (
        <div className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Single Employee Salary Adjustment</h2>
              <p className={styles.cardDesc}>Select an employee and set a percentage increment, fixed monthly bump, or new gross salary.</p>
            </div>
          </div>

          <form onSubmit={handleSingleSubmit}>
            <div className={styles.formGrid}>
              {/* Staff Search Autocomplete */}
              <div className={styles.formGroup} ref={dropdownRef}>
                <label className={styles.formLabel}>Select Employee *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Search staff by name or ID..."
                  value={staffSearchQuery}
                  onChange={(e) => {
                    setStaffSearchQuery(e.target.value);
                    setShowStaffDropdown(true);
                  }}
                  onFocus={() => setShowStaffDropdown(true)}
                  required
                />

                {showStaffDropdown && (
                  <div className={styles.dropdownMenu}>
                    {filteredStaffList.length > 0 ? (
                      filteredStaffList.map(s => (
                        <div
                          key={s.id}
                          className={styles.dropdownItem}
                          onClick={() => handleSelectStaff(s)}
                        >
                          <strong>{s.name}</strong> <span style={{ color: '#64748b', fontSize: '0.8rem' }}>(ID: {s.id} • {s.department})</span>
                        </div>
                      ))
                    ) : (
                      <div className={styles.dropdownItem} style={{ color: '#64748b' }}>
                        No matching staff found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Effective Date */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Effective Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                />
              </div>

              {/* Reason / Remarks */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Reason / Remarks</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Annual appraisal, promotion, wage review..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            {/* Increment / Decrement Mode Radio */}
            <label className={styles.formLabel} style={{ marginBottom: '0.5rem', display: 'block' }}>
              Adjustment Method
            </label>
            <div className={styles.radioGroup}>
              <div
                className={`${styles.radioOption} ${singleMode === 'percentage' ? styles.radioOptionSelected : ''}`}
                onClick={() => setSingleMode('percentage')}
              >
                <TrendingUp size={16} style={{ color: '#059669' }} />
                Percentage Increase (+%)
              </div>

              <div
                className={`${styles.radioOption} ${singleMode === 'decrement_percentage' ? styles.radioOptionSelected : ''}`}
                onClick={() => setSingleMode('decrement_percentage')}
              >
                <TrendingDown size={16} style={{ color: '#dc2626' }} />
                Percentage Decrement (-%)
              </div>

              <div
                className={`${styles.radioOption} ${singleMode === 'fixed_amount' ? styles.radioOptionSelected : ''}`}
                onClick={() => setSingleMode('fixed_amount')}
              >
                <DollarSign size={16} style={{ color: '#0284c7' }} />
                Fixed Increase (+₦)
              </div>

              <div
                className={`${styles.radioOption} ${singleMode === 'decrement_fixed' ? styles.radioOptionSelected : ''}`}
                onClick={() => setSingleMode('decrement_fixed')}
              >
                <DollarSign size={16} style={{ color: '#dc2626' }} />
                Fixed Decrement (-₦)
              </div>

              <div
                className={`${styles.radioOption} ${singleMode === 'new_gross' ? styles.radioOptionSelected : ''}`}
                onClick={() => setSingleMode('new_gross')}
              >
                <Percent size={16} />
                Direct Target Gross (₦)
              </div>
            </div>

            {/* Dynamic Inputs Based on Mode */}
            <div style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
              {(singleMode === 'percentage' || singleMode === 'decrement_percentage') && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {singleMode === 'decrement_percentage' ? 'Reduction Percentage (%) *' : 'Increase Percentage (%) *'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="99.9"
                    className={styles.formInput}
                    placeholder="e.g. 5, 10, 15"
                    value={percentageInput}
                    onChange={(e) => setPercentageInput(e.target.value)}
                    required
                  />
                </div>
              )}

              {(singleMode === 'fixed_amount' || singleMode === 'decrement_fixed') && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {singleMode === 'decrement_fixed' ? 'Fixed Reduction Amount (₦) *' : 'Fixed Increment Amount (₦) *'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={styles.formInput}
                    placeholder="e.g. 25,000"
                    value={fixedAmountInput}
                    onChange={(e) => setFixedAmountInput(formatNumberWithCommas(e.target.value))}
                    required
                  />
                </div>
              )}

              {singleMode === 'new_gross' && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>New Total Gross Salary (₦) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={styles.formInput}
                    placeholder="e.g. 1,600,000"
                    value={newGrossInput}
                    onChange={(e) => setNewGrossInput(formatNumberWithCommas(e.target.value))}
                    required
                  />
                </div>
              )}
            </div>

            {/* Real-Time Preview Impact Card */}
            {selectedStaff && (
              <div className={styles.previewBox}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewTitle}>
                    {singleDifference < 0 ? (
                      <TrendingDown size={18} style={{ color: '#dc2626' }} />
                    ) : (
                      <ArrowUpRight size={18} style={{ color: '#059669' }} />
                    )}
                    Projected Salary & Breakdown Preview
                  </div>
                  {singleDifference > 0 && (
                    <div className={styles.previewBadge}>
                      +₦{formatCurrency(singleDifference)} (+{singlePercentDiff}%)
                    </div>
                  )}
                  {singleDifference < 0 && (
                    <div className={styles.statusDecrement} style={{ fontSize: '0.85rem' }}>
                      -₦{formatCurrency(Math.abs(singleDifference))} (-{singlePercentDiff}%)
                    </div>
                  )}
                </div>

                <div className={styles.comparisonRow}>
                  <div className={styles.comparisonItem}>
                    <div className={styles.comparisonLabel}>Current Gross Salary</div>
                    <div className={styles.comparisonValue} style={{ color: '#64748b' }}>
                      ₦{formatCurrency(selectedStaff.current_gross)}
                    </div>
                  </div>

                  <div className={styles.comparisonItem} style={{ borderColor: singleDifference < 0 ? '#fca5a5' : '#86efac' }}>
                    <div className={styles.comparisonLabel}>Projected New Gross</div>
                    <div className={styles.comparisonValue} style={{ color: singleDifference < 0 ? '#dc2626' : '#059669' }}>
                      ₦{formatCurrency(projectedSingleGross)}
                    </div>
                  </div>

                  <div className={styles.comparisonItem}>
                    <div className={styles.comparisonLabel}>Department / Designation</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                      {selectedStaff.department} • {selectedStaff.designation}
                    </div>
                  </div>
                </div>

                {/* Allowance Itemized Grid */}
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
                  AUTOMATIC ALLOWANCE SPLIT (100%):
                </div>
                <div className={styles.breakdownPillGrid}>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Basic (20%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.basic)}</span>
                  </div>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Housing (20%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.housing)}</span>
                  </div>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Transport (10%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.transport)}</span>
                  </div>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Medical (10%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.medical)}</span>
                  </div>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Utility (20%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.utility)}</span>
                  </div>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Meal (20%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.meal)}</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={submitting || !selectedStaff}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {submitting ? 'Applying Adjustment...' : (singleDifference < 0 ? 'Apply Salary Decrement' : 'Apply Salary Increment')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Bulk / Department Increment */}
      {activeTab === 'bulk' && (
        <div className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Bulk / Department Salary Increment</h2>
              <p className={styles.cardDesc}>Apply a uniform increment across staff, or configure different increment amounts for different departments.</p>
            </div>
          </div>

          {/* Scope Mode Switcher */}
          <div className={styles.scopeToggle}>
            <button
              type="button"
              className={`${styles.scopeToggleBtn} ${bulkScopeMode === 'uniform' ? styles.scopeToggleBtnActive : ''}`}
              onClick={() => setBulkScopeMode('uniform')}
            >
              <Users size={15} style={{ marginRight: '6px' }} />
              Uniform Rate (Single Scope)
            </button>
            <button
              type="button"
              className={`${styles.scopeToggleBtn} ${bulkScopeMode === 'matrix' ? styles.scopeToggleBtnActive : ''}`}
              onClick={() => setBulkScopeMode('matrix')}
            >
              <Layers size={15} style={{ marginRight: '6px' }} />
              Department Matrix (Different Amounts per Dept)
            </button>
          </div>

          {bulkScopeMode === 'uniform' ? (
            <form onSubmit={handleBulkSubmit}>
              <div className={styles.formGrid}>
                {/* Target Audience */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Target Scope *</label>
                  <select
                    className={styles.formSelect}
                    value={bulkTarget}
                    onChange={(e) => setBulkTarget(e.target.value)}
                  >
                    <option value="all">All Active Staff ({staffList.length} Personnel)</option>
                    <option value="department">Specific Department</option>
                  </select>
                </div>

                {/* Department Selector (if target === 'department') */}
                {bulkTarget === 'department' && (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Select Department *</label>
                    <select
                      className={styles.formSelect}
                      value={bulkDeptId}
                      onChange={(e) => setBulkDeptId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Department --</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Effective Date */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Effective Date</label>
                  <input
                    type="date"
                    className={styles.formInput}
                    value={bulkEffectiveDate}
                    onChange={(e) => setBulkEffectiveDate(e.target.value)}
                    required
                  />
                </div>

                {/* Reason / Remarks */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Reason / Remarks</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. General cost of living adjustment..."
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                  />
                </div>
              </div>

              {/* Increment / Decrement Mode Radio */}
              <label className={styles.formLabel} style={{ marginBottom: '0.5rem', display: 'block' }}>
                Adjustment Method
              </label>
              <div className={styles.radioGroup}>
                <div
                  className={`${styles.radioOption} ${bulkMode === 'percentage' ? styles.radioOptionSelected : ''}`}
                  onClick={() => setBulkMode('percentage')}
                >
                  <TrendingUp size={16} style={{ color: '#059669' }} />
                  Percentage Increase (+%)
                </div>

                <div
                  className={`${styles.radioOption} ${bulkMode === 'decrement_percentage' ? styles.radioOptionSelected : ''}`}
                  onClick={() => setBulkMode('decrement_percentage')}
                >
                  <TrendingDown size={16} style={{ color: '#dc2626' }} />
                  Percentage Decrement (-%)
                </div>

                <div
                  className={`${styles.radioOption} ${bulkMode === 'fixed_amount' ? styles.radioOptionSelected : ''}`}
                  onClick={() => setBulkMode('fixed_amount')}
                >
                  <DollarSign size={16} style={{ color: '#0284c7' }} />
                  Fixed Increase (+₦)
                </div>

                <div
                  className={`${styles.radioOption} ${bulkMode === 'decrement_fixed' ? styles.radioOptionSelected : ''}`}
                  onClick={() => setBulkMode('decrement_fixed')}
                >
                  <DollarSign size={16} style={{ color: '#dc2626' }} />
                  Fixed Decrement (-₦)
                </div>
              </div>

              <div style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
                {(bulkMode === 'percentage' || bulkMode === 'decrement_percentage') ? (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      {bulkMode === 'decrement_percentage' ? 'Percentage Reduction (%) *' : 'Percentage Increase (%) *'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="99.9"
                      className={styles.formInput}
                      placeholder="e.g. 5, 10"
                      value={bulkPercentage}
                      onChange={(e) => setBulkPercentage(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      {bulkMode === 'decrement_fixed' ? 'Fixed Reduction Amount (₦) *' : 'Fixed Increase Amount (₦) *'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={styles.formInput}
                      placeholder="e.g. 20,000"
                      value={bulkAmount}
                      onChange={(e) => setBulkAmount(formatNumberWithCommas(e.target.value))}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Impact Analysis Card */}
              <div className={styles.previewBox}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewTitle}>
                    <Building2 size={18} />
                    Bulk Impact Projection Analysis
                  </div>
                  <div className={styles.previewBadge}>
                    {bulkFilteredStaff.length} Staff Affected
                  </div>
                </div>

                <div className={styles.comparisonRow}>
                  <div className={styles.comparisonItem}>
                    <div className={styles.comparisonLabel}>Current Monthly Payroll</div>
                    <div className={styles.comparisonValue} style={{ color: '#64748b' }}>
                      ₦{formatCurrency(currentBulkPayroll)}
                    </div>
                  </div>

                  <div className={styles.comparisonItem} style={{ borderColor: bulkTotalIncrease < 0 ? '#fca5a5' : '#86efac' }}>
                    <div className={styles.comparisonLabel}>Projected New Monthly Payroll</div>
                    <div className={styles.comparisonValue} style={{ color: bulkTotalIncrease < 0 ? '#dc2626' : '#059669' }}>
                      ₦{formatCurrency(projectedBulkPayroll)}
                    </div>
                  </div>

                  <div className={styles.comparisonItem} style={{ borderColor: bulkTotalIncrease < 0 ? '#fca5a5' : '#bae6fd' }}>
                    <div className={styles.comparisonLabel}>
                      {bulkTotalIncrease < 0 ? 'Monthly Payroll Reduction' : 'Monthly Cost Increase'}
                    </div>
                    <div className={styles.comparisonValue} style={{ color: bulkTotalIncrease < 0 ? '#dc2626' : '#0284c7' }}>
                      {bulkTotalIncrease < 0 ? `-₦${formatCurrency(Math.abs(bulkTotalIncrease))}` : `+₦${formatCurrency(bulkTotalIncrease)}`}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={submitting || bulkFilteredStaff.length === 0}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {submitting ? 'Applying Bulk Adjustment...' : (bulkTotalIncrease < 0 ? `Apply Bulk Decrement (${bulkFilteredStaff.length} Staff)` : `Apply Bulk Increment (${bulkFilteredStaff.length} Staff)`)}
              </button>
            </form>
          ) : (
            /* Mode B: Department-by-Department Matrix */
            <form onSubmit={handleMultiDeptSubmit}>
              <div className={styles.templateCard} style={{ marginBottom: '1.25rem' }}>
                <div className={styles.templateTitle}>
                  <Sliders size={18} style={{ color: '#0284c7' }} />
                  Department Increment Configuration
                </div>
                <div className={styles.templateDesc}>
                  Enter different increment amounts or percentages for each department. Only checked departments will be adjusted.
                </div>

                {/* Quick baseline fill bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem', background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                    Quick-Set Baseline:
                  </span>
                  <select
                    className={styles.matrixSelect}
                    value={matrixBaselineType}
                    onChange={(e) => setMatrixBaselineType(e.target.value)}
                  >
                    <option value="fixed_amount">Fixed Increase (+₦)</option>
                    <option value="decrement_fixed">Fixed Decrement (-₦)</option>
                    <option value="percentage">Percentage Increase (+%)</option>
                    <option value="decrement_percentage">Percentage Decrement (-%)</option>
                  </select>
                  <input
                    type="text"
                    className={styles.matrixInput}
                    placeholder={(matrixBaselineType === 'fixed_amount' || matrixBaselineType === 'decrement_fixed') ? 'e.g. 20,000' : 'e.g. 10'}
                    value={matrixBaselineValue}
                    onChange={(e) => setMatrixBaselineValue((matrixBaselineType === 'fixed_amount' || matrixBaselineType === 'decrement_fixed') ? formatNumberWithCommas(e.target.value) : e.target.value)}
                  />
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnOutline}`}
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                    onClick={handleApplyBaselineToAll}
                  >
                    Apply to All Departments
                  </button>
                </div>
              </div>

              <div className={styles.formGrid} style={{ marginBottom: '1.25rem' }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Effective Date</label>
                  <input
                    type="date"
                    className={styles.formInput}
                    value={bulkEffectiveDate}
                    onChange={(e) => setBulkEffectiveDate(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>General Remarks</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Departmental salary increment review..."
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                  />
                </div>
              </div>

              {/* Department Matrix Table */}
              <div className={styles.matrixTableWrapper}>
                <table className={styles.matrixTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>Apply</th>
                      <th>Department</th>
                      <th style={{ textAlign: 'center' }}>Active Staff</th>
                      <th style={{ textAlign: 'right' }}>Current Payroll</th>
                      <th style={{ width: '175px' }}>Adjustment Type</th>
                      <th style={{ width: '150px' }}>Adjustment Value</th>
                      <th style={{ textAlign: 'right' }}>Projected Net Change</th>
                      <th>Custom Note / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map(d => {
                      const deptStaff = staffList.filter(s => String(s.department_id) === String(d.id));
                      const deptCount = deptStaff.length;
                      const deptCurrentPayroll = deptStaff.reduce((sum, s) => sum + (s.current_gross || 0), 0);
                      const setting = matrixSettings[d.id] || { enabled: false, type: 'fixed_amount', value: '', reason: '' };

                      const numVal = parseCleanNumber(setting.value);
                      let projectedChange = 0;
                      if (setting.enabled && numVal > 0) {
                        if (setting.type === 'percentage') {
                          projectedChange = deptCurrentPayroll * (numVal / 100);
                        } else if (setting.type === 'decrement_percentage') {
                          projectedChange = -(deptCurrentPayroll * (numVal / 100));
                        } else if (setting.type === 'decrement_fixed') {
                          projectedChange = -(deptCount * numVal);
                        } else {
                          projectedChange = deptCount * numVal;
                        }
                      }

                      return (
                        <tr key={d.id} style={{ background: setting.enabled ? (projectedChange < 0 ? '#fef2f2' : '#f0fdf4') : 'transparent' }}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!setting.enabled}
                              onChange={() => handleToggleDeptMatrix(d.id)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>
                            {d.name}
                          </td>
                          <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                            {deptCount} Staff
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>
                            ₦{formatCurrency(deptCurrentPayroll)}
                          </td>
                          <td>
                            <select
                              className={styles.matrixSelect}
                              value={setting.type}
                              disabled={!setting.enabled}
                              onChange={(e) => handleUpdateDeptMatrix(d.id, 'type', e.target.value)}
                            >
                              <option value="fixed_amount">Fixed Increase (+₦)</option>
                              <option value="decrement_fixed">Fixed Decrement (-₦)</option>
                              <option value="percentage">Percentage (+%)</option>
                              <option value="decrement_percentage">Percentage (-%)</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className={styles.matrixInput}
                              placeholder={(setting.type === 'fixed_amount' || setting.type === 'decrement_fixed') ? 'e.g. 25,000' : 'e.g. 10'}
                              value={setting.value}
                              disabled={!setting.enabled}
                              onChange={(e) => handleUpdateDeptMatrix(
                                d.id,
                                'value',
                                (setting.type === 'fixed_amount' || setting.type === 'decrement_fixed') ? formatNumberWithCommas(e.target.value) : e.target.value
                              )}
                            />
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: projectedChange < 0 ? '#dc2626' : (projectedChange > 0 ? '#059669' : '#94a3b8'), fontVariantNumeric: 'tabular-nums' }}>
                            {projectedChange < 0 ? `-₦${formatCurrency(Math.abs(projectedChange))}` : (projectedChange > 0 ? `+₦${formatCurrency(projectedChange)}` : '—')}
                          </td>
                          <td>
                            <input
                              type="text"
                              className={styles.formInput}
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                              placeholder={`Adjustment for ${d.name}`}
                              value={setting.reason}
                              disabled={!setting.enabled}
                              onChange={(e) => handleUpdateDeptMatrix(d.id, 'reason', e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Combined Projection Box */}
              <div className={styles.previewBox} style={{ marginBottom: '1.5rem' }}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewTitle}>
                    <Building2 size={18} />
                    Multi-Department Impact Analysis
                  </div>
                  <div className={styles.previewBadge}>
                    {matrixStats.activeDepts} Departments Configured ({matrixStats.affectedStaff} Staff)
                  </div>
                </div>

                <div className={styles.comparisonRow}>
                  <div className={styles.comparisonItem}>
                    <div className={styles.comparisonLabel}>Departments Current Monthly Payroll</div>
                    <div className={styles.comparisonValue} style={{ color: '#64748b' }}>
                      ₦{formatCurrency(matrixStats.totalDeptPayroll)}
                    </div>
                  </div>

                  <div className={styles.comparisonItem} style={{ borderColor: matrixStats.totalIncrease < 0 ? '#fca5a5' : '#86efac' }}>
                    <div className={styles.comparisonLabel}>Projected New Monthly Payroll</div>
                    <div className={styles.comparisonValue} style={{ color: matrixStats.totalIncrease < 0 ? '#dc2626' : '#059669' }}>
                      ₦{formatCurrency(matrixStats.projectedDeptPayroll)}
                    </div>
                  </div>

                  <div className={styles.comparisonItem} style={{ borderColor: matrixStats.totalIncrease < 0 ? '#fca5a5' : '#bae6fd' }}>
                    <div className={styles.comparisonLabel}>
                      {matrixStats.totalIncrease < 0 ? 'Net Monthly Payroll Reduction' : 'Total Monthly Increment Cost'}
                    </div>
                    <div className={styles.comparisonValue} style={{ color: matrixStats.totalIncrease < 0 ? '#dc2626' : '#0284c7' }}>
                      {matrixStats.totalIncrease < 0 ? `-₦${formatCurrency(Math.abs(matrixStats.totalIncrease))}` : `+₦${formatCurrency(matrixStats.totalIncrease)}`}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={submitting || matrixStats.affectedStaff === 0}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {submitting ? 'Applying Multi-Department Adjustments...' : (matrixStats.totalIncrease < 0 ? `Apply Decrements (${matrixStats.affectedStaff} Staff across ${matrixStats.activeDepts} Depts)` : `Apply Increments (${matrixStats.affectedStaff} Staff across ${matrixStats.activeDepts} Depts)`)}
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 3: Spreadsheet Bulk Import */}
      {activeTab === 'upload' && (
        <div className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Spreadsheet Bulk Salary Increment</h2>
              <p className={styles.cardDesc}>Download a pre-filled Excel template, enter custom increment amounts per staff or department, and upload for automated processing with live preview.</p>
            </div>
          </div>

          {/* Step 1: Download Pre-filled Template */}
          <div className={styles.templateCard}>
            <div className={styles.templateHeader}>
              <div>
                <div className={styles.templateTitle}>
                  <FileSpreadsheet size={18} style={{ color: '#059669' }} />
                  Step 1: Download Pre-Filled Staff Template
                </div>
                <p className={styles.templateDesc}>
                  Export an official Excel or CSV spreadsheet containing all active staff pre-organized by department with their Current Gross salary.
                </p>
              </div>

              <div className={styles.templateActions}>
                <select
                  className={styles.formSelect}
                  style={{ width: '200px' }}
                  value={templateDeptId}
                  onChange={(e) => setTemplateDeptId(e.target.value)}
                >
                  <option value="">All Departments ({staffList.length} Staff)</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSuccess}`}
                  onClick={() => handleDownloadTemplate('xlsx')}
                  disabled={downloadingTemplate}
                >
                  {downloadingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Excel Template (.xlsx)
                </button>

                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => handleDownloadTemplate('csv')}
                  disabled={downloadingTemplate}
                >
                  <FileText size={16} />
                  CSV Template
                </button>
              </div>
            </div>

            <div className={styles.templateHint}>
              <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Template Columns:</strong> The bulk template contains only 5 columns: <strong>Staff ID</strong>, <strong>Department</strong>, <strong>Increment Amount</strong>, <strong>Increment Percentage</strong>, and <strong>Effective Date</strong>.<br />
                <strong>How to configure increments & decrements:</strong> Open the file in Excel or Google Sheets. Filter by <em>Department</em> and enter the desired increment (e.g. <code>25000</code> or <code>10%</code>) or decrement (e.g. <code>-15000</code> or <code>-5%</code>) in column <strong>C (Increment Amount)</strong> or column <strong>D (Increment Percentage)</strong>. You do not need to calculate gross salaries or supply file numbers — the system automatically matches the staff records and calculates their new gross. Leave rows empty or 0 for unchanged staff.
              </div>
            </div>
          </div>

          {/* Step 2: Upload Dropzone & Live Preview */}
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={18} style={{ color: '#0284c7' }} />
              Step 2: Upload & Inspect Spreadsheet
            </div>

            <div
              className={`${styles.uploadZone} ${dragActive ? styles.uploadZoneActive : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload-input').click()}
            >
              {previewing ? (
                <div>
                  <Loader2 size={36} className={`${styles.uploadIcon} animate-spin`} />
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0284c7' }}>
                    Inspecting spreadsheet & validating staff records...
                  </div>
                </div>
              ) : (
                <>
                  <Upload size={36} className={styles.uploadIcon} />
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {uploadFile ? uploadFile.name : 'Click to select or drag and drop your completed spreadsheet here'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Supported formats: .xlsx, .xls, .csv (Max 10MB)
                  </div>
                </>
              )}
              <input
                id="file-upload-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelectAndPreview(e.target.files[0]);
                  }
                }}
              />
            </div>
          </div>

          {/* Recently Applied Upload Results Banner */}
          {lastUploadResult && (
            <div style={{
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              marginTop: '1.5rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <CheckCircle2 size={24} style={{ color: '#16a34a' }} />
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#14532d', margin: 0 }}>
                      Bulk Salary Adjustments Applied Successfully!
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: '#166534', marginTop: '2px' }}>
                      Batch: <strong>{lastUploadResult.batch_id}</strong> • Applied to <strong>{lastUploadResult.updated_count} staff</strong> across <strong>{lastUploadResult.departments_summary?.length || 0} departments</strong>.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnOutline}`}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                    onClick={() => {
                      const el = document.querySelector(`.${styles.historyCard}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    View in Audit Table Below ↓
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnOutline}`}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                    onClick={() => setLastUploadResult(null)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Applied Rows Table in Tab 3 */}
              {lastUploadResult.applied_rows && lastUploadResult.applied_rows.length > 0 && (
                <div className={styles.matrixTableWrapper} style={{ maxHeight: '280px', overflowY: 'auto', background: '#ffffff', borderRadius: '0.5rem' }}>
                  <table className={styles.matrixTable}>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Staff ID</th>
                        <th>Staff Name</th>
                        <th>Department</th>
                        <th style={{ textAlign: 'right' }}>Previous Gross</th>
                        <th>Method</th>
                        <th style={{ textAlign: 'right' }}>New Gross</th>
                        <th style={{ textAlign: 'right' }}>Adjustment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastUploadResult.applied_rows.map((ar, idx) => (
                        <tr key={idx}>
                          <td>
                            <span className={ar.increase_amount < 0 ? styles.statusDecrement : styles.statusValid}>
                              {ar.increase_amount < 0 ? 'DECREMENT' : 'APPLIED'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{ar.staff_id}</td>
                          <td>{ar.staff_name}</td>
                          <td>{ar.department}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₦{formatCurrency(ar.current_gross)}</td>
                          <td>{ar.increment_type ? ar.increment_type.replace('_', ' ') : '—'}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>₦{formatCurrency(ar.new_gross)}</td>
                          <td style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 700,
                            color: ar.increase_amount < 0 ? '#dc2626' : '#16a34a'
                          }}>
                            {ar.increase_amount < 0 ? `-₦${formatCurrency(Math.abs(ar.increase_amount))}` : `+₦${formatCurrency(ar.increase_amount)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Interactive Inspection Preview */}
          {previewData && (
            <div className={styles.previewSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={20} style={{ color: '#059669' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Spreadsheet Inspection Summary
                  </h3>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  File: <strong>{uploadFile?.name}</strong> • Total Rows: <strong>{previewData.total_rows}</strong>
                </div>
              </div>

              {/* Prominent Quick Action Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
                padding: '0.85rem 1.25rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                marginBottom: '1.25rem',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                    {previewData.valid_count} Staff records ready to apply
                  </span>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Review the preview below and click &apos;Confirm &amp; Apply&apos; to update salaries and record entries.
                  </div>
                </div>

                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSuccess}`}
                  style={{ padding: '0.65rem 1.4rem', fontSize: '0.92rem', fontWeight: 700 }}
                  onClick={handleConfirmUpload}
                  disabled={submitting || previewData.valid_count === 0}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  {submitting
                    ? 'Applying Salary Adjustments...'
                    : previewData.decrements_count > 0 && previewData.increments_count > 0
                      ? `Confirm & Apply Adjustments (${previewData.valid_count} Staff)`
                      : previewData.decrements_count > 0
                        ? `Confirm & Apply Decrements (${previewData.valid_count} Staff)`
                        : `Confirm & Apply Increments (${previewData.valid_count} Staff)`}
                </button>
              </div>

              {/* KPI Metrics */}
              <div className={styles.previewKpiGrid}>
                <div className={styles.previewKpiCard}>
                  <div className={styles.previewKpiLabel}>
                    {previewData.decrements_count > 0 && previewData.increments_count > 0
                      ? 'Adjustments (Inc / Dec)'
                      : previewData.decrements_count > 0
                        ? 'Staff Receiving Decrements'
                        : 'Staff Receiving Increments'}
                  </div>
                  <div
                    className={styles.previewKpiValue}
                    style={{ color: previewData.decrements_count > 0 && previewData.increments_count === 0 ? '#dc2626' : '#059669' }}
                  >
                    {previewData.valid_count} Staff
                    {previewData.decrements_count > 0 && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', color: '#64748b', marginTop: '2px' }}>
                        +{previewData.increments_count || 0} inc / -{previewData.decrements_count || 0} dec
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.previewKpiCard}>
                  <div className={styles.previewKpiLabel}>Unchanged / Skipped Rows</div>
                  <div className={styles.previewKpiValue} style={{ color: '#64748b' }}>
                    {previewData.skipped_count} Staff
                  </div>
                </div>

                <div className={styles.previewKpiCard}>
                  <div className={styles.previewKpiLabel}>Previous Monthly Payroll</div>
                  <div className={styles.previewKpiValue} style={{ color: '#64748b' }}>
                    ₦{formatCurrency(previewData.total_prev_payroll)}
                  </div>
                </div>

                <div className={styles.previewKpiCard}>
                  <div className={styles.previewKpiLabel}>Projected New Payroll</div>
                  <div className={styles.previewKpiValue} style={{ color: '#0f172a' }}>
                    ₦{formatCurrency(previewData.total_new_payroll)}
                  </div>
                </div>

                <div
                  className={styles.previewKpiCard}
                  style={
                    previewData.total_monthly_increase < 0
                      ? { borderColor: '#fca5a5', background: '#fef2f2' }
                      : { borderColor: '#86efac', background: '#f0fdf4' }
                  }
                >
                  <div
                    className={styles.previewKpiLabel}
                    style={{ color: previewData.total_monthly_increase < 0 ? '#991b1b' : '#166534' }}
                  >
                    {previewData.total_monthly_increase < 0 ? 'Net Monthly Payroll Reduction' : 'Net Monthly Cost Increase'}
                  </div>
                  <div
                    className={styles.previewKpiValue}
                    style={{ color: previewData.total_monthly_increase < 0 ? '#dc2626' : '#15803d' }}
                  >
                    {previewData.total_monthly_increase < 0
                      ? `-₦${formatCurrency(Math.abs(previewData.total_monthly_increase))}`
                      : `+₦${formatCurrency(previewData.total_monthly_increase)}`}
                  </div>
                </div>
              </div>

              {/* Department Breakdown Cards */}
              {previewData.departments_summary && previewData.departments_summary.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', marginBottom: '0.6rem' }}>
                    DEPARTMENT ADJUSTMENT BREAKDOWN ({previewData.departments_summary.length} Departments Affected):
                  </div>
                  <div className={styles.deptGrid}>
                    {previewData.departments_summary.map((ds, idx) => (
                      <div key={idx} className={styles.deptCard}>
                        <div className={styles.deptCardTitle}>
                          <span>{ds.department}</span>
                          <span className={styles.statusValid}>{ds.staff_count} Staff</span>
                        </div>
                        <div className={styles.deptCardStats}>
                          <span>{ds.total_increase < 0 ? 'Dept Reduction:' : 'Dept Increase:'}</span>
                          <span className={ds.total_increase < 0 ? styles.deptCardCut : styles.deptCardBump}>
                            {ds.total_increase < 0 ? `-₦${formatCurrency(Math.abs(ds.total_increase))}` : `+₦${formatCurrency(ds.total_increase)}`}
                          </span>
                        </div>
                        <div className={styles.deptCardStats} style={{ marginTop: '0.2rem' }}>
                          <span>Avg Delta per Staff:</span>
                          <span style={{ fontWeight: 600, color: ds.avg_increase < 0 ? '#dc2626' : 'inherit' }}>
                            {ds.avg_increase < 0 ? `-₦${formatCurrency(Math.abs(ds.avg_increase))}` : `₦${formatCurrency(ds.avg_increase)}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings List */}
              {uploadWarnings.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertCircle size={16} />
                    Validation Warnings ({uploadWarnings.length}):
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#b91c1c', fontSize: '0.82rem', maxHeight: '120px', overflowY: 'auto' }}>
                    {uploadWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Toggleable Data Table Preview */}
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  onClick={() => setShowPreviewRows(prev => !prev)}
                >
                  <Eye size={14} />
                  {showPreviewRows ? 'Hide Detailed Row Preview' : `Inspect Detailed Row Preview (${previewData.preview_rows.length} Rows)`}
                </button>

                {showPreviewRows && (
                  <div className={styles.matrixTableWrapper} style={{ marginTop: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                    <table className={styles.matrixTable}>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Staff ID</th>
                          <th>Staff Name</th>
                          <th>Department</th>
                          <th style={{ textAlign: 'right' }}>Current Gross</th>
                          <th>Method</th>
                          <th>Input</th>
                          <th style={{ textAlign: 'right' }}>Projected New Gross</th>
                          <th style={{ textAlign: 'right' }}>Adjustment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.preview_rows.map((pr, idx) => (
                          <tr key={idx}>
                            <td>
                              <span className={
                                pr.status === 'valid' && pr.increase_amount < 0 ? styles.statusDecrement :
                                pr.status === 'valid' ? styles.statusValid :
                                pr.status === 'warning' ? styles.statusWarning : styles.statusSkipped
                              }>
                                {pr.status === 'valid' && pr.increase_amount < 0 ? 'DECREMENT' : pr.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{pr.staff_id}</td>
                            <td>{pr.staff_name}</td>
                            <td>{pr.department}</td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              ₦{formatCurrency(pr.current_gross)}
                            </td>
                            <td>{pr.increment_type ? pr.increment_type.replace('_', ' ') : '—'}</td>
                            <td>{pr.increment_value ? (pr.increment_type === 'percentage' || pr.increment_type === 'decrement_percentage' ? `${pr.increment_value}%` : `₦${formatCurrency(pr.increment_value)}`) : '—'}</td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                              ₦{formatCurrency(pr.new_gross)}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 700,
                              color: pr.increase_amount > 0 ? '#059669' : pr.increase_amount < 0 ? '#dc2626' : '#64748b'
                            }}>
                              {pr.increase_amount > 0
                                ? `+₦${formatCurrency(pr.increase_amount)}`
                                : pr.increase_amount < 0
                                  ? `-₦${formatCurrency(Math.abs(pr.increase_amount))}`
                                  : '₦0.00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSuccess}`}
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
                  onClick={handleConfirmUpload}
                  disabled={submitting || previewData.valid_count === 0}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  {submitting
                    ? 'Applying Salary Adjustments...'
                    : previewData.decrements_count > 0 && previewData.increments_count > 0
                      ? `Confirm & Apply Adjustments (${previewData.valid_count} Staff)`
                      : previewData.decrements_count > 0
                        ? `Confirm & Apply Decrements (${previewData.valid_count} Staff)`
                        : `Confirm & Apply Increments (${previewData.valid_count} Staff)`}
                </button>

                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={handleResetUpload}
                  disabled={submitting}
                >
                  Select Another File
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Section: Increment Audit Trail & Activity Log */}
      <div className={styles.historyCard}>
        <div className={styles.tableToolbar}>
          <div>
            <h2 className={styles.cardTitle}>Salary Increment Audit History</h2>
            <p className={styles.cardDesc}>Complete history of staff wage adjustments and audit trail.</p>
          </div>

          <div className={styles.tableFilters}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className={styles.formInput}
                placeholder="Search staff or reason..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ paddingLeft: '2rem', width: '220px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>

            <select
              className={styles.formSelect}
              value={historyDeptFilter}
              onChange={(e) => setHistoryDeptFilter(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <button
              type="button"
              className={`${styles.btn} ${styles.btnSuccess}`}
              onClick={handleExportHistoryExcel}
              disabled={exportingHistory || historyRecords.length === 0}
            >
              {exportingHistory ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              Export to Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Staff Name</th>
                <th>Department</th>
                <th>Adjustment Type</th>
                <th className={styles.tdMoney}>Previous Gross (₦)</th>
                <th className={styles.tdMoney}>New Gross (₦)</th>
                <th className={styles.tdIncrease}>Adjustment (₦)</th>
                <th>Effective Date</th>
                <th>Reason / Remarks</th>
                <th>Applied By</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '2rem' }}>
                    <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: '#0284c7' }} />
                  </td>
                </tr>
              ) : historyRecords.length > 0 ? (
                historyRecords.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>#{r.id}</td>
                    <td>
                      <strong>{r.staff_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {r.staff_id}</div>
                    </td>
                    <td>{r.department || 'General'}</td>
                    <td>
                      <span style={{
                        textTransform: 'capitalize',
                        fontWeight: 600,
                        color: r.increment_type?.startsWith('decrement_') ? '#dc2626' : '#0284c7'
                      }}>
                        {r.increment_type?.replace('_', ' ')}
                        {r.percentage ? ` (${r.percentage}%)` : ''}
                      </span>
                    </td>
                    <td className={styles.tdMoney}>{formatCurrency(r.previous_gross_salary)}</td>
                    <td className={styles.tdMoney} style={{ fontWeight: 700 }}>{formatCurrency(r.new_gross_salary)}</td>
                    <td
                      className={styles.tdIncrease}
                      style={{
                        color: Number(r.increase_amount) < 0 ? '#dc2626' : '#059669',
                        fontWeight: 700
                      }}
                    >
                      {Number(r.increase_amount) < 0
                        ? `-₦${formatCurrency(Math.abs(r.increase_amount))}`
                        : `+₦${formatCurrency(r.increase_amount)}`}
                    </td>
                    <td>{r.effective_date || '—'}</td>
                    <td style={{ maxWidth: '200px', whiteSpace: 'normal', fontSize: '0.8rem' }}>{r.reason || '—'}</td>
                    <td>{r.created_by_name || 'Admin'}</td>
                    <td>
                      <span className={r.status === 'applied' ? styles.badgeApplied : styles.badgeReverted}>
                        {r.status === 'applied' ? 'Active' : 'Reverted'}
                      </span>
                    </td>
                    <td>
                      {r.status === 'applied' && (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnOutline}`}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#dc2626' }}
                          onClick={() => setRevertTarget(r)}
                        >
                          <RotateCcw size={12} />
                          Revert
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No salary increment records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {historyPagination.last_page > 1 && (
          <div className={styles.pagination}>
            <div>
              Showing page <strong>{historyPagination.current_page}</strong> of <strong>{historyPagination.last_page}</strong> ({historyPagination.total} total records)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                disabled={historyPagination.current_page <= 1}
                onClick={() => {
                  const p = historyPagination.current_page - 1;
                  setHistoryPage(p);
                  fetchHistory(p);
                }}
              >
                Previous
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                disabled={historyPagination.current_page >= historyPagination.last_page}
                onClick={() => {
                  const p = historyPagination.current_page + 1;
                  setHistoryPage(p);
                  fetchHistory(p);
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Revert Confirmation Modal */}
      {revertTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Revert Salary Increment?</h3>
            <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to revert the salary increment for <strong>{revertTarget.staff_name}</strong>?
            </p>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', margin: '1rem 0' }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Current Gross: <strong>₦{formatCurrency(revertTarget.new_gross_salary)}</strong></div>
              <div style={{ fontSize: '0.82rem', color: '#059669', marginTop: '0.25rem' }}>Restored Gross: <strong>₦{formatCurrency(revertTarget.previous_gross_salary)}</strong></div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => setRevertTarget(null)}
                disabled={reverting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleConfirmRevert}
                disabled={reverting}
              >
                {reverting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                {reverting ? 'Reverting...' : 'Confirm Revert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
