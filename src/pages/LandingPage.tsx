import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import {
    AppBar,
    Box,
    Button,
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

import { useUI } from "../ui/UIProvider";

const coreCapabilities = [
    {
        title: "Member lifecycle",
        copy: "Handle member application, approval, activation, balances, and self-service from one workspace.",
        icon: <PeopleAltRoundedIcon />
    },
    {
        title: "Savings and shares",
        copy: "Track deposits, share contributions, dividend visibility, and running balances with clear history.",
        icon: <SavingsRoundedIcon />
    },
    {
        title: "Lending operations",
        copy: "Manage loan application, appraisal, approval, disbursement, repayment, and follow-up without spreadsheet drift.",
        icon: <TrendingUpRoundedIcon />
    },
    {
        title: "Payments and collections",
        copy: "Support teller cash flows and member self-service collections through guided payment flows.",
        icon: <PaymentsRoundedIcon />
    },
    {
        title: "Controls and approvals",
        copy: "Keep risky operations approval-gated with role-aware execution paths and audit-friendly traceability.",
        icon: <ShieldRoundedIcon />
    },
    {
        title: "Reports and visibility",
        copy: "Give management branch revenue, loan performance, cash control, and operational reporting in real time.",
        icon: <ReceiptLongRoundedIcon />
    }
] as const;

const memberJourney = [
    "Apply for membership online",
    "Branch reviews and approves",
    "Member pays the membership fee",
    "Savings and share accounts become active",
    "Member contributes, repays, and tracks statements in the portal"
] as const;

const operatingPrinciples = [
    {
        title: "Built for one SACCO, not a generic platform",
        copy: "The experience is focused on one institution, one team, one member base, and one operating model."
    },
    {
        title: "Real branch workflows",
        copy: "Branch manager, teller, loan officer, auditor, and member journeys are handled as distinct roles."
    },
    {
        title: "Controls at the backend",
        copy: "Approval, branch access, posting rules, and account ownership are enforced by system logic, not just UI hints."
    }
] as const;

const quickStats = [
    { value: "1", label: "Unified SACCO workspace" },
    { value: "6", label: "Core operating areas" },
    { value: "24/7", label: "Member self-service reach" }
] as const;

const workspaceAreas = [
    "Members and applications",
    "Contributions and savings",
    "Loan operations",
    "Payments and repayment flows",
    "Revenue and reports",
    "Approvals, controls, and audit support"
] as const;

export function LandingPage() {
    const theme = useTheme();
    const { theme: mode, toggleTheme } = useUI();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const isDark = mode === "dark";

    const ownerName = import.meta.env.VITE_MARKETING_OWNER_NAME || "SACCO Team";
    const ownerEmail = import.meta.env.VITE_MARKETING_OWNER_EMAIL || "";
    const ownerPhone = import.meta.env.VITE_MARKETING_OWNER_PHONE || "";
    const ownerWhatsApp = import.meta.env.VITE_MARKETING_OWNER_WHATSAPP || "";
    const ownerCompany = import.meta.env.VITE_MARKETING_OWNER_COMPANY || "SMART SACCOS";
    const logoSrc = "/SACCOSS-LOGO.png";

    const whatsappNumber = ownerWhatsApp.replace(/[^\d]/g, "");
    const contactHref = ownerEmail
        ? `mailto:${ownerEmail}?subject=${encodeURIComponent(`${ownerCompany} product inquiry`)}`
        : ownerPhone
            ? `tel:${ownerPhone}`
            : "/signin";
    const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : null;

    const shellBg = isDark
        ? `radial-gradient(circle at 12% 10%, ${alpha("#67E8F9", 0.12)} 0%, transparent 28%),
            radial-gradient(circle at 88% 8%, ${alpha("#3B82F6", 0.16)} 0%, transparent 22%),
            linear-gradient(180deg, #07111d 0%, #0b1524 54%, #101827 100%)`
        : `radial-gradient(circle at 12% 8%, ${alpha("#CDE4FF", 0.95)} 0%, transparent 28%),
            radial-gradient(circle at 86% 10%, ${alpha("#DDF7FF", 0.9)} 0%, transparent 22%),
            linear-gradient(180deg, #f7fbff 0%, #f4f8ff 58%, #f8fbff 100%)`;
    const glassSurface = isDark ? alpha("#0F172A", 0.8) : alpha("#FFFFFF", 0.88);
    const sectionSurface = isDark ? alpha("#111C2D", 0.84) : alpha("#FFFFFF", 0.92);
    const borderColor = isDark ? alpha("#FFFFFF", 0.1) : alpha("#B9D4FF", 0.72);
    const primaryAccent = isDark ? "#8DD8FF" : "#2358E8";
    const secondaryAccent = isDark ? "#72E1B4" : "#0E9F6E";
    const pageShadow = isDark ? "0 24px 60px rgba(2, 6, 23, 0.34)" : "0 24px 60px rgba(34, 73, 154, 0.12)";

    const navItems = [
        { label: "Overview", href: "#overview" },
        { label: "Capabilities", href: "#capabilities" },
        { label: "Member Experience", href: "#member-experience" },
        { label: "Controls", href: "#controls" },
        { label: "Contact", href: "#contact" }
    ] as const;

    return (
        <Box
            sx={{
                minHeight: "100vh",
                color: "text.primary",
                backgroundImage: shellBg,
                backgroundAttachment: { md: "fixed" }
            }}
        >
            <AppBar
                position="sticky"
                color="transparent"
                elevation={0}
                sx={{
                    top: 0,
                    zIndex: theme.zIndex.appBar,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, isDark ? 0.24 : 0.42)}`,
                    backgroundColor: "transparent",
                    boxShadow: "none"
                }}
            >
                <Toolbar
                    sx={{
                        minHeight: { xs: 68, md: 78 },
                        backdropFilter: "blur(18px)",
                        bgcolor: alpha(glassSurface, isDark ? 0.62 : 0.7)
                    }}
                >
                    <Container maxWidth="xl" sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Box
                                sx={{
                                    width: { xs: 40, md: 46 },
                                    height: { xs: 40, md: 46 },
                                    borderRadius: 2.25,
                                    bgcolor: alpha("#FFFFFF", isDark ? 0.96 : 1),
                                    display: "grid",
                                    placeItems: "center",
                                    boxShadow: `0 14px 34px ${alpha(primaryAccent, isDark ? 0.14 : 0.18)}`
                                }}
                            >
                                <Box
                                    component="img"
                                    src={logoSrc}
                                    alt={`${ownerCompany} logo`}
                                    sx={{ width: { xs: 26, md: 30 }, height: { xs: 26, md: 30 }, objectFit: "contain" }}
                                />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle1"
                                    sx={{ fontWeight: 800, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                >
                                    {ownerCompany}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    Digital SACCO workspace
                                </Typography>
                            </Box>
                        </Stack>

                        <Stack direction="row" spacing={0.5} sx={{ display: { xs: "none", md: "flex" } }}>
                            {navItems.map((item) => (
                                <Button key={item.href} component="a" href={item.href} color="inherit">
                                    {item.label}
                                </Button>
                            ))}
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center">
                            <IconButton onClick={toggleTheme} color="inherit">
                                {isDark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
                            </IconButton>
                            <Button component={RouterLink} to="/signin" variant="text" color="inherit" sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                                Sign in
                            </Button>
                            <Button
                                component={RouterLink}
                                to="/signup"
                                variant="contained"
                                sx={{
                                    display: { xs: "none", sm: "inline-flex" },
                                    borderRadius: 2.25,
                                    px: 2.4,
                                    bgcolor: isDark ? primaryAccent : "#0F172A",
                                    color: isDark ? "#08111f" : "#FFFFFF",
                                    "&:hover": {
                                        bgcolor: isDark ? alpha(primaryAccent, 0.9) : alpha("#0F172A", 0.92)
                                    }
                                }}
                            >
                                Apply now
                            </Button>
                            <IconButton sx={{ display: { xs: "inline-flex", md: "none" } }} onClick={() => setMobileNavOpen(true)}>
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
                        mt: "68px",
                        borderRadius: 0,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        bgcolor: glassSurface,
                        backdropFilter: "blur(20px)"
                    }
                }}
            >
                <Box sx={{ px: 1.5, py: 1.25 }}>
                    <List disablePadding>
                        {navItems.map((item) => (
                            <ListItemButton
                                key={item.href}
                                component="a"
                                href={item.href}
                                onClick={() => setMobileNavOpen(false)}
                                sx={{ borderRadius: 2 }}
                            >
                                <ListItemText primary={item.label} />
                            </ListItemButton>
                        ))}
                    </List>
                    <Stack direction="row" spacing={1} sx={{ px: 1, py: 1.25 }}>
                        <Button component={RouterLink} to="/signin" variant="outlined" fullWidth onClick={() => setMobileNavOpen(false)}>
                            Sign in
                        </Button>
                        <Button
                            component={RouterLink}
                            to="/signup"
                            variant="contained"
                            fullWidth
                            onClick={() => setMobileNavOpen(false)}
                            sx={{
                                bgcolor: isDark ? primaryAccent : "#0F172A",
                                color: isDark ? "#08111f" : "#FFFFFF"
                            }}
                        >
                            Apply now
                        </Button>
                    </Stack>
                </Box>
            </Drawer>

            <Box
                sx={{
                    px: 0,
                    pt: 0
                }}
            >
                <Paper
                    id="overview"
                    elevation={0}
                    sx={{
                        minHeight: { xs: "auto", md: 720 },
                        pt: { xs: 11, md: 16 },
                        pb: { xs: 4.5, md: 6 },
                        px: 0,
                        borderRadius: 0,
                        border: "none",
                        boxShadow: pageShadow,
                        backgroundImage: isDark
                            ? `linear-gradient(140deg, ${alpha("#07111D", 0.58)} 0%, ${alpha("#0B1730", 0.48)} 50%, ${alpha("#08101E", 0.62)} 100%), url("/bk.jpg")`
                            : `linear-gradient(145deg, ${alpha("#FFFFFF", 0.72)} 0%, ${alpha("#F4F8FF", 0.56)} 48%, ${alpha("#EEF4FF", 0.5)} 100%), url("/bk.jpg")`,
                        backgroundSize: "cover",
                        backgroundPosition: "center center",
                        backgroundRepeat: "no-repeat",
                        position: "relative",
                        overflow: "hidden",
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                            background: isDark
                                ? `linear-gradient(90deg, ${alpha("#08111F", 0.34)} 0%, ${alpha("#08111F", 0.08)} 46%, ${alpha("#08111F", 0.26)} 100%),
                                    radial-gradient(circle at 80% 18%, ${alpha(primaryAccent, 0.16)} 0%, transparent 26%),
                                    radial-gradient(circle at 72% 82%, ${alpha(secondaryAccent, 0.12)} 0%, transparent 24%)`
                                : `linear-gradient(90deg, ${alpha("#FFFFFF", 0.34)} 0%, ${alpha("#FFFFFF", 0.06)} 46%, ${alpha("#F5F9FF", 0.2)} 100%),
                                    radial-gradient(circle at 78% 18%, ${alpha("#B8D8FF", 0.56)} 0%, transparent 28%),
                                    radial-gradient(circle at 70% 80%, ${alpha("#D7F3E7", 0.52)} 0%, transparent 24%)`,
                            pointerEvents: "none"
                        }
                    }}
                >
                    <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
                        <Grid container spacing={{ xs: 4, md: 5 }} alignItems="center">
                        <Grid size={{ xs: 12, lg: 5.5 }}>
                            <Stack spacing={{ xs: 2.2, md: 2.6 }}>
                                <Chip
                                    label="Single-tenant SACCO system"
                                    sx={{
                                        alignSelf: "flex-start",
                                        height: 34,
                                        borderRadius: 1.25,
                                        bgcolor: isDark ? alpha(primaryAccent, 0.16) : alpha(primaryAccent, 0.08),
                                        color: primaryAccent,
                                        fontWeight: 700
                                    }}
                                />
                                <Typography
                                    variant="h1"
                                    sx={{
                                        fontSize: { xs: "2.7rem", md: "4.5rem", xl: "5rem" },
                                        lineHeight: { xs: 1.02, md: 0.95 },
                                        letterSpacing: "-0.06em",
                                        fontWeight: 800,
                                        maxWidth: 680
                                    }}
                                >
                                    Run your SACCO from one digital workspace.
                                </Typography>
                                <Typography
                                    variant="h6"
                                    sx={{
                                        color: "text.secondary",
                                        fontWeight: 500,
                                        lineHeight: 1.68,
                                        maxWidth: 620
                                    }}
                                >
                                    A dedicated digital system for SACCO teams to manage members, contributions, savings, loans, approvals, and reporting in one secure environment.
                                </Typography>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} useFlexGap flexWrap="wrap">
                                    <Button
                                        component={RouterLink}
                                        to="/signup"
                                        variant="contained"
                                        endIcon={<ArrowForwardRoundedIcon />}
                                        sx={{
                                            borderRadius: 1.4,
                                            px: 2.7,
                                            minHeight: 48,
                                            bgcolor: isDark ? primaryAccent : "#0F172A",
                                            color: isDark ? "#08111f" : "#FFFFFF"
                                        }}
                                    >
                                        Start membership
                                    </Button>
                                    <Button
                                        component={RouterLink}
                                        to="/signin"
                                        variant="outlined"
                                        sx={{ borderRadius: 1.4, minHeight: 48, px: 2.7 }}
                                    >
                                        Staff sign in
                                    </Button>
                                </Stack>
                                <Button
                                    component="a"
                                    href={contactHref}
                                    variant="text"
                                    sx={{
                                        alignSelf: "flex-start",
                                        px: 0,
                                        minHeight: "auto",
                                        borderRadius: 0,
                                        fontWeight: 700
                                    }}
                                >
                                    Request a walkthrough
                                </Button>
                                <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.8, fontWeight: 500 }}>
                                    Branch manager • Teller • Loan officer • Auditor • Member portal
                                </Typography>
                            </Stack>
                        </Grid>

                        <Grid size={{ xs: 12, lg: 6.5 }}>
                            <Box
                                sx={{
                                    position: "relative",
                                    maxWidth: 760,
                                    mx: "auto",
                                    py: { xs: 1, md: 2 }
                                }}
                            >
                                <Box
                                    sx={{
                                        position: "absolute",
                                        inset: { xs: "6% 4%", md: "4% 6%" },
                                        borderRadius: 4,
                                        background: isDark
                                            ? `radial-gradient(circle at 24% 24%, ${alpha(primaryAccent, 0.22)} 0%, transparent 28%),
                                                radial-gradient(circle at 80% 78%, ${alpha(secondaryAccent, 0.18)} 0%, transparent 26%)`
                                            : `radial-gradient(circle at 24% 24%, ${alpha("#CFE3FF", 0.95)} 0%, transparent 30%),
                                                radial-gradient(circle at 78% 76%, ${alpha("#DDF7FF", 0.95)} 0%, transparent 28%)`,
                                        filter: "blur(18px)"
                                    }}
                                />
                                <Paper
                                    elevation={0}
                                    sx={{
                                        position: "relative",
                                        p: { xs: 1.6, md: 2.25 },
                                        borderRadius: 2.2,
                                        border: `1px solid ${borderColor}`,
                                        bgcolor: isDark ? alpha("#101B2C", 0.92) : alpha("#FFFFFF", 0.98),
                                        boxShadow: isDark
                                            ? "0 28px 60px rgba(2, 6, 23, 0.34)"
                                            : "0 28px 60px rgba(34, 73, 154, 0.14)"
                                    }}
                                >
                                    <Stack spacing={1.8}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <Stack direction="row" spacing={0.8} alignItems="center">
                                                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: alpha(theme.palette.text.secondary, 0.38) }} />
                                                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: alpha(theme.palette.text.secondary, 0.26) }} />
                                                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: secondaryAccent }} />
                                            </Stack>
                                            <Chip
                                                label="Live workspace"
                                                size="small"
                                                sx={{
                                                    borderRadius: 1,
                                                    bgcolor: isDark ? alpha(primaryAccent, 0.14) : alpha(primaryAccent, 0.08),
                                                    color: primaryAccent,
                                                    fontWeight: 700
                                                }}
                                            />
                                        </Stack>

                                        <Grid container spacing={1.5}>
                                            <Grid size={{ xs: 12, md: 8 }}>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: { xs: 1.8, md: 2.2 },
                                                        borderRadius: 1.75,
                                                        minHeight: 240,
                                                        border: `1px solid ${alpha(borderColor, 0.86)}`,
                                                        bgcolor: isDark ? alpha("#0D1727", 0.92) : alpha("#F9FBFF", 0.98),
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        justifyContent: "space-between"
                                                    }}
                                                >
                                                    <Stack spacing={1.2}>
                                                        <Typography variant="overline" sx={{ color: primaryAccent, fontWeight: 800, letterSpacing: "0.16em" }}>
                                                            SACCO OPERATIONS
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.06 }}>
                                                            Members, loans, payments, and reports in one place.
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7, maxWidth: 420 }}>
                                                            A single operating workspace for staff execution, member self-service, and management visibility.
                                                        </Typography>
                                                    </Stack>
                                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1}>
                                                        {[
                                                            { label: "Members", value: "1,248" },
                                                            { label: "Active loans", value: "312" },
                                                            { label: "Gross revenue", value: "TSh 18.4M" }
                                                        ].map((item) => (
                                                            <Paper
                                                                key={item.label}
                                                                elevation={0}
                                                                sx={{
                                                                    flex: 1,
                                                                    p: 1.25,
                                                                    borderRadius: 1.25,
                                                                    border: `1px solid ${alpha(borderColor, 0.82)}`,
                                                                    bgcolor: isDark ? alpha("#FFFFFF", 0.03) : alpha("#FFFFFF", 0.9)
                                                                }}
                                                            >
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {item.label}
                                                                </Typography>
                                                                <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800 }}>
                                                                    {item.value}
                                                                </Typography>
                                                            </Paper>
                                                        ))}
                                                    </Stack>
                                                </Paper>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <Stack spacing={1.5} sx={{ height: "100%" }}>
                                                    <Paper
                                                        elevation={0}
                                                        sx={{
                                                            p: 1.4,
                                                            borderRadius: 1.5,
                                                            border: `1px solid ${alpha(borderColor, 0.84)}`,
                                                            bgcolor: isDark ? alpha("#0E1727", 0.9) : alpha("#FFFFFF", 0.94)
                                                        }}
                                                    >
                                                        <Stack spacing={1}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Lending flow
                                                            </Typography>
                                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                                Appraisal to disbursement
                                                            </Typography>
                                                            <Box sx={{ display: "grid", gap: 0.75 }}>
                                                                {["Application", "Approval", "Disbursement"].map((step) => (
                                                                    <Stack key={step} direction="row" spacing={1} alignItems="center">
                                                                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: secondaryAccent }} />
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            {step}
                                                                        </Typography>
                                                                    </Stack>
                                                                ))}
                                                            </Box>
                                                        </Stack>
                                                    </Paper>
                                                    <Paper
                                                        elevation={0}
                                                        sx={{
                                                            p: 1.4,
                                                            borderRadius: 1.5,
                                                            border: `1px solid ${alpha(borderColor, 0.84)}`,
                                                            bgcolor: isDark ? alpha("#0E1727", 0.9) : alpha("#FFFFFF", 0.94),
                                                            flexGrow: 1
                                                        }}
                                                    >
                                                        <Stack spacing={1}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Member access
                                                            </Typography>
                                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                                Portal and collections
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
                                                                Members can apply, pay fees, contribute, repay, and download statements from one secure portal.
                                                            </Typography>
                                                        </Stack>
                                                    </Paper>
                                                </Stack>
                                            </Grid>
                                        </Grid>
                                    </Stack>
                                </Paper>
                            </Box>
                        </Grid>
                    </Grid>
                    </Container>
                </Paper>
            </Box>

            <Container maxWidth="xl" sx={{ pt: { xs: 4.5, md: 5.5 }, pb: { xs: 4.5, md: 6 } }}>
                <Box>
                    <Grid container spacing={2.25} alignItems="stretch">
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    height: "100%",
                                    p: { xs: 2.5, md: 3 },
                                    borderRadius: 2.25,
                                    border: `1px solid ${borderColor}`,
                                    bgcolor: sectionSurface,
                                    boxShadow: pageShadow
                                }}
                            >
                                <Stack spacing={1.6}>
                                    <Typography variant="overline" sx={{ color: primaryAccent, fontWeight: 800, letterSpacing: "0.16em" }}>
                                        OPERATING MODEL
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                        Built for one SACCO deployment.
                                    </Typography>
                                    <Stack spacing={1.25}>
                                        {operatingPrinciples.map((item) => (
                                            <Box key={item.title}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                    {item.title}
                                                </Typography>
                                                <Typography variant="body2" sx={{ mt: 0.45, color: "text.secondary", lineHeight: 1.7 }}>
                                                    {item.copy}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                </Stack>
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    height: "100%",
                                    p: { xs: 2.5, md: 3 },
                                    borderRadius: 2.25,
                                    border: `1px solid ${borderColor}`,
                                    bgcolor: sectionSurface,
                                    boxShadow: pageShadow
                                }}
                            >
                                <Stack spacing={1.6}>
                                    <Typography variant="overline" sx={{ color: primaryAccent, fontWeight: 800, letterSpacing: "0.16em" }}>
                                        WORKSPACE COVERAGE
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                        Core operational areas in one system.
                                    </Typography>
                                    <Stack spacing={1.05}>
                                        {workspaceAreas.map((item) => (
                                            <Stack key={item} direction="row" spacing={1.15} alignItems="flex-start">
                                                <CheckCircleRoundedIcon sx={{ mt: 0.1, color: secondaryAccent, fontSize: 18 }} />
                                                <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.65 }}>
                                                    {item}
                                                </Typography>
                                            </Stack>
                                        ))}
                                    </Stack>
                                </Stack>
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    height: "100%",
                                    p: { xs: 2.5, md: 3 },
                                    borderRadius: 2.25,
                                    border: `1px solid ${borderColor}`,
                                    bgcolor: sectionSurface,
                                    boxShadow: pageShadow
                                }}
                            >
                                <Stack spacing={1.6}>
                                    <Typography variant="overline" sx={{ color: primaryAccent, fontWeight: 800, letterSpacing: "0.16em" }}>
                                        DEPLOYMENT SNAPSHOT
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                        Ready for branch operations and member service.
                                    </Typography>
                                    <Grid container spacing={1}>
                                        {quickStats.map((item) => (
                                            <Grid key={item.label} size={{ xs: 12, sm: 4, lg: 12 }}>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 1.25,
                                                        borderRadius: 1.4,
                                                        border: `1px solid ${borderColor}`,
                                                        bgcolor: isDark ? alpha("#FFFFFF", 0.035) : alpha("#FFFFFF", 0.88)
                                                    }}
                                                >
                                                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.04em" }}>
                                                        {item.value}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mt: 0.55, color: "text.secondary" }}>
                                                        {item.label}
                                                    </Typography>
                                                </Paper>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Stack>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>

                <Box id="capabilities" sx={{ pt: { xs: 6, md: 7.5 } }}>
                    <Stack spacing={{ xs: 1.2, md: 1 }} sx={{ mb: 3 }}>
                        <Typography
                            variant="overline"
                            sx={{
                                color: primaryAccent,
                                fontWeight: 800,
                                letterSpacing: { xs: "0.12em", md: "0.16em" },
                                fontSize: { xs: "0.8rem", md: "0.9rem" }
                            }}
                        >
                            CAPABILITIES
                        </Typography>
                        <Typography
                            variant="h3"
                            sx={{
                                maxWidth: 820,
                                fontWeight: 800,
                                fontSize: { xs: "2.55rem", sm: "3.15rem", md: "3.75rem" },
                                lineHeight: { xs: 1.06, sm: 1.02, md: 1.04 },
                                letterSpacing: { xs: "-0.045em", md: "-0.05em" },
                                textWrap: "balance"
                            }}
                        >
                            A modern operating surface for member service, lending, collection, and control.
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                color: "text.secondary",
                                maxWidth: 820,
                                lineHeight: { xs: 1.6, md: 1.75 },
                                fontSize: { xs: "1.02rem", md: "1rem" }
                            }}
                        >
                            The product is organized around actual SACCO workflows instead of generic admin menus, so each team member sees what they need to execute with less confusion and better accountability.
                        </Typography>
                    </Stack>

                    <Grid container spacing={2}>
                        {coreCapabilities.map((item) => (
                            <Grid key={item.title} size={{ xs: 12, md: 6, xl: 4 }}>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        height: "100%",
                                        p: 2.6,
                                        borderRadius: 3.5,
                                        border: `1px solid ${borderColor}`,
                                        bgcolor: sectionSurface,
                                        boxShadow: pageShadow
                                    }}
                                >
                                    <Stack spacing={1.6}>
                                        <Box
                                            sx={{
                                                width: 52,
                                                height: 52,
                                                borderRadius: 2.5,
                                                display: "grid",
                                                placeItems: "center",
                                                bgcolor: isDark ? alpha(primaryAccent, 0.16) : alpha(primaryAccent, 0.1),
                                                color: primaryAccent
                                            }}
                                        >
                                            {item.icon}
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                            {item.title}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
                                            {item.copy}
                                        </Typography>
                                    </Stack>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                <Box id="member-experience" sx={{ pt: { xs: 6, md: 7.5 } }}>
                    <Grid container spacing={2.5} alignItems="stretch">
                        <Grid size={{ xs: 12, lg: 6 }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    height: "100%",
                                    p: { xs: 3, md: 3.5 },
                                    borderRadius: 4,
                                    border: `1px solid ${borderColor}`,
                                    bgcolor: sectionSurface,
                                    boxShadow: pageShadow
                                }}
                            >
                                <Stack spacing={2}>
                                    <Typography variant="overline" sx={{ color: primaryAccent, fontWeight: 800, letterSpacing: "0.16em" }}>
                                        MEMBER EXPERIENCE
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.08 }}>
                                        From application to active membership, the journey is structured and visible.
                                    </Typography>
                                    <Typography variant="body1" sx={{ color: "text.secondary", lineHeight: 1.75 }}>
                                        Members do not depend entirely on branch staff for every action. The system supports application, payment, contribution, repayment, and statement visibility through the member portal.
                                    </Typography>
                                    <Stack spacing={1.4}>
                                        {memberJourney.map((item, index) => (
                                            <Stack key={item} direction="row" spacing={1.3} alignItems="flex-start">
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        width: 30,
                                                        height: 30,
                                                        borderRadius: 999,
                                                        display: "grid",
                                                        placeItems: "center",
                                                        bgcolor: isDark ? alpha(secondaryAccent, 0.18) : alpha(secondaryAccent, 0.14),
                                                        color: secondaryAccent,
                                                        fontWeight: 800,
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                                        {index + 1}
                                                    </Typography>
                                                </Paper>
                                                <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7, pt: 0.45 }}>
                                                    {item}
                                                </Typography>
                                            </Stack>
                                        ))}
                                    </Stack>
                                </Stack>
                            </Paper>
                        </Grid>

                        <Grid size={{ xs: 12, lg: 6 }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    height: "100%",
                                    p: { xs: 3, md: 3.5 },
                                    borderRadius: 4,
                                    border: `1px solid ${borderColor}`,
                                    bgcolor: sectionSurface,
                                    boxShadow: pageShadow
                                }}
                            >
                                <Stack spacing={2}>
                                    <Typography variant="overline" sx={{ color: primaryAccent, fontWeight: 800, letterSpacing: "0.16em" }}>
                                        OPERATING PRINCIPLES
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.08 }}>
                                        The system is positioned for operational clarity, not feature noise.
                                    </Typography>
                                    <Grid container spacing={1.5}>
                                        {operatingPrinciples.map((item) => (
                                            <Grid key={item.title} size={{ xs: 12 }}>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 2,
                                                        borderRadius: 2.75,
                                                        border: `1px solid ${borderColor}`,
                                                        bgcolor: isDark ? alpha("#FFFFFF", 0.03) : alpha("#F7FAFF", 0.96)
                                                    }}
                                                >
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                        {item.title}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mt: 0.75, color: "text.secondary", lineHeight: 1.7 }}>
                                                        {item.copy}
                                                    </Typography>
                                                </Paper>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Stack>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>

                <Box id="controls" sx={{ pt: { xs: 6, md: 7.5 } }}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: { xs: 3, md: 4 },
                            borderRadius: 4,
                            border: `1px solid ${borderColor}`,
                            bgcolor: sectionSurface,
                            boxShadow: pageShadow
                        }}
                    >
                        <Grid container spacing={3}>
                            <Grid size={{ xs: 12, lg: 5 }}>
                                <Stack spacing={{ xs: 1.2, md: 1.5 }}>
                                    <Typography
                                        variant="overline"
                                        sx={{
                                            color: primaryAccent,
                                            fontWeight: 800,
                                            letterSpacing: { xs: "0.12em", md: "0.16em" },
                                            fontSize: { xs: "0.8rem", md: "0.9rem" }
                                        }}
                                    >
                                        CONTROL LAYER
                                    </Typography>
                                    <Typography
                                        variant="h3"
                                        sx={{
                                            fontWeight: 800,
                                            fontSize: { xs: "2.45rem", sm: "3.05rem", md: "3.75rem" },
                                            lineHeight: { xs: 1.06, sm: 1.02, md: 1.02 },
                                            letterSpacing: { xs: "-0.045em", md: "-0.05em" },
                                            textWrap: "balance"
                                        }}
                                    >
                                        Controls, traceability, and accountability are part of the product story.
                                    </Typography>
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            color: "text.secondary",
                                            lineHeight: { xs: 1.6, md: 1.8 },
                                            fontSize: { xs: "1.02rem", md: "1rem" }
                                        }}
                                    >
                                        This is important for SACCO leadership. The product supports controlled disbursement, approval-aware posting, branch-scoped access, and reporting that follows real financial activity.
                                    </Typography>
                                </Stack>
                            </Grid>

                            <Grid size={{ xs: 12, lg: 7 }}>
                                <Grid container spacing={1.5}>
                                    {[
                                        {
                                            icon: <LockRoundedIcon />,
                                            title: "Role-bound execution",
                                            copy: "Sensitive actions are constrained to the right role and branch scope."
                                        },
                                        {
                                            icon: <SupportAgentRoundedIcon />,
                                            title: "Operational guidance",
                                            copy: "The system reduces manual follow-up by guiding staff through the expected flow."
                                        },
                                        {
                                            icon: <ShieldRoundedIcon />,
                                            title: "Approval-aware finance",
                                            copy: "High-risk lending and finance actions respect approval state before execution."
                                        },
                                        {
                                            icon: <ReceiptLongRoundedIcon />,
                                            title: "Posted activity visibility",
                                            copy: "Management can review revenue, statements, history, and operational outcomes with less ambiguity."
                                        }
                                    ].map((item) => (
                                        <Grid key={item.title} size={{ xs: 12, sm: 6 }}>
                                            <Paper
                                                elevation={0}
                                                sx={{
                                                    height: "100%",
                                                    p: 2.2,
                                                    borderRadius: 3,
                                                    border: `1px solid ${borderColor}`,
                                                    bgcolor: isDark ? alpha("#FFFFFF", 0.03) : alpha("#F8FBFF", 0.96)
                                                }}
                                            >
                                                <Box sx={{ color: primaryAccent, lineHeight: 0 }}>{item.icon}</Box>
                                                <Typography variant="subtitle1" sx={{ mt: 1.3, fontWeight: 800 }}>
                                                    {item.title}
                                                </Typography>
                                                <Typography variant="body2" sx={{ mt: 0.8, color: "text.secondary", lineHeight: 1.7 }}>
                                                    {item.copy}
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Grid>
                        </Grid>
                    </Paper>
                </Box>

                <Box id="contact" sx={{ pt: { xs: 6, md: 7.5 }, pb: { xs: 2, md: 1 } }}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: { xs: 3, md: 4 },
                            borderRadius: 4,
                            border: `1px solid ${borderColor}`,
                            color: isDark ? "#F8FAFC" : "#0F172A",
                            background: isDark
                                ? `linear-gradient(135deg, ${alpha("#0D1728", 0.96)} 0%, ${alpha("#13253F", 0.96)} 52%, ${alpha("#0F1D34", 0.96)} 100%)`
                                : `linear-gradient(135deg, ${alpha("#FFFFFF", 0.98)} 0%, ${alpha("#EDF5FF", 0.98)} 44%, ${alpha("#E4F0FF", 0.98)} 100%)`,
                            boxShadow: pageShadow
                        }}
                    >
                        <Grid container spacing={3} alignItems="center">
                            <Grid size={{ xs: 12, lg: 8 }}>
                                <Typography
                                    variant="overline"
                                    sx={{
                                        color: primaryAccent,
                                        fontWeight: 800,
                                        letterSpacing: { xs: "0.12em", md: "0.16em" },
                                        fontSize: { xs: "0.8rem", md: "0.9rem" }
                                    }}
                                >
                                    GET STARTED
                                </Typography>
                                <Typography
                                    variant="h3"
                                    sx={{
                                        mt: { xs: 1.2, md: 1 },
                                        fontWeight: 800,
                                        fontSize: { xs: "2.45rem", sm: "3.05rem", md: "3.75rem" },
                                        lineHeight: { xs: 1.06, sm: 1.02, md: 1.03 },
                                        letterSpacing: { xs: "-0.045em", md: "-0.05em" },
                                        textWrap: "balance"
                                    }}
                                >
                                    Ready to start your membership journey or access your workspace?
                                </Typography>
                                <Typography
                                    variant="body1"
                                    sx={{
                                        mt: 1.25,
                                        color: isDark ? alpha("#FFFFFF", 0.78) : "text.secondary",
                                        maxWidth: 760,
                                        lineHeight: { xs: 1.6, md: 1.8 },
                                        fontSize: { xs: "1.02rem", md: "1rem" }
                                    }}
                                >
                                    Apply for membership, sign in to continue operations, or contact the SACCO team for guidance on onboarding, support, and service access.
                                </Typography>
                            </Grid>
                            <Grid size={{ xs: 12, lg: 4 }}>
                                <Stack spacing={1.25}>
                                    <Button component={RouterLink} to="/signup" variant="contained" size="large" sx={{ borderRadius: 2.25 }}>
                                        Apply for membership
                                    </Button>
                                    <Button component={RouterLink} to="/signin" variant="outlined" size="large" sx={{ borderRadius: 2.25 }}>
                                        Existing user sign in
                                    </Button>
                                    <Button component="a" href={contactHref} variant="text" size="large" sx={{ borderRadius: 2.25 }}>
                                        Contact {ownerName}
                                    </Button>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Paper>
                </Box>
            </Container>

            <Box
                component="footer"
                sx={{
                    borderTop: `1px solid ${alpha(theme.palette.divider, isDark ? 0.3 : 0.85)}`,
                    py: 4,
                    bgcolor: isDark ? alpha("#0B1220", 0.7) : alpha("#FFFFFF", 0.76),
                    backdropFilter: "blur(12px)"
                }}
            >
                <Container maxWidth="xl">
                    <Grid container spacing={3}>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.3 }}>
                                <Box
                                    sx={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: 2,
                                        bgcolor: "#FFFFFF",
                                        display: "grid",
                                        placeItems: "center",
                                        border: `1px solid ${alpha(primaryAccent, 0.24)}`
                                    }}
                                >
                                    <Box component="img" src={logoSrc} alt={`${ownerCompany} logo`} sx={{ width: 24, height: 24, objectFit: "contain" }} />
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                    {ownerCompany}
                                </Typography>
                            </Stack>
                            <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 520, lineHeight: 1.75 }}>
                                One focused SACCO system for member operations, lending, collections, controls, and reporting.
                            </Typography>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.2 }}>
                                Navigation
                            </Typography>
                            <Stack spacing={0.8}>
                                {navItems.map((item) => (
                                    <Typography key={item.href} component="a" href={item.href} variant="body2" sx={{ color: "text.secondary", textDecoration: "none" }}>
                                        {item.label}
                                    </Typography>
                                ))}
                                <Typography component={RouterLink} to="/signin" variant="body2" sx={{ color: "text.secondary", textDecoration: "none" }}>
                                    Sign in
                                </Typography>
                            </Stack>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.2 }}>
                                Contact
                            </Typography>
                            <Stack spacing={0.8}>
                                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                    {ownerName}
                                </Typography>
                                {ownerEmail ? (
                                    <Typography component="a" href={`mailto:${ownerEmail}`} variant="body2" sx={{ color: "text.secondary", textDecoration: "none" }}>
                                        {ownerEmail}
                                    </Typography>
                                ) : null}
                                {ownerPhone ? (
                                    <Typography component="a" href={`tel:${ownerPhone}`} variant="body2" sx={{ color: "text.secondary", textDecoration: "none" }}>
                                        {ownerPhone}
                                    </Typography>
                                ) : null}
                                {whatsappHref ? (
                                    <Typography component="a" href={whatsappHref} target="_blank" rel="noreferrer" variant="body2" sx={{ color: "text.secondary", textDecoration: "none" }}>
                                        WhatsApp
                                    </Typography>
                                ) : null}
                                {!ownerEmail && !ownerPhone && !whatsappHref ? (
                                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                        Configure contact details in frontend env for production deployment.
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
