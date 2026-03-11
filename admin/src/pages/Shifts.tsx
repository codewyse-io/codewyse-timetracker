import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  TimePicker,
  Checkbox,
  Popconfirm,
  message,
  Spin,
  Tooltip,
  Row,
  Col,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined, GlobalOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { shiftsApi } from '../api/shifts.api';
import type { CreateShiftData, UpdateShiftData } from '../api/shifts.api';
import type { Shift } from '../types';


const DAYS_OF_WEEK = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' },
];

// Build timezone options from the browser's Intl API
const TIMEZONE_OPTIONS = (() => {
  try {
    const zones = (Intl as any).supportedValuesOf('timeZone') as string[];
    return zones.map((tz: string) => {
      const now = new Date();
      const offset = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
      }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? '';
      return {
        value: tz,
        label: `${tz.replace(/_/g, ' ')} (${offset})`,
        offset,
      };
    });
  } catch {
    // Fallback for older environments
    return [
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
      'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
      'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Shanghai',
      'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
    ].map((tz) => ({ value: tz, label: tz.replace(/_/g, ' '), offset: '' }));
  }
})();

const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

const inputStyle: React.CSSProperties = {
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--text-secondary)',
  fontSize: 13,
};

const CARD_TOP_COLORS = ['#6366f1', '#10b981', '#f59e0b'];

function DayPill({ day }: { day: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 9px',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--primary-light)',
      color: '#4338ca',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.2,
      border: '1px solid rgba(99,102,241,0.15)',
    }}>
      {DAY_SHORT[day] || day}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        background: '#d1fae5',
        color: '#065f46',
        fontSize: 12,
        fontWeight: 600,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
        Active
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 10px',
      borderRadius: 'var(--radius-full)',
      background: '#fee2e2',
      color: '#991b1b',
      fontSize: 12,
      fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
      Inactive
    </span>
  );
}

function ShiftCard({
  shift,
  index,
  onEdit,
  onDelete,
}: {
  shift: Shift;
  index: number;
  onEdit: (shift: Shift) => void;
  onDelete: (id: string) => void;
}) {
  const topColor = CARD_TOP_COLORS[index % CARD_TOP_COLORS.length];

  return (
    <div style={{
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border-light)',
      borderTop: `3px solid ${topColor}`,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      transition: 'box-shadow 0.2s, transform 0.2s',
      position: 'relative',
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card-hover)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)';
        (e.currentTarget as HTMLElement).style.transform = '';
      }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {shift.name}
          </h4>
          <StatusBadge isActive={shift.isActive} />
        </div>
        <Space size={4}>
          <Tooltip title="Edit shift">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(shift)}
              size="small"
              style={{
                color: '#6366f1',
                borderRadius: 6,
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this shift?"
            description="Users assigned to this shift will be unassigned."
            onConfirm={() => onDelete(shift.id)}
            okText="Delete"
            okType="danger"
          >
            <Tooltip title="Delete shift">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
                style={{
                  borderRadius: 6,
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      </div>

      {/* Time Range */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--surface-sunken)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-sm)',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ClockCircleOutlined style={{ color: '#fff', fontSize: 15 }} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Time Range
          </p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {shift.startTime} &ndash; {shift.endTime}
          </p>
          {shift.timezone && shift.timezone !== 'UTC' && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6366f1', fontWeight: 500 }}>
              {shift.timezone.replace(/_/g, ' ')}
            </p>
          )}
          {(!shift.timezone || shift.timezone === 'UTC') && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              UTC
            </p>
          )}
        </div>
      </div>

      {/* Working Days */}
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Working Days
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {shift.allowedDays && shift.allowedDays.length > 0 ? (
            shift.allowedDays.map((day) => (
              <DayPill key={day} day={day} />
            ))
          ) : (
            <span style={{ color: '#d1d5db', fontSize: 12 }}>No days set</span>
          )}
        </div>
      </div>

      {/* Idle Threshold */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Idle Threshold
        </span>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          background: 'var(--surface-sunken)',
          padding: '2px 10px',
          borderRadius: 'var(--radius-sm)',
        }}>
          {shift.idleThresholdMinutes ?? 3} min
        </span>
      </div>
    </div>
  );
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await shiftsApi.getShifts();
      setShifts(response.data);
    } catch {
      message.error('Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const openAddModal = () => {
    setEditingShift(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (shift: Shift) => {
    setEditingShift(shift);
    form.setFieldsValue({
      name: shift.name,
      startTime: dayjs(shift.startTime, 'HH:mm'),
      endTime: dayjs(shift.endTime, 'HH:mm'),
      allowedDays: shift.allowedDays,
      timezone: shift.timezone || 'UTC',
      idleThresholdMinutes: shift.idleThresholdMinutes ?? 3,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const data: CreateShiftData | UpdateShiftData = {
        name: values.name,
        startTime: values.startTime.format('HH:mm'),
        endTime: values.endTime.format('HH:mm'),
        allowedDays: values.allowedDays.map((d: string) => d.toLowerCase()),
        timezone: values.timezone || 'UTC',
        idleThresholdMinutes: values.idleThresholdMinutes ?? 3,
      };
      if (editingShift) {
        await shiftsApi.updateShift(editingShift.id, data);
        message.success('Shift updated successfully');
      } else {
        await shiftsApi.createShift(data as CreateShiftData);
        message.success('Shift created successfully');
      }
      setModalOpen(false);
      setEditingShift(null);
      form.resetFields();
      fetchShifts();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to save shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await shiftsApi.deleteShift(id);
      message.success('Shift deleted');
      fetchShifts();
    } catch {
      message.error('Failed to delete shift');
    }
  };

  return (
    <div style={{ padding: '0 0 32px', animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openAddModal}
          style={{
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            height: 42,
            padding: '0 20px',
            background: 'var(--primary)',
            border: 'none',
            boxShadow: 'var(--shadow-primary)',
            fontSize: 14,
          }}
        >
          Add Shift
        </Button>
      </div>

      {/* Shift Cards Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : shifts.length === 0 ? (
        <div style={{
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          padding: '64px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🗓️</div>
          <h3 style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text-secondary)' }}>No shifts yet</h3>
          <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 14 }}>
            Create your first shift to start scheduling your team
          </p>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAddModal}
            style={{
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              background: 'var(--primary)',
              border: 'none',
            }}
          >
            Create First Shift
          </Button>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {shifts.map((shift, index) => (
            <Col xs={24} sm={12} lg={8} key={shift.id}>
              <ShiftCard shift={shift} index={index} onEdit={openEditModal} onDelete={handleDelete} />
            </Col>
          ))}
        </Row>
      )}

      {/* Add / Edit Shift Modal */}
      <Modal
        title={
          <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              {editingShift ? 'Edit Shift' : 'Create New Shift'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>
              {editingShift
                ? 'Update the shift schedule details'
                : 'Set up a new work schedule for your team'}
            </p>
          </div>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingShift(null);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={480}
        styles={{ header: { borderBottom: 'none', paddingBottom: 0 } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 8 }}>
          <Form.Item
            name="name"
            label={<span style={labelStyle}>Shift Name</span>}
            rules={[{ required: true, message: 'Shift name is required' }]}
          >
            <Input placeholder="e.g. Morning Shift" style={inputStyle} />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="startTime"
                label={<span style={labelStyle}>Start Time</span>}
                rules={[{ required: true, message: 'Start time is required' }]}
              >
                <TimePicker
                  format="HH:mm"
                  style={{ width: '100%', borderRadius: 8 }}
                  placeholder="09:00"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endTime"
                label={<span style={labelStyle}>End Time</span>}
                rules={[{ required: true, message: 'End time is required' }]}
              >
                <TimePicker
                  format="HH:mm"
                  style={{ width: '100%', borderRadius: 8 }}
                  placeholder="17:00"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="timezone"
            label={<span style={labelStyle}>Timezone</span>}
            initialValue="UTC"
            rules={[{ required: true, message: 'Timezone is required' }]}
          >
            <Select
              showSearch
              placeholder="Select timezone"
              optionFilterProp="label"
              options={TIMEZONE_OPTIONS}
              style={{ borderRadius: 8 }}
              suffixIcon={<GlobalOutlined style={{ color: 'var(--text-muted)' }} />}
            />
          </Form.Item>

          <Form.Item
            name="idleThresholdMinutes"
            label={<span style={labelStyle}>Idle Threshold (minutes)</span>}
            initialValue={3}
            rules={[{ required: true, message: 'Required' }]}
            extra={<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Minutes of inactivity before marking the employee as idle</span>}
          >
            <InputNumber min={1} max={60} style={{ width: '100%', borderRadius: 'var(--radius-sm)' }} />
          </Form.Item>

          <Form.Item
            name="allowedDays"
            label={<span style={labelStyle}>Working Days</span>}
            rules={[{ required: true, message: 'Select at least one day' }]}
          >
            <Checkbox.Group
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 0' }}
            >
              {DAYS_OF_WEEK.map((day) => (
                <div key={day.value} style={{ width: '50%' }}>
                  <Checkbox value={day.value} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {day.label}
                  </Checkbox>
                </div>
              ))}
            </Checkbox.Group>
          </Form.Item>

          <div style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}>
            <Button
              onClick={() => { setModalOpen(false); setEditingShift(null); form.resetFields(); }}
              style={{ borderRadius: 'var(--radius-sm)', fontWeight: 500 }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                background: 'var(--primary)',
                border: 'none',
                boxShadow: 'var(--shadow-primary)',
              }}
            >
              {editingShift ? 'Update Shift' : 'Create Shift'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
