import axios, { AxiosError } from "axios";

import { clearStaleSupabaseSession, supabase } from "./supabase";
import type { ApiErrorPayload } from "../types/api";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
    throw new Error("Missing VITE_API_BASE_URL.");
}

export const api = axios.create({
    baseURL: apiBaseUrl,
    timeout: 30000
});

function emitWindowEvent(name: string, detail?: unknown) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
}

api.interceptors.request.use(async (config) => {
    let accessToken: string | undefined;

    try {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token;
    } catch (error) {
        const message = error instanceof Error ? error.message : "";

        if (message.toLowerCase().includes("invalid refresh token")) {
            await supabase.auth.signOut({ scope: "local" });
            clearStaleSupabaseSession();

            if (!window.location.pathname.startsWith("/signin")) {
                window.location.assign("/signin");
            }
        } else {
            throw error;
        }
    }

    config.headers["Cache-Control"] = "no-cache";
    config.headers.Pragma = "no-cache";

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiErrorPayload>) => {
        const status = error.response?.status;
        const apiError = error.response?.data?.error;

        emitWindowEvent("saccos:api-error", {
            status,
            code: apiError?.code || "UNKNOWN_ERROR",
            message: apiError?.message || error.message
        });

        const requestUrl = error.config?.url || "";
        const isAuthBootstrapRequest =
            requestUrl.includes("/auth/signin") ||
            requestUrl.includes("/auth/2fa/setup") ||
            requestUrl.includes("/auth/2fa/verify") ||
            requestUrl.includes("/auth/2fa/validate") ||
            requestUrl.includes("/auth/2fa/recovery") ||
            requestUrl.includes("/auth/2fa/disable") ||
            requestUrl.includes("/auth/2fa/backup-codes/regenerate") ||
            requestUrl.includes("/auth/password-setup/link/send");

        if (status === 401 && !isAuthBootstrapRequest) {
            await supabase.auth.signOut();
            clearStaleSupabaseSession();

            if (!window.location.pathname.startsWith("/signin")) {
                window.location.assign("/signin");
            }
        }

        return Promise.reject(error);
    }
);

export function getApiErrorMessage(error: unknown, fallback = "Request failed.") {
    if (axios.isAxiosError<ApiErrorPayload>(error)) {
        const apiError = error.response?.data?.error;
        const details = apiError?.details;

        if (details && typeof details === "object") {
            const detailedMessage = "message" in details && typeof details.message === "string"
                ? details.message
                : "msg" in details && typeof details.msg === "string"
                    ? details.msg
                    : "error_description" in details && typeof details.error_description === "string"
                        ? details.error_description
                        : null;

            if (detailedMessage) {
                return `${apiError?.message || fallback} ${detailedMessage}`;
            }
        }

        return apiError?.message || error.message || fallback;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return fallback;
}

export function getApiErrorCode(error: unknown) {
    if (axios.isAxiosError<ApiErrorPayload>(error)) {
        return error.response?.data?.error?.code || null;
    }

    return null;
}

export function getApiErrorDetails<T = unknown>(error: unknown) {
    if (axios.isAxiosError<ApiErrorPayload>(error)) {
        return (error.response?.data?.error?.details as T | undefined) ?? null;
    }

    return null;
}
