import { useEffect, useState, useCallback } from 'react';
import { Spin, message, Modal, Input } from 'antd';
import {
  CalendarOutlined,
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAllLeaveRequests, updateLeaveRequestStatus } from '../../api/client';

interface LeaveRequest {
  id: string;
  userId: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
  subject: string;
  message: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes: string | null;
  attachments: string[] | null;
  createdAt: string;
}

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', label: 'Pending' },
  approved: { bg: 'rgba(16, 185, 129, 0.1)', color: '#34d399', label: 'Approved' },
  rejected: { bg: 'rgba(239, 68, 68, 0.1)', color: '#f87171', label: 'Rejected' },
};

export default function HrLeaveRequestsPanel() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllLeaveRequests(1, 100);
      const data = res?.data?.data ?? res?.data ?? [];
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      message.error(`Failed to load leave requests: ${err?.response?.data?.message || err?.message || 'unknown'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  const counts = {
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
    all: rows.length,
  };

  const approve = async (req: LeaveRequest) => {
    setActing(req.id);
    try {
      await updateLeaveRequestStatus(req.id, 'approved');
      message.success(`Approved ${req.user ? `${req.user.firstName}'s` : ''} leave request`);
      await load();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to approve');
    } finally {
      setActing(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setActing(rejectTarget.id);
    try {
      await updateLeaveRequestStatus(rejectTarget.id, 'rejected', rejectNote.trim() || undefined);
      message.success('Leave request rejected');
      setRejectTarget(null);
      setRejectNote('');
      await load();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to reject');
    } finally {
      setActing(null);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      {/* Status filter */}
      <div style={tabBar}>
        {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => {
          const active = filter === f;
          const label = f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1);
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...tabBtn,
                background: active ? 'rgba(124, 92, 252, 0.18)' : 'transparent',
                color: active ? '#c4b5fd' : 'rgba(255,255,255,0.55)',
              }}
            >
              {label}
              <span style={{ marginLeft: 4, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                {counts[f]}
              </span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button onClick={load} style={btnSecondary} title="Refresh">
          <ReloadOutlined spin={loading} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Spin />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...panelStyle, textAlign: 'center', padding: 32 }}>
          <CalendarOutlined style={{ fontSize: 28, color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 10 }} />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            No {filter === 'all' ? '' : filter} leave requests.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((r) => {
            const s = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
            return (
              <div key={r.id} style={panelStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {r.user ? `${r.user.firstName} ${r.user.lastName}` : r.userId.slice(0, 8)}
                      </span>
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: 20,
                          background: s.bg,
                          color: s.color,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 0.05,
                          textTransform: 'uppercase',
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                      {r.subject}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                      {dayjs(r.startDate).format('MMM D')} → {dayjs(r.endDate).format('MMM D, YYYY')}{' '}
                      <span style={{ color: 'rgba(255,255,255,0.35)' }}>
                        &middot; {r.totalDays} day{r.totalDays === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => approve(r)}
                        disabled={acting === r.id}
                        style={btnApprove}
                      >
                        <CheckOutlined /> Approve
                      </button>
                      <button
                        onClick={() => setRejectTarget(r)}
                        disabled={acting === r.id}
                        style={btnReject}
                      >
                        <CloseOutlined /> Reject
                      </button>
                    </div>
                  )}
                </div>
                {r.message && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.7)',
                      padding: 10,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      lineHeight: 1.5,
                    }}
                  >
                    {r.message}
                  </div>
                )}
                {r.adminNotes && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: 'rgba(196, 181, 253, 0.85)',
                      padding: 8,
                      borderRadius: 8,
                      background: 'rgba(124, 92, 252, 0.08)',
                      border: '1px solid rgba(124, 92, 252, 0.18)',
                    }}
                  >
                    <strong>HR note:</strong> {r.adminNotes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!rejectTarget}
        title={
          rejectTarget
            ? `Reject leave request — ${rejectTarget.user ? rejectTarget.user.firstName : 'Employee'}`
            : ''
        }
        onCancel={() => {
          setRejectTarget(null);
          setRejectNote('');
        }}
        onOk={confirmReject}
        okText="Reject"
        okButtonProps={{ danger: true, loading: !!acting }}
        cancelText="Cancel"
      >
        <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.7)', marginBottom: 8 }}>
          Optional note explaining the rejection (visible to the employee):
        </p>
        <Input.TextArea
          rows={3}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="e.g. Please reschedule outside our peak season."
          maxLength={500}
        />
      </Modal>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 12,
  padding: 12,
  marginBottom: 0,
};

const tabBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 10,
  padding: 4,
  gap: 2,
  marginBottom: 14,
};

const tabBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '7px 12px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  transition: 'all 0.15s ease',
};

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnApprove: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 12px',
  borderRadius: 8,
  background: 'rgba(16, 185, 129, 0.12)',
  border: '1px solid rgba(16, 185, 129, 0.3)',
  color: '#34d399',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};

const btnReject: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 12px',
  borderRadius: 8,
  background: 'rgba(239, 68, 68, 0.12)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  color: '#f87171',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};
