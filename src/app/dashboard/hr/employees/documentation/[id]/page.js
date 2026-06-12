"use client";

import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useRouter, useParams } from 'next/navigation';
import { 
  User, Mail, MapPin, GraduationCap, Heart, Users, Baby, Briefcase, 
  CreditCard, FileText, Camera, CheckCircle, ChevronRight, ChevronLeft, Save, Plus, Trash2
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';
const STORAGE_BASE = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://127.0.0.1:8000/storage';

const STEPS = [
  { id: 1, title: 'Basic Info', icon: <User size={20} /> },
  { id: 2, title: 'Contact', icon: <Mail size={20} /> },
  { id: 3, title: 'Origin', icon: <MapPin size={20} /> },
  { id: 4, title: 'Education', icon: <GraduationCap size={20} /> },
  { id: 5, title: 'Marital', icon: <Heart size={20} /> },
  { id: 6, title: 'Next of Kin', icon: <Users size={20} /> },
  { id: 7, title: 'Children', icon: <Baby size={20} /> },
  { id: 8, title: 'Experience', icon: <Briefcase size={20} /> },
  { id: 9, title: 'Attachments', icon: <FileText size={20} /> },
  { id: 10, title: 'Account', icon: <CreditCard size={20} /> },
  { id: 11, title: 'Media', icon: <Camera size={20} /> },
  { id: 12, title: 'Others', icon: <FileText size={20} /> },
  { id: 13, title: 'Preview', icon: <CheckCircle size={20} /> },
];

export default function StaffDocumentation() {
  const router = useRouter();
  const { id } = useParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const stepParam = params.get('step');
      if (stepParam) {
        const stepNum = parseInt(stepParam, 10);
        if (stepNum >= 1 && stepNum <= 13) {
          setCurrentStep(stepNum);
        }
      }
    }
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/hr/documentation/${id}`);
      let serverData = res.data.data;
      
      // Standardize nextOfKin to always have at least 2 entries for legacy parity
      if (!serverData.nextOfKin || serverData.nextOfKin.length === 0) {
        serverData.nextOfKin = [
          { fullname: '', phoneno: '', relationship: '', address: '' },
          { fullname: '', phoneno: '', relationship: '', address: '' }
        ];
      } else if (serverData.nextOfKin.length === 1) {
        serverData.nextOfKin.push({ fullname: '', phoneno: '', relationship: '', address: '' });
      }

      if (!serverData.children) {
        serverData.children = [];
      }
      if (!serverData.experience) {
        serverData.experience = [];
      }
      if (!serverData.attachments) {
        serverData.attachments = [];
      }
      if (!serverData.others) {
        serverData.others = {
          qtn1: '', qtn2: '', qtn3: '', qtn4: '', qtn5: '', qtn6: '', qtn7: '', qtn8: '', qtn9: '', qtn10: '', qtn11: ''
        };
      }
      serverData.media = {
        passportUrl: serverData.basic.passport_url || '',
        signatureUrl: serverData.basic.signature_url || '',
        passportFile: null,
        signatureFile: null
      };

      setData(serverData);
    } catch (err) {
      showToast('Failed to load staff data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleNext = () => currentStep < 13 && setCurrentStep(prev => prev + 1);
  const handleBack = () => currentStep > 1 && setCurrentStep(prev => prev - 1);

  const [designations, setDesignations] = useState([]);
  const [lgas, setLgas] = useState([]);

  useEffect(() => {
    const deptId = data?.basic?.departmentID || data?.basic?.department;
    if (deptId) {
      axios.get(`${API_BASE}/hr/add-staff/designations/${deptId}`)
        .then(res => setDesignations(res.data))
        .catch(() => setDesignations([]));
    }
  }, [data?.basic?.departmentID, data?.basic?.department]);

  useEffect(() => {
    if (data?.basic?.stateID) {
      axios.get(`${API_BASE}/hr/add-staff/lgas/${data.basic.stateID}`)
        .then(res => setLgas(res.data))
        .catch(() => setLgas([]));
    }
  }, [data?.basic?.stateID]);

  const handleStepSave = async () => {
    setSaving(true);
    try {
      let endpoint = '';
      let payload = {};
      let isFormData = false;
      let formData = new FormData();

      switch(currentStep) {
        case 1: endpoint = 'basic'; payload = data.basic; break;
        case 2: endpoint = 'contact'; payload = data.basic; break;
        case 3: endpoint = 'origin'; payload = data.basic; break;
        case 4: handleNext(); setSaving(false); return; // Education records are uploaded instantly
        case 5: 
          endpoint = 'marital'; 
          payload = { 
            wifename: data.marital?.wifename || '',
            wifedateofbirth: data.marital?.wifedateofbirth || null,
            dateofmarriage: data.marital?.dateofmarriage || null,
            homeplace: data.marital?.homeplace || '',
            maritalStatus: data.marital?.maritalstatus || '' 
          }; 
          break;
        case 6: endpoint = 'next-of-kin'; payload = { kins: data.nextOfKin }; break;
        case 7: endpoint = 'children'; payload = { children: data.children }; break;
        case 8: endpoint = 'experience'; payload = { experience: data.experience }; break;
        case 9: endpoint = 'attachment-complete'; payload = {}; break;
        case 10: endpoint = 'account'; payload = { bankID: data.basic.bankID, accountNumber: data.basic.AccNo }; break;
        case 11: 
          endpoint = 'media'; 
          isFormData = true;
          if (data.media?.passportFile) {
            formData.append('passport', data.media.passportFile);
          }
          if (data.media?.signatureFile) {
            formData.append('signature', data.media.signatureFile);
          }
          break;
        case 12: endpoint = 'others'; payload = data.others; break;
        case 13:
          await axios.post(`${API_BASE}/hr/documentation/${id}/submit`);
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('hrms_employee_records_cache');
          }
          showToast("Staff documentation completed successfully!");
          setTimeout(() => {
            router.push('/dashboard/hr/employees');
          }, 1500);
          setSaving(false);
          return;
        default: handleNext(); setSaving(false); return;
      }

      if (isFormData) {
        await axios.post(`${API_BASE}/hr/documentation/${id}/${endpoint}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post(`${API_BASE}/hr/documentation/${id}/${endpoint}`, payload);
      }

      showToast(`Step ${currentStep} saved!`);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('hrms_employee_records_cache');
      }
      handleNext();
      // quietly refresh the full data to catch updated database links/URLs
      fetchData();
    } catch (err) {
      showToast('Error saving progress', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading Documentation...</div>;
  if (!data) return <div className={styles.error}>Staff record not found.</div>;

  const handleChange = (section, e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? (checked ? 'yes' : 'null') : value;
    setData(prev => ({
      ...prev,
      [section]: { ...prev[section], [name]: val }
    }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.wizardHeader}>
        <div className={styles.headerInfo}>
          <h1>Staff Documentation</h1>
          <p>Onboarding: {data.basic.surname} {data.basic.first_name}</p>
        </div>
        <div className={styles.stepTrack}>
          {STEPS.map(step => (
            <div 
              key={step.id} 
              className={`${styles.stepNode} ${currentStep === step.id ? styles.active : ''} ${currentStep > step.id ? styles.completed : ''}`}
              onClick={() => setCurrentStep(step.id)}
            >
              <div className={styles.iconBox}>{step.icon}</div>
              <span>{step.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`premium-card ${styles.wizardCard}`}>
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={styles.stepContent}
          >
            {renderStep(currentStep, data, setData, handleChange, designations, lgas, id, fetchData, setCurrentStep)}
          </motion.div>
        </AnimatePresence>

        <div className={styles.wizardFooter}>
          <button className={styles.btnBack} onClick={handleBack} disabled={currentStep === 1 || saving}>
            <ChevronLeft size={18} /> Back
          </button>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className={styles.btnNext} onClick={handleStepSave} disabled={saving}>
              {saving ? 'Submitting...' : currentStep === 13 ? 'Finish & Submit' : 'Save & Next'} <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function renderStep(step, data, setData, handleChange, designations, lgas, id, fetchData, setCurrentStep) {
  switch(step) {
    case 1: return <StepBasic data={data.basic} lookups={data.lookups} designations={designations} onChange={(e) => handleChange('basic', e)} />;
    case 2: return <StepContact data={data.basic} onChange={(e) => handleChange('basic', e)} />;
    case 3: return <StepOrigin data={data.basic} lookups={data.lookups} lgas={lgas} onChange={(e) => handleChange('basic', e)} />;
    case 4: return <StepEducation staffId={id} data={data.education} lookups={data.lookups} onUpdate={(val) => setData({...data, education: val})} onRefetch={fetchData} />;
    case 5: return <StepMarital data={data.marital} lookups={data.lookups} onChange={(e) => handleChange('marital', e)} />;
    case 6: return <StepNextOfKin data={data.nextOfKin} lookups={data.lookups} onUpdate={(val) => setData({...data, nextOfKin: val})} />;
    case 7: return <StepChildren data={data.children} onUpdate={(val) => setData({...data, children: val})} />;
    case 8: return <StepExperience data={data.experience} onUpdate={(val) => setData({...data, experience: val})} />;
    case 9: return <StepAttachments staffId={id} data={data.attachments} onUpdate={(val) => setData({...data, attachments: val})} onRefetch={fetchData} />;
    case 10: return <StepAccount data={data.basic} lookups={data.lookups} onChange={(e) => handleChange('basic', e)} />;
    case 11: return <StepMedia data={data.media} onChange={(mediaState) => setData({...data, media: mediaState})} />;
    case 12: return <StepOthers data={data.others || {}} lookups={data.lookups} onChange={(e) => handleChange('others', e)} />;
    case 13: return <StepPreview data={data} designations={designations} lgas={lgas} onEditStep={setCurrentStep} />;
    default: return null;
  }
}

// ── Step Components ──

function StepBasic({ data, lookups = {}, designations = [], onChange }) {
  return (
    <div className={styles.formGrid}>
      <div className={styles.field}>
        <label>Surname</label>
        <input type="text" value={data.surname || ''} readOnly className={styles.readOnlyInput} />
      </div>
      <div className={styles.field}>
        <label>First Name</label>
        <input type="text" value={data.first_name || ''} readOnly className={styles.readOnlyInput} />
      </div>
      <div className={styles.field}>
        <label>Other Names</label>
        <input type="text" value={data.othernames || ''} readOnly className={styles.readOnlyInput} />
      </div>

      <CustomSelect 
        label="Title"
        name="title"
        value={data.title}
        options={[
          { id: 'MR.', name: 'MR.' },
          { id: 'MRS.', name: 'MRS.' },
          { id: 'MISS', name: 'MISS' },
          { id: 'DR.', name: 'DR.' },
          { id: 'PROF.', name: 'PROF.' },
          { id: 'HON. JUSTICE', name: 'HON. JUSTICE' },
        ]}
        onChange={onChange}
        required
      />

      <CustomSelect 
        label="Gender"
        name="gender"
        value={data.gender}
        options={[
          { id: 'Male', name: 'Male' },
          { id: 'Female', name: 'Female' },
        ]}
        onChange={onChange}
        required
      />

      <div className={styles.field}>
        <label>Date of Birth *</label>
        <input type="date" name="dob" value={data.dob || ''} onChange={onChange} required />
      </div>

      <CustomSelect 
        label="Place of Birth (State)"
        name="placeofbirth"
        value={data.placeofbirth}
        options={lookups.states || []}
        onChange={onChange}
        required
      />

      <CustomSelect 
        label="Employment Type"
        name="hremploymentType"
        value={data.hremploymentType}
        options={lookups.hrEmploymentTypes || []}
        onChange={onChange}
        required
      />

      <CustomSelect 
        label="Office Shift"
        name="office_shift"
        value={data.office_shift}
        options={[
          { id: '1', name: 'Admin' },
          { id: '2', name: 'Shift' },
        ]}
        onChange={onChange}
        required
      />

      <CustomSelect 
        label="Department"
        name="departmentID"
        value={data.departmentID}
        options={lookups.departments || []}
        onChange={onChange}
        required
      />

      <CustomSelect 
        label="Designation"
        name="designationID"
        value={data.designationID || data.Designation}
        options={designations}
        onChange={onChange}
        required
      />

      <div className={styles.field}>
        <label>Date of Appointment *</label>
        <input type="date" name="date_present_appointment" value={data.date_present_appointment || ''} onChange={onChange} required />
      </div>
    </div>
  );
}

function StepContact({ data, onChange }) {
  return (
    <div className={styles.formGrid}>
      <div className={styles.field}>
        <label>Primary Email Address *</label>
        <input 
          type="email" 
          name="email" 
          value={data.email || ''} 
          onChange={onChange} 
          placeholder="e.g. staff@isalu.gov.ng"
          required 
        />
      </div>
      <div className={styles.field}>
        <label>Alternate Email Address</label>
        <input 
          type="email" 
          name="alternate_email" 
          value={data.alternate_email || ''} 
          onChange={onChange} 
          placeholder="e.g. personal@gmail.com"
        />
      </div>
      <div className={styles.field}>
        <label>Phone Number *</label>
        <input 
          type="tel" 
          name="phone" 
          value={data.phone || ''} 
          onChange={onChange} 
          placeholder="e.g. 08012345678"
          required 
        />
      </div>
      <div className={styles.field}>
        <label>Alternate Phone Number</label>
        <input 
          type="tel" 
          name="alternate_phone" 
          value={data.alternate_phone || ''} 
          onChange={onChange} 
          placeholder="e.g. 07087654321"
        />
      </div>
      <div className={styles.field} style={{ gridColumn: '1/-1' }}>
        <label>Residential / Contact Address *</label>
        <textarea 
          name="home_address" 
          value={data.home_address || ''} 
          onChange={onChange} 
          placeholder="Enter full physical residential address"
          rows={3}
          required
        />
      </div>
    </div>
  );
}

function StepOrigin({ data, lookups = {}, lgas = [], onChange }) {
  return (
    <div className={styles.formGrid}>
      <CustomSelect 
        label="State of Origin"
        name="stateID"
        value={data.stateID}
        options={lookups.states || []}
        onChange={onChange}
        required
      />

      <CustomSelect 
        label="Local Government Area (LGA)"
        name="lgaID"
        value={data.lgaID}
        options={lgas}
        onChange={onChange}
        required
      />
      
      <div className={styles.field} style={{ gridColumn: '1/-1' }}>
        <label>Permanent Home Address *</label>
        <textarea 
          name="permanent_addr" 
          value={data.permanent_addr || ''} 
          onChange={onChange} 
          placeholder="Enter full permanent home address (usually in your state of origin)"
          rows={3}
          required
        />
      </div>
    </div>
  );
}

function StepEducation({ staffId, data = [], onUpdate, lookups = {}, onRefetch }) {
  const [form, setForm] = useState({
    category: '',
    schoolattended: '',
    schoolfrom: '',
    schoolto: '',
    certificateheld: '',
    degreequalification: '',
    document: null
  });
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const fileInputRef = useRef(null);

  const handleAdd = async () => {
    if (!form.schoolattended || !form.category) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('categoryID', form.category);
      formData.append('schoolattended', form.schoolattended);
      formData.append('schoolfrom', form.schoolfrom);
      formData.append('schoolto', form.schoolto);
      formData.append('certificateheld', form.certificateheld);
      formData.append('degreequalification', form.degreequalification);
      if (form.document) {
        formData.append('document', form.document);
      }

      await axios.post(`${API_BASE}/hr/documentation/${staffId}/education`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (onRefetch) onRefetch();
      
      setForm({ category: '', schoolattended: '', schoolfrom: '', schoolto: '', certificateheld: '', degreequalification: '', document: null });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload education record');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (index, recordId) => {
    setDeleteConfirm({ index, recordId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { index, recordId } = deleteConfirm;
    
    // Optimistic UI Update: remove from array and close modal instantly
    const newData = [...data];
    newData.splice(index, 1);
    onUpdate(newData);
    setDeleteConfirm(null);
    
    if (recordId) {
      try {
        await axios.delete(`${API_BASE}/hr/documentation/${staffId}/education/${recordId}`);
        // Optionally refetch quietly in the background
        if (onRefetch) onRefetch();
      } catch (err) {
        console.error(err);
        alert('Failed to delete education record from the server.');
        if (onRefetch) onRefetch(); // Revert UI if it failed
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface, #fff)', padding: '2rem', borderRadius: '1rem', width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trash2 size={20} color="#ef4444" /> Delete Record?
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--secondary)' }}>Are you sure you want to remove this education record? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ background: 'transparent', border: '1px solid var(--border)', padding: '0.6rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', color: 'var(--foreground)' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
      <div className={styles.rowItem}>
        <div className={styles.sectionHeader} style={{ borderBottom: 'none', marginBottom: '1rem' }}>
          <h3><GraduationCap size={20} style={{marginRight:'10px', verticalAlign: 'middle'}}/> Education Qualification</h3>
        </div>
        
        <div className={styles.formGrid}>
          <CustomSelect 
            label="Education"
            name="category"
            value={form.category}
            options={
              (lookups.educationCategories && lookups.educationCategories.length > 0)
                ? lookups.educationCategories.map(c => ({ id: c.id || c.edu_categoryID, name: c.name || c.category }))
                : [
                    { id: 'Primary', name: 'Primary' },
                    { id: 'Secondary', name: 'Secondary' },
                    { id: 'Tertiary', name: 'Tertiary' },
                    { id: 'Professional', name: 'Professional' }
                  ]
            }
            onChange={e => setForm({...form, category: e.target.value})}
          />
          <div className={styles.field}>
            <label>School Attended</label>
            <input type="text" value={form.schoolattended} onChange={e => setForm({...form, schoolattended: e.target.value})} placeholder="e.g. University of Lagos" />
          </div>
          <div className={styles.field}>
            <label>From</label>
            <input type="date" value={form.schoolfrom} max={new Date().toISOString().split('T')[0]} onChange={e => setForm({...form, schoolfrom: e.target.value})} />
          </div>
          <div className={styles.field}>
            <label>To</label>
            <input type="date" value={form.schoolto} onChange={e => setForm({...form, schoolto: e.target.value})} />
          </div>

          <div className={styles.field}>
            <label>Qualification Description</label>
            <input type="text" value={form.certificateheld} onChange={e => setForm({...form, certificateheld: e.target.value})} />
          </div>
          <div className={styles.field}>
            <label>Class of Qualification (eg. BSc)</label>
            <input type="text" value={form.degreequalification} onChange={e => setForm({...form, degreequalification: e.target.value})} />
          </div>
          <div className={styles.field}>
            <label>Attach Certificate</label>
            <input type="file" ref={fileInputRef} onChange={e => setForm({...form, document: e.target.files[0]})} />
          </div>
          <div className={styles.field}>
            <label>&nbsp;</label>
            <button onClick={handleAdd} disabled={uploading} className={styles.btnPrimary} style={{width: '100%', padding: '1rem', borderRadius: '0.75rem'}}>
              <Plus size={16} style={{marginRight:'5px', verticalAlign: 'middle'}}/> {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.rowItem}>
        <div className={styles.sectionHeader} style={{ borderBottom: 'none', marginBottom: '1rem' }}>
          <h3><FileText size={20} style={{marginRight:'10px', verticalAlign: 'middle'}}/> Uploaded Education Records</h3>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Education</th>
                <th>School</th>
                <th>From</th>
                <th>To</th>
                <th>Class</th>
                <th>Description</th>
                <th>Certificate</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) ? (
                <tr><td colSpan="9" className={styles.emptyRow}>No education records found</td></tr>
              ) : (
                data.map((row, i) => (
                  <tr key={row.id || i}>
                    <td>{i + 1}</td>
                    <td>{row.category}</td>
                    <td>{row.schoolattended}</td>
                    <td>{row.schoolfrom}</td>
                    <td>{row.schoolto}</td>
                    <td>{row.degreequalification}</td>
                    <td>{row.certificateheld}</td>
                    <td>
                      {row.document ? (
                        <a href={typeof row.document === 'string' ? (row.document.startsWith('http') ? row.document : `${STORAGE_BASE}/${row.document}`) : '#'} target="_blank" rel="noreferrer" className={styles.badge} style={{cursor:'pointer', textDecoration: 'none'}}>View</a>
                      ) : <span style={{color: 'var(--text-muted)'}}>None</span>}
                    </td>
                    <td>
                      <button onClick={() => handleRemove(i, row.id)} style={{background: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: '600'}}>
                        <Trash2 size={14} /> Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StepMarital({ data, lookups = {}, onChange }) {
  const safeData = data || {};
  const statusOptions = (lookups.maritalStatuses && lookups.maritalStatuses.length > 0)
    ? lookups.maritalStatuses.map(s => ({ id: s.name, name: s.name }))
    : [
        { id: 'Single', name: 'Single' },
        { id: 'Married', name: 'Married' },
        { id: 'Divorced', name: 'Divorced' },
        { id: 'Widowed', name: 'Widowed' }
      ];

  const isMarried = safeData.maritalstatus === 'Married';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className={styles.rowItem} style={{ padding: '2rem' }}>
        <div className={styles.sectionHeader} style={{ borderBottom: 'none', marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <Heart size={20} /> Marital Information
          </h3>
        </div>

        <div className={styles.formGrid}>
          <div style={{ gridColumn: '1 / -1', maxWidth: '400px', margin: '0 auto', width: '100%' }}>
            <CustomSelect 
              label="Marital Status *"
              name="maritalstatus"
              value={safeData.maritalstatus || ''}
              options={statusOptions}
              onChange={onChange}
              required
            />
          </div>

          {isMarried && (
            <>
              <div className={styles.field}>
                <label>Name of Spouse *</label>
                <input 
                  type="text" 
                  name="wifename" 
                  value={safeData.wifename || ''} 
                  onChange={onChange} 
                  required 
                  placeholder="Full name of spouse"
                />
              </div>

              <div className={styles.field}>
                <label>Spouse Date of Birth *</label>
                <input 
                  type="date" 
                  name="wifedateofbirth" 
                  value={safeData.wifedateofbirth ? safeData.wifedateofbirth.split('T')[0] : ''} 
                  max={new Date().toISOString().split('T')[0]}
                  onChange={onChange} 
                  required 
                />
              </div>

              <div className={styles.field}>
                <label>Date of Marriage *</label>
                <input 
                  type="date" 
                  name="dateofmarriage" 
                  value={safeData.dateofmarriage ? safeData.dateofmarriage.split('T')[0] : ''} 
                  max={new Date().toISOString().split('T')[0]}
                  onChange={onChange} 
                  required 
                />
              </div>

              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label>Spouse Address *</label>
                <textarea 
                  name="homeplace" 
                  value={safeData.homeplace || ''} 
                  onChange={onChange} 
                  required 
                  placeholder="Residential address of spouse"
                  rows={2}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StepNextOfKin({ data = [], lookups = {}, onUpdate }) {
  const add = () => onUpdate([...data, { fullname: '', phoneno: '', relationship: '', address: '' }]);
  const remove = (index) => {
    const n = [...data];
    n.splice(index, 1);
    onUpdate(n);
  };
  const update = (i, f, v) => {
    const n = [...data];
    n[i][f] = v;
    onUpdate(n);
  };

  const relationshipOptions = (lookups.relationships && lookups.relationships.length > 0)
    ? lookups.relationships.map(r => ({ id: r.name, name: r.name }))
    : [
        { id: 'Wife', name: 'Wife' },
        { id: 'Husband', name: 'Husband' },
        { id: 'Father', name: 'Father' },
        { id: 'Mother', name: 'Mother' },
        { id: 'Brother', name: 'Brother' },
        { id: 'Sister', name: 'Sister' },
        { id: 'Son', name: 'Son' },
        { id: 'Daughter', name: 'Daughter' },
      ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className={styles.rowItem} style={{ padding: '2rem' }}>
        <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <Users size={20} /> Next of Kin Details
          </h3>
          <button onClick={add} className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
            <Plus size={16} /> Add Kin
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {data.map((row, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.5rem', position: 'relative' }}>
              {data.length > 2 && (
                <button 
                  onClick={() => remove(i)} 
                  style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: '600' }}
                >
                  <Trash2 size={14} /> Remove
                </button>
              )}
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>Kin #{i + 1}</h4>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Full Name *</label>
                  <input type="text" value={row.fullname || ''} onChange={e => update(i, 'fullname', e.target.value)} required placeholder="e.g. Jane Doe" />
                </div>
                <div className={styles.field}>
                  <label>Phone Number *</label>
                  <input type="tel" value={row.phoneno || ''} onChange={e => update(i, 'phoneno', e.target.value)} required placeholder="e.g. 080XXXXXXXX" />
                </div>
                <CustomSelect 
                  label="Relationship *"
                  name="relationship"
                  value={row.relationship || ''}
                  options={relationshipOptions}
                  onChange={e => update(i, 'relationship', e.target.value)}
                  required
                />
                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                  <label>Resident Address</label>
                  <textarea value={row.address || ''} onChange={e => update(i, 'address', e.target.value)} rows={2} placeholder="Enter full address of next of kin" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepChildren({ data = [], onUpdate }) {
  const add = () => onUpdate([...data, { fullname: '', gender: '', dateofbirth: '' }]);
  const remove = (index) => {
    const n = [...data];
    n.splice(index, 1);
    onUpdate(n);
  };
  const update = (i, f, v) => {
    const n = [...data];
    n[i][f] = v;
    onUpdate(n);
  };

  const genderOptions = [
    { id: 'Male', name: 'Male' },
    { id: 'Female', name: 'Female' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className={styles.rowItem} style={{ padding: '2rem' }}>
        <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <Baby size={20} /> Children's Particulars
          </h3>
          <button onClick={add} className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
            <Plus size={16} /> Add Child
          </button>
        </div>

        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--border)', borderRadius: '0.75rem', color: 'var(--text-muted)' }}>
            No children records added yet. Click "Add Child" if applicable, otherwise click "Save & Next" to continue.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {data.map((row, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.5rem', position: 'relative' }}>
                <button 
                  onClick={() => remove(i)} 
                  style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: '600' }}
                >
                  <Trash2 size={14} /> Remove
                </button>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>Child #{i + 1}</h4>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label>Full Name *</label>
                    <input type="text" value={row.fullname || ''} onChange={e => update(i, 'fullname', e.target.value)} required placeholder="e.g. John Doe Jr." />
                  </div>
                  <CustomSelect 
                    label="Gender *"
                    name="gender"
                    value={row.gender || ''}
                    options={genderOptions}
                    onChange={e => update(i, 'gender', e.target.value)}
                    required
                  />
                  <div className={styles.field}>
                    <label>Date of Birth *</label>
                    <input type="date" value={row.dateofbirth ? row.dateofbirth.split('T')[0] : ''} max={new Date().toISOString().split('T')[0]} onChange={e => update(i, 'dateofbirth', e.target.value)} required />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepExperience({ data = [], onUpdate }) {
  const add = () => onUpdate([...data, { employer: '', pay: '', from: '', to: '', filePageRef: '', checkedby: '' }]);
  const remove = (index) => {
    const n = [...data];
    n.splice(index, 1);
    onUpdate(n);
  };
  const update = (i, f, v) => {
    const n = [...data];
    n[i][f] = v;
    onUpdate(n);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className={styles.rowItem} style={{ padding: '2rem' }}>
        <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <Briefcase size={20} /> Previous Employment History
          </h3>
          <button onClick={add} className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
            <Plus size={16} /> Add Record
          </button>
        </div>

        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--border)', borderRadius: '0.75rem', color: 'var(--text-muted)' }}>
            No previous employment records added yet. Click "Add Record" if applicable, otherwise click "Save & Next" to continue.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {data.map((row, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.5rem', position: 'relative' }}>
                <button 
                  onClick={() => remove(i)} 
                  style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: '600' }}
                >
                  <Trash2 size={14} /> Remove
                </button>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>Employment #{i + 1}</h4>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label>Employer / Establishment *</label>
                    <input type="text" value={row.employer || row.previousSchudule || ''} onChange={e => update(i, 'employer', e.target.value)} required placeholder="e.g. Chevron Nigeria" />
                  </div>
                  <div className={styles.field}>
                    <label>Total Previous Pay (Annual) *</label>
                    <input type="text" value={row.pay || row.totalPreviousPay || ''} onChange={e => update(i, 'pay', e.target.value)} required placeholder="e.g. 1,200,000" />
                  </div>
                  <div className={styles.field}>
                    <label>From Date *</label>
                    <input type="date" value={row.from ? row.from.split('T')[0] : (row.fromDate ? row.fromDate.split('T')[0] : '')} max={new Date().toISOString().split('T')[0]} onChange={e => update(i, 'from', e.target.value)} required />
                  </div>
                  <div className={styles.field}>
                    <label>To Date *</label>
                    <input type="date" value={row.to ? row.to.split('T')[0] : (row.toDate ? row.toDate.split('T')[0] : '')} onChange={e => update(i, 'to', e.target.value)} required />
                  </div>
                  <div className={styles.field}>
                    <label>File Page Reference</label>
                    <input type="text" value={row.filePageRef || ''} onChange={e => update(i, 'filePageRef', e.target.value)} placeholder="e.g. Page 12" />
                  </div>
                  <div className={styles.field}>
                    <label>Checked By</label>
                    <input type="text" value={row.checkedby || ''} onChange={e => update(i, 'checkedby', e.target.value)} placeholder="e.g. Admin Officer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepAttachments({ staffId, data = [], onUpdate, onRefetch }) {
  const [form, setForm] = useState({
    description: '',
    filename: null
  });
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const fileInputRef = useRef(null);

  const handleUpload = async () => {
    if (!form.description || !form.filename) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('description', form.description);
      formData.append('filename', form.filename);

      await axios.post(`${API_BASE}/hr/documentation/${staffId}/attachment`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (onRefetch) onRefetch();
      setForm({ description: '', filename: null });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload document attachment');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (index, recordId) => {
    setDeleteConfirm({ index, recordId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { index, recordId } = deleteConfirm;

    // Optimistic UI Update
    const newData = [...data];
    newData.splice(index, 1);
    onUpdate(newData);
    setDeleteConfirm(null);

    if (recordId) {
      try {
        await axios.delete(`${API_BASE}/hr/documentation/${staffId}/attachment/${recordId}`);
        if (onRefetch) onRefetch();
      } catch (err) {
        console.error(err);
        alert('Failed to delete attachment from the server.');
        if (onRefetch) onRefetch();
      }
    }
  };

  const fileDescriptions = [
    { id: 'Application Letter', name: 'Application Letter' },
    { id: 'Letter of Appointment', name: 'Letter of Appointment' },
    { id: 'Birth Certificate', name: 'Birth Certificate' },
    { id: 'Certificate of Indigene', name: 'Certificate of Indigene' },
    { id: 'GEN 75', name: 'GEN 75' },
    { id: 'NIN Slip', name: 'NIN Slip' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface, #fff)', padding: '2rem', borderRadius: '1rem', width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trash2 size={20} color="#ef4444" /> Delete Attachment?
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--secondary)' }}>Are you sure you want to remove this attached file? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ background: 'transparent', border: '1px solid var(--border)', padding: '0.6rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', color: 'var(--foreground)' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.rowItem} style={{ padding: '2rem' }}>
        <div className={styles.sectionHeader} style={{ borderBottom: 'none', marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <FileText size={20} /> Attach Supporting Document
          </h3>
        </div>

        <div className={styles.formGrid}>
          <CustomSelect 
            label="File Description *"
            name="description"
            value={form.description}
            options={fileDescriptions}
            onChange={e => setForm({...form, description: e.target.value})}
            required
          />
          <div className={styles.field}>
            <label>Attach File *</label>
            <input type="file" ref={fileInputRef} onChange={e => setForm({...form, filename: e.target.files[0]})} required />
          </div>
          <div className={styles.field}>
            <label>&nbsp;</label>
            <button onClick={handleUpload} disabled={uploading || !form.description || !form.filename} className={styles.btnPrimary} style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem' }}>
              <Plus size={16} style={{ marginRight: '5px', verticalAlign: 'middle' }} /> {uploading ? 'Uploading...' : 'Upload Attachment'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.rowItem} style={{ padding: '2rem' }}>
        <div className={styles.sectionHeader} style={{ borderBottom: 'none', marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <FileText size={20} /> Attached Document Records
          </h3>
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Attachment Type</th>
                <th>File View</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) ? (
                <tr><td colSpan="4" className={styles.emptyRow}>No attached files found</td></tr>
              ) : (
                data.map((row, i) => (
                  <tr key={row.id || i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: '600' }}>{row.filedesc}</td>
                    <td>
                      {row.filepath ? (
                        <a href={row.filepath.startsWith('http') ? row.filepath : `${STORAGE_BASE}/${row.filepath}`} target="_blank" rel="noreferrer" className={styles.badge} style={{ cursor: 'pointer', textDecoration: 'none' }}>View File</a>
                      ) : <span style={{ color: 'var(--text-muted)' }}>None</span>}
                    </td>
                    <td>
                      <button onClick={() => handleRemove(i, row.id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: '600' }}>
                        <Trash2 size={14} /> Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StepAccount({ data, lookups = {}, onChange }) {
  const bankOptions = (lookups.banks && lookups.banks.length > 0)
    ? lookups.banks
    : [
        { id: '1', name: 'First Bank of Nigeria' },
        { id: '2', name: 'Zenith Bank' }
      ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className={styles.rowItem} style={{ padding: '2rem' }}>
        <div className={styles.sectionHeader} style={{ borderBottom: 'none', marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <CreditCard size={20} /> Bank Account Information
          </h3>
        </div>

        <div className={styles.formGrid}>
          <CustomSelect 
            label="Bank Name *"
            name="bankID"
            value={data.bankID || ''}
            options={bankOptions}
            onChange={onChange}
            required
          />
          <div className={styles.field}>
            <label>Account Number *</label>
            <input 
              type="text" 
              name="AccNo" 
              value={data.AccNo || ''} 
              onChange={onChange} 
              required 
              maxLength={10}
              placeholder="e.g. 3012345678" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepMedia({ data, onChange }) {
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [webcamStream]);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [data.signatureUrl]); // Reset drawing context when signatureUrl changes or is cleared

  const handleFileChange = (field, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onChange({
        ...data,
        [`${field}Url`]: reader.result,
        [`${field}File`]: file
      });
    };
    reader.readAsDataURL(file);
  };

  const startWebcam = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam access requires a secure connection (HTTPS). Please ensure the site is loaded over HTTPS.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      setWebcamStream(stream);
      setWebcamActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      alert('Could not access webcam: ' + err.message);
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    setWebcamActive(false);
  };

  const dataURLtoFile = (dataurl, filename) => {
    let arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]),
        n = bstr.length,
        u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth || 640;
    captureCanvas.height = video.videoHeight || 480;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.95);
    const file = dataURLtoFile(dataUrl, 'webcam_passport.jpg');
    
    onChange({
      ...data,
      passportUrl: dataUrl,
      passportFile: file
    });
    stopWebcam();
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawing.current = true;
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange({
      ...data,
      signatureUrl: '',
      signatureFile: null
    });
  };

  const applySignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const buffer = new Uint32Array(
      canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    if (!buffer.some(color => color !== 0)) {
      alert('Please sign on the canvas before applying!');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const file = dataURLtoFile(dataUrl, 'digital_signature.png');
    onChange({
      ...data,
      signatureUrl: dataUrl,
      signatureFile: file
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div className={styles.rowItem} style={{ padding: '2.5rem' }}>
        <div className={styles.sectionHeader} style={{ borderBottom: 'none', marginBottom: '2rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <Camera size={22} /> Live Capture, Draw, or Upload
          </h3>
        </div>

        <div className={styles.mediaGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem' }}>
          {/* PASSPORT PHOTOGRAPH */}
          <div className={styles.mediaCard} style={{ border: '1px solid var(--border-color)', padding: '2rem', minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Camera size={24} color="var(--primary)" />
                <p style={{ fontWeight: '700', fontSize: '1.1rem', margin: 0 }}>Passport Photograph</p>
              </div>

              {webcamActive ? (
                <div style={{ position: 'relative', width: '100%', height: '200px', background: '#000', borderRadius: '0.75rem', overflow: 'hidden', marginBottom: '1rem' }}>
                  <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: '10px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    <button type="button" onClick={capturePhoto} className={styles.btnPrimary} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Capture</button>
                    <button type="button" onClick={stopWebcam} className={styles.btnBack} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: '#ef4444', color: 'white', border: 'none' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  {data.passportUrl ? (
                    <img 
                      src={(data.passportUrl.startsWith('data:') || data.passportUrl.startsWith('http')) ? data.passportUrl : `${STORAGE_BASE}/${data.passportUrl}`} 
                      alt="Passport" 
                      style={{ width: '130px', height: '160px', borderRadius: '0.75rem', objectFit: 'cover', border: '3px solid var(--primary)', boxShadow: 'var(--shadow)' }} 
                    />
                  ) : (
                    <div style={{ width: '130px', height: '160px', borderRadius: '0.75rem', background: 'var(--bg-secondary, rgba(0,0,0,0.03))', border: '2px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <User size={40} />
                      <span style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>No Image</span>
                    </div>
                  )}
                  <button type="button" onClick={startWebcam} className={styles.btnSave} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}>
                    <Camera size={16} /> Open Web Camera
                  </button>
                </div>
              )}
            </div>

            <div className={styles.field} style={{ width: '100%' }}>
              <label style={{ textAlign: 'left', fontWeight: '600' }}>Or Upload File</label>
              <input type="file" accept="image/*" onChange={e => { stopWebcam(); handleFileChange('passport', e.target.files[0]); }} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }} />
            </div>
          </div>

          {/* SIGNATURE DRAW & SCAN */}
          <div className={styles.mediaCard} style={{ border: '1px solid var(--border-color)', padding: '2rem', minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <FileText size={24} color="var(--primary)" />
                <p style={{ fontWeight: '700', fontSize: '1.1rem', margin: 0 }}>Digital Signature</p>
              </div>

              <div style={{ position: 'relative', width: '100%', marginBottom: '1rem' }}>
                <canvas 
                  ref={canvasRef} 
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{ width: '100%', height: '140px', background: '#f8fafc', border: '2px solid var(--border-color)', borderRadius: '0.75rem', cursor: 'crosshair', touchAction: 'none' }} 
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={clearDrawing} className={styles.btnBack} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Clear</button>
                  <button type="button" onClick={applySignature} className={styles.btnPrimary} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Apply</button>
                </div>
              </div>
            </div>

            <div>
              {data.signatureUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700' }}>Active Signature Preview:</span>
                  <img 
                    src={(data.signatureUrl.startsWith('data:') || data.signatureUrl.startsWith('http')) ? data.signatureUrl : `${STORAGE_BASE}/${data.signatureUrl}`} 
                    alt="Signature" 
                    style={{ width: '180px', height: '60px', objectFit: 'contain', border: '1px solid var(--border-color)', background: 'white', padding: '4px', borderRadius: '0.5rem' }} 
                  />
                </div>
              )}

              <div className={styles.field} style={{ width: '100%' }}>
                <label style={{ textAlign: 'left', fontWeight: '600' }}>Or Upload File</label>
                <input type="file" accept="image/*" onChange={e => handleFileChange('signature', e.target.files[0])} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepOthers({ data = {}, lookups = {}, onChange }) {
  const religionOptions = (lookups.religions && lookups.religions.length > 0)
    ? lookups.religions
    : [
        { id: 'Christianity', name: 'Christianity' },
        { id: 'Islam', name: 'Islam' }
      ];

  const yesNoOptions = [
    { id: 'yes', name: 'Yes' },
    { id: 'no', name: 'No' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className={styles.rowItem} style={{ padding: '2rem' }}>
        <div className={styles.sectionHeader} style={{ borderBottom: 'none', marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <FileText size={20} /> Supplementary Questionnaire
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className={styles.formGrid}>
            <CustomSelect 
              label="1. Have you ever been convicted of a crime? *"
              name="qtn1"
              value={data.qtn1 || ''}
              options={yesNoOptions}
              onChange={onChange}
              required
            />
            {data.qtn1 === 'yes' && (
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label>Conviction Details *</label>
                <textarea name="qtn2" value={data.qtn2 || ''} onChange={onChange} required rows={2} placeholder="State details of the crime and sentence..." />
              </div>
            )}

            <CustomSelect 
              label="2. Have you suffered from any chronic illness? *"
              name="qtn3"
              value={data.qtn3 || ''}
              options={yesNoOptions}
              onChange={onChange}
              required
            />
            {data.qtn3 === 'yes' && (
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label>Illness Details *</label>
                <textarea name="qtn4" value={data.qtn4 || ''} onChange={onChange} required rows={2} placeholder="State details of the chronic illness..." />
              </div>
            )}

            <CustomSelect 
              label="3. Have you taken an undertaking to anybody to repay money advance? *"
              name="qtn5"
              value={data.qtn5 || ''}
              options={yesNoOptions}
              onChange={onChange}
              required
            />

            <CustomSelect 
              label="4. Are you a judgement debtor or have outstanding debts against you? *"
              name="qtn6"
              value={data.qtn6 || ''}
              options={yesNoOptions}
              onChange={onChange}
              required
            />
            {data.qtn6 === 'yes' && (
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label>Judgement Debt Details *</label>
                <textarea name="qtn7" value={data.qtn7 || ''} onChange={onChange} required rows={2} placeholder="State details of outstanding debts or judgements..." />
              </div>
            )}

            <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <label>5. Official Employee details of services in the forces (if applicable)</label>
              <textarea name="qtn8" value={data.qtn8 || ''} onChange={onChange} rows={2} placeholder="State details of service..." />
            </div>

            <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <label>6. Decorations (if any received)</label>
              <textarea name="qtn9" value={data.qtn9 || ''} onChange={onChange} rows={2} placeholder="State decorations or honours received..." />
            </div>

            <CustomSelect 
              label="7. What is your religion? *"
              name="qtn10"
              value={data.qtn10 || ''}
              options={religionOptions}
              onChange={onChange}
              required
            />

            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '1.5rem', border: '1px solid var(--border)', padding: '1rem', borderRadius: '0.75rem', background: 'rgba(var(--primary-rgb), 0.05)' }}>
              <input 
                type="checkbox" 
                name="qtn11" 
                id="qtn11" 
                checked={data.qtn11 === 'yes'} 
                onChange={onChange} 
                required 
                style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', marginTop: '0.125rem' }} 
              />
              <label htmlFor="qtn11" style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>
                I hereby certify on honour that the information given over the above area are true and correct to the best of my knowledge *
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepPreview({ data, designations = [], lgas = [], onEditStep }) {
  const STORAGE_BASE = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://127.0.0.1:8000/storage';

  const getStateName = (id) => data.lookups?.states?.find(s => s.id == id)?.name || '';
  const getDeptName = (id) => data.lookups?.departments?.find(d => d.id == id)?.name || '';
  const getEmpTypeName = (id) => data.lookups?.hrEmploymentTypes?.find(e => e.id == id)?.name || '';
  const getBankName = (id) => data.lookups?.banks?.find(b => b.id == id)?.name || '';
  const getDesignationName = (id) => designations?.find(d => d.id == id)?.name || '';
  const getLgaName = (id) => lgas?.find(l => l.id == id)?.name || '';

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch { return dateStr; }
  };

  const getMediaUrl = (url) => {
    if (!url) return '';
    return (url.startsWith('data:') || url.startsWith('http')) ? url : `${STORAGE_BASE}/${url}`;
  };

  const basic = data.basic || {};
  const media = data.media || {};
  const marital = data.marital || {};
  const others = data.others || {};

  // Shared styles mirroring the blade's Bootstrap table look
  const cardStyle = {
    background: 'var(--card-bg)',
    border: '1px solid #ddd',
    borderRadius: '6px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  };
  const cardHeaderStyle = {
    background: '#337ab7',
    padding: '10px 15px',
    fontSize: '14px',
    color: '#fff',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };
  const cardBodyStyle = { padding: '12px' };
  const tblStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' };
  const tdLabelStyle = { padding: '7px 10px', borderBottom: '1px solid var(--border-color)', width: '220px', fontWeight: '600', verticalAlign: 'top', whiteSpace: 'nowrap' };
  const tdValStyle = { padding: '7px 10px', borderBottom: '1px solid var(--border-color)', verticalAlign: 'top' };
  const dividerRowStyle = { background: '#337ab7', height: '4px' };

  const EditBtn = ({ step }) => (
    <button
      onClick={() => onEditStep && onEditStep(step)}
      title={`Edit Step ${step}`}
      style={{
        background: 'rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.45)',
        borderRadius: '4px',
        color: '#fff',
        cursor: 'pointer',
        padding: '3px 8px',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        fontWeight: '500',
        transition: 'background 0.15s',
      }}
      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
      onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
    >
      ✏️ Edit
    </button>
  );

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Page Title */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '1.3rem', margin: 0 }}>
          Documentation Review &amp; Final Submission
        </h3>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem', fontSize: '0.9rem' }}>
          Review all information below. Click <strong>Finish &amp; Submit</strong> to complete onboarding.
        </p>
      </div>

      {/* ── PASSPORT & SIGNATURE ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><span>Passport &amp; Signature</span><EditBtn step={11} /></div>
        <div style={{ ...cardBodyStyle, textAlign: 'center', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ marginBottom: '8px', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Passport Photograph</div>
              {media.passportUrl ? (
                <img src={getMediaUrl(media.passportUrl)} alt="Staff Passport"
                  style={{ width: '120px', height: '150px', objectFit: 'cover', border: '1px solid #ddd', borderRadius: '4px' }} />
              ) : (
                <div style={{ width: '120px', height: '150px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8rem', borderRadius: '4px' }}>
                  No passport photo
                </div>
              )}
            </div>
            <div>
              <div style={{ marginBottom: '8px', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Digital Signature</div>
              {media.signatureUrl ? (
                <img src={getMediaUrl(media.signatureUrl)} alt="Staff Signature"
                  style={{ width: '200px', height: '70px', objectFit: 'contain', border: '1px solid #ddd', background: 'white', padding: '4px', borderRadius: '4px' }} />
              ) : (
                <div style={{ width: '200px', height: '70px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8rem', borderRadius: '4px' }}>
                  No signature
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BASIC INFORMATION ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><span>Basic Information</span><EditBtn step={1} /></div>
        <div style={cardBodyStyle}>
          <table style={tblStyle}>
            <tbody>
              
              <tr><td style={tdLabelStyle}><b>Name:</b></td><td style={tdValStyle}>{basic.surname} {basic.first_name} {basic.othernames}</td></tr>
              <tr><td style={tdLabelStyle}><b>Gender:</b></td><td style={tdValStyle}>{basic.gender || ''}</td></tr>
              <tr><td style={tdLabelStyle}><b>Date of Birth:</b></td><td style={tdValStyle}>{formatDate(basic.dob)}</td></tr>
              <tr><td style={tdLabelStyle}><b>Employment Type:</b></td><td style={tdValStyle}>{getEmpTypeName(basic.hremploymentType)}</td></tr>
              <tr><td style={tdLabelStyle}><b>Grade Level:</b></td><td style={tdValStyle}>{basic.grade || ''}</td></tr>
              <tr><td style={tdLabelStyle}><b>Step:</b></td><td style={tdValStyle}>{basic.step || ''}</td></tr>
              <tr><td style={tdLabelStyle}><b>Department:</b></td><td style={tdValStyle}>{getDeptName(basic.departmentID || basic.department)}</td></tr>
              <tr><td style={tdLabelStyle}><b>Designation:</b></td><td style={tdValStyle}>{getDesignationName(basic.designationID || basic.Designation)}</td></tr>
              <tr><td style={tdLabelStyle}><b>Date of Appointment:</b></td><td style={tdValStyle}>{formatDate(basic.appointment_date || basic.date_present_appointment)}</td></tr>
              <tr><td style={tdLabelStyle}><b>Date of First Appointment:</b></td><td style={tdValStyle}>{formatDate(basic.date_present_appointment)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CONTACT INFORMATION ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><span>Contact Information</span><EditBtn step={2} /></div>
        <div style={cardBodyStyle}>
          <table style={tblStyle}>
            <tbody>
              <tr><td style={tdLabelStyle}><b>EMAIL:</b></td><td style={tdValStyle}>{basic.email || ''}</td></tr>
              <tr><td style={tdLabelStyle}><b>ALTERNATIVE EMAIL:</b></td><td style={tdValStyle}>{basic.alternate_email || ''}</td></tr>
              <tr><td style={tdLabelStyle}><b>PHONE:</b></td><td style={tdValStyle}>{basic.phone || ''}</td></tr>
              <tr><td style={tdLabelStyle}><b>ALTERNATIVE PHONE:</b></td><td style={tdValStyle}>{basic.alternate_phone || ''}</td></tr>
              <tr><td style={tdLabelStyle}><b>PHYSICAL ADDRESS:</b></td><td style={tdValStyle}>{basic.home_address || ''}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PLACE OF BIRTH ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><span>Place of Birth</span><EditBtn step={3} /></div>
        <div style={cardBodyStyle}>
          <table style={tblStyle}>
            <tbody>
              <tr><td style={tdLabelStyle}><b>STATE OF ORIGIN:</b></td><td style={tdValStyle}>{getStateName(basic.stateID)}</td></tr>
              <tr><td style={tdLabelStyle}><b>L.G.A.:</b></td><td style={tdValStyle}>{getLgaName(basic.lgaID)}</td></tr>
              <tr><td style={tdLabelStyle}><b>ADDRESS:</b></td><td style={tdValStyle}>{basic.permanent_addr || ''}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── EDUCATION ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><span>Education</span><EditBtn step={4} /></div>
        <div style={cardBodyStyle}>
          <table style={tblStyle}>
            <tbody>
              {data.education && data.education.length > 0 ? (
                data.education.map((edu, idx) => (
                  <React.Fragment key={idx}>
                    <tr>
                      <td colSpan="2" style={{ ...tdLabelStyle, width: 'auto', background: 'rgba(51,122,183,0.07)' }}>
                        <b>{edu.category || 'Education'}</b>
                      </td>
                    </tr>
                    <tr><td style={tdLabelStyle}><b>SCHOOL ATTENDED:</b></td><td style={tdValStyle}>{edu.schoolattended || ''}</td></tr>
                    <tr>
                      <td style={tdLabelStyle}><b>FROM:</b></td><td style={tdValStyle}>
                        {edu.schoolfrom || ''} &nbsp;&nbsp; <b>TO:</b> &nbsp; {edu.schoolto || ''}
                      </td>
                    </tr>
                    <tr>
                      <td style={tdLabelStyle}><b>QUALIFICATION:</b></td>
                      <td style={tdValStyle}>
                        {edu.degreequalification || ''} &nbsp;&nbsp;
                        {edu.document && <><b>CERTIFICATE:</b> &nbsp;
                          <a href={getMediaUrl(edu.document)} target="_blank" rel="noreferrer" style={{ color: '#337ab7' }}>
                            {edu.certificateheld || 'View'}
                          </a>
                        </>}
                        {!edu.document && edu.certificateheld && <><b>CERTIFICATE:</b> &nbsp;{edu.certificateheld}</>}
                      </td>
                    </tr>
                    {idx < data.education.length - 1 && (
                      <tr style={dividerRowStyle}><td colSpan="2"></td></tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr><td colSpan="2" style={{ ...tdValStyle, textAlign: 'center', color: '#999', padding: '1.5rem' }}>No education qualifications recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MARITAL INFORMATION ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><span>Marital Information</span><EditBtn step={5} /></div>
        <div style={cardBodyStyle}>
          <table style={tblStyle}>
            <tbody>
              <tr><td style={tdLabelStyle}><b>MARITAL STATUS:</b></td><td style={tdValStyle}>{basic.maritalstatus || ''}</td></tr>
              {(basic.maritalstatus === 'Married' || basic.maritalstatus === 'married') && (
                <>
                  <tr><td style={tdLabelStyle}><b>NAME OF SPOUSE:</b></td><td style={tdValStyle}>{marital?.wifename || ''}</td></tr>
                  <tr><td style={tdLabelStyle}><b>SPOUSE DATE OF BIRTH:</b></td><td style={tdValStyle}>{formatDate(marital?.wifedateofbirth)}</td></tr>
                  <tr><td style={tdLabelStyle}><b>DATE OF MARRIAGE:</b></td><td style={tdValStyle}>{formatDate(marital?.dateofmarriage)}</td></tr>
                  <tr><td style={tdLabelStyle}><b>SPOUSE ADDRESS:</b></td><td style={tdValStyle}>{marital?.homeplace || ''}</td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── NEXT OF KIN ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><span>Next of Kin</span><EditBtn step={6} /></div>
        <div style={cardBodyStyle}>
          <table style={tblStyle}>
            <tbody>
              {data.nextOfKin && data.nextOfKin.length > 0 ? (
                data.nextOfKin.map((nok, idx) => (
                  <React.Fragment key={idx}>
                    <tr><td style={tdLabelStyle}><b>FULL NAME:</b></td><td style={tdValStyle}>{nok.fullname || ''}</td></tr>
                    <tr><td style={tdLabelStyle}><b>PHONE NUMBER:</b></td><td style={tdValStyle}>{nok.phoneno || ''}</td></tr>
                    <tr><td style={tdLabelStyle}><b>RESIDENT ADDRESS:</b></td><td style={tdValStyle}>{nok.address || ''}</td></tr>
                    <tr><td style={tdLabelStyle}><b>RELATIONSHIP:</b></td><td style={tdValStyle}>{nok.relationship || ''}</td></tr>
                    {idx < data.nextOfKin.length - 1 && (
                      <tr style={dividerRowStyle}><td colSpan="2"></td></tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr><td colSpan="2" style={{ ...tdValStyle, textAlign: 'center', color: '#999', padding: '1.5rem' }}>No next of kin recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CHILDREN ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><span>Children</span><EditBtn step={7} /></div>
        <div style={cardBodyStyle}>
          <table style={tblStyle}>
            <tbody>
              {data.children && data.children.length > 0 ? (
                data.children.map((child, idx) => (
                  <React.Fragment key={idx}>
                    <tr><td style={tdLabelStyle}><b>FULLNAME:</b></td><td style={tdValStyle}>{child.fullname || ''}</td></tr>
                    <tr><td style={tdLabelStyle}><b>DATE OF BIRTH:</b></td><td style={tdValStyle}>{formatDate(child.dateofbirth)}</td></tr>
                    <tr><td style={tdLabelStyle}><b>GENDER:</b></td><td style={tdValStyle}>{child.gender || ''}</td></tr>
                    {idx < data.children.length - 1 && (
                      <tr style={dividerRowStyle}><td colSpan="2"></td></tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr><td colSpan="2" style={{ ...tdValStyle, textAlign: 'center', color: '#999', padding: '1.5rem' }}>No children recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PREVIOUS EMPLOYMENT ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><span>Previous Employment</span><EditBtn step={8} /></div>
        <div style={cardBodyStyle}>
          <table style={tblStyle}>
            <tbody>
              {data.experience && data.experience.length > 0 ? (
                data.experience.map((exp, idx) => (
                  <React.Fragment key={idx}>
                    <tr><td style={tdLabelStyle}><b>EMPLOYER:</b></td><td style={tdValStyle}>{exp.previousSchudule || exp.employer || ''}</td></tr>
                    <tr><td style={tdLabelStyle}><b>PREVIOUS PAY:</b></td><td style={tdValStyle}>{exp.totalPreviousPay ? parseFloat(exp.totalPreviousPay).toLocaleString('en-NG', { minimumFractionDigits: 2 }) : ''}</td></tr>
                    <tr><td style={tdLabelStyle}><b>PERIOD OF EMPLOYMENT:</b></td><td style={tdValStyle}>{formatDate(exp.fromDate || exp.from)} - {formatDate(exp.toDate || exp.to)}</td></tr>
                    <tr><td style={tdLabelStyle}><b>FILE PAGES:</b></td><td style={tdValStyle}>{exp.filePageRef || ''}</td></tr>
                    <tr><td style={tdLabelStyle}><b>CHECKED BY:</b></td><td style={tdValStyle}>{exp.checkedby || ''}</td></tr>
                    {idx < data.experience.length - 1 && (
                      <tr style={dividerRowStyle}><td colSpan="2"></td></tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr><td colSpan="2" style={{ ...tdValStyle, textAlign: 'center', color: '#999', padding: '1.5rem' }}>No previous employment recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DOCUMENT ATTACHMENT ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><span>Document Attachment</span><EditBtn step={9} /></div>
        <div style={cardBodyStyle}>
          <table style={tblStyle}>
            <tbody>
              {data.attachments && data.attachments.length > 0 ? (
                data.attachments.map((att, idx) => (
                  <React.Fragment key={idx}>
                    <tr>
                      <td style={tdLabelStyle}><b>DOCUMENT:</b></td>
                      <td style={tdValStyle}>
                        <a href={att.filepath} target="_blank" rel="noreferrer" style={{ color: '#337ab7' }}>
                          {att.filedesc || 'View'}
                        </a>
                      </td>
                    </tr>
                    {idx < data.attachments.length - 1 && (
                      <tr style={dividerRowStyle}><td colSpan="2"></td></tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr><td colSpan="2" style={{ ...tdValStyle, textAlign: 'center', color: '#999', padding: '1.5rem' }}>No attachments uploaded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ACCOUNT INFORMATION ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}><span>Account Information</span><EditBtn step={10} /></div>
        <div style={cardBodyStyle}>
          <table style={tblStyle}>
            <tbody>
              <tr><td style={tdLabelStyle}><b>BANK NAME:</b></td><td style={tdValStyle}>{getBankName(basic.bankID)}</td></tr>
              <tr><td style={tdLabelStyle}><b>ACCOUNT NUMBER:</b></td><td style={tdValStyle}>{basic.AccNo || ''}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── OTHER INFORMATION ── */}
      {others && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}><span>Other Information</span><EditBtn step={12} /></div>
          <div style={cardBodyStyle}>
            <table style={tblStyle}>
              <tbody>
                <tr>
                  <td style={{ ...tdLabelStyle, width: '60%' }}><b>Have you ever been convicted for any crime before?:</b></td>
                  <td style={tdValStyle}>{others.qtn1 || ''}</td>
                </tr>
                {others.qtn1 === 'yes' && (
                  <tr><td style={tdLabelStyle}><b>Details:</b></td><td style={tdValStyle}>{others.qtn2 || ''}</td></tr>
                )}
                <tr>
                  <td style={{ ...tdLabelStyle, width: '60%' }}><b>Have you suffered any illness?:</b></td>
                  <td style={tdValStyle}>{others.qtn3 || ''}</td>
                </tr>
                {others.qtn3 === 'yes' && (
                  <tr><td style={tdLabelStyle}><b>Details:</b></td><td style={tdValStyle}>{others.qtn4 || ''}</td></tr>
                )}
                <tr>
                  <td style={{ ...tdLabelStyle, width: '60%' }}><b>Have you taken an undertaken to anybody to repay money advance from education, etc?</b></td>
                  <td style={tdValStyle}>{others.qtn5 || ''}</td>
                </tr>
                <tr>
                  <td style={{ ...tdLabelStyle, width: '60%' }}><b>Are you a judgement Debtor? or are there any write from debts outstanding against you?</b></td>
                  <td style={tdValStyle}>{others.qtn6 || ''}</td>
                </tr>
                {others.qtn6 === 'yes' && (
                  <tr><td style={tdLabelStyle}><b>Details:</b></td><td style={tdValStyle}>{others.qtn7 || ''}</td></tr>
                )}
                <tr>
                  <td style={{ ...tdLabelStyle, width: '60%' }}><b>Official Employees details of services in the forces (if applicable):</b></td>
                  <td style={tdValStyle}>{others.qtn8 || ''}</td>
                </tr>
                <tr>
                  <td style={{ ...tdLabelStyle, width: '60%' }}><b>Decoration:</b></td>
                  <td style={tdValStyle}>{others.qtn9 || ''}</td>
                </tr>
                <tr>
                  <td style={{ ...tdLabelStyle, width: '60%' }}><b>What is your religion?:</b></td>
                  <td style={tdValStyle}>{others.qtn10 || ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}