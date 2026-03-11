import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Row,
  Col,
  Select,
  Button,
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Spin,
  Empty,
  message,
  Tag,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import dayjs, { type Dayjs } from 'dayjs';

import type { KpiDefinition, User } from '../types';
import { kpisApi, type TeamKpiRow, type CreateKpiEntryData } from '../api/kpis.api';
import apiClient from '../api/client';

function getValueColor(value: number, unit: string): string {
  if (unit === '%') {
    if (value >= 80) return '#52c41a';
    if (value >= 50) return '#fa8c16';
    return '#f5222d';
  }
  return '#1890ff';
}

function getTopBorderColor(unit: string): string {
  if (unit === '%') return '#6366f1';
  if (unit === 'score') return '#10b981';
  if (unit === 'count') return '#f59e0b';
  return '#3b82f6';
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ idx: i, value: v }));
  return (
    <ResponsiveContainer width="100%" height={44}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
        <RechartsTooltip
          contentStyle={{
            background: '#fff',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function KpisPage() {
  const [designation, setDesignation] = useState<string | undefined>(undefined);
  const [definitions, setDefinitions] = useState<KpiDefinition[]>([]);
  const [teamData, setTeamData] = useState<TeamKpiRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [selectedUserDesignation, setSelectedUserDesignation] = useState<string | undefined>(undefined);
  const [userKpiDefs, setUserKpiDefs] = useState<KpiDefinition[]>([]);
  const [form] = Form.useForm();

  const designations = [...new Set(definitions.map((d) => d.designation))];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [defsRes, teamRes] = await Promise.all([
        kpisApi.getDefinitions(designation),
        kpisApi.getTeamKpis({ period: 'weekly' }),
      ]);
      const rawDefs = defsRes.data;
      setDefinitions(Array.isArray(rawDefs) ? rawDefs : (Array.isArray(rawDefs?.data) ? rawDefs.data : []));
      const rawTeam = teamRes.data;
      setTeamData(Array.isArray(rawTeam) ? rawTeam : (Array.isArray(rawTeam?.data) ? rawTeam.data : []));
    } catch {
      message.error('Failed to load KPI data');
    } finally {
      setLoading(false);
    }
  }, [designation]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/users', { params: { limit: 200 } });
        const raw = (res as any).data;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        setUsers(list);
      } catch {
        // Users unavailable
      }
    })();
  }, []);

  const handleUserSelectInModal = async (userId: string) => {
    setSelectedUserId(userId);
    const user = users.find((u) => u.id === userId);
    if (user) {
      setSelectedUserDesignation(user.designation ?? undefined);
      try {
        const res = await kpisApi.getDefinitions(user.designation ?? undefined);
        const raw = res.data;
        setUserKpiDefs(Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []));
      } catch {
        setUserKpiDefs([]);
      }
    }
  };

  const handleSubmitKpi = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedUserId || userKpiDefs.length === 0) return;

      setSubmitting(true);
      const periodStart = (values.periodStart as Dayjs).format('YYYY-MM-DD');
      const entries: CreateKpiEntryData[] = userKpiDefs
        .filter((def) => values[`kpi_${def.id}`] !== undefined && values[`kpi_${def.id}`] !== null)
        .map((def) => ({
          userId: selectedUserId,
          kpiDefinitionId: def.id,
          value: values[`kpi_${def.id}`],
          period: 'weekly' as const,
          periodStart,
        }));

      if (entries.length === 0) {
        message.warning('Please enter at least one KPI value');
        return;
      }

      await kpisApi.bulkCreateEntries(entries);
      message.success('KPI entries saved successfully');
      setModalOpen(false);
      form.resetFields();
      setSelectedUserId(undefined);
      setUserKpiDefs([]);
      fetchData();
    } catch {
      message.error('Failed to save KPI entries');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDefs = designation
    ? definitions.filter((d) => d.designation === designation)
    : definitions;

  // Build dynamic table columns
  const tableColumns = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_: unknown, record: TeamKpiRow) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
          {record.user.firstName} {record.user.lastName}
        </span>
      ),
    },
    ...filteredDefs.map((def) => ({
      title: (
        <span style={{ fontSize: 12 }}>
          {def.metricName}
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({def.unit})</span>
        </span>
      ),
      key: def.id,
      render: (_: unknown, record: TeamKpiRow) => {
        const kpi = record.kpis[def.id];
        if (!kpi) return (
          <span
            style={{
              background: 'var(--surface-sunken)',
              color: 'var(--text-muted)',
              borderRadius: 6,
              padding: '2px 10px',
              fontSize: 12,
            }}
          >
            N/A
          </span>
        );
        const color = getValueColor(kpi.value, kpi.unit);
        return (
          <span
            style={{
              background: `${color}15`,
              color,
              borderRadius: 6,
              padding: '3px 10px',
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${color}30`,
            }}
          >
            {kpi.value} {kpi.unit}
          </span>
        );
      },
    })),
  ];

  // Filter team data by designation if selected
  const filteredTeamData = designation
    ? teamData.filter((t) => t.user.designation === designation)
    : teamData;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Controls */}
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Select
            placeholder="All Designations"
            allowClear
            showSearch
            optionFilterProp="label"
            value={designation}
            onChange={(val) => setDesignation(val)}
            style={{ width: 220 }}
            options={designations.map((d) => ({ value: d, label: d }))}
          />
        </Col>
        <Col flex="auto" style={{ textAlign: 'right' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
            style={{
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary)',
              borderColor: 'var(--primary)',
              fontWeight: 500,
              height: 36,
            }}
          >
            Add KPI Entry
          </Button>
        </Col>
      </Row>

      {filteredDefs.length === 0 ? (
        <Card
          style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-xs)' }}
        >
          <Empty description="No KPI definitions found" />
        </Card>
      ) : (
        <>
          {/* KPI Definition Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {filteredDefs.map((def) => {
              const values = filteredTeamData
                .map((t) => t.kpis[def.id]?.value)
                .filter((v): v is number => v !== undefined);
              const avg =
                values.length > 0
                  ? values.reduce((s, v) => s + v, 0) / values.length
                  : 0;
              const borderColor = getTopBorderColor(def.unit);

              return (
                <Col xs={24} sm={12} lg={6} key={def.id}>
                  <Card
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-light)',
                      borderTop: `3px solid ${borderColor}`,
                      boxShadow: 'var(--shadow-xs)',
                    }}
                    bodyStyle={{ padding: 20 }}
                  >
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      {def.metricName}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: borderColor, marginBottom: 2, lineHeight: 1.2 }}>
                      {avg.toFixed(1)}
                      <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>{def.unit}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12, fontWeight: 500 }}>
                      Team Average
                    </div>
                    <MiniSparkline data={values.length > 0 ? values : [0]} color={borderColor} />
                  </Card>
                </Col>
              );
            })}
          </Row>

          {/* Team Table */}
          <Card
            title={
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
                Team KPI Overview
              </span>
            }
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-xs)',
            }}
            bodyStyle={{ padding: 0, overflow: 'hidden', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}
            headStyle={{ borderBottom: '1px solid var(--border-light)', padding: '16px 20px' }}
          >
            <Table
              dataSource={filteredTeamData}
              columns={tableColumns}
              rowKey="userId"
              pagination={false}
              scroll={{ x: 'max-content' }}
              rowClassName={() => 'kpi-row'}
            />
          </Card>
        </>
      )}

      <Modal
        title={
          <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Add KPI Entry</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400, marginTop: 2 }}>
              Record performance metrics for an employee
            </div>
          </div>
        }
        open={modalOpen}
        onOk={handleSubmitKpi}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
          setSelectedUserId(undefined);
          setSelectedUserDesignation(undefined);
          setUserKpiDefs([]);
        }}
        confirmLoading={submitting}
        width={520}
        okText="Save KPI Entries"
        okButtonProps={{
          style: { background: 'var(--primary)', borderColor: 'var(--primary)', borderRadius: 'var(--radius-sm)', fontWeight: 500 },
        }}
        cancelButtonProps={{ style: { borderRadius: 'var(--radius-sm)' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label={<span style={{ fontWeight: 500 }}>Employee</span>} required>
            <Select
              placeholder="Select employee"
              showSearch
              optionFilterProp="label"
              value={selectedUserId}
              onChange={handleUserSelectInModal}
              style={{ borderRadius: 'var(--radius-sm)' }}
              options={users.map((u) => ({
                value: u.id,
                label: `${u.firstName} ${u.lastName}${u.designation ? ` (${u.designation})` : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            label={<span style={{ fontWeight: 500 }}>Period Start</span>}
            name="periodStart"
            rules={[{ required: true, message: 'Select period start date' }]}
          >
            <DatePicker picker="week" style={{ width: '100%', borderRadius: 'var(--radius-sm)' }} />
          </Form.Item>

          {selectedUserDesignation && userKpiDefs.length === 0 && (
            <div
              style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                color: '#92400e',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              No KPI definitions found for designation: <strong>{selectedUserDesignation}</strong>
            </div>
          )}

          {userKpiDefs.length > 0 && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                KPI Metrics
              </div>
              {userKpiDefs.map((def) => (
                <Form.Item
                  key={def.id}
                  label={
                    <span style={{ fontWeight: 500, color: '#374151' }}>
                      {def.metricName}
                      <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontWeight: 400 }}>({def.unit})</span>
                    </span>
                  }
                  name={`kpi_${def.id}`}
                  extra={def.description && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{def.description}</span>}
                  style={{ marginBottom: 12 }}
                >
                  <InputNumber
                    style={{ width: '100%', borderRadius: 'var(--radius-sm)' }}
                    placeholder={`Enter ${def.metricName}`}
                  />
                </Form.Item>
              ))}
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}
