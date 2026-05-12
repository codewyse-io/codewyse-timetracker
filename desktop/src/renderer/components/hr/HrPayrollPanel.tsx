import { useEffect, useState, useCallback } from 'react';
import { Spin, message, DatePicker } from 'antd';
import {
  DollarOutlined,
  ReloadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { getPayrollSummary } from '../../api/client';

interface PayrollEntry {
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  activeHours: number;
  hourlyRate: number;
  payableAmount: number;
}

interface PayrollSummary {
  startDate: string;
  endDate: string;
  totalEmployees: number;
  employeeCount: number;
  totalActiveHours: number;
  totalPayable: number;
  averageHourlyRate: number;
  entries: PayrollEntry[];
}

function fmtCurrency(n: number): string {
  return `$${(n || 0).toFixed(2)}`;
}

function fmtHours(n: number): string {
  if (!n) return '0h';
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

type Mode = 'weekly' | 'monthly';

export default function HrPayrollPanel() {
  const [mode, setMode] = useState<Mode>('weekly');
  const [anchor, setAnchor] = useState<Dayjs>(dayjs());
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);

  const startDate =
    mode === 'weekly' ? anchor.startOf('week').format('YYYY-MM-DD') : anchor.startOf('month').format('YYYY-MM-DD');
  const endDate =
    mode === 'weekly' ? anchor.endOf('week').format('YYYY-MM-DD') : anchor.endOf('month').format('YYYY-MM-DD');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPayrollSummary(startDate, endDate);
      const data = res?.data ?? res;
      setSummary(data || null);
    } catch (err: any) {
      message.error(`Failed to load payroll: ${err?.response?.data?.message || err?.message || 'unknown'}`);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    if (!summary || summary.entries.length === 0) {
      message.warning('Nothing to export');
      return;
    }
    const headers = ['Employee', 'Email', 'Role', 'Active Hours', 'Hourly Rate', 'Payable'];
    const csv = [
      headers.join(','),
      ...summary.entries.map((e) =>
        [
          `${e.user.firstName} ${e.user.lastName}`,
          e.user.email,
          e.user.role,
          e.activeHours.toFixed(2),
          e.hourlyRate.toFixed(2),
          e.payableAmount.toFixed(2),
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${mode}-${dayjs(startDate).format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 20 }}>
      {/* Filters */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={tabBar}>
              {(['weekly', 'monthly'] as const).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      ...tabBtn,
                      background: active ? 'rgba(124, 92, 252, 0.18)' : 'transparent',
                      color: active ? '#c4b5fd' : 'rgba(255,255,255,0.55)',
                    }}
                  >
                    {m === 'weekly' ? 'Weekly' : 'Monthly'}
                  </button>
                );
              })}
            </div>
            {mode === 'weekly' ? (
              <DatePicker
                size="small"
                picker="week"
                value={anchor}
                onChange={(d) => d && setAnchor(d)}
                allowClear={false}
              />
            ) : (
              <DatePicker
                size="small"
                picker="month"
                value={anchor}
                onChange={(d) => d && setAnchor(d)}
                allowClear={false}
              />
            )}
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
              {dayjs(startDate).format('MMM D')} → {dayjs(endDate).format('MMM D, YYYY')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={load} style={btnSecondary} title="Refresh">
              <ReloadOutlined spin={loading} /> Refresh
            </button>
            <button onClick={exportCsv} style={btnPrimary}>
              <DownloadOutlined /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Spin />
        </div>
      ) : !summary ? (
        <div style={{ ...panelStyle, textAlign: 'center', padding: 32 }}>
          <DollarOutlined style={{ fontSize: 28, color: 'rgba(255,255,255,0.25)', display: 'block', marginBottom: 10 }} />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>No payroll data for this period.</span>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
              marginBottom: 14,
            }}
          >
            <Kpi label="Total Payable" value={fmtCurrency(summary.totalPayable)} accent="#34d399" />
            <Kpi label="Active Hours" value={fmtHours(summary.totalActiveHours)} accent="#5b8def" />
            <Kpi label="Avg Rate" value={fmtCurrency(summary.averageHourlyRate)} accent="#c4b5fd" />
            <Kpi label="Employees" value={String(summary.employeeCount ?? summary.totalEmployees ?? 0)} />
          </div>

          {/* Entries table */}
          <div style={{ ...panelStyle, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Employee', 'Role', 'Active', 'Rate', 'Payable'].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.entries.map((e) => (
                  <tr key={e.userId}>
                    <td style={cell}>
                      <span style={{ fontWeight: 600, color: '#fff' }}>
                        {e.user.firstName} {e.user.lastName}
                      </span>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{e.user.email}</div>
                    </td>
                    <td style={cell}>
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, textTransform: 'capitalize' }}>
                        {e.user.role}
                      </span>
                    </td>
                    <td style={cell}>
                      <span style={{ color: '#5b8def' }}>{fmtHours(e.activeHours)}</span>
                    </td>
                    <td style={cell}>{fmtCurrency(e.hourlyRate)}</td>
                    <td style={cell}>
                      <span style={{ color: '#34d399', fontWeight: 700 }}>{fmtCurrency(e.payableAmount)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ ...panelStyle, padding: 14, marginBottom: 0 }}>
      <div
        style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: 0.05,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || '#fff', letterSpacing: '-0.3px' }}>
        {value}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 12,
  padding: 12,
  marginBottom: 14,
};

const tabBar: React.CSSProperties = {
  display: 'inline-flex',
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 10,
  padding: 4,
  gap: 2,
};

const tabBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  transition: 'all 0.15s ease',
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  color: 'rgba(255,255,255,0.4)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.05,
  fontWeight: 700,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const cell: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: 'rgba(255,255,255,0.75)',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
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

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  borderRadius: 8,
  background: 'linear-gradient(135deg, #7c5cfc, #5b8def)',
  border: 'none',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};
