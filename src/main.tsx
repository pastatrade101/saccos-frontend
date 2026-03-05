import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { ToastProvider } from "./components/Toast";
import { AppThemeProvider } from "./ui/AppThemeProvider";
import { UIProvider } from "./ui/UIProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <UIProvider>
                <AppThemeProvider>
                    <AuthProvider>
                        <ToastProvider>
                            <App />
                        </ToastProvider>
                    </AuthProvider>
                </AppThemeProvider>
            </UIProvider>
        </BrowserRouter>
    </React.StrictMode>
);
