export const NEXT_OF_KIN_RELATIONSHIP_VALUES = [
    "spouse",
    "father",
    "mother",
    "son",
    "daughter",
    "brother",
    "sister",
    "guardian",
    "relative",
    "friend",
    "other"
] as const;

export const LEGACY_NEXT_OF_KIN_RELATIONSHIP_VALUES = [
    "parent",
    "sibling",
    "child"
] as const;

export type NextOfKinRelationship = (typeof NEXT_OF_KIN_RELATIONSHIP_VALUES)[number];
export type LegacyNextOfKinRelationship = (typeof LEGACY_NEXT_OF_KIN_RELATIONSHIP_VALUES)[number];

const NEXT_OF_KIN_RELATIONSHIP_LABELS: Record<string, string> = {
    spouse: "Spouse",
    father: "Father",
    mother: "Mother",
    son: "Son",
    daughter: "Daughter",
    brother: "Brother",
    sister: "Sister",
    guardian: "Guardian",
    relative: "Relative",
    friend: "Friend",
    other: "Other",
    parent: "Parent",
    sibling: "Sibling",
    child: "Child"
};

export const NEXT_OF_KIN_RELATIONSHIP_OPTIONS = NEXT_OF_KIN_RELATIONSHIP_VALUES.map((value) => ({
    value,
    label: NEXT_OF_KIN_RELATIONSHIP_LABELS[value]
}));

export function isSupportedNextOfKinRelationship(value?: string | null): value is NextOfKinRelationship {
    return Boolean(value && NEXT_OF_KIN_RELATIONSHIP_VALUES.includes(value as NextOfKinRelationship));
}

export function isLegacyNextOfKinRelationship(value?: string | null): value is LegacyNextOfKinRelationship {
    return Boolean(value && LEGACY_NEXT_OF_KIN_RELATIONSHIP_VALUES.includes(value as LegacyNextOfKinRelationship));
}

export function formatNextOfKinRelationship(value?: string | null) {
    if (!value) {
        return "";
    }

    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (NEXT_OF_KIN_RELATIONSHIP_LABELS[normalized]) {
        return NEXT_OF_KIN_RELATIONSHIP_LABELS[normalized];
    }

    return value
        .trim()
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
}
