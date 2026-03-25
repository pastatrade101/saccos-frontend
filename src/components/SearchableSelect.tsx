import { ClickAwayListener, List, ListItemButton, ListItemText, Paper, Popper, TextField, type TextFieldProps } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchableOption {
    value: string;
    label: string;
    secondary?: string;
}

interface SearchableSelectProps {
    value: string;
    options: SearchableOption[];
    placeholder?: string;
    onChange: (value: string) => void;
    label?: string;
    helperText?: React.ReactNode;
    error?: boolean;
    size?: TextFieldProps["size"];
    dropdownDirection?: "down" | "up";
}

export function SearchableSelect({
    value,
    options,
    placeholder = "Search and select...",
    onChange,
    label,
    helperText,
    error = false,
    size = "medium",
    dropdownDirection = "down"
}: SearchableSelectProps) {
    const selectedOption = options.find((option) => option.value === value);
    const [query, setQuery] = useState(selectedOption?.label || "");
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setQuery(selectedOption?.label || "");
    }, [selectedOption?.label]);

    const filteredOptions = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        const selectedLabel = selectedOption?.label?.trim().toLowerCase() || "";

        if (!normalized || (selectedLabel && normalized === selectedLabel)) {
            return options.slice(0, 10);
        }

        return options
            .filter((option) =>
                [option.label, option.secondary]
                    .filter(Boolean)
                    .some((entry) => entry?.toLowerCase().includes(normalized))
            )
            .slice(0, 10);
    }, [options, query]);

    return (
        <ClickAwayListener onClickAway={() => setOpen(false)}>
            <div ref={anchorRef} style={{ position: "relative" }}>
            <TextField
                fullWidth
                value={query}
                label={label}
                helperText={helperText}
                error={error}
                size={size}
                placeholder={placeholder}
                onFocus={() => setOpen(true)}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                }}
                onBlur={() => {
                    window.setTimeout(() => {
                        setQuery(options.find((option) => option.value === value)?.label || "");
                    }, 150);
                }}
            />
            {open ? (
                <Popper
                    open
                    anchorEl={anchorRef.current}
                    placement={dropdownDirection === "up" ? "top-start" : "bottom-start"}
                    modifiers={[
                        { name: "offset", options: { offset: [0, 6] } },
                        { name: "flip", enabled: true },
                        { name: "preventOverflow", options: { padding: 12 } }
                    ]}
                    style={{
                        zIndex: 1500,
                        width: anchorRef.current?.clientWidth || undefined
                    }}
                >
                    <Paper
                        variant="outlined"
                        sx={{
                            maxHeight: 240,
                            overflowY: "auto"
                        }}
                    >
                        <List dense disablePadding>
                            {filteredOptions.length ? (
                                filteredOptions.map((option) => (
                                    <ListItemButton
                                        key={option.value}
                                        onMouseDown={() => {
                                            onChange(option.value);
                                            setQuery(option.label);
                                            setOpen(false);
                                        }}
                                    >
                                        <ListItemText primary={option.label} secondary={option.secondary} />
                                    </ListItemButton>
                                ))
                            ) : (
                                <ListItemText sx={{ px: 2, py: 1.5 }} primary="No matches found." />
                            )}
                        </List>
                    </Paper>
                </Popper>
            ) : null}
            </div>
        </ClickAwayListener>
    );
}
