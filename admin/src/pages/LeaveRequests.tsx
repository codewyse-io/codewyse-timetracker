import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Input,
  Space,
  message,
  Image,
  Descriptions,
} from 'antd';
import {
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { leaveRequestsApi } from '../api/leave-requests.api';
import type { LeaveRequest } from '../types';

const statusConfig: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  pending:  { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b', label: 'Pending' },
  approved: { bg: '#d1fae5', color: '#065f46', dot: '#10b981', label: 'Approved' },
  rejected: { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444', label: 'Rejected' },
};

function StatusPill({ status }: { status: string }) {
  const s = statusConfig[status] || statusConfig.pending;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 10px',
      borderRadius: 6,
      background: s.bg,
      color: s.color,
      fontSize: 12,
      fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

interface AttachmentUrl {
  key: string;
  url: string;
  filename: string;
}

export default function LeaveRequestsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [attachmentUrls, setAttachmentUrls] = useState<AttachmentUrl[]>([]);

  // Action modal
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leaveRequestsApi.getAll({ page, limit });
      setRequests(res.data.data);
      setTotal(res.data.total);
    } catch {
      message.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    setAttachmentUrls([]);
    try {
      const [res, attachments] = await Promise.all([
        leaveRequestsApi.getById(id),
        leaveRequestsApi.getAttachments(id),
      ]);
      setSelectedRequest(res.data);
      const attData = (attachments as any)?.data ?? attachments;
      setAttachmentUrls(Array.isArray(attData) ? attData : []);
    } catch {
      message.error('Failed to load request details');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedRequest(null);
    setAttachmentUrls([]);
  };

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;
    setActionLoading(true);
    try {
      if (actionType === 'approve') {
        await leaveRequestsApi.approve(selectedRequest.id, adminNotes || undefined);
        message.success('Leave request approved');
      } else {
        await leaveRequestsApi.reject(selectedRequest.id, adminNotes || undefined);
        message.success('Leave request rejected');
      }
      setActionType(null);
      setAdminNotes('');
      closeDetail();
      fetchRequests();
    } catch {
      message.error(`Failed to ${actionType} request`);
    } finally {
      setActionLoading(false);
    }
  };

  const columns: TableColumnsType<LeaveRequest> = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, r) => {
        const name = r.user ? `${r.user.firstName} ${r.user.lastName}` : '-';
        const initials = r.user
          ? `${r.user.firstName?.charAt(0) ?? ''}${r.user.lastName?.charAt(0) ?? ''}`.toUpperCase()
          : '?';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0,
            }}>{initials}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{name}</div>
              {r.user && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.user.email}</div>}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      render: (subject: string) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>{subject}</span>
      ),
    },
    {
      title: 'Dates',
      key: 'dates',
      render: (_, r) => (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <div>{r.startDate} — {r.endDate}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.totalDays} day{r.totalDays > 1 ? 's' : ''}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusPill status={status} />,
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {new Date(date).toLocaleDateString()}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => openDetail(r.id)}
          size="small"
          style={{
            color: 'var(--primary)',
            borderRadius: 6,
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Table */}
      <div style={{
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}>
        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            onChange: (p) => setPage(p),
            showSizeChanger: false,
            showTotal: (t) => `Total ${t} requests`,
            style: { padding: '12px 24px' },
          }}
          onRow={() => ({
            style: { cursor: 'default', transition: 'background 0.15s' },
            onMouseEnter: (e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-sunken)'; },
            onMouseLeave: (e) => { (e.currentTarget as HTMLElement).style.background = ''; },
          })}
          style={{ border: 'none' }}
        />
      </div>

      {/* Detail Modal */}
      <Modal
        title={
          <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              Leave Request Details
            </h3>
          </div>
        }
        open={detailOpen}
        onCancel={closeDetail}
        footer={null}
        destroyOnClose
        width={640}
        styles={{ header: { borderBottom: 'none', paddingBottom: 0 } }}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
        ) : selectedRequest ? (
          <div style={{ marginTop: 8 }}>
            <Descriptions column={2} size="small" labelStyle={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 13 }} contentStyle={{ fontSize: 13 }}>
              <Descriptions.Item label="Employee">
                {selectedRequest.user ? `${selectedRequest.user.firstName} ${selectedRequest.user.lastName}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <StatusPill status={selectedRequest.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Start Date">{selectedRequest.startDate}</Descriptions.Item>
              <Descriptions.Item label="End Date">{selectedRequest.endDate}</Descriptions.Item>
              <Descriptions.Item label="Total Days">{selectedRequest.totalDays}</Descriptions.Item>
              <Descriptions.Item label="Submitted">{new Date(selectedRequest.createdAt).toLocaleDateString()}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Subject</div>
              <div style={{
                background: 'var(--surface-sunken)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-primary)',
              }}>{selectedRequest.subject}</div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Message</div>
              <div style={{
                background: 'var(--surface-sunken)',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 13,
                color: 'var(--text-primary)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>{selectedRequest.message}</div>
            </div>

            {/* Attachments */}
            {attachmentUrls.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Attachments ({attachmentUrls.length})
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Image.PreviewGroup>
                    {attachmentUrls.map((att, i) => {
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.filename || '');
                      if (isImage) {
                        return (
                          <Image
                            key={i}
                            src={att.url}
                            width={100}
                            height={100}
                            style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-light)' }}
                          />
                        );
                      }
                      return (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 12px',
                            background: 'var(--surface-sunken)',
                            borderRadius: 8,
                            border: '1px solid var(--border-light)',
                            fontSize: 12,
                            color: 'var(--primary)',
                            fontWeight: 500,
                            textDecoration: 'none',
                          }}
                        >
                          {att.filename}
                        </a>
                      );
                    })}
                  </Image.PreviewGroup>
                </div>
              </div>
            )}

            {/* Admin Notes (if already decided) */}
            {selectedRequest.adminNotes && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Admin Notes</div>
                <div style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: '#1e40af',
                }}>{selectedRequest.adminNotes}</div>
              </div>
            )}

            {/* Action Buttons */}
            {selectedRequest.status === 'pending' && !actionType && (
              <div style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => setActionType('reject')}
                  style={{ borderRadius: 8, fontWeight: 500 }}
                >
                  Reject
                </Button>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => setActionType('approve')}
                  style={{
                    borderRadius: 8,
                    fontWeight: 600,
                    background: '#10b981',
                    borderColor: '#10b981',
                  }}
                >
                  Approve
                </Button>
              </div>
            )}

            {/* Action confirmation */}
            {actionType && (
              <div style={{
                marginTop: 20,
                padding: 16,
                background: actionType === 'approve' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${actionType === 'approve' ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: 10,
              }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: actionType === 'approve' ? '#166534' : '#991b1b' }}>
                  {actionType === 'approve' ? 'Approve' : 'Reject'} this request?
                </div>
                <Input.TextArea
                  placeholder="Add notes (optional)..."
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  style={{ borderRadius: 8, marginBottom: 12 }}
                />
                <Space>
                  <Button onClick={() => { setActionType(null); setAdminNotes(''); }} style={{ borderRadius: 8 }}>
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    loading={actionLoading}
                    onClick={handleAction}
                    style={{
                      borderRadius: 8,
                      fontWeight: 600,
                      background: actionType === 'approve' ? '#10b981' : '#ef4444',
                      borderColor: actionType === 'approve' ? '#10b981' : '#ef4444',
                    }}
                  >
                    Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
                  </Button>
                </Space>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
