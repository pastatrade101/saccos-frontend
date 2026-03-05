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
import type { Session, User } from "@supabase/supabase-js";

import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type MeResponse, type MeSubscriptionResponse } from "../lib/endpoints";
import { clearStaleSupabaseSession, supabase } from "../lib/supabase";
import type { AuthMe } from "../types/api";

interface LastApiError {
    status?: number;
    code: string;
    message: string;
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
    signIn: (email: string, password: string) => Promise<void>;
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
        setProfile(null);
        setBranchIds([]);
        setSubscription(null);
        setSubscriptionInactive(false);
    }, []);

    const refreshProfile = useCallback(async (tenantOverride?: string | null) => {
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

    const signIn = useCallback(async (email: string, password: string) => {
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

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw new Error(error.message);
        }
    }, [clearAuthState]);

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
                : profile?.role === "platform_admin"
                    ? "platform_admin"
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
        signOut,
        refreshProfile,
        setSelectedTenantId,
        setSelectedBranchId,
        clearSubscriptionWarning: () => setSubscriptionInactive(false),
        isInternalOps:
            user?.app_metadata?.platform_role === "internal_ops" ||
            user?.app_metadata?.platform_role === "platform_admin" ||
            profile?.role === "platform_admin"
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
