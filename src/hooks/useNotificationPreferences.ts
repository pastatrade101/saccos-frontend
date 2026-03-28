import { useCallback, useEffect, useState } from "react";

import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type NotificationPreferenceResponse,
    type NotificationPreferencesResponse
} from "../lib/endpoints";
import type { NotificationPreferenceItem } from "../types/api";

interface UseNotificationPreferencesOptions {
    tenantId?: string | null;
    enabled?: boolean;
}

interface UpdateNotificationPreferenceInput {
    in_app_enabled?: boolean;
    sms_enabled?: boolean;
    toast_enabled?: boolean;
}

export function useNotificationPreferences(options: UseNotificationPreferencesOptions = {}) {
    const { tenantId, enabled = true } = options;

    const [items, setItems] = useState<NotificationPreferenceItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingEventType, setSavingEventType] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!enabled || !tenantId) {
            setItems([]);
            setError(null);
            return;
        }

        setLoading(true);
        try {
            const response = await api.get<NotificationPreferencesResponse>(endpoints.notifications.preferences(), {
                params: { tenant_id: tenantId }
            });

            setItems(response.data.data || []);
            setError(null);
        } catch (requestError) {
            setError(getApiErrorMessage(requestError, "Unable to load notification preferences."));
        } finally {
            setLoading(false);
        }
    }, [enabled, tenantId]);

    async function updatePreference(eventType: string, payload: UpdateNotificationPreferenceInput) {
        if (!enabled || !tenantId || !eventType) return null;

        setSavingEventType(eventType);
        try {
            const response = await api.patch<NotificationPreferenceResponse>(
                endpoints.notifications.preference(eventType),
                {
                    tenant_id: tenantId,
                    ...payload
                }
            );

            const updated = response.data.data;
            setItems((current) => current.map((item) => item.event_type === eventType ? updated : item));
            setError(null);
            return updated;
        } catch (requestError) {
            throw new Error(getApiErrorMessage(requestError, "Unable to update notification preference."));
        } finally {
            setSavingEventType(null);
        }
    }

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        items,
        loading,
        savingEventType,
        error,
        refresh,
        updatePreference
    };
}
