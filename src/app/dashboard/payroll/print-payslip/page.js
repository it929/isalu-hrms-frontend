"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Printer, AlertCircle, FileText, CheckCircle2, Search, X, Mail } from 'lucide-react';
import axios from 'axios';
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

const formatCurrency = (value) => {
  if (value === undefined || value === null) return '₦0.00';
  const valNum = typeof value === 'string' ? parseFloat(value) : value;
  return '₦' + valNum.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PrintPayslip() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [myStaff, setMyStaff] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection states
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [printSize, setPrintSize] = useState('A5');

  // Payslip rendering states
  const [payslipData, setPayslipData] = useState(null);
  const [fetchingPayslip, setFetchingPayslip] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Notification toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Prepopulate Year dropdown (current year down to 5 years ago)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  // Month list
  const months = [
    { value: 'JANUARY', label: 'January' },
    { value: 'FEBRUARY', label: 'February' },
    { value: 'MARCH', label: 'March' },
    { value: 'APRIL', label: 'April' },
    { value: 'MAY', label: 'May' },
    { value: 'JUNE', label: 'June' },
    { value: 'JULY', label: 'July' },
    { value: 'AUGUST', label: 'August' },
    { value: 'SEPTEMBER', label: 'September' },
    { value: 'OCTOBER', label: 'October' },
    { value: 'NOVEMBER', label: 'November' },
    { value: 'DECEMBER', label: 'December' }
  ];

  // Fetch page initialization metadata
  const initializePage = async () => {
    setLoading(true);
    try {
      // 1. Fetch payslip init to check admin status and get self profile
      const initRes = await axios.get(`${API_BASE}/payroll/payslip/init`, { headers: buildHeaders() });
      if (initRes.data.status === 'success') {
        const adminStatus = !!initRes.data.is_admin;
        setIsAdmin(adminStatus);
        
        const selfStaff = initRes.data.my_staff;
        setMyStaff(selfStaff);

        if (adminStatus) {
          // 2. If admin, fetch all staff list for selection dropdown
          const staffRes = await axios.get(`${API_BASE}/payroll/salary-structures/staff`, { headers: buildHeaders() });
          if (staffRes.data.status === 'success') {
            setStaffList(staffRes.data.data || []);
          }
        } else if (selfStaff) {
          // If regular staff, auto-select their profile
          setSelectedStaffId(selfStaff.id);
          setStaffSearch(selfStaff.name);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Error initializing page data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializePage();
  }, []);

  const handleStaffSelect = (staff) => {
    setSelectedStaffId(staff.id);
    setStaffSearch(staff.name);
    setShowStaffDropdown(false);
  };

  const handleClearStaff = () => {
    if (!isAdmin) return; // Regular users cannot clear themselves
    setSelectedStaffId('');
    setStaffSearch('');
    setPayslipData(null);
  };

  const handleGeneratePayslip = async (e) => {
    e.preventDefault();
    if (!selectedStaffId || !selectedMonth || !selectedYear) {
      showToast('Please specify Staff, Month, and Year.', 'error');
      return;
    }

    setFetchingPayslip(true);
    setPayslipData(null);

    try {
      const res = await axios.get(`${API_BASE}/payroll/payslip`, {
        params: {
          staff_id: selectedStaffId,
          month: selectedMonth,
          year: selectedYear
        },
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        setPayslipData(res.data.data);
        showToast('Payslip generated successfully!', 'success');
      } else {
        showToast(res.data.message || 'Could not fetch payslip details.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'No record found for selected search parameters.', 'error');
    } finally {
      setFetchingPayslip(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedStaffId || !selectedMonth || !selectedYear) return;
    setSendingEmail(true);
    try {
      const res = await axios.post(`${API_BASE}/payroll/payslip/send-email`, {
        staff_id: selectedStaffId,
        month: selectedMonth,
        year: selectedYear
      }, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast('Payslip email sent successfully!', 'success');
      } else {
        showToast(res.data.message || 'Failed to send email.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error sending payslip email.', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Filter staff list based on search term
  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.fileNo.toLowerCase().includes(staffSearch.toLowerCase()) ||
    (s.id && s.id.toString().includes(staffSearch))
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.container}>
      <div className={styles.controlsCard}>
        <h2 className={styles.controlsTitle}>
          <FileText size={22} color="var(--primary)" />
          Generate & Print Payslips
        </h2>

        {loading ? (
          <div className={styles.loading}>
            <Loader2 size={32} className={styles.spinner} />
            <p>Initializing print environment...</p>
          </div>
        ) : (
          <form onSubmit={handleGeneratePayslip}>
            <div className={styles.grid}>
              {/* Staff Select */}
              <div className={styles.formGroup} style={{ position: 'relative' }}>
                <label className={styles.label}>Staff Member</label>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Search staff by name or ID..."
                    value={staffSearch}
                    onChange={(e) => {
                      setStaffSearch(e.target.value);
                      if (selectedStaffId) setSelectedStaffId('');
                      setShowStaffDropdown(true);
                    }}
                    onFocus={() => isAdmin && setShowStaffDropdown(true)}
                    disabled={!isAdmin}
                    style={{ paddingRight: isAdmin && selectedStaffId ? '2.5rem' : '1rem' }}
                  />
                  {isAdmin && selectedStaffId && (
                    <button
                      type="button"
                      onClick={handleClearStaff}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu */}
                {isAdmin && showStaffDropdown && staffSearch && !selectedStaffId && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      background: 'var(--surface)',
                      boxShadow: 'var(--shadow)',
                      zIndex: 999,
                      marginTop: '0.25rem'
                    }}
                  >
                    {filteredStaff.length === 0 ? (
                      <div style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        No staff matching search parameters
                      </div>
                    ) : (
                      filteredStaff.map(s => (
                        <div
                          key={s.id}
                          onClick={() => handleStaffSelect(s)}
                          style={{
                            padding: '0.75rem 1rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.9rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          className="sidebar-hover-effect"
                        >
                          <span>{s.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Month Select */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Select Month</label>
                <select
                  className={styles.select}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  required
                >
                  <option value="">-- Month --</option>
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Year Select */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Select Year</label>
                <select
                  className={styles.select}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  required
                >
                  <option value="">-- Year --</option>
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={fetchingPayslip || !selectedStaffId || !selectedMonth || !selectedYear}
              >
                {fetchingPayslip ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    Generating...
                  </>
                ) : (
                  'Generate Payslip'
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Generating Spinner */}
      {fetchingPayslip && (
        <div className={styles.loading}>
          <Loader2 size={40} className={styles.spinner} />
          <p>Compiling database salary runs...</p>
        </div>
      )}

      {/* Rendered Payslip Card */}
      {payslipData && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Action header */}
          <div className={styles.actions} style={{ justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <label htmlFor="print-size-select" style={{ fontSize: '0.85rem', fontWeight: '600', marginRight: '0.5rem', color: 'var(--text-secondary)' }}>Print Size:</label>
              <select
                id="print-size-select"
                value={printSize}
                onChange={(e) => setPrintSize(e.target.value)}
                className={styles.select}
                style={{ width: 'auto', padding: '0.5rem 2rem 0.5rem 1rem', height: '40px', borderRadius: '8px' }}
              >
                <option value="A5">A5 (Landscape)</option>
                <option value="A4">A4 (Portrait)</option>
              </select>
            </div>
            <button onClick={handlePrint} className={styles.btnPrimary} style={{ height: '40px' }}>
              <Printer size={16} />
              Print Payslip
            </button>
            {isAdmin && (
              <button onClick={handleSendEmail} disabled={sendingEmail} className={styles.btnPrimary} style={{ height: '40px', backgroundColor: '#3b82f6' }}>
                {sendingEmail ? <Loader2 size={16} className={styles.spinner} /> : <Mail size={16} />}
                {sendingEmail ? 'Sending...' : 'Send Payslip to Email'}
              </button>
            )}
          </div>

          {/* Dynamic page print size overrides */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: ${printSize === 'A4' ? 'A4 portrait' : 'A5 landscape'};
                margin: ${printSize === 'A4' ? '12mm' : '4mm'};
              }
            }
          `}} />

          {/* Payslip Document */}
          <div className={styles.payslipWrapper} data-print-size={printSize}>
            <div className={styles.payslipHeader}>
              <div className={styles.companyInfo}>
                <h2>Isalu Hospitals Limited</h2>
                <p>STAFF MONTHLY SALARY ADVICE / PAYSLIP</p>
              </div>
              <div className={styles.payslipTitle}>
                <h3>PAYSLIP</h3>
                <p>{selectedMonth} {selectedYear}</p>
              </div>
            </div>

            {/* Staff details */}
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Staff Name:</span>
                <span className={styles.metaVal}>{payslipData.staff.name}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Department:</span>
                <span className={styles.metaVal}>{payslipData.staff.department}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Designation:</span>
                <span className={styles.metaVal}>{payslipData.staff.designation}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Paid Days:</span>
                <span className={styles.metaVal}>{payslipData.payslip.paid_days !== null && payslipData.payslip.paid_days !== undefined ? payslipData.payslip.paid_days : 'N/A'}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Bank Name:</span>
                <span className={styles.metaVal}>{payslipData.staff.bank_name}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Bank Account:</span>
                <span className={styles.metaVal}>{payslipData.staff.bank_account}</span>
              </div>
            </div>

            {/* Earnings and Deductions columns */}
            <div className={styles.breakdownGrid}>
              {/* Earnings Column */}
              <div>
                <h4 className={styles.sectionTitle}>Earnings</h4>
                <table className={styles.table}>
                  <tbody>
                    <tr>
                      <td>Basic Salary</td>
                      <td>{formatCurrency(payslipData.payslip.basic)}</td>
                    </tr>
                    <tr>
                      <td>Housing Allowance</td>
                      <td>{formatCurrency(payslipData.payslip.housing)}</td>
                    </tr>
                    <tr>
                      <td>Transport Allowance</td>
                      <td>{formatCurrency(payslipData.payslip.transport)}</td>
                    </tr>
                    <tr>
                      <td>Medical Allowance</td>
                      <td>{formatCurrency(payslipData.payslip.medical)}</td>
                    </tr>
                    <tr>
                      <td>Utility Allowance</td>
                      <td>{formatCurrency(payslipData.payslip.utility)}</td>
                    </tr>
                    <tr>
                      <td>Meal Allowance</td>
                      <td>{formatCurrency(payslipData.payslip.meal)}</td>
                    </tr>
                    <tr className={styles.subTotalRow}>
                      <td>Gross Earnings</td>
                      <td>{formatCurrency(payslipData.payslip.gross_pay)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Deductions Column */}
              <div>
                <h4 className={styles.sectionTitle}>Deductions</h4>
                <table className={styles.table}>
                  <tbody>
                    <tr>
                      <td>P. Tax</td>
                      <td>{formatCurrency(payslipData.payslip.tax)}</td>
                    </tr>
                    <tr>
                      <td>IOU</td>
                      <td>{formatCurrency(payslipData.payslip.iou)}</td>
                    </tr>
                    <tr>
                      <td>Retention</td>
                      <td>{formatCurrency(payslipData.payslip.retention)}</td>
                    </tr>
                    <tr>
                      <td>Surcharges</td>
                      <td>{formatCurrency(payslipData.payslip.surcharges)}</td>
                    </tr>
                    <tr>
                      <td>Pension</td>
                      <td>{formatCurrency(payslipData.payslip.pension)}</td>
                    </tr>
                    <tr>
                      <td>Med. Loan</td>
                      <td>{formatCurrency(payslipData.payslip.medical_loan)}</td>
                    </tr>
                    <tr>
                      <td>Coop. Saving</td>
                      <td>{formatCurrency(payslipData.payslip.coop_savings)}</td>
                    </tr>
                    <tr>
                      <td>Coop. Loan Rpyt</td>
                      <td>{formatCurrency(payslipData.payslip.coop_loan)}</td>
                    </tr>
                    <tr>
                      <td>Absence Pen</td>
                      <td>{formatCurrency(payslipData.payslip.absence_penalty)}</td>
                    </tr>
                    <tr>
                      <td>LOA Dedn</td>
                      <td>{formatCurrency(payslipData.payslip.leave_absence_deduction)}</td>
                    </tr>
                    <tr>
                      <td>Coop. Asset</td>
                      <td>{formatCurrency(payslipData.payslip.coop_asset_finance)}</td>
                    </tr>
                    <tr className={styles.subTotalRow}>
                      <td>Total Deductions</td>
                      <td>{formatCurrency(payslipData.payslip.total_deductions)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Balances & Net Salary Row (Side-by-Side) */}
            <div className={styles.bottomSection}>
              {/* Balances & Information Section */}
              <div className={styles.balancesContainer}>
                <h4 className={styles.sectionTitle}>Balances & Outstanding Information</h4>
                <div className={styles.balancesGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Cop. Contr.:</span>
                    <span className={styles.metaVal}>{formatCurrency(payslipData.payslip.coop_savings_balance)}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Cop. Lone Bal:</span>
                    <span className={styles.metaVal}>{formatCurrency(payslipData.payslip.coop_loan_balance)}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Cop. Asset Fin:</span>
                    <span className={styles.metaVal}>{formatCurrency(payslipData.payslip.coop_asset_finance_balance)}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Med. Debt:</span>
                    <span className={styles.metaVal}>{formatCurrency(payslipData.payslip.medical_loan_balance)}</span>
                  </div>
                </div>
              </div>

              {/* Net Salary Paid Section */}
              <div className={styles.netPayContainer}>
                <div className={styles.netPayCard}>
                  <span className={styles.netPayLabel}>Net Salary Paid</span>
                  <div className={styles.netPayVal}>{formatCurrency(payslipData.payslip.net_pay)}</div>
                </div>
              </div>
            </div>

            {/* Signature Section */}
            <div style={{ marginTop: '20px', borderTop: '1px dashed var(--border)', paddingTop: '15px' }}>
              <span className={styles.metaLabel} style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Authorized Signature (HR Head):</span>
              {payslipData.hr_signature ? (
                <img src={payslipData.hr_signature} alt="HR Head Signature" style={{ maxHeight: '70px', display: 'block' }} />
              ) : (
                <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No signature on file</span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} className={styles.toastSuccessIcon} />
            ) : (
              <AlertCircle size={18} className={styles.toastErrorIcon} />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
