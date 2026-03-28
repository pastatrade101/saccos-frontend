import { CardContent, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";

import type { StaffRoleCounts } from "../types/api";
import { MotionButton, MotionCard } from "../ui/motion";
import { getCoverageStatus, recommendedRoleMinimums, roleCoverageLabels } from "../utils/roleRules";

interface RoleCoverageMatrixProps {
    roleCounts: StaffRoleCounts;
    canInviteRole: (role: keyof StaffRoleCounts) => boolean;
    onInvite: (role: keyof StaffRoleCounts) => void;
    onViewUsers: () => void;
}

export function RoleCoverageMatrix({
    roleCounts,
    canInviteRole,
    onInvite,
    onViewUsers
}: RoleCoverageMatrixProps) {
    const rows = (Object.keys(roleCounts) as Array<keyof StaffRoleCounts>).map((role) => {
        const count = roleCounts[role];
        const recommended = recommendedRoleMinimums[role] ?? 0;
        const status = getCoverageStatus(role, count);

        return {
            role,
            count,
            recommended,
            status
        };
    });

    return (
        <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
            <CardContent>
                <Stack spacing={0.5} sx={{ mb: 2 }}>
                    <Typography variant="h6">Role Coverage Matrix</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Identify missing or weak staffing before it becomes an operational or governance gap.
                    </Typography>
                </Stack>

                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Role</TableCell>
                            <TableCell>Count</TableCell>
                            <TableCell>Recommended Min</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Quick Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.role} hover>
                                <TableCell>{roleCoverageLabels[row.role]}</TableCell>
                                <TableCell>{row.count}</TableCell>
                                <TableCell>{row.recommended > 0 ? row.recommended : "Optional"}</TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        label={row.status === "missing" ? "Missing" : row.status === "low" ? "Low" : "OK"}
                                        color={row.status === "missing" ? "error" : row.status === "low" ? "warning" : "success"}
                                        variant={row.status === "ok" ? "filled" : "outlined"}
                                    />
                                </TableCell>
                                <TableCell align="right">
                                    {row.status !== "ok" && canInviteRole(row.role) ? (
                                        <MotionButton size="small" variant="contained" color="secondary" onClick={() => onInvite(row.role)}>
                                            Invite
                                        </MotionButton>
                                    ) : (
                                        <MotionButton size="small" variant="text" onClick={onViewUsers}>
                                            View users
                                        </MotionButton>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </MotionCard>
    );
}
