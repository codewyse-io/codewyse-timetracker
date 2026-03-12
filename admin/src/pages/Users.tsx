import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Popconfirm,
  message,
  Tooltip,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  DeleteOutlined,
  SendOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { usersApi } from '../api/users.api';
import type { CreateUserData, UpdateUserData } from '../api/users.api';
import { shiftsApi } from '../api/shifts.api';
import type { User, Shift } from '../types';


function getAvatarColor(name: string): string {
  const pastels = [
    '#e0e7ff', '#fce7f3', '#d1fae5', '#fef3c7', '#dbeafe',
    '#f3e8ff', '#ccfbf1', '#fee2e2', '#e0f2fe', '#f0fdf4',
  ];
  const textColors = [
    '#4338ca', '#be185d', '#065f46', '#92400e', '#1d4ed8',
    '#6d28d9', '#0f766e', '#b91c1c', '#0369a1', '#15803d',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % pastels.length;
  return JSON.stringify({ bg: pastels[idx], text: textColors[idx] });
}

function AvatarCell({ firstName, lastName }: { firstName: string; lastName: string }) {
  const name = `${firstName} ${lastName}`;
  const initials = `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase();
  const colors = JSON.parse(getAvatarColor(name));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: colors.bg,
        color: colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 13,
        flexShrink: 0,
        letterSpacing: 0.5,
      }}>
        {initials}
      </div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{name}</div>
      </div>
    </div>
  );
}

const roleStyles: Record<string, { background: string; color: string; border: string; boxShadow?: string }> = {
  admin: {
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 2px 6px rgba(99,102,241,0.2)',
  },
  employee: {
    background: 'var(--surface-sunken)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-default)',
  },
};

const statusConfig: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  active:      { bg: '#d1fae5', color: '#065f46', dot: '#10b981', label: 'Active' },
  invited:     { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b', label: 'Invited' },
  deactivated: { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444', label: 'Deactivated' },
};

function RolePill({ role }: { role: string }) {
  const s = roleStyles[role] || roleStyles.employee;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 20,
      background: s.background,
      color: s.color,
      border: s.border,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 0.3,
      boxShadow: s.boxShadow,
    }}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = statusConfig[status] || statusConfig.active;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 10px',
      borderRadius: 'var(--radius-sm)',
      background: s.bg,
      color: s.color,
      fontSize: 12,
      fontWeight: 600,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: s.dot,
        flexShrink: 0,
      }} />
      {s.label}
    </span>
  );
}

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

const DEFAULT_DESIGNATIONS = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Mobile Developer',
  'DevOps Engineer',
  'UI/UX Designer',
  'QA Engineer',
  'Project Manager',
  'Product Manager',
  'HR Manager',
  'Team Lead',
  'Data Analyst',
  'Business Analyst',
  'Marketing Specialist',
  'Sales Representative',
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [customDesignations, setCustomDesignations] = useState<string[]>([]);
  const [newDesignation, setNewDesignation] = useState('');
  const newDesignationInputRef = useRef<any>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await usersApi.getUsers({ page, limit, search: search || undefined });
      setUsers(response.data.data);
      setTotal(response.data.total);
    } catch {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  const fetchShifts = useCallback(async () => {
    try {
      const response = await shiftsApi.getShifts();
      setShifts(response.data);
    } catch {
      // Shifts are optional for the form
    }
  }, []);

  // Build unique designation options from defaults + users + custom
  const designationOptions = (() => {
    const all = new Set(DEFAULT_DESIGNATIONS);
    users.forEach((u) => { if (u.designation) all.add(u.designation); });
    customDesignations.forEach((d) => all.add(d));
    return [...all].sort().map((d) => ({ value: d, label: d }));
  })();

  const handleAddDesignation = () => {
    const trimmed = newDesignation.trim();
    if (!trimmed) return;
    if (!customDesignations.includes(trimmed) && !DEFAULT_DESIGNATIONS.includes(trimmed)) {
      setCustomDesignations((prev) => [...prev, trimmed]);
    }
    setNewDesignation('');
    setTimeout(() => newDesignationInputRef.current?.focus(), 0);
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const handleAddUser = async (values: CreateUserData) => {
    setSubmitting(true);
    try {
      await usersApi.createUser(values);
      message.success('User created successfully');
      setAddModalOpen(false);
      addForm.resetFields();
      fetchUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async (values: UpdateUserData) => {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        hourlyRate: values.hourlyRate != null ? Number(values.hourlyRate) : undefined,
        shiftId: values.shiftId === undefined ? null : values.shiftId,
      };
      await usersApi.updateUser(editingUser.id, payload);
      message.success('User updated successfully');
      setEditModalOpen(false);
      setEditingUser(null);
      editForm.resetFields();
      fetchUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await usersApi.deactivateUser(id);
      message.success('User deactivated');
      fetchUsers();
    } catch {
      message.error('Failed to deactivate user');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await usersApi.deleteUser(id);
      message.success('User deleted');
      fetchUsers();
    } catch {
      message.error('Failed to delete user');
    }
  };

  const handleResendInvite = async (id: string) => {
    try {
      await usersApi.resendInvite(id);
      message.success('Invitation resent');
    } catch {
      message.error('Failed to resend invite');
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    editForm.setFieldsValue({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      designation: user.designation,
      hourlyRate: Number(user.hourlyRate),
      shiftId: user.shiftId,
      allowedLeavesPerYear: user.allowedLeavesPerYear,
    });
    setEditModalOpen(true);
  };

  const getShiftName = (shiftId: string | null) => {
    if (!shiftId) return '-';
    const shift = shifts.find((s) => s.id === shiftId);
    return shift?.name || '-';
  };

  const columns: TableColumnsType<User> = [
    {
      title: 'Member',
      key: 'name',
      render: (_, record) => (
        <AvatarCell firstName={record.firstName} lastName={record.lastName} />
      ),
      sorter: (a, b) => a.firstName.localeCompare(b.firstName),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => (
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{email}</span>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <RolePill role={role} />,
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      render: (designation: string | null) => (
        <span style={{ color: designation ? 'var(--text-secondary)' : 'var(--text-faint)', fontSize: 13 }}>
          {designation || '-'}
        </span>
      ),
    },
    {
      title: 'Hourly Rate',
      dataIndex: 'hourlyRate',
      key: 'hourlyRate',
      render: (rate: number) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>${Number(rate).toFixed(2)}</span>
      ),
    },
    {
      title: 'Shift',
      dataIndex: 'shiftId',
      key: 'shiftId',
      render: (shiftId: string | null) => (
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{getShiftName(shiftId)}</span>
      ),
    },
    {
      title: 'Leaves',
      key: 'leaves',
      render: (_: unknown, record: User) => {
        const consumed = record.consumedLeaves ?? 0;
        const total = record.allowedLeavesPerYear ?? 20;
        const isOver = consumed > total;
        return (
          <span style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: isOver ? '#ef4444' : 'var(--text-primary)' }}>{consumed}</span>
            <span style={{ color: 'var(--text-muted)' }}> / {total}</span>
          </span>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusPill status={status} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit user">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
              size="small"
              style={{
                color: 'var(--primary)',
                borderRadius: 6,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </Tooltip>
          {record.status !== 'deactivated' && (
            <Popconfirm
              title="Deactivate this user?"
              description="This action will prevent the user from logging in."
              onConfirm={() => handleDeactivate(record.id)}
              okText="Deactivate"
              okType="danger"
            >
              <Tooltip title="Deactivate">
                <Button
                  type="text"
                  danger
                  icon={<StopOutlined />}
                  size="small"
                  style={{
                    borderRadius: 6,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              </Tooltip>
            </Popconfirm>
          )}
          {record.status === 'invited' && (
            <Tooltip title="Resend invite">
              <Button
                type="text"
                icon={<SendOutlined />}
                onClick={() => handleResendInvite(record.id)}
                size="small"
                style={{
                  color: '#f59e0b',
                  borderRadius: 6,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Delete this user?"
            description="This action is permanent and cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Tooltip title="Delete user">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
                style={{
                  borderRadius: 6,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const shiftOptions = shifts
    .filter((s) => s.isActive)
    .map((s) => ({ label: s.name, value: s.id }));

  const ModalForm = ({
    form,
    onFinish,
    onCancel,
    isEdit,
  }: {
    form: any;
    onFinish: (v: any) => void;
    onCancel: () => void;
    isEdit: boolean;
  }) => (
    <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 8 }}>
      {!isEdit && (
        <Form.Item
          name="email"
          label={<span style={labelStyle}>Email</span>}
          rules={[
            { required: true, message: 'Email is required' },
            { type: 'email', message: 'Enter a valid email' },
          ]}
        >
          <Input placeholder="user@example.com" style={inputStyle} />
        </Form.Item>
      )}
      <Form.Item
        name="firstName"
        label={<span style={labelStyle}>First Name</span>}
        rules={[{ required: true, message: 'First name is required' }]}
      >
        <Input placeholder="John" style={inputStyle} />
      </Form.Item>
      <Form.Item
        name="lastName"
        label={<span style={labelStyle}>Last Name</span>}
        rules={[{ required: true, message: 'Last name is required' }]}
      >
        <Input placeholder="Doe" style={inputStyle} />
      </Form.Item>
      <Form.Item
        name="role"
        label={<span style={labelStyle}>Role</span>}
        rules={[{ required: true, message: 'Role is required' }]}
      >
        <Select placeholder="Select role" style={{ borderRadius: 8 }}>
          <Select.Option value="admin">Admin</Select.Option>
          <Select.Option value="employee">Employee</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item
        name="designation"
        label={<span style={labelStyle}>Designation</span>}
      >
        <Select
          placeholder="Select or create designation"
          allowClear
          showSearch
          style={{ borderRadius: 8 }}
          options={designationOptions}
          optionFilterProp="label"
          dropdownRender={(menu) => (
            <>
              {menu}
              <Divider style={{ margin: '8px 0 4px' }} />
              <div style={{ display: 'flex', gap: 8, padding: '4px 8px 8px' }}>
                <Input
                  placeholder="New designation..."
                  ref={newDesignationInputRef}
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDesignation(); } }}
                  style={{ borderRadius: 6, fontSize: 13 }}
                  size="small"
                />
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  onClick={handleAddDesignation}
                  size="small"
                  style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}
                >
                  Add
                </Button>
              </div>
            </>
          )}
        />
      </Form.Item>
      <Form.Item
        name="hourlyRate"
        label={<span style={labelStyle}>Hourly Rate ($)</span>}
        rules={[{ required: true, message: 'Hourly rate is required' }]}
      >
        <InputNumber min={0} step={0.5} style={{ width: '100%', borderRadius: 8 }} placeholder="25.00" />
      </Form.Item>
      <Form.Item name="shiftId" label={<span style={labelStyle}>Shift</span>}>
        <Select placeholder="Select shift (optional)" allowClear options={shiftOptions} />
      </Form.Item>
      <Form.Item
        name="allowedLeavesPerYear"
        label={<span style={labelStyle}>Allowed Leaves / Year</span>}
        initialValue={20}
      >
        <InputNumber min={0} max={365} step={1} style={{ width: '100%', borderRadius: 8 }} placeholder="20" />
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
          onClick={onCancel}
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
          {isEdit ? 'Update User' : 'Create User'}
        </Button>
      </div>
    </Form>
  );

  return (
    <div style={{ padding: '0 0 32px', animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Add User Button Row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 28 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddModalOpen(true)}
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
          Add User
        </Button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 20 }}>
        <Input
          placeholder="Search by name or email..."
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{
            width: 380,
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-card)',
            border: '1px solid var(--border-light)',
            height: 42,
            fontSize: 14,
            boxShadow: 'var(--shadow-xs)',
          }}
          allowClear
        />
      </div>

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
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            onChange: (p) => setPage(p),
            showSizeChanger: false,
            showTotal: (t) => `Total ${t} users`,
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

      {/* Add User Modal */}
      <Modal
        title={
          <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Add New Member</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>
              Fill in the details to invite a new team member
            </p>
          </div>
        }
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false);
          addForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={480}
        styles={{ header: { borderBottom: 'none', paddingBottom: 0 } }}
      >
        <ModalForm
          form={addForm}
          onFinish={handleAddUser}
          onCancel={() => { setAddModalOpen(false); addForm.resetFields(); }}
          isEdit={false}
        />
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title={
          <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Member</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>
              Update team member information
            </p>
          </div>
        }
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingUser(null);
          editForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={480}
        styles={{ header: { borderBottom: 'none', paddingBottom: 0 } }}
      >
        <ModalForm
          form={editForm}
          onFinish={handleEditUser}
          onCancel={() => { setEditModalOpen(false); setEditingUser(null); editForm.resetFields(); }}
          isEdit={true}
        />
      </Modal>
    </div>
  );
}
