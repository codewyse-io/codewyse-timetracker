import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Tag,
  Tooltip,
  Empty,
  Spin,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { teamsApi, type Team } from '../api/teams.api';
import apiClient from '../api/client';
import type { User } from '../types';

interface EditState {
  open: boolean;
  team: Team | null;
}

interface AssignState {
  open: boolean;
  team: Team | null;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editState, setEditState] = useState<EditState>({ open: false, team: null });
  const [editForm] = Form.useForm();
  const [assignState, setAssignState] = useState<AssignState>({ open: false, team: null });
  const [assignSelection, setAssignSelection] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, usersRes] = await Promise.all([
        teamsApi.list(),
        apiClient.get('/users', { params: { limit: 200 } }),
      ]);
      setTeams(teamsRes.data || []);
      const raw = (usersRes as any).data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      setUsers(list);
    } catch {
      message.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSaving(true);
      await teamsApi.create({
        name: values.name,
        description: values.description,
        memberIds: values.memberIds,
      });
      message.success('Team created');
      setCreateOpen(false);
      createForm.resetFields();
      await load();
    } catch (err: any) {
      if (err?.errorFields) return; // validation
      const detail = err?.response?.data?.message || err?.message || 'Failed to create team';
      message.error(Array.isArray(detail) ? detail.join(', ') : detail);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editState.team) return;
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      await teamsApi.update(editState.team.id, {
        name: values.name,
        description: values.description,
      });
      message.success('Team updated');
      setEditState({ open: false, team: null });
      await load();
    } catch (err: any) {
      if (err?.errorFields) return;
      const detail = err?.response?.data?.message || err?.message || 'Failed to update team';
      message.error(Array.isArray(detail) ? detail.join(', ') : detail);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await teamsApi.remove(id);
      message.success('Team deleted');
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.message || 'Failed to delete team';
      message.error(Array.isArray(detail) ? detail.join(', ') : detail);
    }
  };

  const openAssign = (team: Team) => {
    setAssignState({ open: true, team });
    setAssignSelection(team.members.map((m) => m.id));
  };

  const handleAssign = async () => {
    if (!assignState.team) return;
    setSaving(true);
    try {
      await teamsApi.assignMembers(assignState.team.id, assignSelection);
      message.success('Members updated');
      setAssignState({ open: false, team: null });
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.message || 'Failed to assign members';
      message.error(Array.isArray(detail) ? detail.join(', ') : detail);
    } finally {
      setSaving(false);
    }
  };

  // Build the per-employee picker: include current team members + anyone unassigned.
  // Optionally include members of other teams (they'll be moved if selected).
  const userOptions = users.map((u) => {
    const currentTeam = teams.find((t) => t.id === (u as any).teamId);
    const otherTeam = currentTeam && currentTeam.id !== assignState.team?.id ? currentTeam : null;
    return {
      value: u.id,
      label: `${u.firstName} ${u.lastName}${otherTeam ? ` (currently in ${otherTeam.name})` : ''}`,
    };
  });

  const columns: ColumnsType<Team> = [
    {
      title: 'Team',
      key: 'name',
      render: (_, t) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{t.name}</div>
          {t.description && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {t.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Members',
      dataIndex: 'memberCount',
      key: 'memberCount',
      render: (n: number) => (
        <span
          style={{
            background: 'rgba(99,102,241,0.08)',
            color: 'var(--primary)',
            padding: '2px 10px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {n}
        </span>
      ),
    },
    {
      title: 'Preview',
      key: 'preview',
      render: (_, t) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {t.members.slice(0, 4).map((m) => (
            <Tag key={m.id} style={{ borderRadius: 6, fontWeight: 500 }}>
              {m.firstName} {m.lastName}
            </Tag>
          ))}
          {t.members.length > 4 && (
            <Tag style={{ borderRadius: 6 }}>+{t.members.length - 4} more</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      align: 'right',
      render: (_, t) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <Tooltip title="Manage members">
            <Button
              size="small"
              icon={<UserSwitchOutlined />}
              onClick={() => openAssign(t)}
            >
              Members
            </Button>
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditState({ open: true, team: t });
                editForm.setFieldsValue({ name: t.name, description: t.description });
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this team?"
            description="Members will be unassigned. This cannot be undone."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(t.id)}
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
          style={{
            borderRadius: 10,
            background: 'var(--primary)',
            borderColor: 'var(--primary)',
            fontWeight: 500,
          }}
        >
          Create Team
        </Button>
      </div>

      <Card
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-xs)',
        }}
        bodyStyle={{ padding: 16 }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
            <Spin size="large" />
          </div>
        ) : teams.length === 0 ? (
          <Empty
            image={<TeamOutlined style={{ fontSize: 48, color: 'var(--border-light)' }} />}
            description={
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>
                  No teams yet
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  Create your first team to scope peer reviews to specific groups.
                </div>
              </div>
            }
          />
        ) : (
          <Table
            dataSource={teams}
            columns={columns}
            rowKey="id"
            rowClassName={() => 'modern-row'}
            pagination={{ pageSize: 15 }}
          />
        )}
      </Card>

      {/* Create */}
      <Modal
        open={createOpen}
        title="Create Team"
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreate}
        okText="Create"
        confirmLoading={saving}
        width={520}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Name is required' }, { max: 100 }]}
          >
            <Input placeholder="e.g. Engineering" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
          <Form.Item label="Initial members" name="memberIds">
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="Add members (optional)"
              options={users.map((u) => ({
                value: u.id,
                label: `${u.firstName} ${u.lastName}${
                  (u as any).teamId ? ' (already in a team)' : ''
                }`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit */}
      <Modal
        open={editState.open}
        title="Edit Team"
        onCancel={() => setEditState({ open: false, team: null })}
        onOk={handleEdit}
        okText="Save"
        confirmLoading={saving}
        width={520}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Name is required' }, { max: 100 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Manage members */}
      <Modal
        open={assignState.open}
        title={assignState.team ? `Members — ${assignState.team.name}` : 'Members'}
        onCancel={() => setAssignState({ open: false, team: null })}
        onOk={handleAssign}
        okText="Save"
        confirmLoading={saving}
        width={620}
      >
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
          Selecting a user that's currently in another team will move them to this team.
        </div>
        <Select
          mode="multiple"
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          value={assignSelection}
          onChange={setAssignSelection}
          placeholder="Pick team members"
          options={userOptions}
        />
      </Modal>
    </div>
  );
}
