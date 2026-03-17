import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Row,
  Col,
  DatePicker,
  Segmented,
  Button,
  Spin,
  Select,
  message,
} from 'antd';
import { DollarOutlined, ClockCircleOutlined, TeamOutlined, DownloadOutlined, RiseOutlined, UserOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

import type { PayrollEntry, User } from '../types';
import { payrollApi, type PayrollSummary } from '../api/payroll.api';
import { usersApi } from '../api/users.api';
import { formatCurrency, formatDuration } from '../utils/format';
import { downloadCsv } from '../utils/export';

type ViewMode = 'Weekly' | 'Monthly';

const statCards = [
  {
    key: 'totalPayable',
    title: 'Total Payable',
    icon: <DollarOutlined style={{ fontSize: 20, color: '#10b981' }} />,
    gradient: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    iconBg: 'rgba(16,185,129,0.12)',
    valueColor: '#10b981',
  },
  {
    key: 'totalActiveHours',
    title: 'Active Hours',
    icon: <ClockCircleOutlined style={{ fontSize: 20, color: '#3b82f6' }} />,
    gradient: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    iconBg: 'rgba(59,130,246,0.12)',
    valueColor: '#3b82f6',
  },
  {
    key: 'averageHourlyRate',
    title: 'Avg Rate',
    icon: <RiseOutlined style={{ fontSize: 20, color: '#8b5cf6' }} />,
    gradient: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
    iconBg: 'rgba(139,92,246,0.12)',
    valueColor: '#8b5cf6',
  },
  {
    key: 'employeeCount',
    title: 'Employees',
    icon: <TeamOutlined style={{ fontSize: 20, color: '#6366f1' }} />,
    gradient: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
    iconBg: 'rgba(99,102,241,0.12)',
    valueColor: '#6366f1',
  },
];

export default function PayrollPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('Weekly');
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | undefined>(undefined);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (viewMode === 'Weekly') {
        const weekStart = selectedDate.startOf('week').format('YYYY-MM-DD');
        res = await payrollApi.getWeeklyPayroll(weekStart);
      } else {
        res = await payrollApi.getMonthlyPayroll(
          selectedDate.year(),
          selectedDate.month() + 1
        );
      }
      setSummary(res.data);
    } catch {
      message.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedDate]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  useEffect(() => {
    usersApi.getUsers({ limit: 200 }).then((res) => {
      const allUsers = res.data.data ?? [];
      setEmployees(allUsers.filter((u: User) => u.role === 'employee'));
    }).catch(() => {});
  }, []);

  const filteredEntries = summary?.entries.filter(
    (e) => !selectedEmployee || e.userId === selectedEmployee,
  ) ?? [];

  const handleExportCsv = () => {
    if (filteredEntries.length === 0) {
      message.warning('No data to export');
      return;
    }
    const headers = ['Employee', 'Role', 'Active Hours', 'Hourly Rate ($)', 'Payable Amount ($)'];
    const rows = filteredEntries.map((e) => [
      `${e.user.firstName} ${e.user.lastName}`,
      e.user.role,
      (e.activeHours || 0).toFixed(1),
      (e.hourlyRate || 0).toFixed(2),
      (e.payableAmount || 0).toFixed(2),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const label = viewMode === 'Weekly'
      ? selectedDate.startOf('week').format('YYYY-MM-DD')
      : selectedDate.format('YYYY-MM');
    downloadCsv(csv, `payroll-${label}.csv`);
  };

  const columns: ColumnsType<PayrollEntry> = [
    {
      title: 'Employee Name',
      key: 'name',
      render: (_, record) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
          {record.user.firstName} {record.user.lastName}
        </span>
      ),
      sorter: (a, b) =>
        `${a.user.firstName} ${a.user.lastName}`.localeCompare(
          `${b.user.firstName} ${b.user.lastName}`
        ),
    },
    {
      title: 'Role',
      key: 'role',
      render: (_, record) => (
        <span
          style={{
            background: 'var(--surface-sunken)',
            color: 'var(--text-secondary)',
            borderRadius: 6,
            padding: '2px 10px',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {record.user.role}
        </span>
      ),
      sorter: (a, b) => a.user.role.localeCompare(b.user.role),
    },
    {
      title: 'Active Hours',
      dataIndex: 'activeHours',
      key: 'activeHours',
      render: (val: number) => (
        <span style={{ color: 'var(--text-secondary)' }}>{formatDuration((val || 0) * 3600)}</span>
      ),
      sorter: (a, b) => (a.activeHours || 0) - (b.activeHours || 0),
    },
    {
      title: 'Hourly Rate',
      dataIndex: 'hourlyRate',
      key: 'hourlyRate',
      render: (val: number) => (
        <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(val || 0)}</span>
      ),
      sorter: (a, b) => (a.hourlyRate || 0) - (b.hourlyRate || 0),
    },
    {
      title: 'Payable Amount',
      dataIndex: 'payableAmount',
      key: 'payableAmount',
      render: (val: number) => (
        <span style={{ color: '#10b981', fontWeight: 600, fontSize: 15 }}>
          {formatCurrency(val || 0)}
        </span>
      ),
      sorter: (a, b) => (a.payableAmount || 0) - (b.payableAmount || 0),
    },
  ];

  const filteredTotalHours = filteredEntries.reduce((s, e) => s + e.activeHours, 0);
  const filteredTotalPayable = filteredEntries.reduce((s, e) => s + e.payableAmount, 0);
  const filteredAvgRate = filteredEntries.length > 0
    ? filteredEntries.reduce((s, e) => s + e.hourlyRate, 0) / filteredEntries.length
    : 0;

  const statValues: Record<string, number | string> = {
    totalPayable: Math.round(filteredTotalPayable * 100) / 100,
    totalActiveHours: Math.round(filteredTotalHours * 100) / 100,
    averageHourlyRate: Math.round(filteredAvgRate * 100) / 100,
    employeeCount: filteredEntries.length,
  };

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Controls Row */}
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Segmented
            options={['Weekly', 'Monthly']}
            value={viewMode}
            onChange={(val) => setViewMode(val as ViewMode)}
          />
        </Col>
        <Col>
          <DatePicker
            picker={viewMode === 'Weekly' ? 'week' : 'month'}
            value={selectedDate}
            onChange={(date) => {
              if (date) setSelectedDate(date);
            }}
            style={{ borderRadius: 'var(--radius-sm)' }}
          />
        </Col>
        <Col>
          <Select
            allowClear
            showSearch
            placeholder="All Employees"
            value={selectedEmployee}
            onChange={(val) => setSelectedEmployee(val)}
            style={{ width: 220, borderRadius: 'var(--radius-sm)' }}
            suffixIcon={<UserOutlined />}
            filterOption={(input, option) =>
              (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={employees.map((emp) => ({
              value: emp.id,
              label: `${emp.firstName} ${emp.lastName}`,
            }))}
          />
        </Col>
        <Col flex="auto" style={{ textAlign: 'right' }}>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportCsv}
            style={{
              borderRadius: 'var(--radius-md)',
              borderColor: 'var(--primary)',
              color: 'var(--primary)',
              fontWeight: 500,
            }}
          >
            Export CSV
          </Button>
        </Col>
      </Row>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {statCards.map((card) => (
              <Col xs={24} sm={12} lg={6} key={card.key}>
                <Card
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-xs)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  bodyStyle={{ padding: 20 }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                        {card.title}
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: card.valueColor, lineHeight: 1.2 }}>
                        {card.key === 'totalPayable' || card.key === 'averageHourlyRate'
                          ? formatCurrency(statValues[card.key] as number)
                          : card.key === 'totalActiveHours'
                          ? `${(statValues[card.key] as number).toFixed(1)} hrs`
                          : statValues[card.key]}
                      </div>
                    </div>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 'var(--radius-md)',
                        background: card.iconBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {card.icon}
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Table Card */}
          <Card
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-xs)',
            }}
            bodyStyle={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}
          >
            <Table
              dataSource={filteredEntries}
              columns={columns}
              rowKey="userId"
              pagination={false}
              rowClassName={() => 'payroll-row'}
              summary={() => {
                if (filteredEntries.length === 0) return null;
                const totalHrs = filteredEntries.reduce((s, e) => s + e.activeHours, 0);
                const totalPay = filteredEntries.reduce((s, e) => s + e.payableAmount, 0);
                const avgRate = filteredEntries.reduce((s, e) => s + e.hourlyRate, 0) / filteredEntries.length;
                return (
                  <Table.Summary.Row className="payroll-summary-row">
                    <Table.Summary.Cell index={0}>
                      <span style={{ fontWeight: 700, color: '#166534' }}>Total</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} />
                    <Table.Summary.Cell index={2}>
                      <span style={{ fontWeight: 700, color: '#166534' }}>
                        {formatDuration(totalHrs * 3600)}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      <span style={{ fontWeight: 700, color: '#166534' }}>
                        {formatCurrency(Math.round(avgRate * 100) / 100)} avg
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>
                      <span style={{ fontWeight: 700, color: '#10b981', fontSize: 16 }}>
                        {formatCurrency(Math.round(totalPay * 100) / 100)}
                      </span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </Card>
        </>
      )}
    </div>
  );
}
