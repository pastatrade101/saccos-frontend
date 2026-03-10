import {
    createContext,
    useCallback,
    useContext,
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
    type MeSubscriptionResponse,
    type OtpChallengeResponse
} from "../lib/endpoints";
import { clearStaleSupabaseSession, supabase } from "../lib/supabase";
import type { ApiErrorPayload, AuthMe } from "../types/api";

interface LastApiError {
    status?: number;
    code: string;
    message: string;
}

interface AuthFlowError extends Error {
    code?: string;
    details?: unknown;
}

interface AuthContextValue {
    session: Session | null;
    user: User | null;
    profile: AuthMe["profile"];
    platformRole: string | null;
    branchIds: string[];
    subscription: AuthMe["subscription"];
    loading: boolean;
    selectedTenantId: string | null;
    selectedBranchId: string | null;
    selectedTenantName: string | null;
    selectedBranchName: string | null;
    subscriptionInactive: boolean;
    lastApiError: LastApiError | null;
    backendUnavailable: boolean;
    signIn: (
        email: string,
        password: string,
        options?: { challengeId?: string | null; otpCode?: string | null }
    ) => Promise<void>;
    requestOtp: (
        email: string,
        password: string,
        challengeId?: string | null,
        phone?: string | null
    ) => Promise<OtpChallengeResponse>;
    signOut: () => Promise<void>;
    refreshProfile: (tenantOverride?: string | null) => Promise<void>;
    setSelectedTenantId: (value: string | null, name?: string | null) => void;
    setSelectedBranchId: (value: string | null) => void;
    clearSubscriptionWarning: () => void;
    isInternalOps: boolean;
}

const SELECTED_TENANT_KEY = "saccos:selectedTenantId";
const SELECTED_BRANCH_KEY = "saccos:selectedBranchId";
const SELECTED_TENANT_NAME_KEY = "saccos:selectedTenantName";
const SELECTED_BRANCH_NAME_KEY = "saccos:selectedBranchName";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
    const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(
        localStorage.getItem(SELECTED_TENANT_KEY)
    );
    const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
        localStorage.getItem(SELECTED_BRANCH_KEY)
    );
    const [selectedTenantName, setSelectedTenantNameState] = useState<string | null>(
        localStorage.getItem(SELECTED_TENANT_NAME_KEY)
    );
    const [selectedBranchName, setSelectedBranchNameState] = useState<string | null>(
        localStorage.getItem(SELECTED_BRANCH_NAME_KEY)
    );
    const [subscriptionInactive, setSubscriptionInactive] = useState(false);
    const [lastApiError, setLastApiError] = useState<LastApiError | null>(null);
    const [backendUnavailable, setBackendUnavailable] = useState(false);
    const selectedTenantIdRef = useRef(selectedTenantId);
    const selectedBranchIdRef = useRef(selectedBranchId);
    const selectedTenantNameRef = useRef(selectedTenantName);
    const selectedBranchNameRef = useRef(selectedBranchName);
    const refreshProfileRequestIdRef = useRef(0);

    useEffect(() => {
        selectedTenantIdRef.current = selectedTenantId;
    }, [selectedTenantId]);

    useEffect(() => {
        selectedBranchIdRef.current = selectedBranchId;
    }, [selectedBranchId]);

    useEffect(() => {
        selectedTenantNameRef.current = selectedTenantName;
    }, [selectedTenantName]);

    useEffect(() => {
        selectedBranchNameRef.current = selectedBranchName;
    }, [selectedBranchName]);

    const clearAuthState = useCallback(() => {
        refreshProfileRequestIdRef.current += 1;
        setProfile(null);
        setBranchIds([]);
        setSubscription(null);
        setSubscriptionInactive(false);
    }, []);

    const refreshProfile = useCallback(async (tenantOverride?: string | null) => {
        const requestId = ++refreshProfileRequestIdRef.current;
        const tenantId = tenantOverride ?? selectedTenantIdRef.current;

        try {
            const { data } = await api.get<MeResponse>(endpoints.users.me(), {
                params: tenantId ? { tenant_id: tenantId } : undefined
            });
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

            if (data.data.tenant?.id) {
                if (selectedTenantIdRef.current !== data.data.tenant.id) {
                    setSelectedTenantIdState(data.data.tenant.id);
                    localStorage.setItem(SELECTED_TENANT_KEY, data.data.tenant.id);
                }

                if (selectedTenantNameRef.current !== data.data.tenant.name) {
                    setSelectedTenantNameState(data.data.tenant.name);
                    localStorage.setItem(SELECTED_TENANT_NAME_KEY, data.data.tenant.name);
                }
            } else if (data.data.profile?.tenant_id && data.data.profile.tenant_id !== selectedTenantIdRef.current) {
                setSelectedTenantIdState(data.data.profile.tenant_id);
                localStorage.setItem(SELECTED_TENANT_KEY, data.data.profile.tenant_id);
            }

            const firstBranch = data.data.branches?.[0];
            setBackendUnavailable(false);

            if (firstBranch) {
                if (selectedBranchIdRef.current !== firstBranch.id) {
                    setSelectedBranchIdState(firstBranch.id);
                    localStorage.setItem(SELECTED_BRANCH_KEY, firstBranch.id);
                }

                if (selectedBranchNameRef.current !== firstBranch.name) {
                    setSelectedBranchNameState(firstBranch.name);
                    localStorage.setItem(SELECTED_BRANCH_NAME_KEY, firstBranch.name);
                }
            } else if (!selectedBranchIdRef.current && data.data.branch_ids?.length) {
                setSelectedBranchIdState(data.data.branch_ids[0]);
                localStorage.setItem(SELECTED_BRANCH_KEY, data.data.branch_ids[0]);
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

            setLastApiError({
                code: errorCode || "PROFILE_REFRESH_FAILED",
                message
            });
            setBackendUnavailable(true);
            clearAuthState();
        }
    }, [clearAuthState]);

    useEffect(() => {
        const {
            data: { subscription: authSubscription }
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setUser(nextSession?.user ?? null);

            if (!nextSession) {
                clearAuthState();
                setBackendUnavailable(false);
                setLoading(false);
                return;
            }

            setLoading(true);
            void refreshProfile().finally(() => {
                setLoading(false);
            });
        });

        void supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setUser(data.session?.user ?? null);

            if (data.session) {
                setLoading(true);
                void refreshProfile().finally(() => {
                    setLoading(false);
                });
                return;
            }

            setBackendUnavailable(false);
            setLoading(false);
        }).catch(async (error) => {
            const message = error instanceof Error ? error.message : "";

            if (message.toLowerCase().includes("invalid refresh token")) {
                await supabase.auth.signOut({ scope: "local" });
                clearStaleSupabaseSession();
            }

            clearAuthState();
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
        options?: { challengeId?: string | null; otpCode?: string | null }
    ) => {
        clearStaleSupabaseSession();
        localStorage.removeItem(SELECTED_TENANT_KEY);
        localStorage.removeItem(SELECTED_BRANCH_KEY);
        localStorage.removeItem(SELECTED_TENANT_NAME_KEY);
        localStorage.removeItem(SELECTED_BRANCH_NAME_KEY);
        setSelectedTenantIdState(null);
        setSelectedBranchIdState(null);
        setSelectedTenantNameState(null);
        setSelectedBranchNameState(null);
        clearAuthState();
        setBackendUnavailable(false);

        try {
            const { data } = await api.post<BackendSignInResponse>(endpoints.auth.backendSignIn(), {
                email,
                password,
                challenge_id: options?.challengeId || undefined,
                otp_code: options?.otpCode || undefined
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

    const requestOtp = useCallback(async (
        email: string,
        password: string,
        challengeId?: string | null,
        phone?: string | null
    ) => {
        try {
            const { data } = await api.post<OtpChallengeResponse>(endpoints.auth.otpSend(), {
                email,
                password,
                challenge_id: challengeId || undefined,
                phone: phone || undefined
            });

            return data;
        } catch (error) {
            if (axios.isAxiosError<ApiErrorPayload>(error)) {
                const code = error.response?.data?.error?.code;
                const details = error.response?.data?.error?.details;

                throw createAuthFlowError(
                    getApiErrorMessage(error, "Unable to send OTP."),
                    code,
                    details
                );
            }

            if (error instanceof Error) {
                throw createAuthFlowError(error.message);
            }

            throw createAuthFlowError("Unable to send OTP.");
        }
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        clearStaleSupabaseSession();
        localStorage.removeItem(SELECTED_TENANT_KEY);
        localStorage.removeItem(SELECTED_BRANCH_KEY);
        localStorage.removeItem(SELECTED_TENANT_NAME_KEY);
        localStorage.removeItem(SELECTED_BRANCH_NAME_KEY);
        setSelectedTenantIdState(null);
        setSelectedBranchIdState(null);
        setSelectedTenantNameState(null);
        setSelectedBranchNameState(null);
        clearAuthState();
        setBackendUnavailable(false);
    }, [clearAuthState]);

    const setSelectedTenantId = useCallback((value: string | null, name?: string | null) => {
        setSelectedTenantIdState(value);

        if (value) {
            localStorage.setItem(SELECTED_TENANT_KEY, value);
        } else {
            localStorage.removeItem(SELECTED_TENANT_KEY);
        }

        if (name !== undefined) {
            setSelectedTenantNameState(name);

            if (name) {
                localStorage.setItem(SELECTED_TENANT_NAME_KEY, name);
            } else {
                localStorage.removeItem(SELECTED_TENANT_NAME_KEY);
            }
        }
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
        signIn,
        requestOtp,
        signOut,
        refreshProfile,
        setSelectedTenantId,
        setSelectedBranchId,
        clearSubscriptionWarning: () => setSubscriptionInactive(false),
        isInternalOps:
            user?.app_metadata?.platform_role === "internal_ops" ||
            user?.app_metadata?.platform_role === "platform_admin" ||
            user?.app_metadata?.platform_role === "platform_owner" ||
            profile?.role === "platform_admin" ||
            profile?.role === "platform_owner"
    }), [
        branchIds,
        lastApiError,
        loading,
        profile,
        refreshProfile,
        selectedBranchId,
        selectedTenantId,
        selectedTenantName,
        selectedBranchName,
        session,
        requestOtp,
        signIn,
        signOut,
        subscription,
        subscriptionInactive,
        user,
        backendUnavailable,
        setSelectedBranchId,
        setSelectedTenantId
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }

    return context;
}
