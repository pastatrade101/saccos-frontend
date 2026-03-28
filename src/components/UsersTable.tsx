import {
    Box,
    Chip,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import type { Branch, StaffAccessUser } from "../types/api";
import { MotionButton, MotionCard } from "../ui/motion";
import { formatDate, formatRole } from "../utils/format";

type StaffRole = "super_admin" | "branch_manager" | "treasury_officer" | "loan_officer" | "teller" | "auditor";

interface UsersTableProps {
    users: StaffAccessUser[];
    branches: Branch[];
    editable: boolean;
    loading?: boolean;
    onSave: (userId: string, payload: { role: StaffRole; is_active: boolean; branch_ids: string[] }) => Promise<void>;
    onViewTemporaryPassword?: (user: StaffAccessUser) => Promise<void>;
}

const rowsPerPageOptions = [10, 25, 50];

export function UsersTable({ users, branches, editable, loading = false, onSave, onViewTemporaryPassword }: UsersTableProps) {
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [drafts, setDrafts] = useState<Record<string, { role: StaffRole; is_active: boolean; branch_ids: string[] }>>({});
    const [savingUserId, setSavingUserId] = useState<string | null>(null);

    useEffect(() => {
        setDrafts(
            Object.fromEntries(
                users.map((user) => [
                    user.user_id,
                    {
                        role: user.role as StaffRole,
                        is_active: user.is_active,
                        branch_ids: user.branch_ids
                    }
                ])
            )
        );
    }, [users]);

    const filteredUsers = useMemo(() => {
        const value = search.trim().toLowerCase();

        return users.filter((user) => {
            const matchesSearch =
                !value ||
                user.full_name.toLowerCase().includes(value) ||
                (user.email || "").toLowerCase().includes(value) ||
                user.branch_name.toLowerCase().includes(value);

            const matchesRole = roleFilter === "all" || user.role === roleFilter;

            return matchesSearch && matchesRole;
        });
    }, [roleFilter, search, users]);

    const paginatedUsers = filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const setDraft = (userId: string, next: Partial<{ role: StaffRole; is_active: boolean; branch_ids: string[] }>) => {
        setDrafts((current) => ({
            ...current,
            [userId]: {
                ...current[userId],
                ...next
            }
        }));
    };

    const handleSave = async (userId: string) => {
        const draft = drafts[userId];
        if (!draft) {
            return;
        }

        setSavingUserId(userId);
        try {
            await onSave(userId, draft);
        } finally {
            setSavingUserId(null);
        }
    };

    useEffect(() => {
        setPage(0);
    }, [search, roleFilter, rowsPerPage]);

    if (!users.length && !loading) {
        return (
            <MotionCard variant="outlined" inView sx={{ p: 4, textAlign: "center" }}>
                <Typography variant="subtitle1">No staff users yet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    Provision the first operating users to start branch activity and governance review.
                </Typography>
            </MotionCard>
        );
    }

    return (
        <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <TextField
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    label="Search users"
                    placeholder="Search by name, email, or branch"
                    fullWidth
                />
                <FormControl sx={{ minWidth: 220 }}>
                    <InputLabel>Role filter</InputLabel>
                    <Select
                        label="Role filter"
                        value={roleFilter}
                        onChange={(event) => setRoleFilter(event.target.value)}
                    >
                        <MenuItem value="all">All roles</MenuItem>
                        <MenuItem value="super_admin">Super Admin</MenuItem>
                        <MenuItem value="branch_manager">Branch Manager</MenuItem>
                        <MenuItem value="treasury_officer">Treasury Officer</MenuItem>
                        <MenuItem value="loan_officer">Loan Officer</MenuItem>
                        <MenuItem value="teller">Teller</MenuItem>
                        <MenuItem value="auditor">Auditor</MenuItem>
                    </Select>
                </FormControl>
            </Stack>

            <MotionCard variant="outlined" inView sx={{ overflow: "hidden" }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Branch</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Last login</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedUsers.map((user) => {
                            const draft = drafts[user.user_id];
                            const hasChanges = draft && (
                                draft.role !== user.role ||
                                draft.is_active !== user.is_active ||
                                draft.branch_ids.join(",") !== user.branch_ids.join(",")
                            );

                            return (
                                <TableRow key={user.user_id} hover>
                                    <TableCell>
                                        <Stack spacing={0.25}>
                                            <Typography variant="body2" fontWeight={700}>
                                                {user.full_name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {user.phone || "No phone"}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>{user.email || "No email"}</TableCell>
                                    <TableCell sx={{ minWidth: 180 }}>
                                        {editable ? (
                                            <FormControl size="small" fullWidth>
                                                <Select
                                                    value={draft?.role || user.role}
                                                    onChange={(event) => setDraft(user.user_id, { role: event.target.value as StaffRole })}
                                                >
                                                    <MenuItem value="super_admin">Super Admin</MenuItem>
                                                    <MenuItem value="branch_manager">Branch Manager</MenuItem>
                                                    <MenuItem value="treasury_officer">Treasury Officer</MenuItem>
                                                    <MenuItem value="loan_officer">Loan Officer</MenuItem>
                                                    <MenuItem value="teller">Teller</MenuItem>
                                                    <MenuItem value="auditor">Auditor</MenuItem>
                                                </Select>
                                            </FormControl>
                                        ) : (
                                            <Chip size="small" label={formatRole(user.role)} variant="outlined" />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editable ? (
                                            <FormControl size="small" fullWidth>
                                                <Select
                                                    value={draft?.branch_ids?.[0] || ""}
                                                    onChange={(event) => setDraft(user.user_id, { branch_ids: event.target.value ? [event.target.value] : [] })}
                                                >
                                                    <MenuItem value="">No fixed branch</MenuItem>
                                                    {branches.map((branch) => (
                                                        <MenuItem key={branch.id} value={branch.id}>
                                                            {branch.name}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        ) : (
                                            user.branch_name
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editable ? (
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Switch
                                                    checked={draft?.is_active ?? user.is_active}
                                                    onChange={(event) => setDraft(user.user_id, { is_active: event.target.checked })}
                                                />
                                                <Typography variant="body2">
                                                    {(draft?.is_active ?? user.is_active) ? "Active" : "Inactive"}
                                                </Typography>
                                            </Stack>
                                        ) : (
                                            <Chip
                                                size="small"
                                                label={user.is_active ? "Active" : "Inactive"}
                                                color={user.is_active ? "success" : "default"}
                                                variant={user.is_active ? "filled" : "outlined"}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>{formatDate(user.last_login_at)}</TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            {user.has_temporary_password && onViewTemporaryPassword ? (
                                                <MotionButton
                                                    variant="outlined"
                                                    size="small"
                                                    onClick={() => void onViewTemporaryPassword(user)}
                                                >
                                                    View temp password
                                                </MotionButton>
                                            ) : null}
                                            {editable ? (
                                                <MotionButton
                                                    variant="contained"
                                                    size="small"
                                                    disabled={!hasChanges || savingUserId === user.user_id}
                                                    onClick={() => void handleSave(user.user_id)}
                                                >
                                                    {savingUserId === user.user_id ? "Saving..." : "Save changes"}
                                                </MotionButton>
                                            ) : (
                                                !user.has_temporary_password ? (
                                                    <Typography variant="caption" color="text.secondary">
                                                        Read only
                                                    </Typography>
                                                ) : null
                                            )}
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <Box sx={{ borderTop: 1, borderColor: "divider" }}>
                    <TablePagination
                        component="div"
                        count={filteredUsers.length}
                        page={page}
                        onPageChange={(_, nextPage) => setPage(nextPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(event) => setRowsPerPage(Number(event.target.value))}
                        rowsPerPageOptions={rowsPerPageOptions}
                    />
                </Box>
            </MotionCard>
        </Stack>
    );
}
