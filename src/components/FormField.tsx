import { FormHelperText, Stack, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";

interface FormFieldProps extends PropsWithChildren {
    label: string;
    hint?: string;
    error?: string;
}

export function FormField({ label, hint, error, children }: FormFieldProps) {
    return (
        <Stack spacing={0.75}>
            <Typography variant="body2" fontWeight={600}>
                {label}
            </Typography>
            {children}
            {hint ? <FormHelperText sx={{ mt: 0 }}>{hint}</FormHelperText> : null}
            {error ? (
                <FormHelperText error sx={{ mt: 0 }}>
                    {error}
                </FormHelperText>
            ) : null}
        </Stack>
    );
}
