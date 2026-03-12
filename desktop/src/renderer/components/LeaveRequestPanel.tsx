import React, { useState, useEffect, useCallback } from 'react';
import { Spin, message } from 'antd';
import { CalendarOutlined, FormOutlined, FileTextOutlined, ArrowLeftOutlined, PlusOutlined, CloudUploadOutlined, PaperClipOutlined, DeleteOutlined } from '@ant-design/icons';
import { getMyLeaveRequests, createLeaveRequest } from '../api/client';
import { LeaveRequest } from '../types';

const statusStyles: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  pending:  { bg: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', dot: '#f59e0b', label: 'Pending' },
  approved: { bg: 'rgba(16, 185, 129, 0.1)', color: '#34d399', dot: '#10b981', label: 'Approved' },
  rejected: { bg: 'rgba(239, 68, 68, 0.1)', color: '#f87171', dot: '#ef4444', label: 'Rejected' },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusStyles[status] || statusStyles.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: s.bg, fontSize: 10, fontWeight: 600, color: s.color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

export default function LeaveRequestPanel() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [msg, setMsg] = useState('');
  const [numDays, setNumDays] = useState(1);
  const [leaveDate, setLeaveDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await getMyLeaveRequests();
      setRequests(Array.isArray(data) ? data : data.data || []);
    } catch {
      message.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const resetForm = () => {
    setSubject(''); setMsg(''); setNumDays(1); setLeaveDate(''); setStartDate(''); setEndDate(''); setFiles(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    const effectiveStart = numDays === 1 ? leaveDate : startDate;
    const effectiveEnd = numDays === 1 ? leaveDate : endDate;

    if (!subject.trim() || !msg.trim() || !effectiveStart || (numDays > 1 && !effectiveEnd)) {
      message.warning('Please fill all required fields');
      return;
    }
    if (numDays > 1 && new Date(effectiveEnd) < new Date(effectiveStart)) {
      message.warning('End date must be after start date');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('subject', subject.trim());
      formData.append('message', msg.trim());
      formData.append('startDate', effectiveStart);
      formData.append('endDate', effectiveEnd);
      if (files) {
        Array.from(files).forEach((f) => formData.append('attachments', f));
      }
      await createLeaveRequest(formData);
      message.success('Leave request submitted');
      resetForm();
      setLoading(true);
      fetchRequests();
    } catch {
      message.error('Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  // Detail view
  if (selectedRequest) {
    const r = selectedRequest;
    return (
      <div style={{ padding: 10, display: 'grid', gap: 10 }}>
        {/* Back button */}
        <button
          onClick={() => setSelectedRequest(null)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6, padding: 0,
          }}
        >
          <ArrowLeftOutlined style={{ fontSize: 11 }} /> Back to requests
        </button>

        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              {r.subject}
            </span>
            <StatusBadge status={r.status} />
          </div>

          {/* Dates */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16,
          }}>
            {[
              { label: 'Start Date', value: r.startDate },
              { label: 'End Date', value: r.endDate },
              { label: 'Total Days', value: `${r.totalDays} day${r.totalDays > 1 ? 's' : ''}` },
            ].map((item) => (
              <div key={item.label} style={{
                background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 12px',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Message */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Message
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '12px 14px',
              border: '1px solid rgba(255,255,255,0.04)',
              fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
            }}>
              {r.message}
            </div>
          </div>

          {/* Admin Notes */}
          {r.adminNotes && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Admin Notes
              </div>
              <div style={{
                background: 'rgba(124, 92, 252, 0.06)', borderRadius: 8, padding: '12px 14px',
                border: '1px solid rgba(124, 92, 252, 0.15)',
                fontSize: 12, color: '#a78bfa', lineHeight: 1.6,
              }}>
                {r.adminNotes}
              </div>
            </div>
          )}

          {/* Submitted date */}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'right' }}>
            Submitted {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>
    );
  }

  // New request form
  if (showForm) {
    const inputStyle: React.CSSProperties = {
      width: '100%', padding: '10px 12px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
      color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500,
      outline: 'none', fontFamily: 'inherit',
    };
    const labelStyle: React.CSSProperties = {
      fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)',
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block',
    };

    return (
      <div style={{ padding: 10, display: 'grid', gap: 10 }}>
        <button
          onClick={resetForm}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6, padding: 0,
          }}
        >
          <ArrowLeftOutlined style={{ fontSize: 11 }} /> Back
        </button>

        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <FormOutlined style={{ fontSize: 14, opacity: 0.7 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              New Leave Request
            </span>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            {/* Subject */}
            <div>
              <label style={labelStyle}>Subject *</label>
              <input
                type="text" placeholder="e.g. Sick Leave, Personal Leave"
                value={subject} onChange={(e) => setSubject(e.target.value)}
                style={inputStyle} maxLength={200}
              />
            </div>

            {/* Number of Days */}
            <div>
              <label style={labelStyle}>Number of Days *</label>
              <input
                type="number" min={1} max={365} value={numDays}
                onChange={(e) => setNumDays(Math.max(1, parseInt(e.target.value) || 1))}
                style={inputStyle}
              />
            </div>

            {/* Leave Date(s) */}
            {numDays === 1 ? (
              <div>
                <label style={labelStyle}>Leave Date *</label>
                <input
                  type="date" value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Start Date *</label>
                  <input
                    type="date" value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ ...inputStyle, colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Date *</label>
                  <input
                    type="date" value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ ...inputStyle, colorScheme: 'dark' }}
                  />
                </div>
              </div>
            )}

            {/* Message */}
            <div>
              <label style={labelStyle}>Message *</label>
              <textarea
                placeholder="Describe your leave reason..."
                value={msg} onChange={(e) => setMsg(e.target.value)}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            {/* File upload */}
            <div>
              <label style={labelStyle}>Attachments (optional)</label>
              <label
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '20px 16px', borderRadius: 10,
                  border: '1.5px dashed rgba(124, 92, 252, 0.25)',
                  background: 'rgba(124, 92, 252, 0.03)',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124, 92, 252, 0.5)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(124, 92, 252, 0.06)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124, 92, 252, 0.25)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(124, 92, 252, 0.03)';
                }}
              >
                <input
                  type="file" multiple accept="image/*,.pdf,.doc,.docx"
                  onChange={(e) => setFiles(e.target.files)}
                  style={{ display: 'none' }}
                />
                <CloudUploadOutlined style={{ fontSize: 22, color: 'rgba(124, 92, 252, 0.5)' }} />
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500, textAlign: 'center' }}>
                  Click to upload files
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                  Max 5 files, 5MB each
                </div>
              </label>

              {/* Selected files list */}
              {files && files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {Array.from(files).map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <PaperClipOutlined style={{ fontSize: 12, color: 'rgba(124, 92, 252, 0.6)', flexShrink: 0 }} />
                      <span style={{
                        fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 500,
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {f.name}
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ))}
                  <button
                    onClick={() => setFiles(null)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 0', fontSize: 11, color: 'rgba(239, 68, 68, 0.7)', fontWeight: 500,
                    }}
                  >
                    <DeleteOutlined style={{ fontSize: 10 }} /> Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
                background: submitting
                  ? 'rgba(124, 92, 252, 0.3)'
                  : 'linear-gradient(135deg, #7c5cfc 0%, #6344e0 100%)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                letterSpacing: 0.3,
                boxShadow: submitting ? 'none' : '0 4px 16px rgba(124, 92, 252, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div style={{ padding: 10, display: 'grid', gap: 10 }}>
      {/* Header with New Request button */}
      <div className="glass-card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ fontSize: 14, opacity: 0.7 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              Leave Requests
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 10,
            }}>
              {requests.length}
            </span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #7c5cfc 0%, #6344e0 100%)',
              color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(124, 92, 252, 0.25)',
              letterSpacing: 0.3,
            }}
          >
            <PlusOutlined style={{ fontSize: 10 }} /> New Request
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="small" />
        </div>
      ) : requests.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ marginBottom: 10, opacity: 0.3 }}><FileTextOutlined style={{ fontSize: 28 }} /></div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
            No leave requests yet
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
            Tap "New Request" to submit one
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {requests.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedRequest(r)}
              className="glass-card"
              style={{
                padding: '12px 14px', cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124, 92, 252, 0.15)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = '';
                (e.currentTarget as HTMLElement).style.borderColor = '';
              }}
            >
              {/* Top row: subject + status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{
                  fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 10,
                }}>
                  {r.subject}
                </span>
                <StatusBadge status={r.status} />
              </div>

              {/* Bottom row: dates + days */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                  {r.startDate} &mdash; {r.endDate}
                </span>
                <span style={{
                  fontSize: 11, color: 'rgba(124, 92, 252, 0.7)', fontWeight: 600,
                }}>
                  {r.totalDays} day{r.totalDays > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
