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

  // Fetch staff list for dropdown selector
  const fetchStaffList = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/payroll/resignations/staff`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
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
                  placeholder="Type staff name, ID..."
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
                      .filter(s => s.name.toLowerCase().includes(dropdownSearch.toLowerCase()) || (s.fileNo && s.fileNo.toLowerCase().includes(dropdownSearch.toLowerCase())))
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
                          <strong>{staff.name}</strong> <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>(Staff ID: {staff.id})</span>
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
          <div className={`${styles.noPrint}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--secondary, #4b5563)' }}>
              Official Letterhead Preview
            </span>
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
                {/* ISALU HOSPITAL Letterhead Header */}
                <div className={styles.letterheadBanner}>
                  <h1 className={styles.hospitalTitle}>{letterData.organization}</h1>
                  <div className={styles.hospitalTagline}>{letterData.tagline}</div>
                  <div className={styles.hospitalContact}>Medical Services & Administrative Operations • High Quality Patient Care</div>
                </div>

                {/* Ref & Date */}
                <div className={styles.metaRow}>
                  <div className={styles.refNumber}>Ref: {letterData.ref_number}</div>
                  <div className={styles.letterDate}>Date: {letterData.date}</div>
                </div>

                {/* Recipient */}
                <div className={styles.recipientBlock}>
                  <div className={styles.recipientName}>{letterData.recipient.name}</div>
                  <div>Staff ID: {letterData.recipient.staffID || letterData.recipient.fileNo}</div>
                  <div>Department: {letterData.recipient.department}</div>
                  <div>ISALU HOSPITAL</div>
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
                  <div style={{ fontWeight: 700, color: '#047857' }}>{letterData.signatory.org}</div>
                </div>
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
