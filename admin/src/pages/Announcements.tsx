import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Tag,
  Spin,
  message,
  Popconfirm,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  SoundOutlined,
  CalendarOutlined,
  TeamOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { announcementsApi, type Announcement, type CreateAnnouncementData } from '../api/announcements.api';

dayjs.extend(relativeTime);

const { TextArea } = Input;

const TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  general: { color: '#6366f1', icon: <SoundOutlined />, label: 'General' },
  holiday: { color: '#10b981', icon: <CalendarOutlined />, label: 'Holiday' },
  meeting: { color: '#3b82f6', icon: <TeamOutlined />, label: 'Meeting' },
  memo: { color: '#8b5cf6', icon: <FileTextOutlined />, label: 'Memo' },
  urgent: { color: '#ef4444', icon: <ThunderboltOutlined />, label: 'Urgent' },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  low: { color: 'default', label: 'Low' },
  normal: { color: 'blue', label: 'Normal' },
  high: { color: 'red', label: 'High' },
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await announcementsApi.getAll();
      setAnnouncements(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreate = async (values: any) => {
    setCreating(true);
    try {
      const data: CreateAnnouncementData = {
        title: values.title,
        message: values.message,
        type: values.type,
        priority: values.priority,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined,
      };
      await announcementsApi.create(data);
      message.success('Announcement published');
      form.resetFields();
      setModalOpen(false);
      fetchAnnouncements();
    } catch {
      message.error('Failed to create announcement');
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await announcementsApi.deactivate(id);
      message.success('Announcement deactivated');
      fetchAnnouncements();
    } catch {
      message.error('Failed to deactivate');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await announcementsApi.delete(id);
      message.success('Announcement deleted');
      fetchAnnouncements();
    } catch {
      message.error('Failed to delete');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
          style={{
            borderRadius: 10,
            fontWeight: 500,
            height: 40,
            paddingInline: 20,
          }}
        >
          New Announcement
        </Button>
      </div>

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <Card style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <Empty description="No announcements yet" />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {announcements.map((a) => {
            const typeConf = TYPE_CONFIG[a.type] || TYPE_CONFIG.general;
            const priorityConf = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.normal;
            const isExpired = a.expiresAt && dayjs(a.expiresAt).isBefore(dayjs());

            return (
              <Card
                key={a.id}
                style={{
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-light)',
                  boxShadow: 'var(--shadow-xs)',
                  opacity: !a.isActive || isExpired ? 0.55 : 1,
                  borderLeft: `3px solid ${typeConf.color}`,
                }}
                styles={{ body: { padding: '16px 20px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Tags row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <Tag
                        icon={typeConf.icon}
                        color={typeConf.color}
                        style={{ borderRadius: 6, fontWeight: 500, fontSize: 11 }}
                      >
                        {typeConf.label}
                      </Tag>
                      <Tag color={priorityConf.color} style={{ borderRadius: 6, fontSize: 11 }}>
                        {priorityConf.label} Priority
                      </Tag>
                      {!a.isActive && (
                        <Tag color="default" style={{ borderRadius: 6, fontSize: 11 }}>Inactive</Tag>
                      )}
                      {isExpired && (
                        <Tag color="default" style={{ borderRadius: 6, fontSize: 11 }}>Expired</Tag>
                      )}
                    </div>

                    {/* Title */}
                    <h3 style={{
                      margin: '0 0 6px',
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      letterSpacing: -0.2,
                    }}>
                      {a.title}
                    </h3>

                    {/* Message */}
                    <p style={{
                      margin: '0 0 10px',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {a.message}
                    </p>

                    {/* Meta */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>
                        By {a.author?.firstName} {a.author?.lastName}
                      </span>
                      <span>·</span>
                      <span>{dayjs(a.createdAt).fromNow()}</span>
                      {a.expiresAt && (
                        <>
                          <span>·</span>
                          <span>Expires {dayjs(a.expiresAt).format('MMM D, YYYY')}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {a.isActive && (
                      <Popconfirm
                        title="Deactivate this announcement?"
                        onConfirm={() => handleDeactivate(a.id)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<EyeInvisibleOutlined style={{ color: 'var(--text-muted)' }} />}
                          title="Deactivate"
                        />
                      </Popconfirm>
                    )}
                    <Popconfirm
                      title="Delete this announcement permanently?"
                      onConfirm={() => handleDelete(a.id)}
                      okText="Delete"
                      cancelText="Cancel"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined style={{ color: '#ef4444' }} />}
                        title="Delete"
                      />
                    </Popconfirm>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        title="New Announcement"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
          This will be visible to all employees in their desktop app.
        </p>
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ type: 'general', priority: 'normal' }}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input placeholder="e.g. Office closed on Friday" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item name="message" label="Message" rules={[{ required: true, message: 'Message is required' }]}>
            <TextArea rows={4} placeholder="Write your announcement..." style={{ borderRadius: 8 }} />
          </Form.Item>

          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="type" label="Type" style={{ flex: 1 }}>
              <Select
                options={Object.entries(TYPE_CONFIG).map(([value, conf]) => ({
                  value,
                  label: conf.label,
                }))}
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item name="priority" label="Priority" style={{ flex: 1 }}>
              <Select
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'high', label: 'High' },
                ]}
                style={{ borderRadius: 8 }}
              />
            </Form.Item>
          </div>

          <Form.Item name="expiresAt" label="Expires On (optional)">
            <DatePicker
              style={{ width: '100%', borderRadius: 8 }}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={creating}>
              Publish
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
