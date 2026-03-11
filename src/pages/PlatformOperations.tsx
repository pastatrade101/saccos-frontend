import { MotionCard } from "../ui/motion";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import SmsRoundedIcon from "@mui/icons-material/SmsRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
    Alert,
    Avatar,
    Button,
    CardContent,
    Chip,
    Grid,
    MenuItem,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
import { downloadFile } from "../utils/downloadFile";
import { formatDate } from "../utils/format";

type Scope = "system" | "tenant";
type SortBy = "traffic" | "errors" | "latency" | "sms";
type SortDir = "asc" | "desc";
type InsightSeverity = "critical" | "high" | "medium" | "low";

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

interface OptimizationInsight {
    id: string;
    severity: InsightSeverity;
    area: string;
    finding: string;
    recommendation: string;
}

const SEVERITY_RANK: Record<InsightSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
};

const SEVERITY_COLOR: Record<InsightSeverity, "error" | "warning" | "info" | "default"> = {
    critical: "error",
    high: "warning",
    medium: "info",
    low: "default"
};

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

function formatRatioPercent(part: number, total: number) {
    if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
        return "0.00%";
    }
    return `${((part / total) * 100).toFixed(2)}%`;
}

function escapeCsv(value: unknown) {
    if (value === null || value === undefined) {
        return "";
    }
    const text = String(value).replace(/"/g, "\"\"");
    return `"${text}"`;
}

function csvRow(values: unknown[]) {
    return values.map((value) => escapeCsv(value)).join(",");
}

function buildOptimizationInsights({
    systemMetrics,
    infrastructure,
    tenantTraffic,
    slowEndpoints,
    errors
}: {
    systemMetrics: PlatformSystemMetrics | null;
    infrastructure: PlatformInfrastructureMetrics | null;
    tenantTraffic: PlatformTenantTrafficRow[];
    slowEndpoints: PlatformSlowEndpointRow[];
    errors: ErrorRow[];
}) {
    const insights: OptimizationInsight[] = [];

    if (systemMetrics) {
        const errorRate = Number(systemMetrics.error_rate_pct || 0);
        if (errorRate >= 2) {
            insights.push({
                id: "system-error-rate-critical",
                severity: "critical",
                area: "API Reliability",
                finding: `Error rate is ${formatPercent(errorRate)} in the current window.`,
                recommendation: "Inspect recent 5xx errors by endpoint and tenant, then fix top failing route before scaling traffic."
            });
        } else if (errorRate >= 1) {
            insights.push({
                id: "system-error-rate-high",
                severity: "high",
                area: "API Reliability",
                finding: `Error rate is ${formatPercent(errorRate)} in the current window.`,
                recommendation: "Prioritize the most frequent failing endpoint and add defensive retries/timeouts around upstream calls."
            });
        }

        const p95 = Number(systemMetrics.p95_latency_ms || 0);
        if (p95 >= 1200) {
            insights.push({
                id: "system-latency-critical",
                severity: "critical",
                area: "API Performance",
                finding: `System p95 latency is ${formatLatency(p95)}.`,
                recommendation: "Profile slow DB queries and add shared cache (Redis) for hot platform endpoints across backend replicas."
            });
        } else if (p95 >= 700) {
            insights.push({
                id: "system-latency-high",
                severity: "high",
                area: "API Performance",
                finding: `System p95 latency is ${formatLatency(p95)}.`,
                recommendation: "Optimize the top slow endpoints first and review query plans/index coverage."
            });
        } else if (p95 >= 450) {
            insights.push({
                id: "system-latency-medium",
                severity: "medium",
                area: "API Performance",
                finding: `System p95 latency is ${formatLatency(p95)}.`,
                recommendation: "Tune endpoint-level caching and reduce payload size for large list endpoints."
            });
        }

        const smsTotal = Number(systemMetrics.sms_total_count || 0);
        const smsDeliveryRate = Number(systemMetrics.sms_delivery_rate_pct || 0);
        if (smsTotal >= 20 && smsDeliveryRate < 90) {
            insights.push({
                id: "sms-delivery-high",
                severity: "high",
                area: "SMS Delivery",
                finding: `SMS delivery rate is ${formatPercent(smsDeliveryRate)} (${Number(systemMetrics.sms_failed_count || 0).toLocaleString()} failed).`,
                recommendation: "Review provider response codes and retry policy; alert tenants with failing sender IDs/templates."
            });
        } else if (smsTotal >= 20 && smsDeliveryRate < 97) {
            insights.push({
                id: "sms-delivery-medium",
                severity: "medium",
                area: "SMS Delivery",
                finding: `SMS delivery rate is ${formatPercent(smsDeliveryRate)}.`,
                recommendation: "Investigate top tenants with failed SMS and verify channel configuration."
            });
        }
    }

    if (infrastructure) {
        const cpu = Number(infrastructure.cpu_pct || 0);
        const memory = Number(infrastructure.memory_pct || 0);
        const disk = Number(infrastructure.disk_pct || 0);
        const network = Number(infrastructure.network_mbps || 0);

        if (cpu >= 85) {
            insights.push({
                id: "infra-cpu-high",
                severity: cpu >= 92 ? "critical" : "high",
                area: "Infrastructure",
                finding: `CPU usage is ${formatPercent(cpu)}.`,
                recommendation: "Scale backend replicas and profile CPU-heavy routes/background jobs."
            });
        }

        if (memory >= 85) {
            insights.push({
                id: "infra-memory-high",
                severity: memory >= 92 ? "critical" : "high",
                area: "Infrastructure",
                finding: `RAM usage is ${formatPercent(memory)}.`,
                recommendation: "Check process memory growth and reduce large in-memory payloads in report/metrics handlers."
            });
        }

        if (disk >= 80) {
            insights.push({
                id: "infra-disk-high",
                severity: disk >= 90 ? "critical" : "high",
                area: "Infrastructure",
                finding: `Disk usage is ${formatPercent(disk)}.`,
                recommendation: "Purge old report exports/import artifacts and enforce bucket retention lifecycle policies."
            });
        }

        if (network >= 80) {
            insights.push({
                id: "infra-network-medium",
                severity: network >= 95 ? "high" : "medium",
                area: "Infrastructure",
                finding: `Network throughput is ${formatNumber(network, 2)} Mbps.`,
                recommendation: "Compress large responses and reduce polling frequency on high-churn dashboards."
            });
        }
    }

    if (tenantTraffic.length) {
        const totalRequests = tenantTraffic.reduce((sum, row) => sum + Number(row.request_count || 0), 0);
        const activeTenantCount = tenantTraffic.filter((row) => Number(row.request_count || 0) > 0).length;
        const topTrafficTenant = [...tenantTraffic].sort((a, b) => b.request_count - a.request_count)[0];
        const topErrorTenant = [...tenantTraffic]
            .filter((row) => row.request_count > 0 && row.error_count > 0)
            .sort((a, b) => (b.error_count / Math.max(b.request_count, 1)) - (a.error_count / Math.max(a.request_count, 1)))[0];
        const topLatencyTenant = [...tenantTraffic].sort((a, b) => b.avg_latency_ms - a.avg_latency_ms)[0];

        if (topTrafficTenant && totalRequests > 0) {
            const share = topTrafficTenant.request_count / totalRequests;
            if (activeTenantCount >= 3 && share >= 0.45 && topTrafficTenant.request_count >= 100) {
                insights.push({
                    id: "tenant-traffic-concentration",
                    severity: "medium",
                    area: "Tenant Traffic Mix",
                    finding: `${topTrafficTenant.tenant_name} drives ${formatRatioPercent(topTrafficTenant.request_count, totalRequests)} of monitored traffic.`,
                    recommendation: "Consider per-tenant throttling/caching to prevent noisy-tenant impact on global latency."
                });
            }
        }

        if (topErrorTenant) {
            const errorRatio = (topErrorTenant.error_count / Math.max(topErrorTenant.request_count, 1)) * 100;
            if (errorRatio >= 2 && topErrorTenant.error_count >= 5) {
                insights.push({
                    id: "tenant-error-hotspot",
                    severity: "high",
                    area: "Tenant Reliability",
                    finding: `${topErrorTenant.tenant_name} has ${formatPercent(errorRatio)} error ratio (${topErrorTenant.error_count.toLocaleString()} errors).`,
                    recommendation: "Review this tenant’s recent failing endpoints and fix tenant-specific data/config hotspots."
                });
            }
        }

        if (topLatencyTenant && topLatencyTenant.avg_latency_ms >= 800 && topLatencyTenant.request_count >= 30) {
            insights.push({
                id: "tenant-latency-hotspot",
                severity: "high",
                area: "Tenant Performance",
                finding: `${topLatencyTenant.tenant_name} average latency is ${formatLatency(topLatencyTenant.avg_latency_ms)}.`,
                recommendation: "Inspect expensive tenant queries and branch/member list joins; add targeted DB indexes."
            });
        }
    }

    if (slowEndpoints.length) {
        const slowest = slowEndpoints[0];
        if (slowest && slowest.avg_latency_ms >= 700 && slowest.calls >= 20) {
            insights.push({
                id: "endpoint-slowest",
                severity: slowest.avg_latency_ms >= 1200 ? "critical" : "high",
                area: "Endpoint Hotspot",
                finding: `${slowest.endpoint} averages ${formatLatency(slowest.avg_latency_ms)} across ${slowest.calls.toLocaleString()} calls.`,
                recommendation: "Optimize this endpoint first (query plan, pagination strategy, precomputed aggregates, cache)."
            });
        }
    }

    if (errors.length) {
        const endpointCounts = new Map<string, number>();
        errors.forEach((row) => {
            if (Number(row.status_code || 0) < 500) {
                return;
            }
            const key = `${row.endpoint}|${row.status_code}`;
            endpointCounts.set(key, (endpointCounts.get(key) || 0) + 1);
        });

        const frequent = [...endpointCounts.entries()].sort((a, b) => b[1] - a[1])[0];
        if (frequent && frequent[1] >= 3) {
            const [endpoint, statusCode] = frequent[0].split("|");
            insights.push({
                id: "repeated-incident",
                severity: "high",
                area: "Incident Pattern",
                finding: `${endpoint} returned ${statusCode} ${frequent[1]} times in recent incidents.`,
                recommendation: "Create a focused fix ticket for this endpoint and add alerting threshold to catch recurrence early."
            });
        }
    }

    return insights
        .sort((left, right) => {
            if (SEVERITY_RANK[left.severity] !== SEVERITY_RANK[right.severity]) {
                return SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
            }
            return left.area.localeCompare(right.area);
        })
        .slice(0, 8);
}

function calculateOptimizationScore(insights: OptimizationInsight[]) {
    if (!insights.length) {
        return 100;
    }

    const penaltyMap: Record<InsightSeverity, number> = {
        critical: 20,
        high: 12,
        medium: 6,
        low: 3
    };

    const totalPenalty = insights.reduce(
        (sum, item) => sum + penaltyMap[item.severity],
        0
    );

    return Math.max(0, 100 - totalPenalty);
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
    const [exporting, setExporting] = useState(false);

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
        {
            key: "sms_usage",
            header: "SMS Sent / Total",
            render: (row) => `${Number(row.sms_sent_count || 0).toLocaleString()} / ${Number(row.sms_total_count || 0).toLocaleString()}`
        },
        {
            key: "sms_failed",
            header: "SMS Failed",
            render: (row) => Number(row.sms_failed_count || 0).toLocaleString()
        },
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

    const optimizationInsights = useMemo(
        () => buildOptimizationInsights({
            systemMetrics,
            infrastructure,
            tenantTraffic,
            slowEndpoints,
            errors
        }),
        [errors, infrastructure, slowEndpoints, systemMetrics, tenantTraffic]
    );

    const optimizationScore = useMemo(
        () => calculateOptimizationScore(optimizationInsights),
        [optimizationInsights]
    );

    const optimizationStatus = useMemo(() => {
        if (optimizationScore >= 85) {
            return { label: "Healthy", color: "success" as const };
        }
        if (optimizationScore >= 70) {
            return { label: "Watch", color: "warning" as const };
        }
        return { label: "Needs Action", color: "error" as const };
    }, [optimizationScore]);

    const insightColumns: Column<OptimizationInsight>[] = [
        {
            key: "severity",
            header: "Priority",
            render: (row) => (
                <Chip
                    size="small"
                    label={row.severity.toUpperCase()}
                    color={SEVERITY_COLOR[row.severity]}
                    variant="outlined"
                />
            )
        },
        { key: "area", header: "Area", render: (row) => row.area },
        { key: "finding", header: "Finding", render: (row) => row.finding },
        { key: "recommendation", header: "Recommended Action", render: (row) => row.recommendation }
    ];

    const exportWeeklyOptimizationReport = useCallback(async () => {
        if (scope === "tenant" && !monitoredTenantId) {
            pushToast({
                type: "error",
                title: "No tenant selected",
                message: "Select a tenant first when exporting in tenant scope."
            });
            return;
        }

        setExporting(true);
        try {
            const windowMinutes = 7 * 24 * 60;
            const weeklyScopedTenantId = scope === "tenant" ? monitoredTenantId : undefined;
            const sharedParams = {
                tenant_id: weeklyScopedTenantId,
                window_minutes: windowMinutes
            };

            const [systemResponse, tenantResponse, infraResponse, errorResponse, slowResponse] = await Promise.all([
                api.get<PlatformSystemMetricsResponse>(endpoints.platform.metricsSystem(), {
                    params: sharedParams
                }),
                api.get<PlatformTenantTrafficResponse>(endpoints.platform.metricsTenants(), {
                    params: {
                        ...sharedParams,
                        sort_by: "traffic",
                        sort_dir: "desc"
                    }
                }),
                api.get<PlatformInfrastructureMetricsResponse>(endpoints.platform.metricsInfrastructure(), {
                    params: {
                        tenant_id: weeklyScopedTenantId,
                        window_minutes: 60
                    }
                }),
                api.get<PlatformErrorsResponse>(endpoints.platform.errors(), {
                    params: {
                        tenant_id: weeklyScopedTenantId,
                        page: 1,
                        limit: 100
                    }
                }),
                api.get<PlatformSlowEndpointsResponse>(endpoints.platform.metricsSlowEndpoints(), {
                    params: {
                        tenant_id: weeklyScopedTenantId,
                        window_minutes: windowMinutes,
                        limit: 20
                    }
                })
            ]);

            const weeklySystem = systemResponse.data.data;
            const weeklyTenants = tenantResponse.data.data || [];
            const weeklyInfra = infraResponse.data.data;
            const weeklyErrors = errorResponse.data.data || [];
            const weeklySlow = slowResponse.data.data || [];
            const weeklyInsights = buildOptimizationInsights({
                systemMetrics: weeklySystem,
                infrastructure: weeklyInfra,
                tenantTraffic: weeklyTenants,
                slowEndpoints: weeklySlow,
                errors: weeklyErrors
            });
            const weeklyScore = calculateOptimizationScore(weeklyInsights);
            const generatedAt = new Date().toISOString();
            const scopeLabel = scope === "system" ? "System-wide" : `Tenant: ${selectedTenantName}`;
            const reportBaseName = `platform-optimization-weekly-${generatedAt.slice(0, 10)}`;

            const csvLines: string[] = [];
            csvLines.push(csvRow(["Platform Weekly Optimization Report"]));
            csvLines.push(csvRow(["Generated At", generatedAt]));
            csvLines.push(csvRow(["Scope", scopeLabel]));
            csvLines.push(csvRow(["Window (minutes)", windowMinutes]));
            csvLines.push(csvRow(["Optimization Score", weeklyScore]));
            csvLines.push("");

            csvLines.push(csvRow(["System Summary"]));
            csvLines.push(csvRow(["Requests/sec", "P95 Latency (ms)", "Error Rate (%)", "Active Users", "Active Tenants", "SMS Sent", "SMS Total", "SMS Delivery Rate (%)"]));
            csvLines.push(csvRow([
                weeklySystem?.requests_per_sec ?? 0,
                weeklySystem?.p95_latency_ms ?? 0,
                weeklySystem?.error_rate_pct ?? 0,
                weeklySystem?.active_users ?? 0,
                weeklySystem?.active_tenants ?? 0,
                weeklySystem?.sms_sent_count ?? 0,
                weeklySystem?.sms_total_count ?? 0,
                weeklySystem?.sms_delivery_rate_pct ?? 0
            ]));
            csvLines.push("");

            csvLines.push(csvRow(["Optimization Priorities"]));
            csvLines.push(csvRow(["Priority", "Area", "Finding", "Recommended Action"]));
            weeklyInsights.forEach((insight) => {
                csvLines.push(csvRow([
                    insight.severity.toUpperCase(),
                    insight.area,
                    insight.finding,
                    insight.recommendation
                ]));
            });
            csvLines.push("");

            csvLines.push(csvRow(["Slow Endpoints"]));
            csvLines.push(csvRow(["Endpoint", "Avg Latency (ms)", "Calls"]));
            weeklySlow.forEach((row) => {
                csvLines.push(csvRow([row.endpoint, row.avg_latency_ms, row.calls]));
            });
            csvLines.push("");

            csvLines.push(csvRow(["Tenant Traffic"]));
            csvLines.push(csvRow(["Tenant", "Tenant ID", "Requests", "Errors", "Avg Latency (ms)", "Active Users", "SMS Sent", "SMS Total", "SMS Failed"]));
            weeklyTenants.forEach((row) => {
                csvLines.push(csvRow([
                    row.tenant_name,
                    row.tenant_id,
                    row.request_count,
                    row.error_count,
                    row.avg_latency_ms,
                    row.active_users,
                    row.sms_sent_count || 0,
                    row.sms_total_count || 0,
                    row.sms_failed_count || 0
                ]));
            });
            csvLines.push("");

            csvLines.push(csvRow(["Recent Errors"]));
            csvLines.push(csvRow(["Time", "Endpoint", "Status", "Tenant", "Message"]));
            weeklyErrors.forEach((row) => {
                csvLines.push(csvRow([
                    row.timestamp,
                    row.endpoint,
                    row.status_code,
                    row.tenant_name || row.tenant_id || "System",
                    row.message
                ]));
            });

            const csvBlob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
            downloadFile(csvBlob, `${reportBaseName}.csv`);

            const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
            doc.setFont("helvetica", "bold");
            doc.setFontSize(15);
            doc.text("Platform Weekly Optimization Report", 40, 36);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.text(`Generated: ${formatDate(generatedAt)}  |  Scope: ${scopeLabel}  |  Window: 7 days`, 40, 54);
            doc.text(`Optimization Score: ${weeklyScore}/100`, 40, 68);

            autoTable(doc, {
                startY: 84,
                head: [["Requests/sec", "P95 Latency (ms)", "Error Rate (%)", "Active Users", "Active Tenants", "SMS Sent", "SMS Total", "SMS Delivery Rate (%)"]],
                body: [[
                    formatNumber(weeklySystem?.requests_per_sec, 2),
                    formatNumber(weeklySystem?.p95_latency_ms, 1),
                    formatNumber(weeklySystem?.error_rate_pct, 2),
                    String(weeklySystem?.active_users || 0),
                    String(weeklySystem?.active_tenants || 0),
                    String(weeklySystem?.sms_sent_count || 0),
                    String(weeklySystem?.sms_total_count || 0),
                    formatNumber(weeklySystem?.sms_delivery_rate_pct, 2)
                ]],
                theme: "grid",
                headStyles: { fillColor: [15, 23, 42] },
                styles: { fontSize: 8.5 }
            });

            const pdfAnyDoc = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
            autoTable(doc, {
                startY: (pdfAnyDoc.lastAutoTable?.finalY || 84) + 16,
                head: [["Priority", "Area", "Finding", "Recommended Action"]],
                body: (weeklyInsights.length ? weeklyInsights : [{
                    severity: "low",
                    area: "General",
                    finding: "No major optimization issues were detected.",
                    recommendation: "Maintain monitoring cadence and keep thresholds under review."
                }]).map((insight) => [
                    insight.severity.toUpperCase(),
                    insight.area,
                    insight.finding,
                    insight.recommendation
                ]),
                theme: "grid",
                headStyles: { fillColor: [30, 64, 175] },
                styles: { fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 70 },
                    1: { cellWidth: 120 },
                    2: { cellWidth: 230 },
                    3: { cellWidth: 300 }
                }
            });

            doc.addPage();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("Slow Endpoints", 40, 36);
            autoTable(doc, {
                startY: 46,
                head: [["Endpoint", "Avg Latency (ms)", "Calls"]],
                body: weeklySlow.map((row) => [
                    row.endpoint,
                    formatNumber(row.avg_latency_ms, 1),
                    String(row.calls)
                ]),
                theme: "grid",
                headStyles: { fillColor: [124, 58, 237] },
                styles: { fontSize: 8.5 }
            });

            const slowFinalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 46;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("Tenant Traffic", 40, slowFinalY + 24);
            autoTable(doc, {
                startY: slowFinalY + 34,
                head: [["Tenant", "Requests", "Errors", "Avg Latency (ms)", "Users", "SMS Sent", "SMS Total", "SMS Failed"]],
                body: weeklyTenants.slice(0, 20).map((row) => [
                    row.tenant_name,
                    String(row.request_count),
                    String(row.error_count),
                    formatNumber(row.avg_latency_ms, 1),
                    String(row.active_users),
                    String(row.sms_sent_count || 0),
                    String(row.sms_total_count || 0),
                    String(row.sms_failed_count || 0)
                ]),
                theme: "grid",
                headStyles: { fillColor: [15, 118, 110] },
                styles: { fontSize: 8 }
            });

            doc.save(`${reportBaseName}.pdf`);

            pushToast({
                type: "success",
                title: "Weekly optimization report exported",
                message: "CSV and PDF reports have been downloaded."
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Export failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setExporting(false);
        }
    }, [monitoredTenantId, pushToast, scope, selectedTenantName]);

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
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<FileDownloadRoundedIcon />}
                                onClick={() => void exportWeeklyOptimizationReport()}
                                disabled={exporting || (scope === "tenant" && !monitoredTenantId)}
                            >
                                {exporting ? "Exporting..." : "Export Weekly Report (CSV/PDF)"}
                            </Button>
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
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        label="SMS sent / total"
                        value={`${Number(systemMetrics?.sms_sent_count || 0).toLocaleString()} / ${Number(systemMetrics?.sms_total_count || 0).toLocaleString()}`}
                        helper="Tenant SMS dispatch volume in current window"
                        icon={<SmsRoundedIcon />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        label="SMS delivery rate"
                        value={formatPercent(systemMetrics?.sms_delivery_rate_pct)}
                        helper={`${Number(systemMetrics?.sms_failed_count || 0).toLocaleString()} failed SMS in current window`}
                        icon={<SmsRoundedIcon />}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={1.25}>
                                <Typography variant="h6">Optimization Score</Typography>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography variant="h3">{optimizationScore}</Typography>
                                    <Typography variant="body2" color="text.secondary">/100</Typography>
                                </Stack>
                                <Chip
                                    size="small"
                                    color={optimizationStatus.color}
                                    label={optimizationStatus.label}
                                    sx={{ width: "fit-content" }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    Score is derived from current reliability, latency, infra pressure, and repeated incident hotspots.
                                </Typography>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>Top Optimization Priorities</Typography>
                            <DataTable
                                rows={optimizationInsights}
                                columns={insightColumns}
                                emptyMessage="No optimization risks detected in the selected window."
                            />
                        </CardContent>
                    </MotionCard>
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
                                <MenuItem value="sms">SMS Usage</MenuItem>
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
