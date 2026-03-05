import { useReducedMotion, type Transition, type Variants } from "framer-motion";

export const springSoft: Transition = {
    type: "spring",
    stiffness: 210,
    damping: 26,
    mass: 0.9
};

export const springSnappy: Transition = {
    type: "spring",
    stiffness: 320,
    damping: 24,
    mass: 0.8
};

export const easeOutFast: Transition = {
    duration: 0.2,
    ease: [0.2, 0.65, 0.3, 0.95]
};

const clampIndex = (index: number) => Math.max(0, Math.min(index, 24));

export function useReducedMotionSafe() {
    return Boolean(useReducedMotion());
}

export const page = (reducedMotion = false): Variants => ({
    hidden: {
        opacity: 0,
        y: reducedMotion ? 0 : 8
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            ...(reducedMotion ? easeOutFast : springSoft),
            staggerChildren: reducedMotion ? 0.015 : 0.06,
            delayChildren: 0.04
        }
    }
});

export const card = (reducedMotion = false): Variants => ({
    hidden: {
        opacity: 0,
        y: reducedMotion ? 0 : 12,
        filter: reducedMotion ? "none" : "blur(8px)"
    },
    visible: (index: number = 0) => ({
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: {
            ...(reducedMotion ? easeOutFast : springSoft),
            delay: clampIndex(index) * (reducedMotion ? 0.015 : 0.045)
        }
    }),
    hover: reducedMotion
        ? {}
        : {
            y: -4,
            scale: 1.012,
            transition: springSnappy
        },
    tap: reducedMotion
        ? {}
        : {
            scale: 0.992,
            transition: easeOutFast
        }
});

export const listItem = (reducedMotion = false): Variants => ({
    hidden: {
        opacity: 0,
        y: reducedMotion ? 0 : 6
    },
    visible: (index: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: {
            ...(reducedMotion ? easeOutFast : springSoft),
            delay: clampIndex(index) * (reducedMotion ? 0.01 : 0.03)
        }
    }),
    hover: reducedMotion
        ? {}
        : {
            y: -2,
            transition: easeOutFast
        },
    tap: reducedMotion
        ? {}
        : {
            scale: 0.996,
            transition: easeOutFast
        }
});

export const modal = (reducedMotion = false): Variants => ({
    hidden: {
        opacity: 0,
        y: reducedMotion ? 0 : 10,
        scale: reducedMotion ? 1 : 0.985,
        filter: reducedMotion ? "none" : "blur(8px)"
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        transition: reducedMotion ? easeOutFast : springSoft
    },
    exit: {
        opacity: 0,
        y: reducedMotion ? 0 : 6,
        scale: reducedMotion ? 1 : 0.992,
        transition: easeOutFast
    }
});

export const button = (reducedMotion = false): Variants => ({
    rest: {
        scale: 1
    },
    hover: reducedMotion
        ? {}
        : {
            y: -1,
            scale: 1.01,
            transition: springSnappy
        },
    tap: reducedMotion
        ? {}
        : {
            scale: 0.985,
            transition: easeOutFast
        }
});

export const skeleton = (reducedMotion = false): Variants => ({
    hidden: {
        opacity: 0
    },
    visible: {
        opacity: 1,
        transition: easeOutFast
    },
    exit: {
        opacity: 0,
        transition: {
            duration: reducedMotion ? 0.12 : 0.18
        }
    }
});
