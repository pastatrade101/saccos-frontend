import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type PropsWithChildren
} from "react";

type ThemeMode = "light" | "dark";

interface UIContextValue {
    theme: ThemeMode;
    isDesktop: boolean;
    sidebarCollapsed: boolean;
    mobileSidebarOpen: boolean;
    toggleTheme: () => void;
    toggleSidebar: () => void;
    closeMobileSidebar: () => void;
}

const THEME_KEY = "saccos:theme";
const SIDEBAR_KEY = "saccos:sidebar-collapsed";
const DESKTOP_MEDIA = "(min-width: 981px)";

const UIContext = createContext<UIContextValue | undefined>(undefined);

function getInitialTheme(): ThemeMode {
    const storedTheme = localStorage.getItem(THEME_KEY);

    if (storedTheme === "light" || storedTheme === "dark") {
        return storedTheme;
    }

    return "light";
}

function getInitialSidebarState() {
    return localStorage.getItem(SIDEBAR_KEY) === "true";
}

export function UIProvider({ children }: PropsWithChildren) {
    const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
    const [isDesktop, setIsDesktop] = useState(window.matchMedia(DESKTOP_MEDIA).matches);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarState);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    useEffect(() => {
        const mediaQuery = window.matchMedia(DESKTOP_MEDIA);
        const onChange = (event: MediaQueryListEvent) => {
            setIsDesktop(event.matches);

            if (event.matches) {
                setMobileSidebarOpen(false);
            }
        };

        setIsDesktop(mediaQuery.matches);
        mediaQuery.addEventListener("change", onChange);

        return () => {
            mediaQuery.removeEventListener("change", onChange);
        };
    }, []);

    useEffect(() => {
        localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
    }, [sidebarCollapsed]);

    const value = useMemo<UIContextValue>(() => ({
        theme,
        isDesktop,
        sidebarCollapsed,
        mobileSidebarOpen,
        toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
        toggleSidebar: () => {
            if (isDesktop) {
                setSidebarCollapsed((current) => !current);
                return;
            }

            setMobileSidebarOpen((current) => !current);
        },
        closeMobileSidebar: () => setMobileSidebarOpen(false)
    }), [isDesktop, mobileSidebarOpen, sidebarCollapsed, theme]);

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
    const context = useContext(UIContext);

    if (!context) {
        throw new Error("useUI must be used within UIProvider");
    }

    return context;
}
