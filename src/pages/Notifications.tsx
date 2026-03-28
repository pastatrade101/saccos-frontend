import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Divider,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    LinearProgress,
    Paper,
    Stack,
    Switch,
    Typography
} from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { NotificationList } from "../components/notifications/NotificationList";
import { useToast } from "../components/Toast";
import { useNotificationPreferences } from "../hooks/useNotificationPreferences";
import { useNotifications } from "../hooks/useNotifications";
import type { NotificationStatus } from "../types/api";
import { getNotificationFallbackRoute } from "../components/notifications/notificationUtils";

const FILTERS: Array<{ label: string; value: "all" | NotificationStatus }> = [
    { label: "All", value: "all" },
    { label: "Unread", value: "unread" },
    { label: "Read", value: "read" },
    { label: "Archived", value: "archived" }
];

export function NotificationsPage() {
    const navigate = useNavigate();
    const { profile, twoFactorSetupRequired } = useAuth();
    const { pushToast } = useToast();
    const [status, setStatus] = useState<"all" | NotificationStatus>("all");
    const [preferencesOpen, setPreferencesOpen] = useState(false);
    const tenantId = profile?.tenant_id || null;
    const isMember = profile?.role === "member";
    const backTarget = isMember
        ? "/portal"
        : profile?.role === "treasury_officer"
            ? "/treasury"
            : "/dashboard";
    const backLabel = isMember ? "Back to portal" : "Back to workspace";
    const {
        items,
        unreadCount,
        total,
        loading,
        error,
        markRead,
        markAllRead,
        archive,
        archiveRead
    } = useNotifications({
        tenantId,
        enabled: !twoFactorSetupRequired,
        recipientUserId: profile?.user_id || null,
        status,
        limit: 50,
        pollMs: 0
    });
    const {
        items: preferenceItems,
        loading: preferencesLoading,
        savingEventType,
        error: preferencesError,
        updatePreference
    } = useNotificationPreferences({
        tenantId,
        enabled: !twoFactorSetupRequired
    });

    const title = useMemo(() => isMember ? "Notification Center" : "Workspace Notifications", [isMember]);
    const preferenceSummary = useMemo(() => {
        const totalItems = preferenceItems.length;
        const inAppEnabled = preferenceItems.filter((item) => item.in_app_enabled).length;
        const smsEnabled = preferenceItems.filter((item) => item.sms_enabled).length;
        const toastEnabled = preferenceItems.filter((item) => item.toast_enabled).length;

        return { totalItems, inAppEnabled, smsEnabled, toastEnabled };
    }, [preferenceItems]);

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 3, md: 5 } }}>
            <Container maxWidth="lg">
                <Stack spacing={3}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
                        <Box>
                            <Button
                                startIcon={<ArrowBackRoundedIcon />}
                                sx={{ mb: 1 }}
                                onClick={() => navigate(backTarget)}
                            >
                                {backLabel}
                            </Button>
                            <Typography variant="h4" fontWeight={800}>
                                {title}
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
                                Actionable alerts from approvals, lending, collections, and member workflow changes.
                            </Typography>
                        </Box>

                        <Card variant="outlined" sx={{ minWidth: { sm: 280 } }}>
                            <CardContent>
                                <Stack spacing={1.25}>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Snapshot
                                    </Typography>
                                    <Typography variant="h5" fontWeight={800}>
                                        {unreadCount}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        unread notification(s) across {total} visible item(s)
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        onClick={() => {
                                            void markAllRead().catch((markError) => {
                                                pushToast({
                                                    type: "error",
                                                    title: "Notifications",
                                                    message: markError instanceof Error ? markError.message : "Unable to mark notifications as read."
                                                });
                                            });
                                        }}
                                        disabled={!unreadCount}
                                    >
                                        Mark all read
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            void archiveRead().catch((archiveError) => {
                                                pushToast({
                                                    type: "error",
                                                    title: "Notifications",
                                                    message: archiveError instanceof Error ? archiveError.message : "Unable to archive read notifications."
                                                });
                                            });
                                        }}
                                        disabled={!items.some((item) => item.status === "read")}
                                    >
                                        Archive read
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {FILTERS.map((filter) => (
                            <Chip
                                key={filter.value}
                                label={filter.label}
                                color={status === filter.value ? "primary" : "default"}
                                variant={status === filter.value ? "filled" : "outlined"}
                                onClick={() => setStatus(filter.value)}
                            />
                        ))}
                    </Stack>

                    <Card variant="outlined">
                        <CardContent sx={{ p: 0 }}>
                            {loading ? (
                                <Box sx={{ px: 2, py: 4 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Loading notifications...
                                    </Typography>
                                </Box>
                            ) : error ? (
                                <Box sx={{ px: 2, py: 4 }}>
                                    <Typography variant="body2" color="error.main">
                                        {error}
                                    </Typography>
                                </Box>
                            ) : (
                                <NotificationList
                                    items={items}
                                    emptyMessage="No notifications match this filter."
                                    showArchiveAction={status !== "archived"}
                                    onArchiveItem={async (item) => {
                                        try {
                                            await archive(item.id);
                                            pushToast({
                                                type: "success",
                                                title: "Notification archived",
                                                message: `${item.title} was archived.`
                                            });
                                        } catch (archiveError) {
                                            pushToast({
                                                type: "error",
                                                title: "Notifications",
                                                message: archiveError instanceof Error ? archiveError.message : "Unable to archive notification."
                                            });
                                        }
                                    }}
                                    onOpenItem={async (item) => {
                                        if (item.status === "unread") {
                                            try {
                                                await markRead(item.id);
                                            } catch (markError) {
                                                pushToast({
                                                    type: "error",
                                                    title: "Notifications",
                                                    message: markError instanceof Error ? markError.message : "Unable to open notification."
                                                });
                                                return;
                                            }
                                        }

                                        navigate(getNotificationFallbackRoute(item, isMember));
                                    }}
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card variant="outlined">
                        <CardContent>
                            <Stack
                                direction={{ xs: "column", md: "row" }}
                                spacing={2}
                                justifyContent="space-between"
                                alignItems={{ xs: "flex-start", md: "center" }}
                            >
                                <Stack spacing={1}>
                                    <Stack direction="row" spacing={1.25} alignItems="center">
                                        <Box
                                            sx={{
                                                width: 42,
                                                height: 42,
                                                borderRadius: 2,
                                                bgcolor: "primary.50",
                                                color: "primary.main",
                                                display: "grid",
                                                placeItems: "center"
                                            }}
                                        >
                                            <SettingsRoundedIcon fontSize="small" />
                                        </Box>
                                        <Box>
                                            <Typography variant="h6" fontWeight={800}>
                                                Notification preferences
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Control which events appear in your bell, trigger SMS, or show toast alerts.
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        <Chip label={`${preferenceSummary.totalItems} tracked events`} size="small" variant="outlined" />
                                        <Chip label={`${preferenceSummary.inAppEnabled} in-app on`} size="small" color="primary" variant="outlined" />
                                        <Chip label={`${preferenceSummary.smsEnabled} SMS on`} size="small" color="success" variant="outlined" />
                                        <Chip label={`${preferenceSummary.toastEnabled} toast on`} size="small" color="warning" variant="outlined" />
                                    </Stack>
                                </Stack>

                                <Button
                                    variant="contained"
                                    startIcon={<SettingsRoundedIcon />}
                                    onClick={() => setPreferencesOpen(true)}
                                >
                                    Manage preferences
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>
            </Container>

            <Dialog
                open={preferencesOpen}
                onClose={() => setPreferencesOpen(false)}
                fullWidth
                maxWidth="lg"
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        overflow: "hidden"
                    }
                }}
            >
                <DialogTitle sx={{ px: { xs: 2.5, md: 3 }, py: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Box>
                            <Typography variant="h5" fontWeight={800}>
                                Notification preferences
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Choose how each event reaches you. In-app controls the bell, SMS controls text delivery, and Toast controls on-screen popups.
                            </Typography>
                        </Box>
                        <IconButton onClick={() => setPreferencesOpen(false)}>
                            <CloseRoundedIcon />
                        </IconButton>
                    </Stack>
                </DialogTitle>
                <DialogContent dividers sx={{ px: { xs: 2, md: 3 }, py: 0 }}>
                    <Stack spacing={2.5} sx={{ py: 2 }}>
                        {preferencesLoading ? <LinearProgress /> : null}
                        {preferencesError ? <Alert severity="error">{preferencesError}</Alert> : null}

                        <Paper
                            variant="outlined"
                            sx={{
                                borderRadius: 2,
                                overflow: "hidden"
                            }}
                        >
                            <Box
                                sx={{
                                    display: { xs: "none", md: "grid" },
                                    gridTemplateColumns: "minmax(0, 1.8fr) 140px 140px 140px",
                                    px: 2.5,
                                    py: 1.25,
                                    bgcolor: "grey.50",
                                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`
                                }}
                            >
                                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                    Event
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                    In-app
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                    SMS
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                    Toast
                                </Typography>
                            </Box>

                            <Stack divider={<Divider flexItem />}>
                                {preferenceItems.map((item) => {
                                    const busy = savingEventType === item.event_type;

                                    return (
                                        <Box
                                            key={item.event_type}
                                            sx={{
                                                px: { xs: 2, md: 2.5 },
                                                py: 2
                                            }}
                                        >
                                            <Stack spacing={1.5}>
                                                <Box>
                                                    <Typography variant="subtitle2" fontWeight={700}>
                                                        {item.label}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 680 }}>
                                                        {item.description}
                                                    </Typography>
                                                </Box>

                                                <Stack
                                                    direction={{ xs: "column", md: "row" }}
                                                    spacing={{ xs: 0.75, md: 0 }}
                                                    sx={{
                                                        display: { md: "grid" },
                                                        gridTemplateColumns: { md: "minmax(0, 1.8fr) 140px 140px 140px" },
                                                        alignItems: "center"
                                                    }}
                                                >
                                                    <Box sx={{ display: { xs: "none", md: "block" } }} />

                                                    <FormControlLabel
                                                        sx={{ m: 0 }}
                                                        control={
                                                            <Switch
                                                                checked={item.in_app_enabled}
                                                                disabled={busy}
                                                                onChange={(event) => {
                                                                    void updatePreference(item.event_type, {
                                                                        in_app_enabled: event.target.checked
                                                                    }).catch((updateError) => {
                                                                        pushToast({
                                                                            type: "error",
                                                                            title: "Preferences",
                                                                            message: updateError instanceof Error ? updateError.message : "Unable to update preference."
                                                                        });
                                                                    });
                                                                }}
                                                            />
                                                        }
                                                        label={
                                                            <Typography variant="body2" color="text.secondary">
                                                                In-app
                                                            </Typography>
                                                        }
                                                        labelPlacement="end"
                                                    />

                                                    <FormControlLabel
                                                        sx={{ m: 0 }}
                                                        control={
                                                            <Switch
                                                                checked={item.sms_enabled}
                                                                disabled={busy}
                                                                onChange={(event) => {
                                                                    void updatePreference(item.event_type, {
                                                                        sms_enabled: event.target.checked
                                                                    }).catch((updateError) => {
                                                                        pushToast({
                                                                            type: "error",
                                                                            title: "Preferences",
                                                                            message: updateError instanceof Error ? updateError.message : "Unable to update preference."
                                                                        });
                                                                    });
                                                                }}
                                                            />
                                                        }
                                                        label={
                                                            <Typography variant="body2" color="text.secondary">
                                                                SMS
                                                            </Typography>
                                                        }
                                                        labelPlacement="end"
                                                    />

                                                    <FormControlLabel
                                                        sx={{ m: 0 }}
                                                        control={
                                                            <Switch
                                                                checked={item.toast_enabled}
                                                                disabled={busy}
                                                                onChange={(event) => {
                                                                    void updatePreference(item.event_type, {
                                                                        toast_enabled: event.target.checked
                                                                    }).catch((updateError) => {
                                                                        pushToast({
                                                                            type: "error",
                                                                            title: "Preferences",
                                                                            message: updateError instanceof Error ? updateError.message : "Unable to update preference."
                                                                        });
                                                                    });
                                                                }}
                                                            />
                                                        }
                                                        label={
                                                            <Typography variant="body2" color="text.secondary">
                                                                Toast
                                                            </Typography>
                                                        }
                                                        labelPlacement="end"
                                                    />
                                                </Stack>
                                            </Stack>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Paper>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: { xs: 2.5, md: 3 }, py: 2 }}>
                    <Button onClick={() => setPreferencesOpen(false)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
