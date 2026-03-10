import { MotionCard } from "../ui/motion";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
    Alert,
    Avatar,
    CardContent,
    Chip,
    Grid,
    MenuItem,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthProvider";
import { AppLoader } from "../components/AppLoader";
import { ChartPanel } from "../components/ChartPanel";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type PlatformErrorsResponse,
    type PlatformInfrastructureMetrics,
    type PlatformInfrastructureMetricsResponse,
    type PlatformSlowEndpointRow,
    type PlatformSlowEndpointsResponse,
    type PlatformSystemMetrics,
    type PlatformSystemMetricsResponse,
    type PlatformTenantTrafficResponse,
    type PlatformTenantTrafficRow,
    type PlatformTenantsResponse
} from "../lib/endpoints";
import { formatDate } from "../utils/format";

type Scope = "system" | "tenant";
type SortBy = "traffic" | "errors" | "latency";
type SortDir = "asc" | "desc";

interface TenantOption {
    id: string;
    name: string;
}

interface ErrorRow {
    timestamp: string;
    endpoint: string;
    status_code: number;
    tenant_id: string | null;
    tenant_name?: string;
    message: string;
}

function MetricCard({
    label,
    value,
    helper,
    icon
}: {
    label: string;
    value: string;
    helper: string;
    icon: React.ReactNode;
}) {
    return (
        <MotionCard variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Stack spacing={1}>
                        <Typography variant="overline" color="text.secondary">{label}</Typography>
                        <Typography variant="h4">{value}</Typography>
                        <Typography variant="body2" color="text.secondary">{helper}</Typography>
                    </Stack>
                    <Avatar sx={{ bgcolor: "action.hover", color: "text.primary" }}>
                        {icon}
                    </Avatar>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

function formatNumber(value?: number | null, digits = 2) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) {
        return "0";
    }
    return numeric.toFixed(digits);
}

function formatPercent(value?: number | null) {
    return `${formatNumber(value, 2)}%`;
}

function formatLatency(value?: number | null) {
    return `${formatNumber(value, 1)} ms`;
}

function buildGaugeData(value: number, max: number, color: string) {
    const safeMax = Math.max(max, 1);
    const ratio = Math.min(Math.max(value / safeMax, 0), 1);
    const used = Number((ratio * 100).toFixed(2));
    const remaining = Number((100 - used).toFixed(2));

    return {
        labels: ["Used", "Remaining"],
        datasets: [
            {
                data: [used, remaining],
                backgroundColor: [color, "rgba(148,163,184,0.22)"],
                borderWidth: 0
            }
        ]
    };
}

export function PlatformOperationsPage() {
    const { pushToast } = useToast();
    const { selectedTenantId: activeTenantId } = useAuth();

    const [scope, setScope] = useState<Scope>("system");
    const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
    const [monitoredTenantId, setMonitoredTenantId] = useState<string>("");
    const [sortBy, setSortBy] = useState<SortBy>("traffic");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [loading, setLoading] = useState(true);

    const [systemMetrics, setSystemMetrics] = useState<PlatformSystemMetrics | null>(null);
    const [tenantTraffic, setTenantTraffic] = useState<PlatformTenantTrafficRow[]>([]);
    const [infrastructure, setInfrastructure] = useState<PlatformInfrastructureMetrics | null>(null);
    const [errors, setErrors] = useState<ErrorRow[]>([]);
    const [slowEndpoints, setSlowEndpoints] = useState<PlatformSlowEndpointRow[]>([]);

    const scopedTenantId = scope === "tenant" ? monitoredTenantId || undefined : undefined;

    const loadTenantOptions = useCallback(async () => {
        try {
            const { data } = await api.get<PlatformTenantsResponse>(endpoints.platform.tenants(), {
                params: { page: 1, limit: 100 }
            });

            const rows = (data.data || []).map((tenant) => ({
                id: tenant.id,
                name: tenant.name
            }));

            setTenantOptions(rows);

            if (!monitoredTenantId) {
                const fallback = activeTenantId || rows[0]?.id || "";
                if (fallback) {
                    setMonitoredTenantId(fallback);
                }
            }
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load tenants",
                message: getApiErrorMessage(error)
            });
        }
    }, [activeTenantId, monitoredTenantId, pushToast]);

    const loadOperationsData = useCallback(async () => {
        if (scope === "tenant" && !monitoredTenantId) {
            return;
        }

        setLoading(true);

        try {
            const sharedParams = {
                tenant_id: scopedTenantId,
                window_minutes: 60
            };

            const [systemResponse, tenantResponse, infrastructureResponse, errorsResponse, slowResponse] = await Promise.all([
                api.get<PlatformSystemMetricsResponse>(endpoints.platform.metricsSystem(), {
                    params: sharedParams
                }),
                api.get<PlatformTenantTrafficResponse>(endpoints.platform.metricsTenants(), {
                    params: {
                        ...sharedParams,
                        sort_by: sortBy,
                        sort_dir: sortDir
                    }
                }),
                api.get<PlatformInfrastructureMetricsResponse>(endpoints.platform.metricsInfrastructure(), {
                    params: {
                        tenant_id: scopedTenantId,
                        window_minutes: 1
                    }
                }),
                api.get<PlatformErrorsResponse>(endpoints.platform.errors(), {
                    params: {
                        tenant_id: scopedTenantId,
                        page: 1,
                        limit: 20
                    }
                }),
                api.get<PlatformSlowEndpointsResponse>(endpoints.platform.metricsSlowEndpoints(), {
                    params: {
                        tenant_id: scopedTenantId,
                        window_minutes: 60,
                        limit: 10
                    }
                })
            ]);

            setSystemMetrics(systemResponse.data.data);
            setTenantTraffic(tenantResponse.data.data || []);
            setInfrastructure(infrastructureResponse.data.data);
            setErrors(errorsResponse.data.data || []);
            setSlowEndpoints(slowResponse.data.data || []);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load platform operations data",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoading(false);
        }
    }, [scope, monitoredTenantId, scopedTenantId, sortBy, sortDir, pushToast]);

    useEffect(() => {
        void loadTenantOptions();
    }, [loadTenantOptions]);

    useEffect(() => {
        if (scope === "tenant" && !monitoredTenantId && tenantOptions.length) {
            setMonitoredTenantId(activeTenantId || tenantOptions[0].id);
        }
    }, [activeTenantId, monitoredTenantId, scope, tenantOptions]);

    useEffect(() => {
        void loadOperationsData();
    }, [loadOperationsData]);

    const lineLabels = useMemo(
        () => (systemMetrics?.timeseries || []).map((point) =>
            new Date(point.timestamp).toLocaleTimeString("en-TZ", { hour: "2-digit", minute: "2-digit" })
        ),
        [systemMetrics]
    );

    const requestRateData = useMemo(() => ({
        labels: lineLabels,
        datasets: [
            {
                label: "Requests/sec",
                data: (systemMetrics?.timeseries || []).map((point) => point.requests_per_sec),
                borderColor: "#1f77ff",
                backgroundColor: "rgba(31,119,255,0.14)",
                tension: 0.3,
                fill: true
            }
        ]
    }), [lineLabels, systemMetrics]);

    const latencyData = useMemo(() => ({
        labels: lineLabels,
        datasets: [
            {
                label: "P95 latency (ms)",
                data: (systemMetrics?.timeseries || []).map((point) => point.p95_latency_ms),
                borderColor: "#f59e0b",
                backgroundColor: "rgba(245,158,11,0.14)",
                tension: 0.3,
                fill: true
            }
        ]
    }), [lineLabels, systemMetrics]);

    const errorRateData = useMemo(() => ({
        labels: lineLabels,
        datasets: [
            {
                label: "Error rate %",
                data: (systemMetrics?.timeseries || []).map((point) => point.error_rate_pct),
                borderColor: "#ef4444",
                backgroundColor: "rgba(239,68,68,0.14)",
                tension: 0.3,
                fill: true
            }
        ]
    }), [lineLabels, systemMetrics]);

    const gaugeCharts = useMemo(() => {
        const cpu = Number(infrastructure?.cpu_pct || 0);
        const memory = Number(infrastructure?.memory_pct || 0);
        const disk = Number(infrastructure?.disk_pct || 0);
        const networkMbps = Number(infrastructure?.network_mbps || 0);
        const networkBudget = 100;

        return [
            {
                title: "CPU Usage",
                subtitle: formatPercent(cpu),
                data: buildGaugeData(cpu, 100, "#7c3aed")
            },
            {
                title: "RAM Usage",
                subtitle: formatPercent(memory),
                data: buildGaugeData(memory, 100, "#0284c7")
            },
            {
                title: "Disk Usage",
                subtitle: formatPercent(disk),
                data: buildGaugeData(disk, 100, "#f97316")
            },
            {
                title: "Network Throughput",
                subtitle: `${formatNumber(networkMbps, 2)} Mbps (100 Mbps budget)`,
                data: buildGaugeData(networkMbps, networkBudget, "#0f766e")
            }
        ];
    }, [infrastructure]);

    const tenantColumns: Column<PlatformTenantTrafficRow>[] = [
        {
            key: "tenant",
            header: "Tenant",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={700}>{row.tenant_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.tenant_id}</Typography>
                </Stack>
            )
        },
        { key: "requests", header: "Requests", render: (row) => row.request_count.toLocaleString() },
        { key: "errors", header: "Errors", render: (row) => row.error_count.toLocaleString() },
        { key: "latency", header: "Avg Latency", render: (row) => formatLatency(row.avg_latency_ms) },
        { key: "users", header: "Active Users", render: (row) => row.active_users.toLocaleString() }
    ];

    const errorColumns: Column<ErrorRow>[] = [
        { key: "time", header: "Time", render: (row) => formatDate(row.timestamp) },
        { key: "endpoint", header: "Endpoint", render: (row) => row.endpoint },
        {
            key: "status",
            header: "Status",
            render: (row) => (
                <Chip
                    size="small"
                    label={String(row.status_code)}
                    color={row.status_code >= 500 ? "error" : "warning"}
                    variant="outlined"
                />
            )
        },
        {
            key: "tenant",
            header: "Tenant",
            render: (row) => row.tenant_name || row.tenant_id || "System"
        },
        { key: "message", header: "Error Message", render: (row) => row.message }
    ];

    const slowColumns: Column<PlatformSlowEndpointRow>[] = [
        { key: "endpoint", header: "Endpoint", render: (row) => row.endpoint },
        { key: "avg", header: "Avg Latency", render: (row) => formatLatency(row.avg_latency_ms) },
        { key: "calls", header: "Calls", render: (row) => row.calls.toLocaleString() }
    ];

    const selectedTenantName = tenantOptions.find((tenant) => tenant.id === monitoredTenantId)?.name || "-";

    if (loading && !systemMetrics) {
        return <AppLoader fullscreen={false} minHeight={420} message="Loading platform operations dashboard..." />;
    }

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={2}>
                        <Stack spacing={1}>
                            <Typography variant="h4">Platform Operations</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 840 }}>
                                Monitor API health, server load, tenant traffic, and incident signals from a single SaaS owner control room.
                            </Typography>
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <TextField
                                select
                                size="small"
                                label="Scope"
                                value={scope}
                                onChange={(event) => setScope(event.target.value as Scope)}
                                sx={{ minWidth: 160 }}
                            >
                                <MenuItem value="system">System-wide</MenuItem>
                                <MenuItem value="tenant">Per-tenant</MenuItem>
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Tenant"
                                value={monitoredTenantId}
                                onChange={(event) => setMonitoredTenantId(event.target.value)}
                                disabled={scope !== "tenant"}
                                sx={{ minWidth: 280 }}
                            >
                                {tenantOptions.map((tenant) => (
                                    <MenuItem key={tenant.id} value={tenant.id}>{tenant.name}</MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                        <Chip label={`Mode: ${scope === "system" ? "System-wide" : "Per-tenant"}`} color="primary" variant="outlined" />
                        {scope === "tenant" ? <Chip label={`Tenant: ${selectedTenantName}`} variant="outlined" /> : null}
                    </Stack>
                </CardContent>
            </MotionCard>

            {!tenantOptions.length && scope === "tenant" ? (
                <Alert severity="warning" variant="outlined">
                    No tenants available to monitor in per-tenant mode.
                </Alert>
            ) : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        label="Requests / sec"
                        value={formatNumber(systemMetrics?.requests_per_sec, 2)}
                        helper="Current request throughput"
                        icon={<InsightsRoundedIcon />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        label="API p95 latency"
                        value={formatLatency(systemMetrics?.p95_latency_ms)}
                        helper="Observed p95 response time"
                        icon={<SpeedRoundedIcon />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        label="API error rate"
                        value={formatPercent(systemMetrics?.error_rate_pct)}
                        helper="5xx error ratio in current window"
                        icon={<WarningAmberRoundedIcon />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        label="Active users / tenants"
                        value={`${systemMetrics?.active_users || 0} / ${systemMetrics?.active_tenants || 0}`}
                        helper="Active entities in current window"
                        icon={<LanRoundedIcon />}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <ChartPanel
                        title="API Request Rate"
                        subtitle="Requests per second over time"
                        type="line"
                        data={requestRateData}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <ChartPanel
                        title="API Latency (p95)"
                        subtitle="P95 latency trend"
                        type="line"
                        data={latencyData}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <ChartPanel
                        title="Error Rate %"
                        subtitle="Server error ratio trend"
                        type="line"
                        data={errorRateData}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                {gaugeCharts.map((item) => (
                    <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
                        <ChartPanel
                            title={item.title}
                            subtitle={item.subtitle}
                            type="doughnut"
                            data={item.data}
                            height={220}
                        />
                    </Grid>
                ))}
            </Grid>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                        <Stack spacing={0.5}>
                            <Typography variant="h6">Tenant Traffic Monitor</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Compare tenant traffic, error concentration, and average response latency.
                            </Typography>
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <TextField
                                select
                                size="small"
                                label="Sort by"
                                value={sortBy}
                                onChange={(event) => setSortBy(event.target.value as SortBy)}
                                sx={{ minWidth: 150 }}
                            >
                                <MenuItem value="traffic">Traffic</MenuItem>
                                <MenuItem value="errors">Errors</MenuItem>
                                <MenuItem value="latency">Latency</MenuItem>
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="Direction"
                                value={sortDir}
                                onChange={(event) => setSortDir(event.target.value as SortDir)}
                                sx={{ minWidth: 130 }}
                            >
                                <MenuItem value="desc">Desc</MenuItem>
                                <MenuItem value="asc">Asc</MenuItem>
                            </TextField>
                        </Stack>
                    </Stack>
                    <DataTable rows={tenantTraffic} columns={tenantColumns} emptyMessage="No tenant traffic metrics available." />
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, xl: 8 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>Recent Errors and Incidents</Typography>
                            <DataTable rows={errors} columns={errorColumns} emptyMessage="No recent API errors recorded." />
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, xl: 4 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>Slow Endpoints</Typography>
                            <DataTable rows={slowEndpoints} columns={slowColumns} emptyMessage="No endpoint latency data available." />
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>
        </Stack>
    );
}
