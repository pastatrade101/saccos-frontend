import type { MemberApplicationStatus } from "../types/api";

export const memberApplicationStatusLabels: Record<MemberApplicationStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under review",
    approved: "Approved",
    approved_pending_payment: "Approved – Awaiting Membership Fee Payment",
    active: "Active",
    rejected: "Rejected",
    cancelled: "Cancelled"
};
