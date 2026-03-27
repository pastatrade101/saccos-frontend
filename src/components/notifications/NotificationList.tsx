import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import {
    Box,
    Button,
    Chip,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Stack,
    Typography
} from "@mui/material";

import type { NotificationItem } from "../../types/api";
import { formatNotificationTimestamp, getNotificationSeverityColor } from "./notificationUtils";

interface NotificationListProps {
    items: NotificationItem[];
    emptyMessage: string;
    onOpenItem: (item: NotificationItem) => void | Promise<void>;
    compact?: boolean;
    onArchiveItem?: (item: NotificationItem) => void | Promise<void>;
    showArchiveAction?: boolean;
}

export function NotificationList({
    items,
    emptyMessage,
    onOpenItem,
    compact = false,
    onArchiveItem,
    showArchiveAction = false
}: NotificationListProps) {
    if (!items.length) {
        return (
            <Box
                sx={{
                    px: compact ? 1.25 : 2,
                    py: compact ? 2 : 3,
                    textAlign: "center",
                    color: "text.secondary"
                }}
            >
                <MarkEmailReadRoundedIcon sx={{ mb: 0.75, color: "text.disabled" }} />
                <Typography variant="body2">{emptyMessage}</Typography>
            </Box>
        );
    }

    return (
        <List disablePadding>
            {items.map((item) => (
                <ListItemButton
                    key={item.id}
                    onClick={() => void onOpenItem(item)}
                    sx={{
                        alignItems: "flex-start",
                        px: compact ? 1.25 : 1.5,
                        py: compact ? 1.15 : 1.35,
                        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                        bgcolor: item.status === "unread" ? "action.hover" : "transparent"
                    }}
                >
                    <Stack direction="row" spacing={1} sx={{ width: "100%", minWidth: 0 }}>
                        <ListItemText
                            primary={
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <Typography variant={compact ? "body2" : "subtitle2"} fontWeight={700}>
                                        {item.title}
                                    </Typography>
                                    <Chip
                                        label={item.severity}
                                        size="small"
                                        color={getNotificationSeverityColor(item.severity)}
                                        variant={item.status === "unread" ? "filled" : "outlined"}
                                        sx={{ textTransform: "capitalize", height: 22 }}
                                    />
                                    {item.status === "unread" ? (
                                        <Chip label="Unread" size="small" variant="outlined" sx={{ height: 22 }} />
                                    ) : null}
                                </Stack>
                            }
                            secondary={
                                <Stack spacing={0.8} sx={{ mt: 0.6 }}>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ display: "-webkit-box", WebkitLineClamp: compact ? 2 : 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                                    >
                                        {item.message}
                                    </Typography>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatNotificationTimestamp(item.created_at)}
                                        </Typography>
                                        <Button size="small" endIcon={<ChevronRightRoundedIcon fontSize="small" />} sx={{ minWidth: 0, px: 0 }}>
                                            {item.action_label || "Open"}
                                        </Button>
                                    </Stack>
                                </Stack>
                            }
                        />
                        {showArchiveAction && onArchiveItem ? (
                            <IconButton
                                edge="end"
                                size="small"
                                aria-label="Archive notification"
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void onArchiveItem(item);
                                }}
                                sx={{ mt: 0.25 }}
                            >
                                <ArchiveOutlinedIcon fontSize="small" />
                            </IconButton>
                        ) : null}
                    </Stack>
                </ListItemButton>
            ))}
        </List>
    );
}
