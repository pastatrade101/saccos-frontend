import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

import type { AuthMe } from "../types/api";

export interface AuthContextValue {
    session: Session | null;
    user: User | null;
    profile: AuthMe["profile"];
    platformRole: string | null;
    branchIds: string[];
    loading: boolean;
    selectedBranchId: string | null;
    selectedBranchName: string | null;
    lastApiError: {
        status?: number;
        code: string;
        message: string;
    } | null;
    backendUnavailable: boolean;
    twoFactorSetupRequired: boolean;
    signIn: (
        email: string,
        password: string,
        options?: { totpCode?: string | null; recoveryCode?: string | null }
    ) => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    markPasswordChanged: () => void;
    setSelectedBranchId: (value: string | null) => void;
    isInternalOps: boolean;
    selectedTenantId: string | null;
    selectedTenantName: string | null;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }

    return context;
}
