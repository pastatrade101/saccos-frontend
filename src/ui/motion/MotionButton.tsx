import { Button, type ButtonProps } from "@mui/material";
import { motion } from "framer-motion";
import { useMemo, type PropsWithChildren } from "react";

import { button, useReducedMotionSafe } from "./presets";

export interface MotionButtonProps extends Omit<ButtonProps, "component"> {
    disableMotion?: boolean;
}

export function MotionButton({
    disableMotion = false,
    children,
    ...props
}: PropsWithChildren<MotionButtonProps>) {
    const reducedMotion = useReducedMotionSafe();
    const variants = useMemo(() => button(reducedMotion), [reducedMotion]);
    const canAnimate = !disableMotion;

    return (
        <motion.div
            variants={canAnimate ? variants : undefined}
            initial={canAnimate ? "rest" : false}
            animate={canAnimate ? "rest" : undefined}
            whileHover={canAnimate && !reducedMotion ? "hover" : undefined}
            whileTap={canAnimate && !reducedMotion ? "tap" : undefined}
            style={{
                width: props.fullWidth ? "100%" : "auto",
                display: props.fullWidth ? "block" : "inline-block"
            }}
        >
            <Button {...props}>{children}</Button>
        </motion.div>
    );
}
