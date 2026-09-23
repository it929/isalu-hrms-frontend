"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { FileText, Sparkles, Printer, Copy, RefreshCw, CheckCircle2, AlertCircle, Loader2, User, Building, Calendar, Send } from 'lucide-react';
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

function DocumentGeneratorContent() {
  const searchParams = useSearchParams();

  // Form States
  const [templateType, setTemplateType] = useState('resignation_acceptance');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [customPrompt, setCustomPrompt] = useState('');

  // Staff Autocomplete States
  const [staffList, setStaffList] = useState([]);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [resignationId, setResignationId] = useState(null);
  const dropdownRef = useRef(null);

  // Output States
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [letterData, setLetterData] = useState(null);
  const [includeHeading, setIncludeHeading] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch staff list for dropdown selector (loads both active staff_status: 1 and inactive staff_status: 0)
  const fetchStaffList = useCallback(async () => {
    try {
      let res;
      try {
        res = await axios.get(`${API_BASE}/hr/letters/staff`, { headers: buildHeaders() });
      } catch (firstErr) {
        try {
          const rootBase = API_BASE.replace(/\/nextjs$/, '');
          res = await axios.get(`${rootBase}/hr/letters/staff`, { headers: buildHeaders() });
        } catch (secondErr) {
          res = await axios.get(`${API_BASE}/payroll/resignations/staff?all_status=1`, { headers: buildHeaders() });
        }
      }
      if (res && res.data && res.data.status === 'success') {
        setStaffList(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load staff list', err);
    }
  }, []);

  useEffect(() => {
    fetchStaffList();
  }, [fetchStaffList]);

  // Read URL Search Parameters (if navigated from Resignation page)
  useEffect(() => {
    const paramType = searchParams.get('type');
    const paramStaffId = searchParams.get('staff_id');
    const paramResigId = searchParams.get('resignation_id');

    if (paramType) setTemplateType(paramType);
    if (paramResigId) setResignationId(paramResigId);

    if (paramStaffId && staffList.length > 0) {
      const found = staffList.find(s => String(s.id) === String(paramStaffId));
      if (found) {
        setSelectedStaff(found);
        setDropdownSearch(found.name);
      }
    }
  }, [searchParams, staffList]);

  // Generate Letter Handler
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const payload = {
        type: templateType,
        staff_id: selectedStaff ? selectedStaff.id : null,
        custom_prompt: customPrompt,
        effective_date: effectiveDate,
        resignation_id: resignationId,
        custom_recipient: !selectedStaff && dropdownSearch ? dropdownSearch : null,
      };

      let res;
      try {
        res = await axios.post(`${API_BASE}/hr/letters/generate`, payload, { headers: buildHeaders() });
      } catch (firstErr) {
        const rootBase = API_BASE.replace(/\/nextjs$/, '');
        res = await axios.post(`${rootBase}/hr/letters/generate`, payload, { headers: buildHeaders() });
      }

      if (res && res.data && res.data.status === 'success') {
        setLetterData(res.data.data);
        showToast('HR Letter generated successfully!');
      } else {
        showToast(res?.data?.message || 'Failed to generate letter', 'error');
      }
    } catch (err) {
      console.error('Error generating letter:', err);
      showToast(err.response?.data?.message || 'Error generating HR letter.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generate default initial letter on load
  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateType]);

  // Copy Content Handler
  const handleCopy = () => {
    if (!letterData) return;
    const textToCopy = `${letterData.organization}\n${letterData.ref_number}\nDate: ${letterData.date}\n\nTo: ${letterData.recipient.name}\n${letterData.recipient.department}\n\nSubject: ${letterData.subject}\n\n${letterData.salutation}\n\n${letterData.body}\n\nSincerely,\n${letterData.signatory.name}\n${letterData.signatory.org}`;
    navigator.clipboard.writeText(textToCopy);
    showToast('Letter text copied to clipboard!');
  };

  return (
    <div className={styles.container}>
      {/* Toast */}
      {toast && (
        <div className={styles.toast}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={`${styles.header} ${styles.noPrint}`}>
        <h1 className={styles.title}>
          <Sparkles size={24} style={{ color: '#10b981' }} />
          AI HR Document & Letter Generator
        </h1>
        <p className={styles.subtitle}>Generate, customize, and print official ISALU HOSPITAL letters and administrative correspondence.</p>
      </div>

      <div className={styles.grid}>
        {/* Left Column — Controls & Options */}
        <div className={`${styles.card} ${styles.noPrint}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <FileText size={18} /> Letter Parameters
            </h2>
          </div>

          <div className={styles.cardBody}>
            {/* 1. Document Template Type */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Letter Template Type</label>
              <select
                className={styles.select}
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
              >
                <option value="resignation_acceptance">Resignation Acceptance Letter</option>
                <option value="job_offer">Employment Offer Letter</option>
                <option value="query_notice">Query / Disciplinary Notice</option>
                <option value="promotion_letter">Promotion & Salary Adjustment</option>
                <option value="custom_letter">Custom AI Letter (Prompt Guided)</option>
              </select>
            </div>

            {/* 2. Staff Profile Selector */}
            <div className={styles.formGroup} ref={dropdownRef}>
              <label className={styles.label}>Recipient / Staff Member</label>
              <div className={styles.autocompleteWrapper}>
                <input
                  type="text"
                  placeholder="Type staff name or StaffID..."
                  className={styles.input}
                  value={dropdownSearch}
                  onChange={(e) => {
                    setDropdownSearch(e.target.value);
                    setShowDropdown(true);
                    if (selectedStaff && e.target.value !== selectedStaff.name) {
                      setSelectedStaff(null);
                    }
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
                {showDropdown && (
                  <div className={styles.dropdownMenu}>
                    {staffList
                      .filter(s => s.name.toLowerCase().includes(dropdownSearch.toLowerCase()) || String(s.id).includes(dropdownSearch.trim()))
                      .slice(0, 8)
                      .map((staff) => (
                        <div
                          key={staff.id}
                          className={styles.dropdownItem}
                          onClick={() => {
                            setSelectedStaff(staff);
                            setDropdownSearch(staff.name);
                            setShowDropdown(false);
                          }}
                        >
                          <div>
                            <strong>{staff.name}</strong>
                            <div style={{ fontSize: '0.72rem', color: '#6b7280', display: 'flex', gap: '0.4rem', marginTop: '0.1rem' }}>
                              <span>StaffID: {staff.id}</span>
                              <span style={{ 
                                color: staff.staff_status === 1 ? '#059669' : '#d97706',
                                fontWeight: 600,
                              }}>
                                • {staff.staff_status === 1 ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Effective / Action Date */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Effective / Issue Date</label>
              <input
                type="date"
                className={styles.input}
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>

            {/* 4. AI Directives / Custom Prompt Box */}
            <div className={styles.formGroup}>
              <label className={styles.label}>AI Directives / Custom Notes</label>
              <textarea
                className={styles.textarea}
                placeholder="e.g. Include note requiring 2-week handover to HOD; warm tone thanking staff for service..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            </div>

            {/* Generate Button */}
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? <Loader2 className={styles.loadingSpinner} size={18} /> : <Sparkles size={18} />}
              {loading ? 'Generating Letter...' : 'Generate Letter'}
            </button>
          </div>
        </div>

        {/* Right Column — Live Preview & Print Container */}
        <div>
          {/* Action Toolbar */}
          <div className={`${styles.noPrint}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className={styles.toolbarControls}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--secondary, #4b5563)' }}>
                Official Letterhead
              </span>
              <label className={styles.toggleLabel} title="Toggle official Isalu letterhead heading from PDF">
                <input
                  type="checkbox"
                  className={styles.toggleCheckbox}
                  checked={includeHeading}
                  onChange={(e) => setIncludeHeading(e.target.checked)}
                />
                <span>Letterhead Heading</span>
              </label>
              <label className={styles.toggleLabel} title="Toggle clinical specialties footer">
                <input
                  type="checkbox"
                  className={styles.toggleCheckbox}
                  checked={includeFooter}
                  onChange={(e) => setIncludeFooter(e.target.checked)}
                />
                <span>Services Footer</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={handleCopy}
                disabled={!letterData}
              >
                <Copy size={15} /> Copy Text
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => window.print()}
                disabled={!letterData}
              >
                <Printer size={15} /> Print Letter
              </button>
            </div>
          </div>

          {/* Letterhead Paper */}
          <div className={styles.paperContainer}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '500px' }}>
                <Loader2 className={styles.loadingSpinner} size={36} style={{ color: '#10b981' }} />
                <p style={{ marginTop: '1rem', fontStyle: 'italic', fontFamily: 'Arial, sans-serif' }}>Drafting formal HR document...</p>
              </div>
            ) : letterData ? (
              <>
                {/* Redesigned Official ISALU HOSPITAL Letter Heading */}
                {includeHeading ? (
                  <header className={styles.officialHeader}>
                    {/* Top Left Gradient Arc SVG */}
                    <div className={styles.headerArcWrapper}>
                      <svg
                        viewBox="0 0 32 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={styles.headerArcSvg}
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="isaluArcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#00b4d8" />
                            <stop offset="45%" stopColor="#00a2e8" />
                            <stop offset="100%" stopColor="#0077b6" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M0,0 L32,0 C22,10 10,22 0,32 Z"
                          fill="url(#isaluArcGradient)"
                        />
                      </svg>
                    </div>

                    {/* Header Content Grid */}
                    <div className={styles.headerContentGrid}>
                      {/* Left Address & Contact Block */}
                      <div className={styles.headerLeftBlock}>
                        <div className={styles.headerAddressLine}>No 46, Ijaiye Road Opposite Ogba Shopping Arcade,</div>
                        <div className={styles.headerAddressLine}>Caterpillar Bus-Stop, Ogba, Lagos Nigeria.</div>
                        <div className={styles.headerContactLine}>
                          <span className={styles.headerContactLabel}>Tel:</span> 08169618571, 08062287502, 08033088592
                        </div>
                        <div className={styles.headerWebLine}>
                          <span>info@isaluhospitals.com</span>, <span>www.isaluhospitals.com</span>
                        </div>
                      </div>

                      {/* Right Brand & Logo Block */}
                      <div className={styles.headerRightBlock}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/isalu_symbol.png"
                          alt="ISALU Logo Symbol"
                          className={styles.headerLogoSymbol}
                        />
                        <div className={styles.headerBrandText}>
                          <div className={styles.brandTitleMain}>ISALU</div>
                          <div className={styles.brandTitleSub}>HOSPITALS</div>
                          <div className={styles.brandTitleRow}>
                            <span className={styles.brandTitleLimited}>LIMITED</span>
                            <span className={styles.brandTitleRc}>RC: 502112</span>
                          </div>
                          <div className={styles.brandTagline}>[SPECIALIST HEALTHCARE PROVIDER]</div>
                        </div>
                      </div>
                    </div>
                  </header>
                ) : (
                  <div className={styles.preprintedSpacer}>
                    <strong>Pre-printed Letterhead Mode</strong>
                    <span>Space reserved for physical letterhead stationery in printer tray</span>
                  </div>
                )}

                {/* Letter Content Area */}
                <div className={styles.letterContentArea}>
                  {/* Ref & Date */}
                  <div className={styles.metaRow}>
                    <div className={styles.refNumber}>Ref: {letterData.ref_number}</div>
                    <div className={styles.letterDate}>Date: {letterData.date}</div>
                  </div>

                  {/* Recipient */}
                  <div className={styles.recipientBlock}>
                    <div className={styles.recipientName}>{letterData.recipient.name}</div>
                    {(letterData.recipient.staffID || letterData.recipient.id) && (
                      <div>StaffID: {letterData.recipient.staffID || letterData.recipient.id}</div>
                    )}
                    <div>Department: {letterData.recipient.department}</div>
                    <div>ISALU HOSPITALS LIMITED</div>
                  </div>

                  {/* Subject */}
                  <div className={styles.subjectLine}>
                    {letterData.subject}
                  </div>

                  {/* Salutation */}
                  <div style={{ marginBottom: '1rem', fontWeight: 600 }}>
                    {letterData.salutation}
                  </div>

                  {/* Body (Editable) */}
                  <div
                    className={styles.letterBody}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      setLetterData(prev => prev ? ({ ...prev, body: e.target.innerText }) : null);
                    }}
                  >
                    {letterData.body}
                  </div>

                  {/* Signatory */}
                  <div className={styles.signatoryBlock}>
                    <div>Yours faithfully,</div>
                    <div className={styles.signatureLine}></div>
                    <div className={styles.signatoryName}>{letterData.signatory.name}</div>
                    <div className={styles.signatoryTitle}>{letterData.signatory.title}</div>
                    <div style={{ fontWeight: 700, color: '#0284c7' }}>{letterData.signatory.org}</div>
                  </div>
                </div>

                {/* Redesigned Official Letterhead Footer */}
                {includeFooter && (
                  <footer className={styles.officialFooter}>
                    <div className={styles.footerGrid}>
                      {/* Col 1 */}
                      <div className={styles.footerCol}>
                        <div className={styles.footerColTitle}>Obstetrics & Gynaecology</div>
                        <ul className={styles.footerList}>
                          <li>Antenatal Clinic</li>
                          <li>Family Planning Clinic</li>
                          <li>Fertility Clinic</li>
                          <li>Routine Gynaecology Clinic</li>
                        </ul>
                        <div className={styles.footerColSubTitle}>Admissions</div>
                        <ul className={styles.footerList}>
                          <li>Standard Private Suites</li>
                          <li>Standard Executives Suites</li>
                        </ul>
                      </div>

                      {/* Col 2 */}
                      <div className={styles.footerCol}>
                        <div className={styles.footerColTitle}>Internal Medicine</div>
                        <ul className={styles.footerList}>
                          <li>Dermatology</li>
                          <li>Diabetes Mellitus</li>
                          <li>Cardiology</li>
                          <li>Gastro-Enterology</li>
                          <li>Neurology</li>
                          <li>Psychiatry</li>
                          <li>Nephrology</li>
                        </ul>
                      </div>

                      {/* Col 3 */}
                      <div className={styles.footerCol}>
                        <div className={styles.footerColTitle}>General Surgery</div>
                        <ul className={styles.footerList}>
                          <li>General Surgery</li>
                          <li>Orthopedics</li>
                          <li>Urology</li>
                        </ul>
                        <div className={styles.footerColSubTitle}>Health Screening</div>
                        <ul className={styles.footerList}>
                          <li>Well Man Scheme</li>
                          <li>Well Woman Scheme</li>
                        </ul>
                      </div>

                      {/* Col 4 */}
                      <div className={styles.footerCol}>
                        <div className={styles.footerColTitle}>Diagnostic Imaging</div>
                        <ul className={styles.footerList}>
                          <li>X-Ray Services</li>
                          <li>Ultrasound Scans</li>
                          <li>ECG</li>
                        </ul>
                        <div className={styles.footerColSubTitle} style={{ marginTop: '0.2rem' }}>Physiotherapy</div>
                      </div>

                      {/* Col 5 */}
                      <div className={styles.footerCol} style={{ borderRight: 'none' }}>
                        <div className={styles.footerColTitle}>Paediatrics</div>
                        <ul className={styles.footerList}>
                          <li>Out-Patient Clinic</li>
                          <li>Child Welfare</li>
                          <li>Immunization</li>
                        </ul>
                        <div className={styles.footerColSubTitle}>Opthalmology</div>
                        <ul className={styles.footerList}>
                          <li>Eye Clinic</li>
                        </ul>
                      </div>
                    </div>

                    {/* Bottom Right Corner Flourish SVG */}
                    <div className={styles.footerFlourishWrapper}>
                      <svg
                        viewBox="0 0 90 60"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={styles.footerFlourishSvg}
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="footerFlourishGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#00b4d8" />
                            <stop offset="100%" stopColor="#0077b6" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M90,0 C60,25 20,45 0,60 L90,60 Z"
                          fill="url(#footerFlourishGrad)"
                        />
                      </svg>
                    </div>
                  </footer>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AiDocumentGeneratorPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading Document Generator...</div>}>
      <DocumentGeneratorContent />
    </Suspense>
  );
}
