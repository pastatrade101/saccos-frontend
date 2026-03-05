import { Dialog, type DialogProps } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import type { PropsWithChildren } from "react";

import { modal, useReducedMotionSafe } from "./presets";

const MotionContainer = motion.div;

export interface MotionModalProps extends Omit<DialogProps, "children"> {
    open: boolean;
}

export function MotionModal({ open, children, ...props }: PropsWithChildren<MotionModalProps>) {
    const reducedMotion = useReducedMotionSafe();
    const variants = modal(reducedMotion);

    return (
        <Dialog open={open} keepMounted {...props}>
            <AnimatePresence initial={false} mode="wait">
                {open ? (
                    <MotionContainer
                        key="motion-modal-body"
                        variants={variants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={{ width: "100%" }}
                    >
                        {children}
                    </MotionContainer>
                ) : null}
            </AnimatePresence>
        </Dialog>
    );
}
