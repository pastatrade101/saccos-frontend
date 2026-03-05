import type { Role, StaffConflict, StaffRoleCounts, StaffAccessUser } from "../types/api";

export const recommendedRoleMinimums: Record<Extract<Role, "super_admin" | "branch_manager" | "loan_officer" | "teller" | "auditor">, number> = {
    super_admin: 1,
    branch_manager: 1,
    loan_officer: 1,
    teller: 1,
    auditor: 1
};

export const roleCoverageLabels: Record<keyof StaffRoleCounts, string> = {
    super_admin: "Super Admin",
    branch_manager: "Branch Manager",
    loan_officer: "Loan Officer",
    teller: "Teller",
    auditor: "Auditor"
};

export type CoverageStatus = "missing" | "low" | "ok";

export function getCoverageStatus(role: keyof StaffRoleCounts, count: number): CoverageStatus {
    const recommended = recommendedRoleMinimums[role];

    if (count === 0) {
        return "missing";
    }

    if (count < recommended) {
        return "low";
    }

    return "ok";
}

export function detectRoleConflicts(users: StaffAccessUser[]): StaffConflict[] {
    return users.flatMap((user) => {
        const roles = [user.role];
        const conflicts: StaffConflict[] = [];

        const pushConflict = (reason: string) => {
            conflicts.push({
                user_id: user.user_id,
                full_name: user.full_name,
                roles,
                reason
            });
        };

        if (user.role === "auditor" && user.branch_ids.length > 0) {
            pushConflict("Auditor has operational branch assignment. Review separation of duties.");
        }

        return conflicts;
    });
}

export function minimumCoverageMet(roleCounts: StaffRoleCounts) {
    return Object.entries(recommendedRoleMinimums).every(([role, minimum]) => roleCounts[role as keyof StaffRoleCounts] >= minimum);
}
