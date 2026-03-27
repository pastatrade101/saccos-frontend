import { useCallback, useEffect, useRef, useState } from "react";

import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type NotificationResponse,
    type NotificationsArchiveReadResponse,
    type NotificationsMarkAllReadResponse,
    type NotificationsResponse
} from "../lib/endpoints";
import { supabase } from "../lib/supabase";
import type { NotificationItem, NotificationStatus } from "../types/api";

interface UseNotificationsOptions {
    tenantId?: string | null;
    recipientUserId?: string | null;
    recentOnly?: boolean;
    status?: "all" | NotificationStatus;
    limit?: number;
    pollMs?: number;
    onNewNotification?: (notification: NotificationItem) => void;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
    const {
        tenantId,
        recipientUserId,
        recentOnly = false,
        status = "all",
        limit = recentOnly ? 5 : 20,
        pollMs = 60000,
        onNewNotification
    } = options;

    const [items, setItems] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const onNewNotificationRef = useRef(onNewNotification);
    const toastedIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        onNewNotificationRef.current = onNewNotification;
    }, [onNewNotification]);

    const refresh = useCallback(async () => {
        if (!tenantId) {
            setItems([]);
            setUnreadCount(0);
            setTotal(0);
            return;
        }

        setLoading(true);
        try {
            const response = await api.get<NotificationsResponse>(endpoints.notifications.list(), {
                params: {
                    tenant_id: tenantId,
                    recent_only: recentOnly,
                    status,
                    limit
                }
            });

            setItems(response.data.data.items || []);
            setUnreadCount(Number(response.data.data.unread_count || 0));
            setTotal(Number(response.data.data.total || 0));
            setError(null);
        } catch (requestError) {
            setError(getApiErrorMessage(requestError, "Unable to load notifications."));
        } finally {
            setLoading(false);
        }
    }, [tenantId, recentOnly, status, limit]);

    async function markRead(notificationId: string) {
        if (!notificationId) return null;

        const response = await api.patch<NotificationResponse>(endpoints.notifications.markRead(notificationId));
        const updated = response.data.data;

        setItems((current) => current.map((item) => item.id === notificationId ? updated : item));
        if (updated.status === "read") {
            setUnreadCount((current) => Math.max(0, current - 1));
        }

        return updated;
    }

    async function markAllRead() {
        if (!tenantId) return 0;

        const response = await api.patch<NotificationsMarkAllReadResponse>(endpoints.notifications.markAllRead(), {
            tenant_id: tenantId
        });

        const updatedCount = Number(response.data.data.updated || 0);
        setItems((current) => current.map((item) => ({
            ...item,
            status: item.status === "unread" ? "read" : item.status,
            read_at: item.status === "unread" ? new Date().toISOString() : item.read_at
        })));
        setUnreadCount(0);
        return updatedCount;
    }

    async function archive(notificationId: string) {
        if (!notificationId) return null;

        const currentItem = items.find((item) => item.id === notificationId) || null;
        const response = await api.patch<NotificationResponse>(endpoints.notifications.archive(notificationId));
        const archived = response.data.data;

        setItems((current) => {
            if (status === "archived") {
                return current.map((item) => item.id === notificationId ? archived : item);
            }
            return current.filter((item) => item.id !== notificationId);
        });
        setTotal((current) => Math.max(0, status === "archived" ? current : current - 1));
        if (archived.status === "archived") {
            setUnreadCount((current) => Math.max(0, current - (currentItem?.status === "unread" ? 1 : 0)));
        }

        return archived;
    }

    async function archiveRead() {
        if (!tenantId) return 0;

        const response = await api.patch<NotificationsArchiveReadResponse>(endpoints.notifications.archiveRead(), {
            tenant_id: tenantId
        });

        const updatedCount = Number(response.data.data.updated || 0);
        setItems((current) => status === "archived"
            ? current
            : current.filter((item) => item.status !== "read")
        );
        setTotal((current) => Math.max(0, status === "archived" ? current : current - updatedCount));
        return updatedCount;
    }

    useEffect(() => {
        void refresh();

        if (!tenantId || !pollMs) {
            return undefined;
        }

        const timer = window.setInterval(() => {
            void refresh();
        }, pollMs);

        return () => window.clearInterval(timer);
    }, [tenantId, pollMs, refresh]);

    useEffect(() => {
        if (!tenantId || !recipientUserId) {
            return undefined;
        }

        const channel = supabase
            .channel(`notifications:${tenantId}:${recipientUserId}:${recentOnly ? "recent" : status}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "notifications",
                    filter: `recipient_user_id=eq.${recipientUserId}`
                },
                (payload) => {
                    const nextRecord = payload.new as NotificationItem | undefined;

                    if (payload.eventType === "INSERT" && nextRecord?.tenant_id === tenantId) {
                        if (!toastedIdsRef.current.has(nextRecord.id)) {
                            toastedIdsRef.current.add(nextRecord.id);
                            onNewNotificationRef.current?.(nextRecord);
                        }
                    }

                    void refresh();
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [tenantId, recipientUserId, recentOnly, status, refresh]);

    return {
        items,
        unreadCount,
        total,
        loading,
        error,
        refresh,
        markRead,
        markAllRead,
        archive,
        archiveRead
    };
}
