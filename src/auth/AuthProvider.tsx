import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PropsWithChildren
} from "react";
import axios from "axios";
import type { Session, User } from "@supabase/supabase-js";

import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type BackendSignInResponse,
    type MeResponse,
    type MeSubscriptionResponse
} from "../lib/endpoints";
import { clearStaleSupabaseSession, supabase } from "../lib/supabase";
import type { ApiErrorPayload, AuthMe } from "../types/api";
import { AuthContext, type AuthContextValue } from "./AuthContext";

interface LastApiError {
    status?: number;
    code: string;
    message: string;
}

interface AuthFlowError extends Error {
    code?: string;
    details?: unknown;
}

const SELECTED_BRANCH_KEY = "saccos:selectedBranchId";
const SELECTED_BRANCH_NAME_KEY = "saccos:selectedBranchName";

function createAuthFlowError(
    message: string,
    code?: string,
    details?: unknown
): AuthFlowError {
    const error = new Error(message) as AuthFlowError;
    error.code = code;
    error.details = details;
    return error;
}

export function AuthProvider({ children }: PropsWithChildren) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<AuthMe["profile"]>(null);
    const [branchIds, setBranchIds] = useState<string[]>([]);
    const [subscription, setSubscription] = useState<AuthMe["subscription"]>(null);
    const [loading, setLoading] = useState(true);
    const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
        localStorage.getItem(SELECTED_BRANCH_KEY)
    );
    const [selectedBranchName, setSelectedBranchNameState] = useState<string | null>(
        localStorage.getItem(SELECTED_BRANCH_NAME_KEY)
    );
    const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(null);
    const [selectedTenantName, setSelectedTenantNameState] = useState<string | null>(null);
    const [subscriptionInactive, setSubscriptionInactive] = useState(false);
    const [lastApiError, setLastApiError] = useState<LastApiError | null>(null);
    const [backendUnavailable, setBackendUnavailable] = useState(false);
    const selectedBranchIdRef = useRef(selectedBranchId);
    const selectedBranchNameRef = useRef(selectedBranchName);
    const sessionRef = useRef<Session | null>(null);
    const refreshProfileRequestIdRef = useRef(0);
    const authBootstrappedRef = useRef(false);

    useEffect(() => {
        selectedBranchIdRef.current = selectedBranchId;
    }, [selectedBranchId]);

    useEffect(() => {
        selectedBranchNameRef.current = selectedBranchName;
    }, [selectedBranchName]);

    useEffect(() => {
        sessionRef.current = session;
    }, [session]);

    const clearAuthState = useCallback(() => {
        refreshProfileRequestIdRef.current += 1;
        setProfile(null);
        setBranchIds([]);
        setSubscription(null);
        setSubscriptionInactive(false);
        setSelectedTenantIdState(null);
        setSelectedTenantNameState(null);
    }, []);

    const discardInvalidSession = useCallback(async () => {
        try {
            await supabase.auth.signOut({ scope: "local" });
        } catch {
            // Ignore local sign-out failures and still clear stale browser state.
        }

        clearStaleSupabaseSession();
        setSession(null);
        setUser(null);
        setLastApiError(null);
        setBackendUnavailable(false);
        clearAuthState();
    }, [clearAuthState]);

    const refreshProfile = useCallback(async () => {
        const requestId = ++refreshProfileRequestIdRef.current;

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;

            if (!accessToken) {
                await discardInvalidSession();
                return;
            }

            const { data } = await api.get<MeResponse>(endpoints.users.me());
            const tenantId = data.data.tenant?.id || data.data.profile?.tenant_id || null;
            const tenantName = data.data.tenant?.name || null;
            const subscriptionResponse = tenantId
                ? await api.get<MeSubscriptionResponse>(endpoints.me.subscription(), {
                    params: { tenant_id: tenantId }
                })
                : null;

            if (requestId !== refreshProfileRequestIdRef.current) {
                return;
            }

            setProfile(data.data.profile);
            setBranchIds(data.data.branch_ids || []);
            setSubscription(subscriptionResponse?.data.data || data.data.subscription || null);
            setSubscriptionInactive(Boolean(subscriptionResponse?.data.data && subscriptionResponse.data.data.isUsable === false));
            setSelectedTenantIdState(tenantId);
            setSelectedTenantNameState(tenantName);

            const firstBranch = data.data.branches?.[0];
            setBackendUnavailable(false);

            if (firstBranch) {
                setSelectedBranchIdState(firstBranch.id);
                setSelectedBranchNameState(firstBranch.name);
            } else if (data.data.branch_ids?.length) {
                setSelectedBranchIdState(data.data.branch_ids[0]);
            }
        } catch (error) {
            if (requestId !== refreshProfileRequestIdRef.current) {
                return;
            }

            const message = getApiErrorMessage(error);
            const errorCode =
                typeof error === "object" &&
                error !== null &&
                "response" in error &&
                typeof error.response === "object" &&
                error.response !== null &&
                "data" in error.response
                    ? (error.response as { data?: { error?: { code?: string } } }).data?.error?.code
                    : undefined;

            if (errorCode === "TENANT_ID_REQUIRED" || errorCode === "PROFILE_NOT_FOUND") {
                setBackendUnavailable(false);
                clearAuthState();
                return;
            }

            if (errorCode === "AUTH_TOKEN_MISSING" || errorCode === "AUTH_TOKEN_INVALID") {
                await discardInvalidSession();
                return;
            }

            setLastApiError({
                code: errorCode || "PROFILE_REFRESH_FAILED",
                message
            });
            setBackendUnavailable(true);
            clearAuthState();
        }
    }, [clearAuthState, discardInvalidSession]);

    useEffect(() => {
        const {
            data: { subscription: authSubscription }
        } = supabase.auth.onAuthStateChange((event, nextSession) => {
            const hadSession = Boolean(sessionRef.current);
            setSession(nextSession);
            setUser(nextSession?.user ?? null);

            if (!nextSession) {
                clearAuthState();
                setBackendUnavailable(false);
                authBootstrappedRef.current = true;
                setLoading(false);
                return;
            }

            const shouldShowGlobalLoader =
                !authBootstrappedRef.current
                || event === "INITIAL_SESSION"
                || (event === "SIGNED_IN" && !hadSession);

            if (shouldShowGlobalLoader) {
                setLoading(true);
            }

            void refreshProfile().finally(() => {
                authBootstrappedRef.current = true;

                if (shouldShowGlobalLoader) {
                    setLoading(false);
                }
            });
        });

        void supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setUser(data.session?.user ?? null);

            if (data.session) {
                setLoading(true);
                void refreshProfile().finally(() => {
                    authBootstrappedRef.current = true;
                    setLoading(false);
                });
                return;
            }

            authBootstrappedRef.current = true;
            setBackendUnavailable(false);
            setLoading(false);
        }).catch(async (error) => {
            const message = error instanceof Error ? error.message : "";

            if (message.toLowerCase().includes("invalid refresh token")) {
                await supabase.auth.signOut({ scope: "local" });
                clearStaleSupabaseSession();
            }

            clearAuthState();
            authBootstrappedRef.current = true;
            setBackendUnavailable(false);
            setLoading(false);
        });

        return () => {
            authSubscription.unsubscribe();
        };
    }, [clearAuthState, refreshProfile]);

    useEffect(() => {
        const handleSubscriptionInactive = () => setSubscriptionInactive(true);
        const handleApiError = (event: Event) => {
            const customEvent = event as CustomEvent<LastApiError>;
            setLastApiError(customEvent.detail);
        };

        window.addEventListener("saccos:subscription-inactive", handleSubscriptionInactive);
        window.addEventListener("saccos:api-error", handleApiError);

        return () => {
            window.removeEventListener("saccos:subscription-inactive", handleSubscriptionInactive);
            window.removeEventListener("saccos:api-error", handleApiError);
        };
    }, []);

    const signIn = useCallback(async (
        email: string,
        password: string,
        options?: { totpCode?: string | null; recoveryCode?: string | null }
    ) => {
        setLoading(true);
        clearStaleSupabaseSession();
        localStorage.removeItem(SELECTED_BRANCH_KEY);
        localStorage.removeItem(SELECTED_BRANCH_NAME_KEY);
        setSelectedBranchIdState(null);
        setSelectedBranchNameState(null);
        clearAuthState();
        setBackendUnavailable(false);

        try {
            const { data } = await api.post<BackendSignInResponse>(endpoints.auth.backendSignIn(), {
                email,
                password,
                totp_code: options?.totpCode || undefined,
                recovery_code: options?.recoveryCode || undefined
            });

            const accessToken = data.session?.access_token;
            const refreshToken = data.session?.refresh_token;

            if (!accessToken || !refreshToken) {
                throw createAuthFlowError(
                    "Authentication session is incomplete.",
                    "SESSION_MISSING"
                );
            }

            const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });

            if (error) {
                throw error;
            }
        } catch (error) {
            setLoading(false);
            if (axios.isAxiosError<ApiErrorPayload>(error)) {
                const code = error.response?.data?.error?.code;
                const details = error.response?.data?.error?.details;

                throw createAuthFlowError(
                    getApiErrorMessage(error, "Unable to sign in."),
                    code,
                    details
                );
            }

            if (error instanceof Error) {
                throw createAuthFlowError(error.message);
            }

            throw createAuthFlowError("Unable to sign in.");
        }
    }, [clearAuthState]);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        clearStaleSupabaseSession();
        localStorage.removeItem(SELECTED_BRANCH_KEY);
        localStorage.removeItem(SELECTED_BRANCH_NAME_KEY);
        setSelectedBranchIdState(null);
        setSelectedBranchNameState(null);
        clearAuthState();
        setBackendUnavailable(false);
    }, [clearAuthState]);

    const markPasswordChanged = useCallback(() => {
        const changedAt = new Date().toISOString();
        setProfile((current) => current
            ? {
                ...current,
                must_change_password: false,
                first_login_at: current.first_login_at || changedAt
            }
            : current);
    }, []);

    const setSelectedBranchId = useCallback((value: string | null) => {
        setSelectedBranchIdState(value);

        if (value) {
            localStorage.setItem(SELECTED_BRANCH_KEY, value);
        } else {
            localStorage.removeItem(SELECTED_BRANCH_KEY);
            localStorage.removeItem(SELECTED_BRANCH_NAME_KEY);
            setSelectedBranchNameState(null);
        }
    }, []);

    const isInternalOps = Boolean(
        user?.app_metadata?.platform_role === "internal_ops" ||
        user?.app_metadata?.platform_role === "platform_admin" ||
        user?.app_metadata?.platform_role === "platform_owner" ||
        profile?.role === "platform_admin" ||
        profile?.role === "platform_owner"
    );

    const twoFactorSetupRequired = Boolean(
        !isInternalOps &&
        profile?.two_factor_required &&
        profile?.two_factor_setup_required
    );

    const value = useMemo<AuthContextValue>(() => ({
        session,
        user,
        profile,
        platformRole:
            typeof user?.app_metadata?.platform_role === "string"
                ? user.app_metadata.platform_role
                : profile?.role === "platform_admin" || profile?.role === "platform_owner"
                    ? profile.role
                    : null,
        branchIds,
        subscription,
        loading,
        selectedTenantId,
        selectedBranchId,
        selectedTenantName,
        selectedBranchName,
        subscriptionInactive,
        lastApiError,
        backendUnavailable,
        twoFactorSetupRequired,
        signIn,
        signOut,
        refreshProfile,
        markPasswordChanged,
        setSelectedBranchId,
        clearSubscriptionWarning: () => setSubscriptionInactive(false),
        isInternalOps
    }), [
        branchIds,
        lastApiError,
        loading,
        profile,
        markPasswordChanged,
        refreshProfile,
        selectedBranchId,
        selectedTenantId,
        selectedTenantName,
        selectedBranchName,
        session,
        signIn,
        signOut,
        subscription,
        subscriptionInactive,
        twoFactorSetupRequired,
        user,
        backendUnavailable,
        setSelectedBranchId,
        isInternalOps
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
