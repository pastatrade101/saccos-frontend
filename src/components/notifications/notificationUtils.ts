import type { ChipProps } from "@mui/material";

import type { NotificationItem, NotificationSeverity } from "../../types/api";

export function getNotificationSeverityColor(severity: NotificationSeverity): ChipProps["color"] {
    switch (severity) {
        case "success":
            return "success";
        case "warning":
            return "warning";
        case "critical":
            return "error";
        default:
            return "info";
    }
}

export function formatNotificationTimestamp(value?: string | null) {
    if (!value) {
        return "Just now";
    }

    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleString();
}

export function getNotificationFallbackRoute(item: NotificationItem, isMember: boolean) {
    if (item.action_route) {
        return item.action_route;
    }

    return isMember ? "/portal" : "/dashboard";
}
