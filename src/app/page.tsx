'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { Users, CheckCircle, TrendingUp, PieChart as PieChartIcon, Send, MessageSquare } from 'lucide-react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  Legend
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Carregando painel...</div>
      </div>
    );
  }

  const conversionData = stats ? [
    { name: 'Converted', value: parseFloat(stats.conversionRate || '0') },
    { name: 'Remaining', value: Math.max(0, 100 - parseFloat(stats.conversionRate || '0')) }
  ] : [];

  const COLORS_CONVERSION = ['#8b5cf6', '#e2e8f0'];

  const matriculaProgress = stats?.metaMatriculas > 0
    ? Math.min(100, (stats.matriculados / stats.metaMatriculas) * 100)
    : 0;

  const progressData = [
    { name: 'Progress', value: matriculaProgress },
    { name: 'Remaining', value: 100 - matriculaProgress }
  ];

  const COLORS_PROGRESS = ['#10b981', '#e2e8f0'];

  const efficiencyData = stats ? [
    { name: 'Leads/Matrícula', value: parseFloat(stats.leadToMatriculaRatio || '0') },
    { name: 'Inscritos/Matrícula', value: parseFloat(stats.inscritoToMatriculaRatio || '0') }
  ] : [];

  const comercialConversionData = [
    { name: 'Converted', value: parseFloat(stats?.taxaConversaoComercial || '0') },
    { name: 'Remaining', value: Math.max(0, 100 - parseFloat(stats?.taxaConversaoComercial || '0')) }
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Visão Geral</h1>
          <p className={styles.subtitle}>Bem-vindo de volta, Admin</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.dateButton}>
            This Month
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Total de Leads</span>
            <div className={`${styles.iconBox} ${styles.blueIcon}`}>
              <Users size={20} />
            </div>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats?.total || 0}</span>
            <span className={styles.kpiTrend}>+12% from last month</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Matriculados</span>
            <div className={`${styles.iconBox} ${styles.greenIcon}`}>
              <CheckCircle size={20} />
            </div>
          </div>
          <div className={styles.kpiContent} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className={styles.kpiValue}>
                {stats?.matriculados || 0}
                <span style={{ fontSize: '0.5em', color: '#94a3b8', marginLeft: '8px' }}>
                  / {stats?.metaMatriculas || 0}
                </span>
              </span>
              <span className={styles.kpiTrend}>
                {stats?.metaMatriculas > 0
                  ? `${((stats.matriculados / stats.metaMatriculas) * 100).toFixed(0)}% da meta`
                  : 'Sem meta definida'}
              </span>
            </div>
            <div style={{ width: 60, height: 60 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={progressData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={30}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    {progressData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_PROGRESS[index % COLORS_PROGRESS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Taxa de Aproveitamento</span>
            <div className={`${styles.iconBox} ${styles.purpleIcon}`}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className={styles.kpiContent} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className={styles.kpiValue}>{stats?.conversionRate}%</span>
              <span className={styles.kpiTrend}>Meta: 15%</span>
            </div>
            <div style={{ width: 60, height: 60 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conversionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={30}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    {conversionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_CONVERSION[index % COLORS_CONVERSION.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>


        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Leads p/ Matrícula</span>
            <div className={`${styles.iconBox} ${styles.blueIcon}`}>
              <PieChartIcon size={20} />
            </div>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats?.leadToMatriculaRatio}</span>
            <span className={styles.kpiTrend}>Leads+Inscritos / Matrículas</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Inscritos p/ Matrícula</span>
            <div className={`${styles.iconBox} ${styles.greenIcon}`}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats?.inscritoToMatriculaRatio}</span>
            <span className={styles.kpiTrend}>Inscritos / Matrículas</span>
          </div>
        </div>

        {/* NEW: Encaminhados ao Comercial */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Encaminhados ao Comercial</span>
            <div className={`${styles.iconBox} ${styles.purpleIcon}`}>
              <Send size={20} />
            </div>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats?.encaminhadosComercial || 0}</span>
            <span className={styles.kpiTrend}>Leads enviados para o comercial</span>
          </div>
        </div>

        {/* NEW: Conversão Comercial */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Conversão Comercial</span>
            <div className={`${styles.iconBox} ${styles.greenIcon}`}>
              <CheckCircle size={20} />
            </div>
          </div>
          <div className={styles.kpiContent} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className={styles.kpiValue}>
                {stats?.encaminhadosMatriculados || 0}
                <span style={{ fontSize: '0.5em', color: '#94a3b8', marginLeft: '8px' }}>
                  / {stats?.encaminhadosComercial || 0}
                </span>
              </span>
              <span className={styles.kpiTrend}>
                {stats?.taxaConversaoComercial || '0.0'}% de conversão
              </span>
            </div>
            <div style={{ width: 60, height: 60 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={comercialConversionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={30}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#e2e8f0" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* NEW: Total de Mensagens Enviadas */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Mensagens Enviadas</span>
            <div className={`${styles.iconBox} ${styles.blueIcon}`}>
              <MessageSquare size={20} />
            </div>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{stats?.totalMessagesSent?.toLocaleString('pt-BR') || 0}</span>
            <span className={styles.kpiTrend}>
              WhatsApp: {stats?.whatsappMessagesSent || 0} | Templates: {stats?.templatesSent || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className={styles.chartsGrid}>
        {/* Funnel Chart */}
        <div className={styles.chartCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Funil de Vendas</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.funnelChart}>
              {stats?.funnel?.map((step: any, index: number) => {
                const maxVal = stats.funnel[0].value || 1;
                const width = (step.value / maxVal) * 100;

                return (
                  <div key={step.label} className={styles.funnelRow}>
                    <div className={styles.funnelLabel}>
                      <span className={styles.funnelStepName}>{step.label}</span>
                      <span className={styles.funnelStepValue}>{step.value}</span>
                    </div>
                    <div className={styles.funnelBarContainer}>
                      <div
                        className={styles.funnelBar}
                        style={{
                          width: `${width}%`,
                          background: step.color,
                          opacity: 0.9
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Distribuição de Status</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.barChart}>
              {stats?.statusCounts.map((item: any) => {
                const percentage = stats.total > 0 ? (item.count / stats.total) * 100 : 0;
                return (
                  <div key={item.status} className={styles.barRow}>
                    <div className={styles.barLabel}>
                      <span>{item.status || 'Sem Status'}</span>
                      <span className={styles.barCount}>{item.count}</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {stats?.statusCounts.length === 0 && (
                <p className={styles.emptyText}>Nenhum dado disponível</p>
              )}
            </div>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Métricas de Eficiência</h3>
          </div>
          <div className={styles.cardBody} style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={efficiencyData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} />
                <RechartsTooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div >
  );
}
