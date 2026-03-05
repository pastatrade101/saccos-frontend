export function formatCurrency(value?: number | null) {
    return new Intl.NumberFormat("en-TZ", {
        style: "currency",
        currency: "TZS",
        maximumFractionDigits: 0
    }).format(value || 0);
}

export function formatDate(value?: string | null) {
    if (!value) {
        return "N/A";
    }

    return new Intl.DateTimeFormat("en-TZ", {
        dateStyle: "medium"
    }).format(new Date(value));
}

export function formatRole(role: string) {
    return role
        .split("_")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
}

export function formatPlatformRole(role?: string | null) {
    if (!role) {
        return "N/A";
    }

    if (role === "internal_ops" || role === "platform_admin") {
        return "Platform Admin";
    }

    return formatRole(role);
}
