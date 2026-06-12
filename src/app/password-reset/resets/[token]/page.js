"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

export default function ResetPassword() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token;

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/password-reset/resets/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          password_confirmation: passwordConfirmation,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message || "Password successfully reset.");
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } else {
        if (data.errors) {
          setError(Object.values(data.errors).flat().join(" "));
        } else {
          setError(data.error || data.message || "An error occurred.");
        }
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Reset Password</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", textAlign: "left" }}>
            <label htmlFor="password" className={styles.label}>New Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Enter new password"
              required
              minLength={5}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", textAlign: "left" }}>
            <label htmlFor="passwordConfirmation" className={styles.label}>Confirm Password</label>
            <input
              id="passwordConfirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              className={styles.input}
              placeholder="Confirm new password"
              required
              minLength={5}
            />
          </div>

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Resetting... Please wait..." : "Reset Password"}
          </button>
        </form>

        {message && <div className={`${styles.alert} ${styles.success}`}>{message}</div>}
        {error && <div className={`${styles.alert} ${styles.error}`}>{error}</div>}

        <div style={{ marginTop: "1.5rem" }}>
          <Link href="/" className={styles.link}>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
