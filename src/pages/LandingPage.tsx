import { MotionCard, MotionModal } from "../ui/motion";
import {
    AppBar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Divider,
    Drawer,
    Grid,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Stack,
    Toolbar,
    Typography,
    alpha,
    useTheme
} from "@mui/material";
import { useState } from "react";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import HealthAndSafetyRoundedIcon from "@mui/icons-material/HealthAndSafetyRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import NightlightRoundedIcon from "@mui/icons-material/NightlightRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import PieChartRoundedIcon from "@mui/icons-material/PieChartRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import { Link as RouterLink } from "react-router-dom";

import { useUI } from "../ui/UIProvider";

const planCards = [
    {
        code: "Starter",
        description: "Perfect for small SACCOS starting digital operations.",
        highlight: false,
        features: [
            "Member registration and profiles",
            "Daily cash desk transactions",
            "Role-based staff access",
            "Basic reports for management"
        ]
    },
    {
        code: "Growth",
        description: "Best for growing SACCOS handling loans and dividends every day.",
        highlight: true,
        features: [
            "Loan applications, appraisal, and tracking",
            "Share contributions and dividends",
            "Approval workflow for sensitive actions",
            "Branch dashboards and richer reports"
        ]
    },
    {
        code: "Enterprise",
        description: "For large institutions that need stronger controls and multi-branch visibility.",
        highlight: false,
        features: [
            "Multi-branch operations at scale",
            "Advanced approval chains",
            "Audit-friendly logs and evidence",
            "Priority rollout support"
        ]
    }
] as const;

const productModules = [
    {
        title: "Members",
        copy: "Register members quickly, keep records clean, and track account details in one place.",
        icon: <PeopleAltRoundedIcon />
    },
    {
        title: "Cash Desk",
        copy: "Handle deposits, withdrawals, and contributions with a simple, guided flow.",
        icon: <PaidRoundedIcon />
    },
    {
        title: "Loans",
        copy: "Manage loan requests, approvals, disbursement, and repayment without losing track.",
        icon: <AutoGraphRoundedIcon />
    },
    {
        title: "Shares and Dividends",
        copy: "Track share growth and run dividend cycles with clear records for every member.",
        icon: <PieChartRoundedIcon />
    },
    {
        title: "Audit Trail",
        copy: "Every key action is logged so managers and auditors can review with confidence.",
        icon: <GavelRoundedIcon />
    },
    {
        title: "Tenant Management",
        copy: "Run one or many SACCOS workspaces with separate data and simple plan control.",
        icon: <LanRoundedIcon />
    }
] as const;

const buyerValuePillars = [
    {
        title: "Safer Money Movement",
        copy: "Built-in checks help prevent risky mistakes before money is posted.",
        icon: <HealthAndSafetyRoundedIcon />
    },
    {
        title: "Faster Daily Work",
        copy: "Your team handles members, cash, loans, and reports from one dashboard.",
        icon: <AutoGraphRoundedIcon />
    },
    {
        title: "Better Member Service",
        copy: "Give members clearer records, faster responses, and more trust in your process.",
        icon: <PeopleAltRoundedIcon />
    },
    {
        title: "Ready to Scale",
        copy: "Start small today and expand branches and users without changing systems.",
        icon: <LanRoundedIcon />
    }
] as const;

const whyDifferentPoints = [
    "Only the right person can approve sensitive actions.",
    "Important actions leave a clear, searchable history.",
    "Loan and cash workflows follow clear approval steps.",
    "The system blocks high-risk actions until checks are complete.",
    "Controls are enforced by the backend, not just the screen."
] as const;

const onboardingSteps = [
    {
        step: "01",
        title: "Book a quick demo",
        description: "Tell us your branch size and goals so we can guide you."
    },
    {
        step: "02",
        title: "Choose your plan",
        description: "Pick Starter, Growth, or Enterprise based on your needs."
    },
    {
        step: "03",
        title: "We set up your workspace",
        description: "Your tenant, roles, and access are prepared for your team."
    },
    {
        step: "04",
        title: "Start operations",
        description: "Your team signs in and starts serving members immediately."
    }
] as const;

const demoStorySteps = [
    {
        step: "01",
        title: "Register a member",
        description: "Your officer adds member details once and keeps records clean."
    },
    {
        step: "02",
        title: "Member requests a loan",
        description: "The application enters one clear workflow."
    },
    {
        step: "03",
        title: "Loan officer appraises",
        description: "The officer reviews terms and updates the appraisal."
    },
    {
        step: "04",
        title: "Branch manager decides",
        description: "The manager approves or rejects based on policy."
    },
    {
        step: "05",
        title: "Teller disburses",
        description: "Funds are released and recorded with receipt evidence."
    },
    {
        step: "06",
        title: "Repayments are tracked",
        description: "Installments and balances update in real time."
    },
    {
        step: "07",
        title: "Reports update automatically",
        description: "Leadership sees performance without manual spreadsheets."
    },
    {
        step: "08",
        title: "Auditor reviews history",
        description: "Every step can be traced from request to final posting."
    }
] as const;

const enterpriseReadinessPhases = [
    {
        phase: "Step 1",
        priority: "Now",
        title: "Map your process",
        copy: "We align your member, loan, and cash workflow to how your team works today."
    },
    {
        phase: "Step 2",
        priority: "Now",
        title: "Set access and approvals",
        copy: "We set user roles and approval rules so sensitive actions are controlled."
    },
    {
        phase: "Step 3",
        priority: "Now",
        title: "Load your starting data",
        copy: "Members and opening balances are prepared so your team can start cleanly."
    },
    {
        phase: "Step 4",
        priority: "Next",
        title: "Train your staff",
        copy: "Your team learns the daily flow in plain, practical sessions."
    },
    {
        phase: "Step 5",
        priority: "Next",
        title: "Go live branch by branch",
        copy: "You can launch one branch first and expand when the team is ready."
    },
    {
        phase: "Step 6",
        priority: "Next",
        title: "Track daily performance",
        copy: "Managers monitor loans, cash, and member activity from dashboards."
    },
    {
        phase: "Step 7",
        priority: "Grow",
        title: "Strengthen audits and reports",
        copy: "Use built-in logs and reports to simplify compliance and reviews."
    },
    {
        phase: "Step 8",
        priority: "Grow",
        title: "Scale with confidence",
        copy: "Add more users and branches while keeping the same simple workflow."
    }
] as const;

export function LandingPage() {
    const theme = useTheme();
    const { theme: mode, toggleTheme } = useUI();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const isDark = mode === "dark";

    const ownerName = import.meta.env.VITE_MARKETING_OWNER_NAME || "Platform Owner";
    const ownerEmail = import.meta.env.VITE_MARKETING_OWNER_EMAIL || "";
    const ownerPhone = import.meta.env.VITE_MARKETING_OWNER_PHONE || "";
    const ownerWhatsApp = import.meta.env.VITE_MARKETING_OWNER_WHATSAPP || "";
    const ownerCompany = import.meta.env.VITE_MARKETING_OWNER_COMPANY || "SMART SACCOS";
    const logoSrc = "/SACCOSS-LOGO.png";

    const whatsappNumber = ownerWhatsApp.replace(/[^\d]/g, "");
    const contactHref = ownerEmail
        ? `mailto:${ownerEmail}?subject=${encodeURIComponent("SACCOS SaaS plan inquiry")}`
        : ownerPhone
            ? `tel:${ownerPhone}`
            : "/signin";
    const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : null;
    const shellBg = isDark
        ? "radial-gradient(circle at 14% 12%, rgba(90,112,156,0.16), transparent 30%), radial-gradient(circle at 84% 10%, rgba(72,153,145,0.11), transparent 28%), radial-gradient(circle at 52% 88%, rgba(206,162,82,0.12), transparent 30%), linear-gradient(180deg, #070c16 0%, #0b121d 55%, #101827 100%)"
        : "radial-gradient(circle at 14% 12%, rgba(92,109,255,0.14), transparent 30%), radial-gradient(circle at 84% 10%, rgba(39,209,187,0.12), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #f3f8ff 55%, #f7fbff 100%)";
    const glassSurface = isDark
        ? alpha(theme.palette.background.paper, 0.62)
        : alpha(theme.palette.common.white, 0.84);
    const sectionSurface = isDark
        ? alpha(theme.palette.background.paper, 0.54)
        : alpha(theme.palette.common.white, 0.9);
    const cardBorder = alpha(theme.palette.divider, isDark ? 0.52 : 0.82);
    const accentColor = isDark ? "#D9B273" : theme.palette.primary.main;
    const sectionCardSx = {
        borderRadius: 3,
        border: `1px solid ${cardBorder}`,
        bgcolor: sectionSurface,
        backdropFilter: "blur(10px)",
        boxShadow: isDark
            ? "0 20px 44px rgba(0, 0, 0, 0.34)"
            : "0 18px 40px rgba(12, 23, 44, 0.1)"
    } as const;

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "background.default",
                color: "text.primary",
                backgroundImage: shellBg
            }}
        >
            <AppBar
                position="sticky"
                color="transparent"
                elevation={0}
                sx={{
                    borderBottom: `1px solid ${alpha(theme.palette.divider, isDark ? 0.45 : 0.72)}`
                }}
            >
                <Toolbar
                    sx={{
                        minHeight: { xs: 64, md: 76 },
                        px: { xs: 1.5, sm: 2.5 },
                        backdropFilter: "blur(18px)",
                        bgcolor: glassSurface
                    }}
                >
                    <Container maxWidth="xl" sx={{ display: "flex", alignItems: "center", gap: { xs: 1, md: 2 } }}>
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Box
                                sx={{
                                    width: { xs: 36, md: 44 },
                                    height: { xs: 36, md: 44 },
                                    borderRadius: 1.5,
                                    bgcolor: "#ffffff",
                                    display: "grid",
                                    placeItems: "center",
                                    flexShrink: 0,
                                    boxShadow: `0 14px 30px ${alpha(accentColor, isDark ? 0.3 : 0.22)}`
                                }}
                            >
                                <Box
                                    component="img"
                                    src={logoSrc}
                                    alt="SMART SACCOS logo"
                                    sx={{
                                        width: { xs: 24, md: 30 },
                                        height: { xs: 24, md: 30 },
                                        objectFit: "contain"
                                    }}
                                />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle1"
                                    sx={{ fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
                                >
                                    {ownerCompany}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: { xs: "none", sm: "block" }, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
                                >
                                    Simple software to run your SACCOS
                                </Typography>
                            </Box>
                        </Stack>

                        <Stack
                            direction="row"
                            spacing={0.75}
                            sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}
                        >
                            <Button component="a" href="#solutions" color="inherit">
                                Solutions
                            </Button>
                            <Button component="a" href="#readiness" color="inherit">
                                Go Live Steps
                            </Button>
                            <Button component="a" href="#why-different" color="inherit">
                                Why Different
                            </Button>
                            <Button component="a" href="#plans" color="inherit">
                                Plans
                            </Button>
                            <Button component="a" href="#how-it-works" color="inherit">
                                How It Works
                            </Button>
                            <Button component="a" href="#contact" color="inherit">
                                Contact
                            </Button>
                        </Stack>

                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                            <IconButton onClick={toggleTheme} color="inherit" size="small">
                                {mode === "dark" ? <LightModeRoundedIcon /> : <NightlightRoundedIcon />}
                            </IconButton>
                            <Button component={RouterLink} to="/signin" variant="text" color="inherit" sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                                Sign in
                            </Button>
                            <Button
                                component={RouterLink}
                                to="/signup"
                                variant="outlined"
                                color="inherit"
                                sx={{
                                    display: { xs: "none", sm: "inline-flex" },
                                    borderColor: alpha(theme.palette.common.white, 0.6),
                                    color: "#ffffff"
                                }}
                            >
                                Apply for membership
                            </Button>
                            <Button
                                component="a"
                                href={contactHref}
                                variant="contained"
                                endIcon={<ArrowForwardRoundedIcon />}
                                sx={{
                                    display: { xs: "none", md: "inline-flex" },
                                    ...(isDark
                                        ? {
                                              bgcolor: accentColor,
                                              color: "#1a1a1a",
                                              "&:hover": { bgcolor: alpha(accentColor, 0.86) }
                                          }
                                        : {})
                                }}
                            >
                                Book demo
                            </Button>
                            <IconButton
                                color="inherit"
                                size="small"
                                sx={{ display: { xs: "inline-flex", md: "none" } }}
                                onClick={() => setMobileNavOpen(true)}
                            >
                                <MenuRoundedIcon />
                            </IconButton>
                        </Stack>
                    </Container>
                </Toolbar>
            </AppBar>

            <Drawer
                anchor="top"
                open={mobileNavOpen}
                onClose={() => setMobileNavOpen(false)}
                PaperProps={{
                    sx: {
                        mt: "64px",
                        borderRadius: 0,
                        borderBottom: `1px solid ${theme.palette.divider}`
                    }
                }}
            >
                <Box sx={{ px: 1.5, py: 1 }}>
                    <List disablePadding>
                        {[
                            { label: "Solutions", href: "#solutions" },
                            { label: "Go Live Steps", href: "#readiness" },
                            { label: "Why Different", href: "#why-different" },
                            { label: "Plans", href: "#plans" },
                            { label: "How It Works", href: "#how-it-works" },
                            { label: "Contact", href: "#contact" }
                        ].map((item) => (
                            <ListItemButton
                                key={item.href}
                                component="a"
                                href={item.href}
                                onClick={() => setMobileNavOpen(false)}
                                sx={{ borderRadius: 1 }}
                            >
                                <ListItemText primary={item.label} />
                            </ListItemButton>
                        ))}
                    </List>
                    <Stack direction="row" spacing={1} sx={{ px: 1, py: 1.5 }}>
                        <Button
                            component={RouterLink}
                            to="/signin"
                            variant="outlined"
                            fullWidth
                            onClick={() => setMobileNavOpen(false)}
                            sx={
                                isDark
                                    ? {
                                          borderColor: alpha(accentColor, 0.5),
                                          color: accentColor,
                                          "&:hover": {
                                              borderColor: alpha(accentColor, 0.8),
                                              bgcolor: alpha(accentColor, 0.12)
                                          }
                                      }
                                    : undefined
                            }
                        >
                            Sign in
                        </Button>
                        <Button
                            component={RouterLink}
                            to="/signup"
                            variant="contained"
                            fullWidth
                            onClick={() => setMobileNavOpen(false)}
                            sx={
                                isDark
                                    ? {
                                          bgcolor: accentColor,
                                          color: "#1a1a1a",
                                          "&:hover": { bgcolor: alpha(accentColor, 0.86) }
                                      }
                                    : undefined
                            }
                        >
                            Apply now
                        </Button>
                        <Button
                            component="a"
                            href={contactHref}
                            variant="contained"
                            fullWidth
                            onClick={() => setMobileNavOpen(false)}
                            sx={
                                isDark
                                    ? {
                                          bgcolor: accentColor,
                                          color: "#1a1a1a",
                                          "&:hover": { bgcolor: alpha(accentColor, 0.86) }
                                      }
                                    : undefined
                            }
                        >
                            Book demo
                        </Button>
                    </Stack>
                </Box>
            </Drawer>

            <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
                <Box
                    sx={{
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: 3,
                        px: { xs: 2.25, md: 4.5 },
                        py: { xs: 4, md: 6.5 },
                        mb: { xs: 4, md: 5 },
                        backgroundImage: `linear-gradient(135deg, ${
                            mode === "light"
                                ? "rgba(8, 18, 44, 0.78), rgba(16, 44, 74, 0.5)"
                                : "rgba(6, 10, 18, 0.88), rgba(25, 34, 42, 0.72)"
                        }), url('/13321.jpg')`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        border: `1px solid ${alpha("#ffffff", isDark ? 0.14 : 0.28)}`,
                        boxShadow: `0 30px 70px ${alpha(theme.palette.common.black, mode === "light" ? 0.14 : 0.36)}`,
                        "&::after": {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                            background:
                                mode === "light"
                                    ? "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0))"
                                    : "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0))",
                            pointerEvents: "none"
                        },
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            width: 420,
                            height: 420,
                            borderRadius: "50%",
                            top: -220,
                            right: -120,
                            background: isDark
                                ? "radial-gradient(circle, rgba(199,162,95,0.24), rgba(199,162,95,0) 65%)"
                                : "radial-gradient(circle, rgba(115,134,255,0.3), rgba(115,134,255,0) 65%)",
                            pointerEvents: "none"
                        }
                    }}
                >
                <Grid container spacing={4} alignItems="center" sx={{ position: "relative", zIndex: 1 }}>
                    <Grid size={{ xs: 12, lg: 7 }}>
                        <Stack spacing={3}>
                            <Chip
                                icon={<VerifiedRoundedIcon />}
                                label="Simple, guided SACCOS platform"
                                sx={{
                                    alignSelf: "flex-start",
                                    bgcolor: alpha("#ffffff", 0.12),
                                    color: "#ffffff",
                                    fontWeight: 700
                                }}
                            />
                            <Typography
                                variant="h2"
                                sx={{
                                    color: "#ffffff",
                                    fontSize: { xs: "2.15rem", md: "3.9rem" },
                                    lineHeight: 1.04,
                                    letterSpacing: { xs: -1.3, md: -2.2 },
                                    fontWeight: 800,
                                    maxWidth: 820
                                }}
                            >
                                Run your SACCOS from one simple system.
                            </Typography>
                            <Typography
                                variant="h6"
                                sx={{
                                    maxWidth: 720,
                                    fontWeight: 500,
                                    lineHeight: 1.6,
                                    color: alpha("#ffffff", 0.86)
                                }}
                            >
                                Manage members, loans, cash, approvals, and reports in one place.
                                Your team follows clear steps, so daily operations are faster and safer.
                            </Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                <Button
                                    component="a"
                                    href={contactHref}
                                    size="large"
                                    variant="contained"
                                    endIcon={<ArrowForwardRoundedIcon />}
                                    sx={{
                                        bgcolor: "#ffffff",
                                        color: accentColor,
                                        "&:hover": { bgcolor: alpha("#ffffff", 0.92) }
                                    }}
                                >
                                    Book a demo
                                </Button>
                                <Button
                                    component="a"
                                    href="#plans"
                                    size="large"
                                    variant="outlined"
                                    sx={{
                                        borderColor: alpha("#ffffff", 0.4),
                                        color: "#ffffff",
                                        "&:hover": { borderColor: alpha("#ffffff", 0.7), bgcolor: alpha("#ffffff", 0.08) }
                                    }}
                                >
                                    Explore plans
                                </Button>
                                <Button
                                    component={RouterLink}
                                    to="/signup"
                                    size="large"
                                    variant="outlined"
                                    sx={{
                                        borderColor: alpha("#ffffff", 0.4),
                                        color: "#ffffff",
                                        "&:hover": { borderColor: alpha("#ffffff", 0.7), bgcolor: alpha("#ffffff", 0.08) }
                                    }}
                                >
                                    Apply for membership
                                </Button>
                            </Stack>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} sx={{ pt: 1 }}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <SecurityRoundedIcon sx={{ color: "#ffffff" }} />
                                    <Typography variant="body1" sx={{ color: alpha("#ffffff", 0.82) }}>
                                        Separate workspace per SACCOS
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <HealthAndSafetyRoundedIcon sx={{ color: "#ffffff" }} />
                                    <Typography variant="body1" sx={{ color: alpha("#ffffff", 0.82) }}>
                                        Clear records for every transaction
                                    </Typography>
                                </Stack>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <InsightsRoundedIcon sx={{ color: "#ffffff" }} />
                                        <Typography variant="body1" sx={{ color: alpha("#ffffff", 0.82) }}>
                                        Easy to scale branch by branch
                                        </Typography>
                                    </Stack>
                                </Stack>
                        </Stack>
                    </Grid>

                    <Grid size={{ xs: 12, lg: 5 }}>
                        <Paper
                            sx={{
                                p: { xs: 2.5, md: 3.5 },
                                borderRadius: 2.5,
                                background:
                                    mode === "light"
                                        ? "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(247,249,255,0.92) 100%)"
                                        : "linear-gradient(180deg, rgba(26,31,41,0.94) 0%, rgba(20,24,34,0.92) 100%)",
                                backdropFilter: "blur(8px)",
                                border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.42 : 0.82)}`,
                                boxShadow: `0 30px 60px ${alpha(theme.palette.common.black, mode === "light" ? 0.1 : 0.32)}`
                            }}
                        >
                            <Stack spacing={2.5}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Box>
                                        <Typography variant="overline" sx={{ fontWeight: 800, color: accentColor }}>
                                            Start here
                                        </Typography>
                                        <Typography variant="h5">Go live in 4 simple steps</Typography>
                                    </Box>
                                    <Chip
                                        label="Guided setup"
                                        variant="outlined"
                                        sx={{
                                            borderColor: alpha(accentColor, isDark ? 0.66 : 0.48),
                                            color: accentColor
                                        }}
                                    />
                                </Stack>

                                <Grid container spacing={1.5}>
                                    {onboardingSteps.map((step) => (
                        <Grid key={step.step} size={{ xs: 12, sm: 6 }}>
                                            <MotionCard
                                                sx={{
                                                    height: "100%",
                                                    borderRadius: 2,
                                                    bgcolor: alpha(accentColor, isDark ? 0.15 : 0.04)
                                                }}
                                            >
                                                <CardContent sx={{ p: 2.25 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: accentColor }}>
                                                        {step.step}
                                                    </Typography>
                                                    <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 700 }}>
                                                        {step.title}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                        {step.description}
                                                    </Typography>
                                                </CardContent>
                                            </MotionCard>
                                        </Grid>
                                    ))}
                                </Grid>

                                <Divider />

                                <Stack spacing={1.25}>
                                    {[
                                        "We help you choose the right plan for your size",
                                        "Your workspace is set up with secure staff logins",
                                        "Your team starts with a clear day-to-day workflow"
                                    ].map((item) => (
                                        <Stack key={item} direction="row" spacing={1.25} alignItems="flex-start">
                                            <CheckCircleRoundedIcon color="success" fontSize="small" sx={{ mt: 0.2 }} />
                                            <Typography variant="body2" color="text.secondary">
                                                {item}
                                            </Typography>
                                        </Stack>
                                    ))}
                                </Stack>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>
                </Box>

                <Grid container spacing={2} sx={{ mt: { xs: 4, md: 5 } }}>
                    {[
                        { value: "4", label: "Steps to go live", caption: "from first demo to team access" },
                        { value: "1", label: "Platform for all teams", caption: "members, loans, cash, approvals, and reports" },
                        { value: "0", label: "Paper chasing", caption: "replace manual follow-up with clear workflows" }
                    ].map((stat) => (
                        <Grid key={stat.label} size={{ xs: 12, md: 4 }}>
                            <Paper sx={{ ...sectionCardSx, p: 3 }}>
                                <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: -1.1 }}>
                                    {stat.value}
                                </Typography>
                                <Typography variant="h6" sx={{ mt: 0.6, fontWeight: 700 }}>
                                    {stat.label}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    {stat.caption}
                                </Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            </Container>

            <Box id="readiness" sx={{ py: { xs: 7, md: 9 } }}>
                <Container maxWidth="xl">
                    <Stack spacing={1} sx={{ mb: 4 }}>
                        <Typography variant="overline" sx={{ fontWeight: 800, color: accentColor }}>
                            Go-live checklist
                        </Typography>
                        <Typography variant="h3" sx={{ maxWidth: 860 }}>
                            A simple plan to move from setup to daily operations.
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 860 }}>
                            We guide setup, access, training, and rollout so your team can start quickly and operate with confidence.
                        </Typography>
                    </Stack>

                    <Grid container spacing={2}>
                        {enterpriseReadinessPhases.map((item) => (
                            <Grid key={item.phase} size={{ xs: 12, md: 6, lg: 3 }}>
                                <MotionCard sx={{ ...sectionCardSx, height: "100%" }}>
                                    <CardContent sx={{ p: 2.75 }}>
                                        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                {item.phase}
                                            </Typography>
                                            <Chip
                                                size="small"
                                                label={item.priority}
                                                sx={{
                                                    fontWeight: 700,
                                                    bgcolor: alpha(accentColor, isDark ? 0.18 : 0.08),
                                                    color: accentColor,
                                                    border: `1px solid ${alpha(accentColor, isDark ? 0.42 : 0.24)}`
                                                }}
                                            />
                                        </Stack>
                                        <Typography variant="subtitle1" sx={{ mt: 1.1, fontWeight: 700 }}>
                                            {item.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2, lineHeight: 1.75 }}>
                                            {item.copy}
                                        </Typography>
                                    </CardContent>
                                </MotionCard>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            <Box
                id="solutions"
                sx={{
                    py: { xs: 7, md: 9 },
                    background: isDark
                        ? "linear-gradient(180deg, rgba(9, 14, 22, 0) 0%, rgba(26, 29, 31, 0.42) 100%)"
                        : "linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(231, 241, 255, 0.42) 100%)"
                }}
            >
                <Container maxWidth="xl">
                    <Stack spacing={1} sx={{ mb: 4 }}>
                        <Typography variant="overline" sx={{ fontWeight: 800, color: accentColor }}>
                            What you get
                        </Typography>
                        <Typography variant="h3" sx={{ maxWidth: 760 }}>
                            Everything your SACCOS team needs in one place.
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
                            Use one system for daily work, leadership visibility, and better member service.
                        </Typography>
                    </Stack>

                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        {buyerValuePillars.map((item) => (
                            <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
                                <MotionCard sx={{ ...sectionCardSx, height: "100%" }}>
                                    <CardContent sx={{ p: 2.75 }}>
                                        <Box sx={{ color: accentColor, lineHeight: 0 }}>{item.icon}</Box>
                                        <Typography variant="h6" sx={{ mt: 1.5 }}>
                                            {item.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                            {item.copy}
                                        </Typography>
                                    </CardContent>
                                </MotionCard>
                            </Grid>
                        ))}
                    </Grid>

                    <Stack spacing={1} sx={{ mb: 3 }}>
                        <Typography variant="overline" sx={{ fontWeight: 800, color: accentColor }}>
                            Core features
                        </Typography>
                        <Typography variant="h4" sx={{ maxWidth: 760 }}>
                            Tools your team can understand on day one.
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
                            Each section is built for real branch work, with fewer clicks and clearer steps.
                        </Typography>
                    </Stack>

                    <Grid container spacing={2}>
                        {productModules.map((module) => (
                            <Grid key={module.title} size={{ xs: 12, md: 6, lg: 4 }}>
                                <MotionCard sx={{ ...sectionCardSx, height: "100%" }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box
                                            sx={{
                                                width: 52,
                                                height: 52,
                                                borderRadius: 2.5,
                                                display: "grid",
                                                placeItems: "center",
                                                bgcolor: alpha(accentColor, isDark ? 0.2 : 0.1),
                                                color: accentColor,
                                                mb: 2
                                            }}
                                        >
                                            {module.icon}
                                        </Box>
                                        <Typography variant="h6">{module.title}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, lineHeight: 1.75 }}>
                                            {module.copy}
                                        </Typography>
                                    </CardContent>
                                </MotionCard>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            <Box
                id="why-different"
                sx={{
                    py: { xs: 7, md: 9 },
                    background: isDark
                        ? "linear-gradient(180deg, rgba(28, 31, 40, 0.34), rgba(14, 18, 28, 0.5))"
                        : "linear-gradient(180deg, rgba(51, 99, 255, 0.08), rgba(51, 99, 255, 0.03))"
                }}
            >
                <Container maxWidth="xl">
                    <Grid container spacing={4} alignItems="stretch">
                        <Grid size={{ xs: 12, lg: 6 }}>
                            <Paper sx={{ ...sectionCardSx, p: { xs: 3, md: 4 }, height: "100%" }}>
                                <Typography variant="overline" sx={{ fontWeight: 800, color: accentColor }}>
                                    Why teams choose this platform
                                </Typography>
                                <Typography variant="h4" sx={{ mt: 1, mb: 1.5 }}>
                                    Rules are built in, so mistakes are reduced.
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 620 }}>
                                    Instead of relying on manual follow-up, the system guides each step and blocks risky actions.
                                </Typography>

                                <Stack spacing={1.75}>
                                    {whyDifferentPoints.map((point) => (
                                        <Stack key={point} direction="row" spacing={1.5} alignItems="flex-start">
                                            <LockRoundedIcon fontSize="small" sx={{ mt: 0.2, color: accentColor }} />
                                            <Typography variant="body2" color="text.secondary">
                                                {point}
                                            </Typography>
                                        </Stack>
                                    ))}
                                </Stack>
                            </Paper>
                        </Grid>

                        <Grid size={{ xs: 12, lg: 6 }}>
                            <Paper sx={{ ...sectionCardSx, p: { xs: 3, md: 4 }, height: "100%" }}>
                                <Typography variant="overline" sx={{ fontWeight: 800, color: accentColor }}>
                                    What this means for your SACCOS
                                </Typography>
                                <Typography variant="h4" sx={{ mt: 1, mb: 3 }}>
                                    Safer operations and clearer accountability every day.
                                </Typography>

                                <Grid container spacing={2}>
                                    {[
                                        {
                                            title: "Correct role enforcement",
                                            copy: "No sensitive action executes without a role that is explicitly authorized.",
                                            icon: <GavelRoundedIcon sx={{ color: accentColor }} />
                                        },
                                        {
                                            title: "Traceable operation chain",
                                            copy: "Each key step can be reviewed from request to final posting.",
                                            icon: <InsightsRoundedIcon sx={{ color: accentColor }} />
                                        },
                                        {
                                            title: "Balanced accounting integrity",
                                            copy: "Posting paths are tied to controlled accounting logic and balanced journal outcomes.",
                                            icon: <HealthAndSafetyRoundedIcon sx={{ color: accentColor }} />
                                        },
                                        {
                                            title: "Approval-gated execution",
                                            copy: "High-risk steps like disbursement stay blocked until required approvals are complete.",
                                            icon: <SecurityRoundedIcon sx={{ color: accentColor }} />
                                        }
                                    ].map((item) => (
                                        <Grid key={item.title} size={{ xs: 12, sm: 6 }}>
                                            <MotionCard sx={{ ...sectionCardSx, height: "100%" }}>
                                                <CardContent sx={{ p: 2.5 }}>
                                                    {item.icon}
                                                    <Typography variant="subtitle1" sx={{ mt: 1.5, fontWeight: 700 }}>
                                                        {item.title}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                        {item.copy}
                                                    </Typography>
                                                </CardContent>
                                            </MotionCard>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Paper>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            <Box id="plans" sx={{ py: { xs: 7, md: 9 } }}>
                <Container maxWidth="xl">
                    <Stack spacing={1} sx={{ mb: 4 }}>
                        <Typography variant="overline" sx={{ fontWeight: 800, color: accentColor }}>
                            Plans
                        </Typography>
                        <Typography variant="h3">Choose the plan that fits your SACCOS today.</Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
                            We guide plan selection based on your branch size, workflows, and growth goals.
                        </Typography>
                    </Stack>

                    <Grid container spacing={2}>
                        {planCards.map((plan) => (
                            <Grid key={plan.code} size={{ xs: 12, md: 4 }}>
                                <Paper
                                    sx={{
                                        ...sectionCardSx,
                                        height: "100%",
                                        p: 3,
                                        position: "relative",
                                        overflow: "hidden",
                                        borderColor: plan.highlight ? alpha(accentColor, 0.8) : cardBorder,
                                        boxShadow: plan.highlight
                                            ? `0 24px 50px ${alpha(accentColor, 0.24)}`
                                            : undefined
                                    }}
                                >
                                    {plan.highlight ? (
                                        <Chip
                                            label="Most requested"
                                            sx={{
                                                position: "absolute",
                                                top: 20,
                                                right: 20,
                                                fontWeight: 700,
                                                bgcolor: alpha(accentColor, isDark ? 0.24 : 0.14),
                                                color: accentColor,
                                                border: `1px solid ${alpha(accentColor, isDark ? 0.5 : 0.32)}`
                                            }}
                                        />
                                    ) : null}
                                    <Typography variant="h5">{plan.code}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, minHeight: 72 }}>
                                        {plan.description}
                                    </Typography>
                                    <Divider sx={{ my: 2.5 }} />
                                    <Stack spacing={1.5}>
                                        {plan.features.map((feature) => (
                                            <Stack key={feature} direction="row" spacing={1.25} alignItems="flex-start">
                                                <CheckCircleRoundedIcon fontSize="small" sx={{ mt: 0.2, color: accentColor }} />
                                                <Typography variant="body2" color="text.secondary">
                                                    {feature}
                                                </Typography>
                                            </Stack>
                                        ))}
                                    </Stack>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            <Box id="how-it-works" sx={{ py: { xs: 7, md: 9 } }}>
                <Container maxWidth="xl">
                    <Paper sx={{ ...sectionCardSx, p: { xs: 3, md: 4 } }}>
                        <Grid container spacing={4}>
                            <Grid size={{ xs: 12, lg: 5 }}>
                                <Typography variant="overline" sx={{ fontWeight: 800, color: accentColor }}>
                                    How it works
                                </Typography>
                                <Typography variant="h3" sx={{ mt: 1.25 }}>
                                    See one loan journey step by step.
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                                    From member registration to loan disbursement and reporting, every step is clear and traceable.
                                </Typography>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3 }}>
                                    <Button
                                        component="a"
                                        href={contactHref}
                                        variant="contained"
                                        sx={
                                            isDark
                                                ? {
                                                      bgcolor: accentColor,
                                                      color: "#1a1a1a",
                                                      "&:hover": { bgcolor: alpha(accentColor, 0.86) }
                                                  }
                                                : undefined
                                        }
                                    >
                                        Book demo
                                    </Button>
                                    {whatsappHref ? (
                                        <Button
                                            component="a"
                                            href={whatsappHref}
                                            target="_blank"
                                            rel="noreferrer"
                                            variant="outlined"
                                            sx={
                                                isDark
                                                    ? {
                                                          borderColor: alpha(accentColor, 0.5),
                                                          color: accentColor,
                                                          "&:hover": {
                                                              borderColor: alpha(accentColor, 0.8),
                                                              bgcolor: alpha(accentColor, 0.12)
                                                          }
                                                      }
                                                    : undefined
                                            }
                                        >
                                            WhatsApp
                                        </Button>
                                    ) : null}
                                </Stack>
                            </Grid>
                            <Grid size={{ xs: 12, lg: 7 }}>
                                <Grid container spacing={2}>
                                    {demoStorySteps.map((step) => (
                                        <Grid key={step.step} size={{ xs: 12, md: 6 }}>
                                            <MotionCard sx={{ ...sectionCardSx, height: "100%" }}>
                                                <CardContent sx={{ p: 2.5 }}>
                                                    <Typography variant="h4" sx={{ fontWeight: 800, color: accentColor }}>
                                                        {step.step}
                                                    </Typography>
                                                    <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 700 }}>
                                                        {step.title}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                        {step.description}
                                                    </Typography>
                                                </CardContent>
                                            </MotionCard>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Grid>
                        </Grid>
                    </Paper>
                </Container>
            </Box>

            <Container maxWidth="xl" id="contact" sx={{ pb: { xs: 6, md: 8 } }}>
                <Paper
                    sx={{
                        p: { xs: 3, md: 4 },
                        borderRadius: 3,
                        border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.36 : 0.22)}`,
                        background: isDark
                            ? "linear-gradient(135deg, rgba(26, 35, 50, 0.92) 0%, rgba(55, 77, 88, 0.82) 58%, rgba(123, 95, 52, 0.78) 120%)"
                            : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 120%)`,
                        color: "#ffffff"
                    }}
                >
                    <Grid container spacing={3} alignItems="center">
                        <Grid size={{ xs: 12, lg: 8 }}>
                            <Typography variant="overline" sx={{ color: alpha("#ffffff", 0.76), fontWeight: 800 }}>
                                Ready to get started?
                            </Typography>
                            <Typography variant="h3" sx={{ mt: 1 }}>
                                Talk to us and choose the best plan for your SACCOS.
                            </Typography>
                            <Typography variant="body1" sx={{ mt: 1.5, color: alpha("#ffffff", 0.82), maxWidth: 780 }}>
                                We help you choose a plan, set up your workspace, and onboard your first team members.
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <Stack spacing={1.5}>
                                <Button
                                    component="a"
                                    href={contactHref}
                                    size="large"
                                    variant="contained"
                                    sx={{
                                        bgcolor: "#ffffff",
                                        color: accentColor,
                                        "&:hover": { bgcolor: alpha("#ffffff", 0.92) }
                                    }}
                                >
                                    Contact {ownerName}
                                </Button>
                                <Button
                                    component={RouterLink}
                                    to="/signin"
                                    size="large"
                                    variant="outlined"
                                    sx={{
                                        borderColor: alpha("#ffffff", 0.42),
                                        color: "#ffffff"
                                    }}
                                >
                                    Existing client sign in
                                </Button>
                            </Stack>
                        </Grid>
                    </Grid>
                </Paper>
            </Container>

            <Box
                component="footer"
                sx={{
                    borderTop: `1px solid ${theme.palette.divider}`,
                    py: 4,
                    bgcolor: isDark ? alpha(theme.palette.background.paper, 0.4) : alpha("#ffffff", 0.7)
                }}
            >
                <Container maxWidth="xl">
                    <Grid container spacing={3}>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                                <Box
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 1.5,
                                        bgcolor: "#ffffff",
                                        display: "grid",
                                        placeItems: "center",
                                        border: `1px solid ${alpha(accentColor, 0.24)}`
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src={logoSrc}
                                        alt="SMART SACCOS logo"
                                        sx={{ width: 24, height: 24, objectFit: "contain" }}
                                    />
                                </Box>
                                <Typography variant="h6">{ownerCompany}</Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
                                One simple platform for members, loans, cash, approvals, and reports.
                            </Typography>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
                                Product
                            </Typography>
                            <Stack spacing={0.8}>
                                <Typography component="a" href="#solutions" variant="body2" color="text.secondary" sx={{ textDecoration: "none" }}>
                                    Solutions
                                </Typography>
                                <Typography component="a" href="#readiness" variant="body2" color="text.secondary" sx={{ textDecoration: "none" }}>
                                    Go live steps
                                </Typography>
                                <Typography component="a" href="#why-different" variant="body2" color="text.secondary" sx={{ textDecoration: "none" }}>
                                    Why different
                                </Typography>
                                <Typography component="a" href="#plans" variant="body2" color="text.secondary" sx={{ textDecoration: "none" }}>
                                    Plans
                                </Typography>
                                <Typography component="a" href="#how-it-works" variant="body2" color="text.secondary" sx={{ textDecoration: "none" }}>
                                    How it works
                                </Typography>
                                <Typography component={RouterLink} to="/signin" variant="body2" color="text.secondary" sx={{ textDecoration: "none" }}>
                                    Sign in
                                </Typography>
                            </Stack>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
                                Contact the owner
                            </Typography>
                            <Stack spacing={0.8}>
                                <Typography variant="body2" color="text.secondary">
                                    {ownerName}
                                </Typography>
                                {ownerEmail ? (
                                    <Typography component="a" href={`mailto:${ownerEmail}`} variant="body2" color="text.secondary" sx={{ textDecoration: "none" }}>
                                        {ownerEmail}
                                    </Typography>
                                ) : null}
                                {ownerPhone ? (
                                    <Typography component="a" href={`tel:${ownerPhone}`} variant="body2" color="text.secondary" sx={{ textDecoration: "none" }}>
                                        {ownerPhone}
                                    </Typography>
                                ) : null}
                                {!ownerEmail && !ownerPhone ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Configure owner contact in frontend env for production deployments.
                                    </Typography>
                                ) : null}
                            </Stack>
                        </Grid>
                    </Grid>
                </Container>
            </Box>
        </Box>
    );
}
