import { Box, type BoxProps } from "@mui/material";
import { motion } from "framer-motion";
import { useMemo, type PropsWithChildren } from "react";

import { page, useReducedMotionSafe } from "./presets";

export interface MotionSectionProps extends Omit<BoxProps, "component"> {
    inView?: boolean;
    once?: boolean;
    disableMotion?: boolean;
}

export function MotionSection({
    inView = false,
    once = true,
    disableMotion = false,
    children,
    ...props
}: PropsWithChildren<MotionSectionProps>) {
    const reducedMotion = useReducedMotionSafe();
    const variants = useMemo(() => page(reducedMotion), [reducedMotion]);
    const canAnimate = !disableMotion;

    return (
        <motion.div
            variants={canAnimate ? variants : undefined}
            initial={canAnimate ? "hidden" : false}
            animate={!inView && canAnimate ? "visible" : undefined}
            whileInView={inView && canAnimate ? "visible" : undefined}
            viewport={inView && canAnimate ? { once, amount: 0.16 } : undefined}
        >
            <Box {...props}>{children}</Box>
        </motion.div>
    );
}
