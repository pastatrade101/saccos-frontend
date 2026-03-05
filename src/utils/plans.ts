import type { Plan, PlanFeature } from "../types/api";

export function getPlanFeatureValue(feature: PlanFeature) {
    if (feature.feature_type === "bool") {
        return Boolean(feature.bool_value);
    }

    if (feature.feature_type === "int") {
        return Number(feature.int_value ?? 0);
    }

    return feature.string_value || "";
}

export function getPlanFeatureMap(plan: Plan) {
    return Object.fromEntries(
        (plan.plan_features || []).map((feature) => [feature.feature_key, getPlanFeatureValue(feature)])
    );
}

export function getPlanHighlights(plan: Plan) {
    const featureMap = getPlanFeatureMap(plan);
    const highlights: string[] = [];

    if (featureMap.loans_enabled) {
        highlights.push("Loan operations enabled");
    } else {
        highlights.push("Loan operations disabled");
    }

    if (featureMap.dividends_enabled) {
        highlights.push("Dividend cycles enabled");
    }

    if (featureMap.contributions_enabled) {
        highlights.push("Share contributions enabled");
    }

    if (featureMap.advanced_reports) {
        highlights.push("Advanced reporting unlocked");
    } else {
        highlights.push("Standard reporting only");
    }

    if (featureMap.maker_checker_enabled) {
        highlights.push("Maker-checker controls available");
    }

    if (featureMap.multi_approval_enabled) {
        highlights.push("Multi-approval governance available");
    }

    const maxBranches = Number(featureMap.max_branches || 0);
    const maxUsers = Number(featureMap.max_users || 0);
    const maxMembers = Number(featureMap.max_members || 0);

    highlights.push(
        `Capacity: ${maxBranches.toLocaleString()} branches, ${maxUsers.toLocaleString()} users, ${maxMembers.toLocaleString()} members`
    );

    return highlights.slice(0, 4);
}
