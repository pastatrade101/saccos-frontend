import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import {
    Badge,
    Box,
    Button,
    CircularProgress,
    IconButton,
    Menu,
    Stack,
    Typography
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { useNotificationPreferences } from "../../hooks/useNotificationPreferences";
import { useNotifications } from "../../hooks/useNotifications";
import { useToast } from "../Toast";
import { NotificationList } from "./NotificationList";
import { getNotificationFallbackRoute } from "./notificationUtils";

interface NotificationBellProps {
    tenantId?: string | null;
    iconColor?: string;
    buttonSx?: SxProps<Theme>;
    menuPaperSx?: SxProps<Theme>;
}

export function NotificationBell({
    tenantId,
    iconColor,
    buttonSx,
    menuPaperSx
}: NotificationBellProps) {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { pushToast } = useToast();
    const { items, unreadCount, loading, error, markRead, markAllRead, archiveRead } = useNotifications({
        tenantId,
        recipientUserId: profile?.user_id || null,
        recentOnly: true,
        limit: 5,
        onNewNotification: (notification) => {
            const preference = preferenceItems.find((item) => item.event_type === notification.event_type);
            if (!preference?.toast_enabled || !["critical", "warning"].includes(notification.severity)) {
                return;
            }

            pushToast({
                type: notification.severity === "critical" ? "error" : "warning",
                title: notification.title,
                message: notification.message
            });
        }
    });
    const { items: preferenceItems } = useNotificationPreferences({
        tenantId
    });
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const isMember = profile?.role === "member";

    async function handleOpenItem(notificationId: string) {
        try {
            await markRead(notificationId);
        } catch (markError) {
            pushToast({
                type: "error",
                title: "Notification action failed",
                message: markError instanceof Error ? markError.message : "Unable to mark notification as read."
            });
        }
    }

    return (
        <>
            <IconButton
                onClick={(event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)}
                sx={buttonSx}
            >
                <Badge badgeContent={unreadCount} color="error" max={99}>
                    <NotificationsRoundedIcon sx={{ color: iconColor || "inherit" }} />
                </Badge>
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{
                    sx: {
                        mt: 1.25,
                        width: 380,
                        maxWidth: "calc(100vw - 24px)",
                        borderRadius: 2,
                        ...menuPaperSx
                    }
                }}
            >
                <Box sx={{ px: 1.5, py: 1.25 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Box>
                            <Typography variant="subtitle1" fontWeight={700}>
                                Notifications
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {unreadCount > 0 ? `${unreadCount} unread item(s)` : "All caught up"}
                            </Typography>
                        </Box>
                        <Button
                            size="small"
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
                    </Stack>
                    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 0.75 }}>
                        <Button
                            size="small"
                            color="inherit"
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
                </Box>

                {loading ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ py: 3 }}>
                        <CircularProgress size={24} />
                    </Stack>
                ) : error ? (
                    <Box sx={{ px: 1.5, py: 2 }}>
                        <Typography variant="body2" color="error.main">
                            {error}
                        </Typography>
                    </Box>
                ) : (
                    <NotificationList
                        compact
                        items={items}
                        emptyMessage="No notifications yet."
                        onOpenItem={async (item) => {
                            setAnchorEl(null);
                            if (item.status === "unread") {
                                await handleOpenItem(item.id);
                            }
                            navigate(getNotificationFallbackRoute(item, isMember));
                        }}
                    />
                )}

                <Box sx={{ px: 1.5, py: 1.25 }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => {
                            setAnchorEl(null);
                            navigate("/notifications");
                        }}
                    >
                        View all notifications
                    </Button>
                </Box>
            </Menu>
        </>
    );
}
