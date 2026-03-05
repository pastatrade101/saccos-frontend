import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { CardContent, Chip, Divider, Stack, Typography } from "@mui/material";

import type { StaffConflict, StaffRoleCounts } from "../types/api";
import { MotionButton, MotionCard } from "../ui/motion";
import { minimumCoverageMet } from "../utils/roleRules";

interface AccessHealthPanelProps {
    roleCounts: StaffRoleCounts;
    conflicts: StaffConflict[];
    onViewConflicts: () => void;
}

export function AccessHealthPanel({ roleCounts, conflicts, onViewConflicts }: AccessHealthPanelProps) {
    const coverageMet = minimumCoverageMet(roleCounts);
    const tooManySuperAdmins = roleCounts.super_admin > 3;

    return (
        <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
            <CardContent>
                <Stack spacing={2}>
                    <Stack spacing={0.5}>
                        <Typography variant="h6">Access Health</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Read governance posture quickly before changing the operating team.
                        </Typography>
                    </Stack>

                    <Stack spacing={1.25}>
                        <HealthRow
                            icon={conflicts.length ? <ErrorOutlineRoundedIcon color="error" /> : <VerifiedRoundedIcon color="success" />}
                            title="Separation of duties"
                            status={conflicts.length ? `${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""}` : "No detected conflicts"}
                            chipColor={conflicts.length ? "error" : "success"}
                            helper={conflicts.length
                                ? "At least one user has a role or assignment pattern that needs review."
                                : "No visible role conflicts in the current workspace."}
                        />
                        <Divider />
                        <HealthRow
                            icon={coverageMet ? <FactCheckRoundedIcon color="success" /> : <WarningAmberRoundedIcon color="warning" />}
                            title="Minimum coverage"
                            status={coverageMet ? "Coverage met" : "Coverage gap"}
                            chipColor={coverageMet ? "success" : "warning"}
                            helper={coverageMet
                                ? "Every core role currently meets the recommended minimum."
                                : "One or more critical roles are missing or under-covered."}
                        />
                        <Divider />
                        <HealthRow
                            icon={tooManySuperAdmins ? <WarningAmberRoundedIcon color="warning" /> : <VerifiedRoundedIcon color="success" />}
                            title="Admin concentration"
                            status={tooManySuperAdmins ? "High" : "Controlled"}
                            chipColor={tooManySuperAdmins ? "warning" : "success"}
                            helper={tooManySuperAdmins
                                ? "More than three super admins can dilute accountability."
                                : "Super admin count is within a controlled range."}
                        />
                    </Stack>

                    <MotionButton variant="outlined" onClick={onViewConflicts}>
                        View conflicts
                    </MotionButton>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

function HealthRow({
    icon,
    title,
    status,
    chipColor,
    helper
}: {
    icon: React.ReactNode;
    title: string;
    status: string;
    chipColor: "success" | "warning" | "error";
    helper: string;
}) {
    return (
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
            {icon}
            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography variant="subtitle2">{title}</Typography>
                    <Chip size="small" label={status} color={chipColor} variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                    {helper}
                </Typography>
            </Stack>
        </Stack>
    );
}
