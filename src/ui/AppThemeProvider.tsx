import { CssBaseline, GlobalStyles, ThemeProvider, alpha, createTheme } from "@mui/material";
import type { PropsWithChildren } from "react";

import { useUI } from "./UIProvider";
import { brandColors, darkThemeColors, fintechGradient } from "../theme/colors";

export function AppThemeProvider({ children }: PropsWithChildren) {
    const { theme } = useUI();
    const isLight = theme === "light";

    const muiTheme = createTheme({
        palette: {
            mode: theme,
            primary: {
                light: brandColors.primary[300],
                main: brandColors.primary[900],
                dark: brandColors.primary[700],
                contrastText: "#ffffff"
            },
            secondary: {
                light: brandColors.accent[300],
                main: brandColors.accent[500],
                dark: brandColors.accent[700],
                contrastText: "#ffffff"
            },
            success: {
                main: brandColors.success
            },
            warning: {
                main: brandColors.warning
            },
            error: {
                main: brandColors.danger
            },
            info: {
                main: brandColors.info
            },
            background: {
                default: isLight ? brandColors.neutral.background : darkThemeColors.background,
                paper: isLight ? brandColors.neutral.card : darkThemeColors.paper
            },
            text: {
                primary: isLight ? brandColors.neutral.textPrimary : darkThemeColors.textPrimary,
                secondary: isLight ? brandColors.neutral.textSecondary : darkThemeColors.textSecondary
            },
            divider: isLight ? brandColors.neutral.border : darkThemeColors.border
        },
        shape: {
            borderRadius: 8
        },
        typography: {
            fontFamily: '"Source Sans 3", "Segoe UI", sans-serif',
            h4: {
                fontWeight: 700,
                letterSpacing: -0.4
            },
            h5: {
                fontWeight: 700
            },
            h6: {
                fontWeight: 700
            },
            button: {
                fontWeight: 600,
                textTransform: "none"
            }
        },
        components: {
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: "none",
                        border: `1px solid ${isLight ? brandColors.neutral.border : darkThemeColors.border}`,
                        borderRadius: 8
                    }
                }
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        boxShadow: isLight
                            ? "0 10px 28px rgba(15, 23, 42, 0.06)"
                            : "0 14px 32px rgba(0, 0, 0, 0.24)"
                    }
                }
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: true
                },
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        minHeight: 40,
                        paddingInline: 16
                    },
                    containedPrimary: {
                        backgroundColor: brandColors.primary[900],
                        "&:hover": {
                            backgroundColor: brandColors.primary[700]
                        }
                    },
                    containedSecondary: {
                        backgroundColor: brandColors.accent[500],
                        "&:hover": {
                            backgroundColor: brandColors.accent[700]
                        }
                    }
                }
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        backgroundColor: isLight ? "#ffffff" : alpha("#ffffff", 0.04)
                    }
                }
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: 7
                    }
                }
            },
            MuiListItemButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 7
                    }
                }
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8
                    }
                }
            },
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundImage: "none",
                        boxShadow: "none",
                        borderBottom: `1px solid ${isLight ? brandColors.neutral.border : darkThemeColors.border}`,
                        borderRadius: 0
                    }
                }
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        borderRight: `1px solid ${isLight ? brandColors.neutral.border : darkThemeColors.border}`,
                        borderRadius: 0
                    }
                }
            },
            MuiTableCell: {
                styleOverrides: {
                    head: {
                        backgroundColor: isLight ? brandColors.primary[100] : alpha(brandColors.primary[300], 0.12),
                        color: isLight ? brandColors.primary[900] : darkThemeColors.textPrimary
                    }
                }
            }
        }
    });

    return (
        <ThemeProvider theme={muiTheme}>
            <CssBaseline />
            <GlobalStyles
                styles={{
                    ":root": {
                        "--gradient-fintech": fintechGradient
                    },
                    body: {
                        backgroundColor: muiTheme.palette.background.default
                    }
                }}
            />
            {children}
        </ThemeProvider>
    );
}
