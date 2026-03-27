import type { ChipProps } from "@mui/material";

export type AuditorReasonCode =
    | "HIGH_VALUE_TX"
    | "BACKDATED_ENTRY"
    | "REVERSAL"
    | "OUT_OF_HOURS_POSTING"
    | "MAKER_CHECKER_VIOLATION"
    | "CASH_VARIANCE"
    | "MANUAL_JOURNAL";

export interface AuditorReasonMeta {
    label: string;
    severity: "critical" | "warning" | "info";
    chipColor: ChipProps["color"];
    summary: string;
}

const REASON_META: Record<AuditorReasonCode, AuditorReasonMeta> = {
    HIGH_VALUE_TX: {
        label: "High value transaction",
        severity: "warning",
        chipColor: "warning",
        summary: "Large-value posting that may require additional control review."
    },
    BACKDATED_ENTRY: {
        label: "Backdated entry",
        severity: "warning",
        chipColor: "warning",
        summary: "Entry date falls before the actual creation date."
    },
    REVERSAL: {
        label: "Reversal",
        severity: "critical",
        chipColor: "error",
        summary: "Posting reversed and should be reviewed for pattern or override misuse."
    },
    OUT_OF_HOURS_POSTING: {
        label: "Out of hours",
        severity: "warning",
        chipColor: "warning",
        summary: "Posting happened outside configured operating hours."
    },
    MAKER_CHECKER_VIOLATION: {
        label: "Maker-checker violation",
        severity: "critical",
        chipColor: "error",
        summary: "Segregation-of-duties control appears to have been breached."
    },
    CASH_VARIANCE: {
        label: "Cash variance",
        severity: "critical",
        chipColor: "error",
        summary: "Counted cash did not match expected teller cash."
    },
    MANUAL_JOURNAL: {
        label: "Manual journal",
        severity: "info",
        chipColor: "info",
        summary: "Manual adjustment journal requiring traceability review."
    }
};

export function getAuditorReasonMeta(reasonCode: string): AuditorReasonMeta {
    return REASON_META[(reasonCode as AuditorReasonCode)] || {
        label: reasonCode.split("_").join(" "),
        severity: "info",
        chipColor: "default",
        summary: "Auditor exception raised for review."
    };
}

export function getSeverityScore(reasonCode: string) {
    const severity = getAuditorReasonMeta(reasonCode).severity;
    if (severity === "critical") return 3;
    if (severity === "warning") return 2;
    return 1;
}

export function formatAuditShortId(value?: string | null) {
    if (!value) return "N/A";
    return String(value).slice(0, 8).toUpperCase();
}

export function buildAuditLogFieldSummary(
    beforeData?: Record<string, unknown> | null,
    afterData?: Record<string, unknown> | null
) {
    const beforeKeys = new Set(Object.keys(beforeData || {}));
    const afterKeys = new Set(Object.keys(afterData || {}));
    const changedKeys = new Set<string>();

    for (const key of beforeKeys) {
        if (JSON.stringify(beforeData?.[key]) !== JSON.stringify(afterData?.[key])) {
            changedKeys.add(key);
        }
    }

    for (const key of afterKeys) {
        if (!beforeKeys.has(key)) {
            changedKeys.add(key);
        }
    }

    return Array.from(changedKeys).slice(0, 4);
}

export function formatAuditValue(value: unknown) {
    if (value === null || value === undefined || value === "") {
        return "Empty";
    }
    if (typeof value === "boolean") {
        return value ? "True" : "False";
    }
    if (typeof value === "number") {
        return Number.isInteger(value) ? value.toLocaleString("en-TZ") : value.toFixed(2);
    }
    if (typeof value === "string") {
        return value;
    }
    return JSON.stringify(value);
}

export function buildAuditLogFieldChanges(
    beforeData?: Record<string, unknown> | null,
    afterData?: Record<string, unknown> | null
) {
    const before = beforeData || {};
    const after = afterData || {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

    return Array.from(keys)
        .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
        .map((key) => ({
            field: key,
            before: before[key],
            after: after[key]
        }));
}
