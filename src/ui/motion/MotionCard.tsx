import { Box, Card, type CardProps, Paper, type PaperProps, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import { card, listItem, useReducedMotionSafe } from "./presets";

const MotionMuiCard = motion(Card);
const MotionMuiPaper = motion(Paper);

interface BaseMotionSurfaceProps {
    index?: number;
    interactive?: boolean;
    disabledMotion?: boolean;
    inView?: boolean;
    once?: boolean;
}

export interface MotionCardProps extends Omit<CardProps, "component">, BaseMotionSurfaceProps {}

export function MotionCard({
    index = 0,
    interactive = false,
    disabledMotion = false,
    inView = false,
    once = true,
    sx,
    ...props
}: MotionCardProps) {
    const reducedMotion = useReducedMotionSafe();
    const variants = useMemo(() => card(reducedMotion), [reducedMotion]);
    const shouldAnimate = !disabledMotion;

    return (
        <MotionMuiCard
            variants={shouldAnimate ? variants : undefined}
            custom={index}
            initial={shouldAnimate ? "hidden" : false}
            animate={!inView && shouldAnimate ? "visible" : undefined}
            whileInView={inView && shouldAnimate ? "visible" : undefined}
            viewport={inView && shouldAnimate ? { once, amount: 0.2 } : undefined}
            whileHover={interactive && shouldAnimate && !reducedMotion ? "hover" : undefined}
            whileTap={interactive && shouldAnimate && !reducedMotion ? "tap" : undefined}
            layout={!reducedMotion}
            sx={{
                position: "relative",
                overflow: "hidden",
                ...(interactive && !reducedMotion ? {
                    "&::after": {
                        content: "\"\"",
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background:
                            "linear-gradient(110deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.08) 48%, rgba(255,255,255,0) 66%)",
                        transform: "translateX(-120%)",
                        transition: "transform 420ms ease"
                    },
                    "&:hover::after": {
                        transform: "translateX(120%)"
                    }
                } : null),
                ...sx
            }}
            {...props}
        />
    );
}

export interface MotionListItemProps extends Omit<PaperProps, "component">, BaseMotionSurfaceProps {}

export function MotionListItem({
    index = 0,
    interactive = false,
    disabledMotion = false,
    inView = false,
    once = true,
    ...props
}: MotionListItemProps) {
    const reducedMotion = useReducedMotionSafe();
    const variants = useMemo(() => listItem(reducedMotion), [reducedMotion]);
    const shouldAnimate = !disabledMotion;

    return (
        <MotionMuiPaper
            variants={shouldAnimate ? variants : undefined}
            custom={index}
            initial={shouldAnimate ? "hidden" : false}
            animate={!inView && shouldAnimate ? "visible" : undefined}
            whileInView={inView && shouldAnimate ? "visible" : undefined}
            viewport={inView && shouldAnimate ? { once, amount: 0.18 } : undefined}
            whileHover={interactive && shouldAnimate && !reducedMotion ? "hover" : undefined}
            whileTap={interactive && shouldAnimate && !reducedMotion ? "tap" : undefined}
            layout={!reducedMotion}
            {...props}
        />
    );
}

interface AnimatedNumberProps {
    value: number;
    durationMs?: number;
    formatter?: (value: number) => string;
}

function AnimatedNumber({ value, durationMs = 520, formatter }: AnimatedNumberProps) {
    const reducedMotion = useReducedMotionSafe();
    const [displayValue, setDisplayValue] = useState(value);
    const previousValueRef = useRef(value);

    useEffect(() => {
        if (reducedMotion) {
            setDisplayValue(value);
            previousValueRef.current = value;
            return;
        }

        const startValue = previousValueRef.current;
        const delta = value - startValue;
        const start = performance.now();
        let animationFrame = 0;

        const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / durationMs, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayValue(startValue + delta * eased);

            if (progress < 1) {
                animationFrame = window.requestAnimationFrame(tick);
            } else {
                previousValueRef.current = value;
            }
        };

        animationFrame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(animationFrame);
    }, [durationMs, reducedMotion, value]);

    if (formatter) {
        return <>{formatter(displayValue)}</>;
    }

    return <>{Math.round(displayValue).toLocaleString()}</>;
}

export interface MotionStatCardProps extends MotionCardProps {
    label: string;
    value: number;
    helper?: string;
    formatter?: (value: number) => string;
}

export function MotionStatCard({
    label,
    value,
    helper,
    formatter,
    children,
    ...props
}: PropsWithChildren<MotionStatCardProps>) {
    return (
        <MotionCard interactive {...props}>
            <Box sx={{ p: 2.25 }}>
                <Typography variant="overline" color="text.secondary">
                    {label}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.5 }}>
                    <AnimatedNumber value={value} formatter={formatter} />
                </Typography>
                {helper ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        {helper}
                    </Typography>
                ) : null}
                {children}
            </Box>
        </MotionCard>
    );
}
