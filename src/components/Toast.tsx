import { Alert, Snackbar } from "@mui/material";
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

type ToastType = "success" | "error";

interface ToastItem {
    id: number;
    title: string;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    pushToast: (toast: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: PropsWithChildren) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const value = useMemo<ToastContextValue>(() => ({
        pushToast: (toast) => {
            const id = Date.now() + Math.random();
            setToasts((current) => [...current, { ...toast, id }]);

            window.setTimeout(() => {
                setToasts((current) => current.filter((item) => item.id !== id));
            }, 4500);
        }
    }), []);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {toasts.map((toast, index) => (
                <Snackbar
                    key={toast.id}
                    open
                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                    sx={{ mt: `${index * 9}px` }}
                >
                    <Alert severity={toast.type} variant="filled" sx={{ width: 360 }}>
                        <strong>{toast.title}</strong>
                        <div>{toast.message}</div>
                    </Alert>
                </Snackbar>
            ))}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }

    return context;
}
