"use client";

import { useState } from "react";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

export default function ForgotPassword() {
  const [staffId, setStaffId] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ staffId }),
      });
      
      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        setError(`Server error (${res.status}). Please contact administrator.`);
        return;
      }

      if (res.ok) {
        setMessage(data.success || "Password reset email sent.");
      } else {
        setError(data.error || data.message || "An error occurred.");
      }
    } catch (err) {
      setError("Network error. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Forgot Password</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="staffId" className={styles.label}>Staff ID</label>
          <input
            id="staffId"
            type="text"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className={styles.input}
            placeholder="Enter Staff ID"
            required
          />
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Processing…" : "Reset Password"}
          </button>
        </form>
        {message && <div className={`${styles.alert} ${styles.success}`}>{message}</div>}
        {error && <div className={`${styles.alert} ${styles.error}`}>{error}</div>}
      </div>
    </div>
  );
}
