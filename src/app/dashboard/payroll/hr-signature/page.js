"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  PenTool,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
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

export default function HrSignaturePage() {
  const [signature, setSignature] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchSignature = async () => {
    setFetching(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/hr-signature`, {
        headers: buildHeaders(),
      });
      if (res.data.status === 'success') {
        setSignature(res.data.signature);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to retrieve current signature.', 'error');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchSignature();
  }, []);

  // Initialize Canvas Drawing context
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Check if canvas is empty
    const buffer = new Uint32Array(
      canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    const isEmpty = !buffer.some(color => color !== 0);
    if (isEmpty) {
      showToast('Please draw your signature first.', 'error');
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE}/payroll/hr-signature`, {
        signature: dataUrl
      }, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast('Signature saved successfully!', 'success');
        setSignature(dataUrl);
        handleClear();
      } else {
        showToast(res.data.message || 'Failed to save signature.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error saving signature.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={styles.container}
    >
      <div className={styles.header}>
        <h1>HR Head Signature Setup</h1>
        <p>Draw your official signature to be stamped on all generated staff payslips.</p>
      </div>

      <div className={styles.grid}>
        {/* Signature Pad */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>
            <PenTool size={18} /> Draw New Signature
          </p>
          <div className={styles.canvasContainer}>
            <canvas
              ref={canvasRef}
              width={500}
              height={200}
              className={styles.canvas}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <div className={styles.btns}>
            <button type="button" className={styles.btnClear} onClick={handleClear}>
              <Trash2 size={16} /> Clear Canvas
            </button>
            <button type="button" className={styles.btnSave} onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={16} className={styles.spinner} /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Signature'}
            </button>
          </div>
        </div>

        {/* Current Active Signature */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>
            Current Active Signature
            {fetching && <Loader2 size={14} className={`${styles.spinner} ${styles.inlineLoader}`} />}
          </p>
          <div className={styles.previewContainer}>
            {fetching ? (
              <div className={styles.previewPlaceholder}>Loading current signature...</div>
            ) : signature ? (
              <img src={signature} alt="HR Head Active Signature" className={styles.previewImage} />
            ) : (
              <div className={styles.previewPlaceholder}>No signature registered. Draw one on the left.</div>
            )}
          </div>
          <div className={styles.btns}>
            <button type="button" className={styles.btnRefresh} onClick={fetchSignature} disabled={fetching}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${
              toast.type === 'success' ? styles.toastSuccess : styles.toastError
            }`}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
