import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Spin, Row, Col, Modal, Form, Input, Popconfirm, message, Tag } from 'antd';
import { PlusOutlined, TeamOutlined, BankOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { superAdminApi, type OrgWithStats, type SuperAdminDashboard } from '../api/super-admin.api';
import type { Organization } from '../types';

export default function SuperAdminDashboardPage() {
  const [data, setData] = useState<SuperAdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      const res = await superAdminApi.getDashboard();
      setData(res.data);
    } catch {
      message.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCreate = async (values: any) => {
    setSubmitting(true);
    try {
      await superAdminApi.createOrganization(values);
      message.success('Organization created');
      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values: any) => {
    if (!editingOrg) return;
    setSubmitting(true);
    try {
      await superAdminApi.updateOrganization(editingOrg.id, values);
      message.success('Organization updated');
      setEditingOrg(null);
      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await superAdminApi.deleteOrganization(id);
      message.success('Organization deleted');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to delete');
    }
  };

  const openEdit = (org: Organization) => {
    setEditingOrg(org);
    form.setFieldsValue({ name: org.name, slug: org.slug, emailFromName: org.emailFromName, primaryColor: org.primaryColor });
    setModalOpen(true);
  };

  const columns: ColumnsType<OrgWithStats> = [
    {
      title: 'Organization',
      key: 'name',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.slug}</div>
        </div>
      ),
    },
    {
      title: 'Users',
      key: 'users',
      render: (_, r) => (
        <span>
          <span style={{ fontWeight: 600 }}>{r.activeUsers}</span>
          <span style={{ color: 'var(--text-muted)' }}> / {r.totalUsers}</span>
        </span>
      ),
    },
    {
      title: 'Active Sessions',
      dataIndex: 'activeSessions',
      key: 'activeSessions',
      render: (v: number) => (
        v > 0
          ? <Tag color="green">{v} online</Tag>
          : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>None</span>
      ),
    },
    {
      title: 'Sessions (Month)',
      dataIndex: 'totalSessionsThisMonth',
      key: 'monthSessions',
      render: (v: number) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'Color',
      dataIndex: 'primaryColor',
      key: 'color',
      render: (c: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: c, border: '1px solid rgba(0,0,0,0.1)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c}</span>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this organization?" onConfirm={() => handleDelete(r.id)} okText="Delete" okType="danger">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { title: 'Organizations', value: data?.totalOrganizations || 0, icon: <BankOutlined />, color: '#6366f1' },
          { title: 'Total Users', value: data?.totalUsers || 0, icon: <TeamOutlined />, color: '#3b82f6' },
          { title: 'Active Users', value: data?.activeUsers || 0, icon: <ThunderboltOutlined />, color: '#10b981' },
        ].map((s) => (
          <Col xs={24} sm={8} key={s.title}>
            <Card style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }} bodyStyle={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: s.color }}>
                  {s.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Orgs Table */}
      <Card
        style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}
        bodyStyle={{ padding: 0 }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>Organizations</span>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingOrg(null); form.resetFields(); setModalOpen(true); }}>
              Add Organization
            </Button>
          </div>
        }
      >
        <Table
          dataSource={data?.organizations || []}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        title={editingOrg ? 'Edit Organization' : 'Create Organization'}
        onCancel={() => { setModalOpen(false); setEditingOrg(null); form.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={editingOrg ? handleUpdate : handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Organization Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Acme Corp" />
          </Form.Item>
          <Form.Item name="slug" label="Slug (URL-safe identifier)" rules={[{ required: true }, { pattern: /^[a-z0-9-]+$/, message: 'Lowercase letters, numbers, hyphens only' }]}>
            <Input placeholder="e.g. acme-corp" disabled={!!editingOrg} />
          </Form.Item>
          <Form.Item name="emailFromName" label="Email Sender Name">
            <Input placeholder="e.g. Acme Corp" />
          </Form.Item>
          <Form.Item name="primaryColor" label="Primary Color">
            <Input placeholder="#6366f1" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setModalOpen(false); setEditingOrg(null); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingOrg ? 'Update' : 'Create'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
