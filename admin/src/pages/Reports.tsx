import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Row,
  Col,
  DatePicker,
  Button,
  Modal,
  Space,
  Spin,
  message,
} from 'antd';
import {
  DownloadOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

import type { WeeklyReport } from '../types';
import { reportsApi } from '../api/reports.api';
import {
  formatDuration,
  formatCurrency,
  formatDate,
  getFocusScoreColor,
  getFocusScoreCategory,
} from '../utils/format';
import { downloadBlob } from '../utils/export';
import { useOrg } from '../contexts/OrgContext';

function FocusBadge({ score }: { score: number }) {
  const color = getFocusScoreColor(score);
  const label = getFocusScoreCategory(score);
  const bgMap: Record<string, string> = {
    green: '#f0fdf4',
    orange: '#fff7ed',
    red: '#fef2f2',
    blue: '#eff6ff',
    default: '#f8fafc',
  };
  const textMap: Record<string, string> = {
    green: '#166534',
    orange: '#92400e',
    red: '#991b1b',
    blue: '#1e40af',
    default: '#475569',
  };
  const borderMap: Record<string, string> = {
    green: '#bbf7d0',
    orange: '#fed7aa',
    red: '#fecaca',
    blue: '#bfdbfe',
    default: 'var(--border-default)',
  };

  return (
    <span
      style={{
        background: bgMap[color] || bgMap.default,
        color: textMap[color] || textMap.default,
        border: `1px solid ${borderMap[color] || borderMap.default}`,
        borderRadius: 'var(--radius-full)',
        padding: '3px 12px',
        fontSize: 12,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: textMap[color] || textMap.default,
          display: 'inline-block',
        }}
      />
      {score} · {label}
    </span>
  );
}

export default function ReportsPage() {
  const { org } = useOrg();
  const [weekDate, setWeekDate] = useState<Dayjs>(dayjs());
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const weekStart = weekDate.startOf('week').format('YYYY-MM-DD');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getWeeklyReports({
        weekStart,
        page,
        limit,
      });
      setReports(res.data.data);
      setTotal(res.data.total);
    } catch {
      message.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [weekStart, page, limit]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await reportsApi.generateReports(weekStart);
      message.success('Reports generated successfully');
      fetchReports();
    } catch {
      message.error('Failed to generate reports');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await reportsApi.exportCsv(weekStart);
      downloadBlob(blob, `report-${weekStart}.csv`);
    } catch {
      message.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const blob = await reportsApi.exportPdf(weekStart);
      downloadBlob(blob, `report-${weekStart}.pdf`);
    } catch {
      message.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleRowClick = async (report: WeeklyReport) => {
    try {
      const res = await reportsApi.getReportById(report.id);
      setSelectedReport(res.data);
    } catch {
      setSelectedReport(report);
    }
    setDetailOpen(true);
  };

  const columns: ColumnsType<WeeklyReport> = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, record) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
          {record.user
            ? `${record.user.firstName} ${record.user.lastName}`
            : record.userId}
        </span>
      ),
    },
    {
      title: 'Total Hours',
      dataIndex: 'totalHoursWorked',
      key: 'totalHours',
      render: (val: number) => (
        <span style={{ color: 'var(--text-secondary)' }}>{formatDuration((val || 0) * 3600)}</span>
      ),
      sorter: (a, b) => (a.totalHoursWorked || 0) - (b.totalHoursWorked || 0),
    },
    {
      title: 'Active Hours',
      dataIndex: 'activeHours',
      key: 'activeHours',
      render: (val: number) => (
        <span style={{ color: '#10b981', fontWeight: 500 }}>{formatDuration((val || 0) * 3600)}</span>
      ),
      sorter: (a, b) => (a.activeHours || 0) - (b.activeHours || 0),
    },
    {
      title: 'Idle Hours',
      dataIndex: 'idleHours',
      key: 'idleHours',
      render: (val: number) => (
        <span style={{ color: 'var(--text-muted)' }}>{formatDuration((val || 0) * 3600)}</span>
      ),
      sorter: (a, b) => (a.idleHours || 0) - (b.idleHours || 0),
    },
    {
      title: 'Focus Score',
      dataIndex: 'focusScore',
      key: 'focusScore',
      render: (val: number) => <FocusBadge score={val} />,
      sorter: (a, b) => (a.focusScore || 0) - (b.focusScore || 0),
    },
    {
      title: 'KPI Summary',
      dataIndex: 'kpiSummary',
      key: 'kpiSummary',
      render: (val: Record<string, unknown> | null) => {
        if (!val || typeof val !== 'object') return (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>N/A</span>
        );
        const entries = Object.entries(val);
        if (entries.length === 0) return (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>N/A</span>
        );
        return (
          <Space direction="vertical" size={3}>
            {entries.slice(0, 3).map(([key, value]) => (
              <span
                key={key}
                style={{
                  background: 'var(--surface-sunken)',
                  color: 'var(--text-secondary)',
                  borderRadius: 5,
                  padding: '1px 8px',
                  fontSize: 11,
                  fontWeight: 500,
                  display: 'inline-block',
                }}
              >
                {key}: {String(value)}
              </span>
            ))}
            {entries.length > 3 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>+{entries.length - 3} more</span>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Payable Amount',
      dataIndex: 'payableAmount',
      key: 'payableAmount',
      render: (val: number) => (
        <span style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(val || 0, org?.currency || 'USD')}</span>
      ),
      sorter: (a, b) => (a.payableAmount || 0) - (b.payableAmount || 0),
    },
  ];

  // Build mock daily data for the detail modal chart
  const buildDailyChartData = (report: WeeklyReport) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const avgDaily = (report.totalHoursWorked || 0) / 5;
    return days.map((day) => ({
      day,
      hours: Math.max(0, avgDaily * (0.7 + Math.random() * 0.6)),
    }));
  };

  const buildFocusTrend = (report: WeeklyReport) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const base = report.focusScore || 50;
    return days.map((day) => ({
      day,
      score: Math.max(0, Math.min(100, base + (Math.random() - 0.5) * 20)),
    }));
  };

  return (
    <div style={{ animation: 'fadeInUp 0.35s ease-out' }}>
      {/* Controls */}
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <DatePicker
            picker="week"
            value={weekDate}
            onChange={(date) => {
              if (date) {
                setWeekDate(date);
                setPage(1);
              }
            }}
            style={{ borderRadius: 'var(--radius-sm)' }}
          />
        </Col>
        <Col flex="auto" style={{ textAlign: 'right' }}>
          <Space>
            <Button
              type="primary"
              loading={generating}
              onClick={handleGenerate}
              style={{
                borderRadius: 10,
                fontWeight: 600,
                background: 'var(--primary)',
                border: 'none',
              }}
            >
              {generating ? 'Generating...' : 'Generate Reports'}
            </Button>
            <Button
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={handleExportCsv}
              disabled={reports.length === 0}
              style={{
                borderRadius: 10,
                borderColor: 'var(--primary)',
                color: 'var(--primary)',
                fontWeight: 500,
              }}
            >
              Export CSV
            </Button>
            <Button
              icon={<FilePdfOutlined />}
              loading={exporting}
              onClick={handleExportPdf}
              disabled={reports.length === 0}
              style={{
                borderRadius: 10,
                borderColor: '#ef4444',
                color: '#ef4444',
                fontWeight: 500,
              }}
            >
              Export PDF
            </Button>
          </Space>
        </Col>
      </Row>

      <Card
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-xs)',
        }}
        bodyStyle={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Table
            dataSource={reports}
            columns={columns}
            rowKey="id"
            rowClassName={() => 'report-row'}
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              style: { cursor: 'pointer' },
            })}
            pagination={{
              current: page,
              pageSize: limit,
              total,
              onChange: (p) => setPage(p),
              showTotal: (t) => `Total ${t} reports`,
              style: { padding: '12px 16px' },
            }}
          />
        )}
      </Card>

      <Modal
        title={null}
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setSelectedReport(null);
        }}
        footer={null}
        width={840}
        bodyStyle={{ padding: 0 }}
      >
        {selectedReport && (
          <div>
            {/* Modal Header */}
            <div
              style={{
                padding: '24px 28px 20px',
                borderBottom: '1px solid var(--border-light)',
                background: 'var(--surface-sunken)',
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedReport.user
                      ? `${selectedReport.user.firstName} ${selectedReport.user.lastName}`
                      : 'Report Detail'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
                    Week of {formatDate(selectedReport.weekStart)} — {formatDate(selectedReport.weekEnd)}
                  </div>
                </div>
                <FocusBadge score={selectedReport.focusScore} />
              </div>
            </div>

            <div style={{ padding: '20px 28px' }}>
              {/* Summary Stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                {[
                  { label: 'Total Hours', value: formatDuration((selectedReport.totalHoursWorked || 0) * 3600), color: '#6366f1' },
                  { label: 'Active Hours', value: formatDuration((selectedReport.activeHours || 0) * 3600), color: '#10b981' },
                  { label: 'Idle Hours', value: formatDuration((selectedReport.idleHours || 0) * 3600), color: '#94a3b8' },
                  { label: 'Payable Amount', value: formatCurrency(selectedReport.payableAmount || 0, org?.currency || 'USD'), color: '#10b981' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={24} md={12}>
                  <div
                    style={{
                      background: '#fafbff',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      Daily Hours
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={buildDailyChartData(selectedReport)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}
                          cursor={{ fill: 'var(--border-light)' }}
                        />
                        <Bar dataKey="hours" fill="#6366f1" radius={[5, 5, 0, 0]} opacity={0.85} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div
                    style={{
                      background: '#fafbff',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      Focus Score Trend
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={buildFocusTrend(selectedReport)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          dot={{ fill: '#10b981', r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Col>
              </Row>

              {/* KPI Details */}
              {selectedReport.kpiSummary &&
                typeof selectedReport.kpiSummary === 'object' &&
                Object.keys(selectedReport.kpiSummary).length > 0 && (
                  <div
                    style={{
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      KPI Details
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {Object.entries(
                        selectedReport.kpiSummary as Record<string, unknown>
                      ).map(([key, value]) => (
                        <div
                          key={key}
                          style={{
                            background: 'var(--surface-card)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{key}:</span>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
