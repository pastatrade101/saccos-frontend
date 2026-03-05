import { MotionCard, MotionModal } from "../ui/motion";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Grid,
    MenuItem,
    Pagination,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { AppLoader } from "../components/AppLoader";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type LoanSchedulesResponse, type LoansResponse, type MembersResponse } from "../lib/endpoints";
import type { Loan, LoanSchedule, Member } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

type FollowUpRow = {
    id: string;
    loan_id: string;
    loan_number: string;
    member_name: string;
    due_date: string;
    status: LoanSchedule["status"];
    principal_due: number;
    interest_due: number;
    total_due: number;
};

export function FollowUpsPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { selectedTenantId, selectedTenantName } = useAuth();
    const [schedules, setSchedules] = useState<LoanSchedule[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "partial" | "overdue">("all");
    const [loanFilter, setLoanFilter] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 10;

    useEffect(() => {
        const loadFollowUps = async () => {
            if (!selectedTenantId) {
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                const [{ data: schedulesResponse }, { data: loansResponse }, { data: membersResponse }] = await Promise.all([
                    api.get<LoanSchedulesResponse>(endpoints.finance.loanSchedules(), {
                        params: { tenant_id: selectedTenantId }
                    }),
                    api.get<LoansResponse>(endpoints.finance.loanPortfolio(), {
                        params: { tenant_id: selectedTenantId }
                    }),
                    api.get<MembersResponse>(endpoints.members.list())
                ]);

                setSchedules((schedulesResponse.data || []).filter((schedule) => ["pending", "partial", "overdue"].includes(schedule.status)));
                setLoans(loansResponse.data || []);
                setMembers(membersResponse.data || []);
            } catch (error) {
                pushToast({
                    type: "error",
                    title: "Unable to load follow-up data",
                    message: getApiErrorMessage(error)
                });
            } finally {
                setLoading(false);
            }
        };

        void loadFollowUps();
    }, [pushToast, selectedTenantId]);

    const rows = useMemo<FollowUpRow[]>(() => {
        const loanMap = new Map(loans.map((loan) => [loan.id, loan]));
        const memberMap = new Map(members.map((member) => [member.id, member]));

        return schedules.map((schedule) => {
            const loan = loanMap.get(schedule.loan_id);
            const member = loan ? memberMap.get(loan.member_id) : null;
            const principalDue = Math.max(schedule.principal_due - schedule.principal_paid, 0);
            const interestDue = Math.max(schedule.interest_due - schedule.interest_paid, 0);

            return {
                id: schedule.id,
                loan_id: schedule.loan_id,
                loan_number: loan?.loan_number || schedule.loan_id,
                member_name: member?.full_name || "Unknown member",
                due_date: schedule.due_date,
                status: schedule.status,
                principal_due: principalDue,
                interest_due: interestDue,
                total_due: principalDue + interestDue
            };
        });
    }, [loans, members, schedules]);

    const filteredRows = useMemo(() => {
        return rows.filter((row) => {
            if (statusFilter !== "all" && row.status !== statusFilter) {
                return false;
            }

            if (loanFilter) {
                const query = loanFilter.toLowerCase();
                const matchesLoan = row.loan_number.toLowerCase().includes(query);
                const matchesMember = row.member_name.toLowerCase().includes(query);

                if (!matchesLoan && !matchesMember) {
                    return false;
                }
            }

            if (fromDate && row.due_date < fromDate) {
                return false;
            }

            if (toDate && row.due_date > toDate) {
                return false;
            }

            return true;
        });
    }, [fromDate, loanFilter, rows, statusFilter, toDate]);

    const summary = useMemo(() => {
        const critical = filteredRows.filter((row) => row.status === "overdue").length;
        const watchlist = filteredRows.filter((row) => row.status === "partial").length;
        const totalDue = filteredRows.reduce((sum, row) => sum + row.total_due, 0);

        return { critical, watchlist, totalDue };
    }, [filteredRows]);

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const paginatedRows = useMemo(
        () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
        [filteredRows, page]
    );

    useEffect(() => {
        setPage(1);
    }, [statusFilter, loanFilter, fromDate, toDate]);

    const columns: Column<FollowUpRow>[] = [
        {
            key: "loan",
            header: "Loan",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {row.loan_number}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {row.member_name}
                    </Typography>
                </Stack>
            )
        },
        { key: "due_date", header: "Due Date", render: (row) => formatDate(row.due_date) },
        {
            key: "status",
            header: "Status",
            render: (row) => (
                <Chip
                    size="small"
                    label={row.status}
                    color={row.status === "overdue" ? "error" : row.status === "partial" ? "warning" : "default"}
                    variant={row.status === "pending" ? "outlined" : "filled"}
                />
            )
        },
        { key: "principal_due", header: "Principal Due", render: (row) => formatCurrency(row.principal_due) },
        { key: "interest_due", header: "Interest Due", render: (row) => formatCurrency(row.interest_due) },
        { key: "total_due", header: "Total Due", render: (row) => formatCurrency(row.total_due) }
    ];

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                        <Box>
                            <Button
                                variant="text"
                                color="inherit"
                                startIcon={<ArrowBackRoundedIcon />}
                                onClick={() => navigate("/dashboard")}
                                sx={{ mb: 1, ml: -1 }}
                            >
                                Back to Dashboard
                            </Button>
                            <Typography variant="h5">Operational Follow-up</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                Filter due loan schedules, identify overdue exposure, and focus collections or branch follow-up for {selectedTenantName || "the current tenant"}.
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip label={`${summary.critical} critical`} color={summary.critical ? "error" : "default"} variant="outlined" />
                            <Chip label={`${summary.watchlist} watchlist`} color={summary.watchlist ? "warning" : "default"} variant="outlined" />
                            <Chip label={`${formatCurrency(summary.totalDue)} total due`} color="primary" variant="outlined" />
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <FilterAltRoundedIcon fontSize="small" />
                            <Typography variant="h6">Filters</Typography>
                        </Stack>

                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                    select
                                    label="Status"
                                    value={statusFilter}
                                    onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                                    fullWidth
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="pending">Pending</MenuItem>
                                    <MenuItem value="partial">Partial</MenuItem>
                                    <MenuItem value="overdue">Overdue</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                    label="Loan or Member"
                                    value={loanFilter}
                                    onChange={(event) => setLoanFilter(event.target.value)}
                                    fullWidth
                                    placeholder="Search loan number or member"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                    label="Due From"
                                    type="date"
                                    value={fromDate}
                                    onChange={(event) => setFromDate(event.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                    label="Due To"
                                    type="date"
                                    value={toDate}
                                    onChange={(event) => setToDate(event.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                />
                            </Grid>
                        </Grid>
                    </Stack>
                </CardContent>
            </MotionCard>

            {loading ? (
                <AppLoader fullscreen={false} minHeight={280} message="Loading follow-up items..." />
            ) : (
                <MotionCard variant="outlined">
                    <CardContent>
                        {filteredRows.length ? null : (
                            <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
                                No follow-up items match the current filters.
                            </Alert>
                        )}
                        <Stack spacing={2}>
                            <DataTable rows={paginatedRows} columns={columns} emptyMessage="No loan schedules require follow-up right now." />
                            {filteredRows.length ? (
                                <Stack
                                    direction={{ xs: "column", md: "row" }}
                                    justifyContent="space-between"
                                    alignItems={{ xs: "flex-start", md: "center" }}
                                    spacing={1.5}
                                >
                                    <Typography variant="body2" color="text.secondary">
                                        Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredRows.length)} of {filteredRows.length}
                                    </Typography>
                                    {totalPages > 1 ? (
                                        <Pagination
                                            color="primary"
                                            count={totalPages}
                                            page={page}
                                            onChange={(_, value) => setPage(value)}
                                        />
                                    ) : null}
                                </Stack>
                            ) : null}
                        </Stack>
                    </CardContent>
                </MotionCard>
            )}
        </Stack>
    );
}
