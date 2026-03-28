import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import MonetizationOnRoundedIcon from "@mui/icons-material/MonetizationOnRounded";
import PriceChangeRoundedIcon from "@mui/icons-material/PriceChangeRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import ShowChartRoundedIcon from "@mui/icons-material/ShowChartRounded";
import WalletRoundedIcon from "@mui/icons-material/WalletRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    LinearProgress,
    MenuItem,
    Paper,
    Stack,
    Tab,
    Tabs,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { ChartPanel } from "../components/ChartPanel";
import { useToast } from "../components/Toast";
import { TwoFactorStepUpDialog, type TwoFactorStepUpPayload } from "../components/TwoFactorStepUpDialog";
import { api, getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from "../lib/api";
import { endpoints } from "../lib/endpoints";
import type {
    ApiEnvelope,
    PaginatedResult,
    TreasuryAsset,
    TreasuryIncome,
    TreasuryLiquidityOverview,
    TreasuryOrder,
    TreasuryOverview,
    TreasuryPolicy,
    TreasuryPolicyViolation,
    TreasuryPortfolioPosition,
    TreasuryTransaction
} from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

type TreasuryTab = "portfolio" | "orders" | "transactions" | "income" | "liquidity";

const TAB_OPTIONS: Array<{ value: TreasuryTab; label: string }> = [
    { value: "portfolio", label: "Portfolio" },
    { value: "orders", label: "Investment Orders" },
    { value: "transactions", label: "Transactions" },
    { value: "income", label: "Investment Income" },
    { value: "liquidity", label: "Liquidity Overview" }
];

function orderStatusColor(status: TreasuryOrder["status"]): "default" | "warning" | "success" | "error" | "info" {
    if (status === "executed") return "success";
    if (status === "approved") return "info";
    if (status === "pending_review" || status === "pending_approval") return "warning";
    if (status === "rejected" || status === "cancelled") return "error";
    return "default";
}

function guardrailColor(status: TreasuryOverview["safeguard_status"]): "success" | "warning" {
    return status === "healthy" ? "success" : "warning";
}

function assetLabel(asset?: TreasuryAsset | null) {
    if (!asset) return "Unknown asset";
    if (asset.symbol) return `${asset.asset_name} (${asset.symbol})`;
    return asset.asset_name;
}

export function TreasuryPage() {
    const navigate = useNavigate();
    const { profile, twoFactorSetupRequired } = useAuth();
    const { pushToast } = useToast();
    const tenantId = profile?.tenant_id || "";
    const securityTarget = profile?.two_factor_enabled ? "/security" : "/security?intent=setup";
    const canOperate =
        profile?.role === "super_admin" ||
        profile?.role === "branch_manager" ||
        profile?.role === "treasury_officer";
    const canReviewExecute = profile?.role === "super_admin" || profile?.role === "branch_manager";
    const canConfigurePolicy = profile?.role === "super_admin" || profile?.role === "branch_manager";
    const [activeTab, setActiveTab] = useState<TreasuryTab>("portfolio");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [overview, setOverview] = useState<TreasuryOverview | null>(null);
    const [liquidity, setLiquidity] = useState<TreasuryLiquidityOverview | null>(null);
    const [policy, setPolicy] = useState<TreasuryPolicy | null>(null);
    const [assets, setAssets] = useState<TreasuryAsset[]>([]);
    const [portfolio, setPortfolio] = useState<TreasuryPortfolioPosition[]>([]);
    const [orders, setOrders] = useState<TreasuryOrder[]>([]);
    const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
    const [incomeRows, setIncomeRows] = useState<TreasuryIncome[]>([]);
    const [busy, setBusy] = useState(false);
    const [assetDialogOpen, setAssetDialogOpen] = useState(false);
    const [orderDialogOpen, setOrderDialogOpen] = useState(false);
    const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
    const [valuationDialogOpen, setValuationDialogOpen] = useState(false);
    const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<TreasuryPortfolioPosition | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<TreasuryOrder | null>(null);
    const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected">("approved");
    const [reviewReason, setReviewReason] = useState("");
    const [reviewNotes, setReviewNotes] = useState("");
    const [assetForm, setAssetForm] = useState({
        asset_name: "",
        asset_type: "Bond Fund",
        symbol: "",
        market: "",
        currency: "TZS"
    });
    const [orderForm, setOrderForm] = useState({
        asset_id: "",
        order_type: "buy" as "buy" | "sell",
        units: "",
        unit_price: "",
        notes: ""
    });
    const [incomeForm, setIncomeForm] = useState({
        asset_id: "",
        income_type: "dividend" as "dividend" | "interest" | "capital_gain",
        amount: "",
        description: ""
    });
    const [valuationPrice, setValuationPrice] = useState("");
    const [stepUpOpen, setStepUpOpen] = useState(false);
    const [stepUpTitle, setStepUpTitle] = useState("Authenticator verification required");
    const [stepUpDescription, setStepUpDescription] = useState("");
    const [stepUpActionLabel, setStepUpActionLabel] = useState("Verify");
    const [stepUpHandler, setStepUpHandler] = useState<((payload: TwoFactorStepUpPayload) => Promise<void>) | null>(null);
    const [twoFactorGateActive, setTwoFactorGateActive] = useState(false);

    const handleTwoFactorGateError = (error: unknown) => {
        if (getApiErrorCode(error) !== "TWO_FACTOR_SETUP_REQUIRED") {
            return false;
        }

        setTwoFactorGateActive(true);
        return true;
    };

    const loadTreasury = async (mode: "initial" | "refresh" = "refresh") => {
        if (!tenantId || twoFactorSetupRequired || profile?.role === "branch_manager") {
            return;
        }

        if (mode === "initial") {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            const [
                overviewResponse,
                liquidityResponse,
                policyResponse,
                assetsResponse,
                portfolioResponse,
                ordersResponse,
                transactionsResponse,
                incomeResponse
            ] = await Promise.all([
                api.get<ApiEnvelope<TreasuryOverview>>(endpoints.treasury.overview(), { params: { tenant_id: tenantId } }),
                api.get<ApiEnvelope<TreasuryLiquidityOverview>>(endpoints.treasury.liquidity(), { params: { tenant_id: tenantId } }),
                api.get<ApiEnvelope<TreasuryPolicy>>(endpoints.treasury.policy(), { params: { tenant_id: tenantId } }),
                api.get<ApiEnvelope<TreasuryAsset[]>>(endpoints.treasury.assets(), { params: { tenant_id: tenantId } }),
                api.get<ApiEnvelope<TreasuryPortfolioPosition[]>>(endpoints.treasury.portfolio(), { params: { tenant_id: tenantId } }),
                api.get<PaginatedResult<TreasuryOrder>>(endpoints.treasury.orders(), { params: { tenant_id: tenantId, limit: 50 } }),
                api.get<PaginatedResult<TreasuryTransaction>>(endpoints.treasury.transactions(), { params: { tenant_id: tenantId, limit: 50 } }),
                api.get<PaginatedResult<TreasuryIncome>>(endpoints.treasury.income(), { params: { tenant_id: tenantId, limit: 50 } })
            ]);

            setOverview(overviewResponse.data.data);
            setLiquidity(liquidityResponse.data.data);
            setPolicy(policyResponse.data.data);
            setAssets(assetsResponse.data.data);
            setPortfolio(portfolioResponse.data.data);
            setOrders(ordersResponse.data.data);
            setTransactions(transactionsResponse.data.data);
            setIncomeRows(incomeResponse.data.data);
            setTwoFactorGateActive(false);
        } catch (error) {
            if (handleTwoFactorGateError(error)) {
                return;
            }

            pushToast({
                type: "error",
                title: "Treasury",
                message: getApiErrorMessage(error, "Unable to load the treasury workspace.")
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (twoFactorSetupRequired || profile?.role === "branch_manager") {
            return;
        }

        void loadTreasury("initial");
    }, [tenantId, twoFactorSetupRequired, profile?.role]);

    const orderPreviewAmount = useMemo(() => {
        const units = Number(orderForm.units || 0);
        const unitPrice = Number(orderForm.unit_price || 0);
        return units > 0 && unitPrice > 0 ? units * unitPrice : 0;
    }, [orderForm.units, orderForm.unit_price]);

    const effectivePolicy = useMemo(
        () => policy || overview?.policy || liquidity?.policy || null,
        [liquidity?.policy, overview?.policy, policy]
    );

    const selectedOrderAsset = useMemo(
        () => assets.find((asset) => asset.id === orderForm.asset_id) || null,
        [assets, orderForm.asset_id]
    );

    const totalPortfolioMarketValue = useMemo(
        () => portfolio.reduce((sum, row) => sum + Number(row.current_market_value || 0), 0),
        [portfolio]
    );

    const selectedAssetPosition = useMemo(
        () => portfolio.find((row) => row.asset_id === orderForm.asset_id) || null,
        [orderForm.asset_id, portfolio]
    );

    const projectedAssetMarketValue = useMemo(() => {
        if (!selectedOrderAsset || orderForm.order_type !== "buy") {
            return Number(selectedAssetPosition?.current_market_value || 0);
        }

        return Number(selectedAssetPosition?.current_market_value || 0) + orderPreviewAmount;
    }, [orderForm.order_type, orderPreviewAmount, selectedAssetPosition?.current_market_value, selectedOrderAsset]);

    const projectedPortfolioValue = useMemo(() => {
        if (orderForm.order_type !== "buy") {
            return totalPortfolioMarketValue;
        }

        return totalPortfolioMarketValue + orderPreviewAmount;
    }, [orderForm.order_type, orderPreviewAmount, totalPortfolioMarketValue]);

    const projectedAllocationPercent = useMemo(() => {
        if (!projectedPortfolioValue || !selectedOrderAsset || orderForm.order_type !== "buy") {
            return 0;
        }

        return (projectedAssetMarketValue / projectedPortfolioValue) * 100;
    }, [orderForm.order_type, projectedAssetMarketValue, projectedPortfolioValue, selectedOrderAsset]);

    const projectedAssetTypeAllocationPercent = useMemo(() => {
        if (!projectedPortfolioValue || !selectedOrderAsset || orderForm.order_type !== "buy") {
            return 0;
        }

        const currentAssetTypeValue = portfolio.reduce((sum, row) => {
            return (row.treasury_assets?.asset_type || "") === (selectedOrderAsset.asset_type || "")
                ? sum + Number(row.current_market_value || 0)
                : sum;
        }, 0);

        return ((currentAssetTypeValue + orderPreviewAmount) / projectedPortfolioValue) * 100;
    }, [orderForm.order_type, orderPreviewAmount, portfolio, projectedPortfolioValue, selectedOrderAsset]);

    const orderRiskCheck = useMemo(() => {
        const totalCash = Number(liquidity?.total_cash || 0);
        const remainingCash = totalCash - orderPreviewAmount;
        const violations: TreasuryPolicyViolation[] = [];

        if (effectivePolicy?.max_single_order_amount != null && orderPreviewAmount > Number(effectivePolicy.max_single_order_amount)) {
            violations.push({
                violation: true,
                policy_violation: true,
                rule: "max_single_order_amount",
                severity: "warning",
                message: "Order exceeds the maximum treasury order amount.",
                current_value: orderPreviewAmount,
                required_value: Number(effectivePolicy.max_single_order_amount)
            });
        }

        if (orderForm.order_type === "buy" && orderPreviewAmount > 0) {
            const reserveAmount = totalCash * (Number(effectivePolicy?.liquidity_reserve_ratio || 0) / 100);
            const loanProtectionAmount = Number(liquidity?.outstanding_loans || liquidity?.outstanding_loan_obligations || 0)
                * (Number(effectivePolicy?.loan_liquidity_protection_ratio || 0) / 100);

            if (remainingCash < reserveAmount) {
                violations.push({
                    violation: true,
                    policy_violation: true,
                    rule: "liquidity_reserve",
                    severity: "block",
                    message: "This order would breach the treasury liquidity reserve requirement.",
                    current_value: remainingCash,
                    required_value: reserveAmount
                });
            }

            if (remainingCash < Number(effectivePolicy?.minimum_cash_buffer || 0)) {
                violations.push({
                    violation: true,
                    policy_violation: true,
                    rule: "minimum_cash_buffer",
                    severity: "block",
                    message: "This order would reduce available cash below the treasury cash buffer.",
                    current_value: remainingCash,
                    required_value: Number(effectivePolicy?.minimum_cash_buffer || 0)
                });
            }

            if (remainingCash < loanProtectionAmount) {
                violations.push({
                    violation: true,
                    policy_violation: true,
                    rule: "loan_liquidity_protection",
                    severity: "block",
                    message: "This order would consume cash protected for lending liquidity.",
                    current_value: remainingCash,
                    required_value: loanProtectionAmount
                });
            }

            if (
                effectivePolicy?.max_asset_allocation_percent != null &&
                projectedAssetTypeAllocationPercent > Number(effectivePolicy.max_asset_allocation_percent)
            ) {
                violations.push({
                    violation: true,
                    policy_violation: true,
                    rule: "max_asset_allocation",
                    severity: "warning",
                    message: "Projected asset-type allocation exceeds treasury policy.",
                    current_value: projectedAssetTypeAllocationPercent,
                    required_value: Number(effectivePolicy.max_asset_allocation_percent)
                });
            }

            if (
                effectivePolicy?.max_single_asset_percent != null &&
                projectedAllocationPercent > Number(effectivePolicy.max_single_asset_percent)
            ) {
                violations.push({
                    violation: true,
                    policy_violation: true,
                    rule: "max_single_asset",
                    severity: "warning",
                    message: "Projected single-asset concentration exceeds treasury policy.",
                    current_value: projectedAllocationPercent,
                    required_value: Number(effectivePolicy.max_single_asset_percent)
                });
            }
        }

        if (
            effectivePolicy?.approval_threshold != null &&
            Number(effectivePolicy.approval_threshold) > 0 &&
            orderPreviewAmount >= Number(effectivePolicy.approval_threshold)
        ) {
            violations.push({
                violation: true,
                policy_violation: true,
                rule: "approval_threshold",
                severity: "warning",
                message: "Order meets the treasury approval threshold and should be escalated.",
                current_value: orderPreviewAmount,
                required_value: Number(effectivePolicy.approval_threshold)
            });
        }

        const blockingViolations = violations.filter((item) => item.severity === "block");
        const warningViolations = violations.filter((item) => item.severity === "warning");

        return {
            remainingCash,
            projectedAllocationPercent,
            projectedAssetTypeAllocationPercent,
            violations,
            blockingViolations,
            warningViolations,
            liquidityBlocked: blockingViolations.length > 0,
            requiresEscalation: warningViolations.length > 0
        };
    }, [
        effectivePolicy?.approval_threshold,
        effectivePolicy?.max_asset_allocation_percent,
        effectivePolicy?.max_single_asset_percent,
        effectivePolicy?.max_single_order_amount,
        effectivePolicy?.minimum_cash_buffer,
        effectivePolicy?.liquidity_reserve_ratio,
        effectivePolicy?.loan_liquidity_protection_ratio,
        liquidity?.outstanding_loan_obligations,
        liquidity?.outstanding_loans,
        liquidity?.total_cash,
        orderForm.order_type,
        orderPreviewAmount,
        projectedAllocationPercent,
        projectedAssetTypeAllocationPercent
    ]);

    const governanceIndicators = useMemo(() => ([
        { label: "Pending", value: overview?.pending_orders ?? 0, tone: "warning.main" },
        { label: "Approved", value: overview?.approved_orders ?? 0, tone: "info.main" },
        { label: "Executed", value: overview?.executed_orders ?? 0, tone: "success.main" }
    ]), [overview?.approved_orders, overview?.executed_orders, overview?.pending_orders]);

    const allocationChartData = useMemo(() => {
        const grouped = portfolio.reduce<Record<string, number>>((accumulator, row) => {
            const key = row.treasury_assets?.asset_type || row.treasury_assets?.asset_name || "Unclassified";
            accumulator[key] = (accumulator[key] || 0) + Number(row.current_market_value || 0);
            return accumulator;
        }, {});

        const labels = Object.keys(grouped);
        const values = labels.map((label) => grouped[label]);
        const colors = ["#3120b2", "#1b8f4d", "#e08d11", "#cc4b37", "#0d7ea3", "#7a4fd3"];

        return {
            labels,
            datasets: [
                {
                    data: values,
                    backgroundColor: labels.map((_, index) => colors[index % colors.length]),
                    borderWidth: 0
                }
            ]
        };
    }, [portfolio]);

    const allocationBreakdown = useMemo(() => {
        return Object.entries(
            portfolio.reduce<Record<string, number>>((accumulator, row) => {
                const key = row.treasury_assets?.asset_type || row.treasury_assets?.asset_name || "Unclassified";
                accumulator[key] = (accumulator[key] || 0) + Number(row.current_market_value || 0);
                return accumulator;
            }, {})
        ).map(([label, value]) => ({
            label,
            value,
            percent: totalPortfolioMarketValue > 0 ? (value / totalPortfolioMarketValue) * 100 : 0
        }));
    }, [portfolio, totalPortfolioMarketValue]);

    const incomeTrendData = useMemo(() => {
        const now = new Date();
        const buckets = Array.from({ length: 6 }, (_, offset) => {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - offset), 1);
            const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
            return {
                key,
                label: monthDate.toLocaleDateString("en-TZ", { month: "short", year: "2-digit" }),
                amount: 0
            };
        });

        incomeRows.forEach((row) => {
            const received = new Date(row.received_date);
            const key = `${received.getFullYear()}-${String(received.getMonth() + 1).padStart(2, "0")}`;
            const bucket = buckets.find((entry) => entry.key === key);
            if (bucket) {
                bucket.amount += Number(row.amount || 0);
            }
        });

        return {
            labels: buckets.map((bucket) => bucket.label),
            datasets: [
                {
                    label: "Investment income",
                    data: buckets.map((bucket) => bucket.amount),
                    borderColor: "#3120b2",
                    backgroundColor: "rgba(49, 32, 178, 0.12)",
                    tension: 0.35,
                    fill: true
                }
            ]
        };
    }, [incomeRows]);

    const openStepUpDialog = (
        title: string,
        description: string,
        actionLabel: string,
        handler: (payload: TwoFactorStepUpPayload) => Promise<void>
    ) => {
        setStepUpTitle(title);
        setStepUpDescription(description);
        setStepUpActionLabel(actionLabel);
        setStepUpHandler(() => handler);
        setStepUpOpen(true);
    };

    const closeStepUpDialog = () => {
        if (busy) {
            return;
        }

        setStepUpOpen(false);
        setStepUpHandler(null);
    };

    const resetAssetForm = () => {
        setAssetForm({
            asset_name: "",
            asset_type: "Bond Fund",
            symbol: "",
            market: "",
            currency: "TZS"
        });
    };

    const resetOrderForm = () => {
        setOrderForm({
            asset_id: "",
            order_type: "buy",
            units: "",
            unit_price: "",
            notes: ""
        });
    };

    const resetIncomeForm = () => {
        setIncomeForm({
            asset_id: "",
            income_type: "dividend",
            amount: "",
            description: ""
        });
    };

    const handleCreateAsset = async () => {
        if (!assetForm.asset_name.trim()) {
            pushToast({ type: "error", title: "Treasury asset", message: "Asset name is required." });
            return;
        }

        setBusy(true);
        try {
            await api.post(endpoints.treasury.assets(), {
                tenant_id: tenantId,
                asset_name: assetForm.asset_name.trim(),
                asset_type: assetForm.asset_type.trim(),
                symbol: assetForm.symbol.trim() || null,
                market: assetForm.market.trim() || null,
                currency: assetForm.currency.trim() || "TZS"
            });
            setAssetDialogOpen(false);
            resetAssetForm();
            await loadTreasury();
            pushToast({ type: "success", title: "Treasury", message: "Asset added to the treasury register." });
        } catch (error) {
            if (handleTwoFactorGateError(error)) {
                return;
            }
            pushToast({ type: "error", title: "Treasury", message: getApiErrorMessage(error, "Unable to create asset.") });
        } finally {
            setBusy(false);
        }
    };

    const handleCreateOrder = async () => {
        if (!orderForm.asset_id) {
            pushToast({ type: "error", title: "Treasury order", message: "Choose an asset first." });
            return;
        }

        setBusy(true);
        try {
            const { data } = await api.post<ApiEnvelope<TreasuryOrder>>(endpoints.treasury.orders(), {
                tenant_id: tenantId,
                asset_id: orderForm.asset_id,
                order_type: orderForm.order_type,
                units: Number(orderForm.units || 0),
                unit_price: Number(orderForm.unit_price || 0),
                total_amount: orderPreviewAmount,
                notes: orderForm.notes.trim() || null
            });
            setOrderDialogOpen(false);
            resetOrderForm();
            await loadTreasury();
            pushToast({
                type: data.data.policy_check?.warning_violations?.length ? "warning" : "success",
                title: "Treasury",
                message: data.data.policy_check?.warning_violations?.length
                    ? "Investment order created and flagged for escalation review under treasury policy."
                    : "Investment order created and queued for review."
            });
        } catch (error) {
            if (handleTwoFactorGateError(error)) {
                return;
            }
            const violation = getApiErrorDetails<TreasuryPolicyViolation>(error);
            pushToast({
                type: violation?.severity === "warning" ? "warning" : "error",
                title: "Treasury",
                message: violation?.message || getApiErrorMessage(error, "Unable to create treasury order.")
            });
        } finally {
            setBusy(false);
        }
    };

    const handleReviewOrder = async () => {
        if (!selectedOrder) {
            return;
        }

        setBusy(true);
        try {
            const { data } = await api.post<ApiEnvelope<TreasuryOrder>>(endpoints.treasury.reviewOrder(selectedOrder.id), {
                tenant_id: tenantId,
                decision: reviewDecision,
                reason: reviewDecision === "rejected" ? reviewReason.trim() : null,
                notes: reviewNotes.trim() || null
            });
            setReviewDialogOpen(false);
            setSelectedOrder(null);
            setReviewDecision("approved");
            setReviewReason("");
            setReviewNotes("");
            await loadTreasury();
            pushToast({
                type: reviewDecision === "approved" ? "success" : "warning",
                title: "Treasury",
                message: reviewDecision === "approved"
                    ? (data.data.approval_required
                        ? "Order reviewed and routed into approval control."
                        : "Order reviewed and marked approved for execution.")
                    : "Treasury order rejected."
            });
        } catch (error) {
            pushToast({ type: "error", title: "Treasury", message: getApiErrorMessage(error, "Unable to review treasury order.") });
        } finally {
            setBusy(false);
        }
    };

    const handleExecuteOrder = (order: TreasuryOrder) => {
        openStepUpDialog(
            "Execute treasury order",
            `Confirm a fresh authenticator check before posting ${assetLabel(order.treasury_assets)} to the ledger and updating the institutional portfolio.`,
            "Execute order",
            async (stepUpPayload) => {
                setBusy(true);
                try {
                    await api.post(endpoints.treasury.executeOrder(order.id), {
                        tenant_id: tenantId,
                        two_factor_code: stepUpPayload.two_factor_code || null,
                        recovery_code: stepUpPayload.recovery_code || null
                    });
                    setStepUpOpen(false);
                    setStepUpHandler(null);
                    await loadTreasury();
                    pushToast({ type: "success", title: "Treasury", message: "Order executed and posted to the ledger." });
                } catch (error) {
                    if (handleTwoFactorGateError(error)) {
                        return;
                    }
                    pushToast({ type: "error", title: "Treasury", message: getApiErrorMessage(error, "Unable to execute treasury order.") });
                } finally {
                    setBusy(false);
                }
            }
        );
    };

    const handleRecordIncome = async () => {
        if (!incomeForm.asset_id) {
            pushToast({ type: "error", title: "Treasury income", message: "Choose an asset first." });
            return;
        }

        setBusy(true);
        try {
            await api.post(endpoints.treasury.income(), {
                tenant_id: tenantId,
                asset_id: incomeForm.asset_id,
                income_type: incomeForm.income_type,
                amount: Number(incomeForm.amount || 0),
                description: incomeForm.description.trim() || null
            });
            setIncomeDialogOpen(false);
            resetIncomeForm();
            await loadTreasury();
            pushToast({ type: "success", title: "Treasury", message: "Investment income recorded and posted to the ledger." });
        } catch (error) {
            if (handleTwoFactorGateError(error)) {
                return;
            }
            pushToast({ type: "error", title: "Treasury", message: getApiErrorMessage(error, "Unable to record treasury income.") });
        } finally {
            setBusy(false);
        }
    };

    const handleSaveValuation = async () => {
        if (!selectedPosition) {
            return;
        }

        setBusy(true);
        try {
            await api.patch(endpoints.treasury.valuation(selectedPosition.asset_id), {
                tenant_id: tenantId,
                current_price: Number(valuationPrice || 0)
            });
            setValuationDialogOpen(false);
            setSelectedPosition(null);
            setValuationPrice("");
            await loadTreasury();
            pushToast({ type: "success", title: "Treasury", message: "Portfolio valuation updated without touching the ledger." });
        } catch (error) {
            if (handleTwoFactorGateError(error)) {
                return;
            }
            pushToast({ type: "error", title: "Treasury", message: getApiErrorMessage(error, "Unable to update valuation.") });
        } finally {
            setBusy(false);
        }
    };

    const summaryCards = overview ? [
        {
            label: "Total Investments",
            value: formatCurrency(overview.total_investments),
            helper: `${overview.active_positions_count} active portfolio position(s)`,
            icon: <WalletRoundedIcon color="primary" />
        },
        {
            label: "Portfolio Value",
            value: formatCurrency(overview.total_portfolio_value),
            helper: `Return ${overview.investment_return_percent.toFixed(2)}%`,
            icon: <ShowChartRoundedIcon color="success" />
        },
        {
            label: "Investment Income YTD",
            value: formatCurrency(overview.investment_income_ytd),
            helper: `Unrealized gain ${formatCurrency(overview.unrealized_gains)}`,
            icon: <MonetizationOnRoundedIcon color="warning" />
        },
        {
            label: "Investable Cash",
            value: formatCurrency(overview.available_investable_cash),
            helper: `${overview.pending_review_orders + overview.pending_approval_orders} order(s) still open`,
            icon: <ShieldRoundedIcon color="info" />
        },
        {
            label: "Liquidity Reserve Required",
            value: formatCurrency(overview.liquidity_reserve_required),
            helper: `${effectivePolicy?.liquidity_reserve_ratio ?? 0}% reserve ratio in force`,
            icon: <ShieldRoundedIcon color="warning" />
        },
        {
            label: "Loan Exposure",
            value: formatCurrency(overview.loan_exposure),
            helper: "Outstanding loan principal across the SACCO",
            icon: <AssessmentRoundedIcon color="action" />
        }
    ] : [];

    const activeAssetOptions = assets.filter((asset) => asset.status === "active");
    const secondaryActionSx = {
        minHeight: 52,
        px: 2.25,
        minWidth: 144,
        borderRadius: 2,
        borderColor: "divider",
        bgcolor: "background.paper",
        color: "text.primary",
        fontWeight: 700,
        whiteSpace: "nowrap",
        justifyContent: "center",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        "& .MuiButton-startIcon": {
            color: "primary.main"
        },
        "&:hover": {
            borderColor: "primary.main",
            bgcolor: "primary.50"
        }
    } as const;
    const primaryActionSx = {
        minHeight: 52,
        px: 2.5,
        minWidth: 144,
        borderRadius: 2,
        fontWeight: 800,
        whiteSpace: "nowrap",
        boxShadow: "0 10px 24px rgba(49, 32, 178, 0.18)",
        "&:hover": {
            boxShadow: "0 14px 30px rgba(49, 32, 178, 0.24)"
        }
    } as const;

    if (twoFactorSetupRequired) {
        return <Navigate to="/security" replace />;
    }

    if (profile?.role === "branch_manager") {
        return <Navigate to="/treasury/policy-settings" replace />;
    }

    if (twoFactorGateActive) {
        return (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
                <Card
                    variant="outlined"
                    sx={{
                        maxWidth: 760,
                        borderRadius: 3
                    }}
                >
                    <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                        <Stack spacing={2.5}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box
                                    sx={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 2.5,
                                        display: "grid",
                                        placeItems: "center",
                                        bgcolor: "warning.50",
                                        color: "warning.main"
                                    }}
                                >
                                    <ShieldRoundedIcon />
                                </Box>
                                <Box>
                                    <Typography variant="h5" fontWeight={800}>
                                        Configure two-factor authentication
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Treasury access is protected. Set up authenticator-based verification before you can view portfolio positions, orders, transactions, or income.
                                    </Typography>
                                </Box>
                            </Stack>

                            <Alert severity="info">
                                This role can manage institutional funds and ledger-linked treasury activity, so two-factor authentication is required before the treasury workspace is unlocked.
                            </Alert>

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                <Button
                                    variant="contained"
                                    startIcon={<ShieldRoundedIcon />}
                                    onClick={() => navigate(securityTarget)}
                                >
                                    Configure two-factor authentication
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => {
                                        setTwoFactorGateActive(false);
                                        void loadTreasury("initial");
                                    }}
                                >
                                    Try again
                                </Button>
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={3}>
                <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={2}>
                    <Box>
                        <Typography variant="h4" fontWeight={800}>
                            Treasury
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                            Institutional investment management for SACCO funds. Treasury activity posts only to the core ledger and never changes member balances directly.
                        </Typography>
                    </Box>
                    {canOperate ? (
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1.25}
                            alignItems={{ xs: "stretch", sm: "center" }}
                            sx={{
                                p: 1,
                                borderRadius: 2.25,
                                bgcolor: "background.paper",
                                border: "1px solid",
                                borderColor: "divider",
                                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
                            }}
                        >
                            <Button
                                variant="outlined"
                                startIcon={<AddRoundedIcon />}
                                onClick={() => setAssetDialogOpen(true)}
                                sx={secondaryActionSx}
                            >
                                Add asset
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<PriceChangeRoundedIcon />}
                                onClick={() => setIncomeDialogOpen(true)}
                                sx={secondaryActionSx}
                            >
                                Record income
                            </Button>
                            {canConfigurePolicy ? (
                                <Button
                                    variant="outlined"
                                    startIcon={<AssessmentRoundedIcon />}
                                    onClick={() => navigate("/treasury/policy-settings")}
                                    sx={secondaryActionSx}
                                >
                                    Treasury policy
                                </Button>
                            ) : null}
                            <Button
                                variant="contained"
                                startIcon={<ShowChartRoundedIcon />}
                                onClick={() => setOrderDialogOpen(true)}
                                sx={primaryActionSx}
                            >
                                New order
                            </Button>
                        </Stack>
                    ) : null}
                </Stack>

                <Alert severity="info">
                    Treasury uses the institutional cash pool derived from ledger cash and current loan obligations. Unrealized valuation changes stay off-ledger until a realized transaction occurs.
                </Alert>

                {refreshing ? <LinearProgress /> : null}

                {loading ? (
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="body2" color="text.secondary">
                                Loading treasury workspace...
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Box
                            sx={{
                                display: "grid",
                                gap: 2,
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    md: "repeat(2, minmax(0, 1fr))",
                                    xl: "repeat(3, minmax(0, 1fr))"
                                }
                            }}
                        >
                            {summaryCards.map((card) => (
                                <Card key={card.label} variant="outlined">
                                    <CardContent>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">
                                                    {card.label}
                                                </Typography>
                                                <Typography variant="h5" fontWeight={800} sx={{ mt: 1 }}>
                                                    {card.value}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                    {card.helper}
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={{
                                                    width: 46,
                                                    height: 46,
                                                    borderRadius: 2,
                                                    display: "grid",
                                                    placeItems: "center",
                                                    bgcolor: "action.hover"
                                                }}
                                            >
                                                {card.icon}
                                            </Box>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>

                        <Box
                            sx={{
                                display: "grid",
                                gap: 2,
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    lg: "repeat(3, minmax(0, 1fr))"
                                }
                            }}
                        >
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="h6" fontWeight={800}>
                                        Governance indicators
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Treasury order flow across review, approval, and execution.
                                    </Typography>
                                    <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                                        {governanceIndicators.map((item) => (
                                            <Paper key={item.label} variant="outlined" sx={{ flex: 1, p: 2 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {item.label}
                                                </Typography>
                                                <Typography variant="h5" fontWeight={800} sx={{ mt: 1, color: item.tone }}>
                                                    {item.value}
                                                </Typography>
                                            </Paper>
                                        ))}
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="h6" fontWeight={800}>
                                        Treasury guardrails
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Current policy limits protecting institutional liquidity and concentration.
                                    </Typography>
                                    <Stack spacing={1.25} sx={{ mt: 2 }}>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Liquidity Reserve Ratio</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {effectivePolicy ? `${effectivePolicy.liquidity_reserve_ratio}%` : "Not configured"}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Minimum Cash Buffer</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {effectivePolicy ? formatCurrency(effectivePolicy.minimum_cash_buffer || 0) : "Not configured"}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Loan Liquidity Protection</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {effectivePolicy ? `${effectivePolicy.loan_liquidity_protection_ratio || 0}%` : "Not configured"}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Maximum Asset Allocation %</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {effectivePolicy?.max_asset_allocation_percent != null
                                                    ? `${effectivePolicy.max_asset_allocation_percent}%`
                                                    : "Not configured"}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Maximum Single Asset %</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {effectivePolicy?.max_single_asset_percent != null
                                                    ? `${effectivePolicy.max_single_asset_percent}%`
                                                    : "Not configured"}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Maximum Single Order Amount</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {effectivePolicy?.max_single_order_amount != null
                                                    ? formatCurrency(effectivePolicy.max_single_order_amount)
                                                    : "Not capped"}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Approval Threshold</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {effectivePolicy?.approval_threshold
                                                    ? formatCurrency(effectivePolicy.approval_threshold)
                                                    : "No automatic threshold"}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Valuation Update Frequency</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {effectivePolicy ? `${effectivePolicy.valuation_update_frequency_days} day(s)` : "Not configured"}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Policy Version</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {effectivePolicy ? `v${effectivePolicy.policy_version}` : "Not configured"}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="h6" fontWeight={800}>
                                        Liquidity projection
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Forward-looking operational cash pressure affecting treasury timing.
                                    </Typography>
                                    <Stack spacing={1.25} sx={{ mt: 2 }}>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Expected Loan Disbursements</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {formatCurrency(overview?.expected_loan_disbursements || 0)}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Expected Repayments</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {formatCurrency(overview?.expected_repayments || 0)}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                                            <Typography variant="body2" color="text.secondary">Open Treasury Orders</Typography>
                                            <Typography variant="body2" fontWeight={700}>
                                                {formatCurrency(overview?.open_treasury_orders_amount || 0)}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Box>

                        <Card variant="outlined">
                            <CardContent sx={{ p: 0 }}>
                                <Tabs
                                    value={activeTab}
                                    onChange={(_, nextValue: TreasuryTab) => setActiveTab(nextValue)}
                                    variant="scrollable"
                                    scrollButtons="auto"
                                    sx={{ px: 2, pt: 1 }}
                                >
                                    {TAB_OPTIONS.map((tab) => (
                                        <Tab key={tab.value} value={tab.value} label={tab.label} />
                                    ))}
                                </Tabs>
                                <Divider />
                                <Box sx={{ p: { xs: 2, md: 3 } }}>
                                    {activeTab === "portfolio" ? (
                                        <Stack spacing={3}>
                                            <Box
                                                sx={{
                                                    display: "grid",
                                                    gap: 2,
                                                    gridTemplateColumns: {
                                                        xs: "1fr",
                                                        xl: "minmax(0, 1.2fr) minmax(320px, 0.8fr)"
                                                    }
                                                }}
                                            >
                                                <ChartPanel
                                                    title="Portfolio allocation"
                                                    subtitle="Current market value concentration by treasury asset type."
                                                    type="doughnut"
                                                    height={260}
                                                    data={allocationChartData}
                                                    options={{
                                                        plugins: {
                                                            legend: {
                                                                position: "bottom"
                                                            }
                                                        },
                                                        maintainAspectRatio: false
                                                    }}
                                                />
                                                <Card variant="outlined">
                                                    <CardContent>
                                                        <Typography variant="h6" fontWeight={800}>
                                                            Allocation breakdown
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                            Helps treasury monitor concentration before creating new orders.
                                                        </Typography>
                                                        <Stack spacing={1.25} sx={{ mt: 2 }}>
                                                            {allocationBreakdown.length ? allocationBreakdown.map((item) => (
                                                                <Paper key={item.label} variant="outlined" sx={{ p: 1.5 }}>
                                                                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                                                                        <Box>
                                                                            <Typography variant="body2" fontWeight={700}>
                                                                                {item.label}
                                                                            </Typography>
                                                                            <Typography variant="caption" color="text.secondary">
                                                                                {formatCurrency(item.value)}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Typography variant="body2" fontWeight={700}>
                                                                            {item.percent.toFixed(1)}%
                                                                        </Typography>
                                                                    </Stack>
                                                                </Paper>
                                                            )) : (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    No valued positions are available yet.
                                                                </Typography>
                                                            )}
                                                        </Stack>
                                                    </CardContent>
                                                </Card>
                                            </Box>

                                            <Card variant="outlined">
                                                <CardContent>
                                                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                                                        <Box>
                                                            <Typography variant="h6" fontWeight={800}>
                                                                Portfolio positions
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                What the SACCO currently owns, with unrealized valuation tracked separately from ledger postings.
                                                            </Typography>
                                                        </Box>
                                                        {overview ? (
                                                            <Chip
                                                                color={guardrailColor(overview.safeguard_status)}
                                                                label={overview.safeguard_status === "healthy" ? "Liquidity guardrail healthy" : "Guardrail blocking new buys"}
                                                            />
                                                        ) : null}
                                                    </Stack>
                                                    <TableContainer component={Paper} variant="outlined">
                                                        <Table size="small">
                                                            <TableHead>
                                                                <TableRow>
                                                                    <TableCell>Asset</TableCell>
                                                                    <TableCell align="right">Units</TableCell>
                                                                    <TableCell align="right">Average price</TableCell>
                                                                    <TableCell align="right">Cost</TableCell>
                                                                    <TableCell align="right">Market value</TableCell>
                                                                    <TableCell align="right">Allocation %</TableCell>
                                                                    <TableCell align="right">Unrealized gain</TableCell>
                                                                    <TableCell align="right">Return</TableCell>
                                                                    <TableCell>Last valuation date</TableCell>
                                                                    {canOperate ? <TableCell align="right">Action</TableCell> : null}
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {portfolio.length ? portfolio.map((row) => (
                                                                    <TableRow key={row.id} hover>
                                                                        <TableCell>
                                                                            <Typography variant="body2" fontWeight={700}>
                                                                                {assetLabel(row.treasury_assets)}
                                                                            </Typography>
                                                                            <Typography variant="caption" color="text.secondary">
                                                                                {row.treasury_assets?.market || row.treasury_assets?.asset_type || "Institutional asset"}
                                                                            </Typography>
                                                                        </TableCell>
                                                                        <TableCell align="right">{row.units_owned.toLocaleString("en-TZ", { maximumFractionDigits: 2 })}</TableCell>
                                                                        <TableCell align="right">{formatCurrency(row.average_price)}</TableCell>
                                                                        <TableCell align="right">{formatCurrency(row.total_cost)}</TableCell>
                                                                        <TableCell align="right">{formatCurrency(row.current_market_value)}</TableCell>
                                                                        <TableCell align="right">{(row.allocation_percent || 0).toFixed(2)}%</TableCell>
                                                                        <TableCell align="right">
                                                                            <Typography color={row.unrealized_gain >= 0 ? "success.main" : "error.main"} fontWeight={700}>
                                                                                {formatCurrency(row.unrealized_gain)}
                                                                            </Typography>
                                                                        </TableCell>
                                                                        <TableCell align="right">{row.portfolio_return_percent.toFixed(2)}%</TableCell>
                                                                        <TableCell>{row.last_valuation_at ? formatDate(row.last_valuation_at) : "Not valued yet"}</TableCell>
                                                                        {canOperate ? (
                                                                            <TableCell align="right">
                                                                                <Button
                                                                                    size="small"
                                                                                    onClick={() => {
                                                                                        setSelectedPosition(row);
                                                                                        setValuationPrice(String(row.current_price || row.average_price || 0));
                                                                                        setValuationDialogOpen(true);
                                                                                    }}
                                                                                >
                                                                                    Revalue
                                                                                </Button>
                                                                            </TableCell>
                                                                        ) : null}
                                                                    </TableRow>
                                                                )) : (
                                                                    <TableRow>
                                                                        <TableCell colSpan={canOperate ? 10 : 9}>
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                No portfolio positions yet.
                                                                            </Typography>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </TableContainer>
                                                </CardContent>
                                            </Card>

                                            <Card variant="outlined">
                                                <CardContent>
                                                    <Typography variant="h6" fontWeight={800}>
                                                        Asset registry
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                        Institutional instruments available for treasury orders.
                                                    </Typography>
                                                    <TableContainer component={Paper} variant="outlined">
                                                        <Table size="small">
                                                            <TableHead>
                                                                <TableRow>
                                                                    <TableCell>Asset</TableCell>
                                                                    <TableCell>Type</TableCell>
                                                                    <TableCell>Market</TableCell>
                                                                    <TableCell>Currency</TableCell>
                                                                    <TableCell>Status</TableCell>
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {assets.map((asset) => (
                                                                    <TableRow key={asset.id}>
                                                                        <TableCell>{assetLabel(asset)}</TableCell>
                                                                        <TableCell>{asset.asset_type}</TableCell>
                                                                        <TableCell>{asset.market || "N/A"}</TableCell>
                                                                        <TableCell>{asset.currency}</TableCell>
                                                                        <TableCell>
                                                                            <Chip size="small" label={asset.status === "active" ? "Active" : "Inactive"} color={asset.status === "active" ? "success" : "default"} />
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </TableContainer>
                                                </CardContent>
                                            </Card>
                                        </Stack>
                                    ) : null}

                                    {activeTab === "orders" ? (
                                        <Card variant="outlined">
                                            <CardContent>
                                                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                                                    <Box>
                                                        <Typography variant="h6" fontWeight={800}>
                                                            Investment orders
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Treasury orders move through review, optional approval control, then execution into the ledger.
                                                        </Typography>
                                                    </Box>
                                                    {canOperate ? (
                                                        <Button variant="contained" onClick={() => setOrderDialogOpen(true)}>
                                                            Create order
                                                        </Button>
                                                    ) : null}
                                                </Stack>
                                                <TableContainer component={Paper} variant="outlined">
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>Reference</TableCell>
                                                                <TableCell>Asset</TableCell>
                                                                <TableCell>Order</TableCell>
                                                                <TableCell align="right">Amount</TableCell>
                                                                <TableCell>Status</TableCell>
                                                                <TableCell>Date</TableCell>
                                                                {canReviewExecute ? <TableCell align="right">Action</TableCell> : null}
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {orders.length ? orders.map((order) => (
                                                                <TableRow key={order.id} hover>
                                                                    <TableCell>
                                                                        <Typography variant="body2" fontWeight={700}>{order.reference}</Typography>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {order.approval_request_id ? "Approval-linked" : "Direct execution path"}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell>{assetLabel(order.treasury_assets)}</TableCell>
                                                                    <TableCell>
                                                                        <Typography variant="body2" fontWeight={700}>
                                                                            {order.order_type === "buy" ? "Buy" : "Sell"} {order.units.toLocaleString("en-TZ", { maximumFractionDigits: 2 })} unit(s)
                                                                        </Typography>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {formatCurrency(order.unit_price)} each
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell align="right">{formatCurrency(order.total_amount)}</TableCell>
                                                                    <TableCell>
                                                                        <Chip size="small" color={orderStatusColor(order.status)} label={order.status.replace(/_/g, " ")} />
                                                                    </TableCell>
                                                                    <TableCell>{formatDate(order.order_date)}</TableCell>
                                                                    {canReviewExecute ? (
                                                                        <TableCell align="right">
                                                                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
                                                                                {order.status === "pending_review" ? (
                                                                                    <>
                                                                                        <Button
                                                                                            size="small"
                                                                                            onClick={() => {
                                                                                                setSelectedOrder(order);
                                                                                                setReviewDecision("approved");
                                                                                                setReviewReason("");
                                                                                                setReviewNotes(order.notes || "");
                                                                                                setReviewDialogOpen(true);
                                                                                            }}
                                                                                        >
                                                                                            Review
                                                                                        </Button>
                                                                                        <Button
                                                                                            size="small"
                                                                                            color="error"
                                                                                            onClick={() => {
                                                                                                setSelectedOrder(order);
                                                                                                setReviewDecision("rejected");
                                                                                                setReviewReason("");
                                                                                                setReviewNotes(order.notes || "");
                                                                                                setReviewDialogOpen(true);
                                                                                            }}
                                                                                        >
                                                                                            Reject
                                                                                        </Button>
                                                                                    </>
                                                                                ) : null}
                                                                                {order.status === "approved" || order.status === "pending_approval" ? (
                                                                                    <Button size="small" variant="contained" onClick={() => handleExecuteOrder(order)}>
                                                                                        Execute
                                                                                    </Button>
                                                                                ) : null}
                                                                            </Stack>
                                                                        </TableCell>
                                                                    ) : null}
                                                                </TableRow>
                                                            )) : (
                                                                <TableRow>
                                                                    <TableCell colSpan={canReviewExecute ? 7 : 6}>
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            No treasury orders yet.
                                                                        </Typography>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            </CardContent>
                                        </Card>
                                    ) : null}

                                    {activeTab === "transactions" ? (
                                        <Card variant="outlined">
                                            <CardContent>
                                                <Typography variant="h6" fontWeight={800}>
                                                    Investment transactions
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                    Executed treasury movements and realized cash/income events already posted to the core ledger.
                                                </Typography>
                                                <TableContainer component={Paper} variant="outlined">
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>Date</TableCell>
                                                                <TableCell>Asset</TableCell>
                                                                <TableCell>Type</TableCell>
                                                                <TableCell align="right">Units</TableCell>
                                                                <TableCell align="right">Amount</TableCell>
                                                                <TableCell>Reference</TableCell>
                                                                <TableCell>Ledger</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {transactions.length ? transactions.map((transaction) => (
                                                                <TableRow key={transaction.id}>
                                                                    <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                                                                    <TableCell>{assetLabel(transaction.treasury_assets)}</TableCell>
                                                                    <TableCell>{transaction.transaction_type}</TableCell>
                                                                    <TableCell align="right">{transaction.units.toLocaleString("en-TZ", { maximumFractionDigits: 2 })}</TableCell>
                                                                    <TableCell align="right">{formatCurrency(transaction.total_amount)}</TableCell>
                                                                    <TableCell>{transaction.reference}</TableCell>
                                                                    <TableCell>{transaction.ledger_journal_id ? "Posted" : "Pending"}</TableCell>
                                                                </TableRow>
                                                            )) : (
                                                                <TableRow>
                                                                    <TableCell colSpan={7}>
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            No treasury transactions yet.
                                                                        </Typography>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            </CardContent>
                                        </Card>
                                    ) : null}

                                    {activeTab === "income" ? (
                                        <Stack spacing={3}>
                                            <ChartPanel
                                                title="Investment income trend"
                                                subtitle="Monthly institutional income totals from dividends, interest, and realized treasury gains."
                                                type="line"
                                                height={240}
                                                data={incomeTrendData}
                                                options={{
                                                    plugins: {
                                                        legend: {
                                                            display: false
                                                        }
                                                    },
                                                    maintainAspectRatio: false
                                                }}
                                            />
                                            <Card variant="outlined">
                                                <CardContent>
                                                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                                                        <Box>
                                                            <Typography variant="h6" fontWeight={800}>
                                                                Investment income
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Dividends, interest, and realized treasury income captured as institutional ledger events.
                                                            </Typography>
                                                        </Box>
                                                        {canOperate ? (
                                                            <Button variant="contained" onClick={() => setIncomeDialogOpen(true)}>
                                                                Record income
                                                            </Button>
                                                        ) : null}
                                                    </Stack>
                                                    <TableContainer component={Paper} variant="outlined">
                                                        <Table size="small">
                                                            <TableHead>
                                                                <TableRow>
                                                                    <TableCell>Date</TableCell>
                                                                    <TableCell>Asset</TableCell>
                                                                    <TableCell>Type</TableCell>
                                                                    <TableCell align="right">Amount</TableCell>
                                                                    <TableCell>Description</TableCell>
                                                                    <TableCell>Ledger</TableCell>
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {incomeRows.length ? incomeRows.map((row) => (
                                                                    <TableRow key={row.id}>
                                                                        <TableCell>{formatDate(row.received_date)}</TableCell>
                                                                        <TableCell>{assetLabel(row.treasury_assets)}</TableCell>
                                                                        <TableCell>{row.income_type.replace("_", " ")}</TableCell>
                                                                        <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                                                                        <TableCell>{row.description || "Recorded without notes"}</TableCell>
                                                                        <TableCell>{row.posted_to_ledger ? "Posted" : "Pending"}</TableCell>
                                                                    </TableRow>
                                                                )) : (
                                                                    <TableRow>
                                                                        <TableCell colSpan={6}>
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                No treasury income recorded yet.
                                                                            </Typography>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </TableContainer>
                                                </CardContent>
                                            </Card>
                                        </Stack>
                                    ) : null}

                                    {activeTab === "liquidity" && liquidity ? (
                                        <Stack spacing={3}>
                                            <Box
                                                sx={{
                                                    display: "grid",
                                                    gap: 2,
                                                    gridTemplateColumns: {
                                                        xs: "1fr",
                                                        md: "repeat(3, minmax(0, 1fr))"
                                                    }
                                                }}
                                            >
                                                <Card variant="outlined">
                                                    <CardContent>
                                                        <Typography variant="body2" color="text.secondary">Treasury cash pool</Typography>
                                                        <Typography variant="h5" fontWeight={800} sx={{ mt: 1 }}>{formatCurrency(liquidity.total_cash)}</Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                            Derived from the SACCO settlement cash account.
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                                <Card variant="outlined">
                                                    <CardContent>
                                                        <Typography variant="body2" color="text.secondary">Protected liquidity</Typography>
                                                        <Typography variant="h5" fontWeight={800} sx={{ mt: 1 }}>{formatCurrency(liquidity.protected_liquidity)}</Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                            Loans outstanding plus reserve guardrail.
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                                <Card variant="outlined">
                                                    <CardContent>
                                                        <Typography variant="body2" color="text.secondary">Available for investment</Typography>
                                                        <Typography variant="h5" fontWeight={800} sx={{ mt: 1 }}>{formatCurrency(liquidity.available_investable_cash)}</Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                            Buy orders above this amount are blocked.
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Box>

                                            <Card variant="outlined">
                                                <CardContent>
                                                    <Typography variant="h6" fontWeight={800}>
                                                        Liquidity projection
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                                                        Treasury timing view based on expected lending flows and still-open institutional orders.
                                                    </Typography>
                                                    <Box
                                                        sx={{
                                                            display: "grid",
                                                            gap: 2,
                                                            gridTemplateColumns: {
                                                                xs: "1fr",
                                                                md: "repeat(3, minmax(0, 1fr))"
                                                            }
                                                        }}
                                                    >
                                                        <Paper variant="outlined" sx={{ p: 2.5 }}>
                                                            <Typography variant="body2" color="text.secondary">Expected loan disbursements</Typography>
                                                            <Typography variant="h6" fontWeight={800} sx={{ mt: 1 }}>
                                                                {formatCurrency(liquidity.expected_loan_disbursements)}
                                                            </Typography>
                                                        </Paper>
                                                        <Paper variant="outlined" sx={{ p: 2.5 }}>
                                                            <Typography variant="body2" color="text.secondary">Expected repayments</Typography>
                                                            <Typography variant="h6" fontWeight={800} sx={{ mt: 1 }}>
                                                                {formatCurrency(liquidity.expected_repayments)}
                                                            </Typography>
                                                        </Paper>
                                                        <Paper variant="outlined" sx={{ p: 2.5 }}>
                                                            <Typography variant="body2" color="text.secondary">Open treasury orders</Typography>
                                                            <Typography variant="h6" fontWeight={800} sx={{ mt: 1 }}>
                                                                {formatCurrency(liquidity.open_treasury_orders_amount)}
                                                            </Typography>
                                                        </Paper>
                                                    </Box>
                                                </CardContent>
                                            </Card>

                                            <Card variant="outlined">
                                                <CardContent>
                                                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                                                        <Box>
                                                            <Typography variant="h6" fontWeight={800}>
                                                                Guardrail policy
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Treasury uses its own institutional reserve rules while still respecting current loan obligations.
                                                            </Typography>
                                                        </Box>
                                                        <Chip
                                                            color={guardrailColor(liquidity.safeguard_status)}
                                                            label={liquidity.safeguard_status === "healthy" ? "Orders can proceed" : "New buy orders blocked"}
                                                        />
                                                    </Stack>
                                                    <Box
                                                        sx={{
                                                            display: "grid",
                                                            gap: 2,
                                                            gridTemplateColumns: {
                                                                xs: "1fr",
                                                                md: "repeat(2, minmax(0, 1fr))"
                                                            }
                                                        }}
                                                    >
                                                        <Paper variant="outlined" sx={{ p: 2.5 }}>
                                                            <Stack spacing={1.25}>
                                                                <Typography variant="body2" color="text.secondary">Liquidity reserve ratio</Typography>
                                                                <Typography variant="h6" fontWeight={800}>{liquidity.policy.liquidity_reserve_ratio}%</Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Minimum reserve amount: {formatCurrency(liquidity.policy.minimum_liquidity_reserve)}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Minimum cash buffer: {formatCurrency(liquidity.policy.minimum_cash_buffer || 0)}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Loan liquidity protection: {liquidity.policy.loan_liquidity_protection_ratio || 0}%
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Single-order limit: {liquidity.policy.max_single_order_amount != null ? formatCurrency(liquidity.policy.max_single_order_amount) : "Not capped"}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Valuation refresh: every {liquidity.policy.valuation_update_frequency_days} day(s)
                                                                </Typography>
                                                            </Stack>
                                                        </Paper>
                                                        <Paper variant="outlined" sx={{ p: 2.5 }}>
                                                            <Stack spacing={1.25}>
                                                                <Typography variant="body2" color="text.secondary">Ledger mappings</Typography>
                                                                <Typography variant="body2">
                                                                    Settlement account: {liquidity.policy.accounts?.settlement?.account_name || "Unmapped"}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    Investments control: {liquidity.policy.accounts?.investments?.account_name || "Unmapped"}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    Investment income: {liquidity.policy.accounts?.income?.account_name || "Unmapped"}
                                                                </Typography>
                                                            </Stack>
                                                        </Paper>
                                                    </Box>
                                                    {canConfigurePolicy ? (
                                                        <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate("/treasury/policy-settings")}>
                                                            Update treasury policy
                                                        </Button>
                                                    ) : null}
                                                </CardContent>
                                            </Card>
                                        </Stack>
                                    ) : null}
                                </Box>
                            </CardContent>
                        </Card>
                    </>
                )}
            </Stack>

            <Dialog open={assetDialogOpen} onClose={() => !busy && setAssetDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Add treasury asset</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <TextField label="Asset name" value={assetForm.asset_name} onChange={(event) => setAssetForm((current) => ({ ...current, asset_name: event.target.value }))} fullWidth />
                        <TextField label="Asset type" value={assetForm.asset_type} onChange={(event) => setAssetForm((current) => ({ ...current, asset_type: event.target.value }))} fullWidth />
                        <TextField label="Symbol" value={assetForm.symbol} onChange={(event) => setAssetForm((current) => ({ ...current, symbol: event.target.value }))} fullWidth />
                        <TextField label="Market" value={assetForm.market} onChange={(event) => setAssetForm((current) => ({ ...current, market: event.target.value }))} fullWidth />
                        <TextField label="Currency" value={assetForm.currency} onChange={(event) => setAssetForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} fullWidth />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAssetDialogOpen(false)} disabled={busy}>Cancel</Button>
                    <Button onClick={() => void handleCreateAsset()} variant="contained" disabled={busy}>Save asset</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={orderDialogOpen} onClose={() => !busy && setOrderDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Create investment order</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <TextField
                            select
                            label="Asset"
                            value={orderForm.asset_id}
                            onChange={(event) => setOrderForm((current) => ({ ...current, asset_id: event.target.value }))}
                            fullWidth
                        >
                            {activeAssetOptions.map((asset) => (
                                <MenuItem key={asset.id} value={asset.id}>
                                    {assetLabel(asset)}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="Order type"
                            value={orderForm.order_type}
                            onChange={(event) => setOrderForm((current) => ({ ...current, order_type: event.target.value as "buy" | "sell" }))}
                            fullWidth
                        >
                            <MenuItem value="buy">Buy</MenuItem>
                            <MenuItem value="sell">Sell</MenuItem>
                        </TextField>
                        <TextField label="Units" value={orderForm.units} onChange={(event) => setOrderForm((current) => ({ ...current, units: event.target.value }))} fullWidth />
                        <TextField label="Unit price (TSh)" value={orderForm.unit_price} onChange={(event) => setOrderForm((current) => ({ ...current, unit_price: event.target.value }))} fullWidth />
                        <TextField
                            label="Notes"
                            value={orderForm.notes}
                            onChange={(event) => setOrderForm((current) => ({ ...current, notes: event.target.value }))}
                            multiline
                            minRows={3}
                            fullWidth
                        />
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">Order preview</Typography>
                            <Typography variant="h6" fontWeight={800} sx={{ mt: 1 }}>
                                {formatCurrency(orderPreviewAmount)}
                            </Typography>
                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Post-order liquidity: {formatCurrency(orderRiskCheck.remainingCash)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Policy compliance status: {orderRiskCheck.liquidityBlocked ? "Blocked" : orderRiskCheck.requiresEscalation ? "Escalation required" : "Compliant"}
                                </Typography>
                            </Stack>
                        </Paper>
                        {orderRiskCheck.blockingViolations.map((violation) => (
                            <Alert key={`${violation.rule}-block`} severity="error">
                                {violation.message}
                            </Alert>
                        ))}
                        {orderRiskCheck.warningViolations.map((violation) => (
                            <Alert key={`${violation.rule}-warning`} severity="warning">
                                {violation.message}
                            </Alert>
                        ))}
                        {!orderRiskCheck.liquidityBlocked && !orderRiskCheck.requiresEscalation && orderForm.order_type === "buy" && orderPreviewAmount > 0 ? (
                            <Alert severity="info">
                                Guardrail checks passed against current liquidity and treasury policy.
                            </Alert>
                        ) : null}
                        {orderRiskCheck.violations.length ? (
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Stack spacing={1}>
                                    {orderRiskCheck.violations.map((violation) => (
                                        <Typography key={violation.rule} variant="body2" color="text.secondary">
                                            {violation.rule === "max_single_order_amount" && effectivePolicy?.max_single_order_amount != null
                                                ? `Single-order limit: ${formatCurrency(effectivePolicy.max_single_order_amount)}`
                                                : violation.rule === "approval_threshold" && effectivePolicy?.approval_threshold
                                                    ? `Approval threshold: ${formatCurrency(effectivePolicy.approval_threshold)}`
                                                    : violation.rule === "max_asset_allocation"
                                                        ? `Projected asset-type allocation: ${orderRiskCheck.projectedAssetTypeAllocationPercent.toFixed(2)}%`
                                                        : violation.rule === "max_single_asset"
                                                            ? `Projected single-asset concentration for ${assetLabel(selectedOrderAsset)}: ${orderRiskCheck.projectedAllocationPercent.toFixed(2)}%`
                                                            : violation.rule === "minimum_cash_buffer" && effectivePolicy
                                                                ? `Minimum cash buffer: ${formatCurrency(effectivePolicy.minimum_cash_buffer || 0)}`
                                                                : violation.rule === "loan_liquidity_protection" && effectivePolicy
                                                                    ? `Loan liquidity protection ratio: ${effectivePolicy.loan_liquidity_protection_ratio || 0}%`
                                                                    : violation.rule === "liquidity_reserve" && effectivePolicy
                                                                        ? `Liquidity reserve ratio: ${effectivePolicy.liquidity_reserve_ratio}%`
                                                                        : violation.message}
                                        </Typography>
                                    ))}
                                </Stack>
                            </Paper>
                        ) : null}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOrderDialogOpen(false)} disabled={busy}>Cancel</Button>
                    <Button onClick={() => void handleCreateOrder()} variant="contained" disabled={busy || orderRiskCheck.liquidityBlocked}>Create order</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={incomeDialogOpen} onClose={() => !busy && setIncomeDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Record investment income</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <TextField
                            select
                            label="Asset"
                            value={incomeForm.asset_id}
                            onChange={(event) => setIncomeForm((current) => ({ ...current, asset_id: event.target.value }))}
                            fullWidth
                        >
                            {activeAssetOptions.map((asset) => (
                                <MenuItem key={asset.id} value={asset.id}>
                                    {assetLabel(asset)}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="Income type"
                            value={incomeForm.income_type}
                            onChange={(event) => setIncomeForm((current) => ({ ...current, income_type: event.target.value as "dividend" | "interest" | "capital_gain" }))}
                            fullWidth
                        >
                            <MenuItem value="dividend">Dividend</MenuItem>
                            <MenuItem value="interest">Interest</MenuItem>
                            <MenuItem value="capital_gain">Capital gain</MenuItem>
                        </TextField>
                        <TextField label="Amount (TSh)" value={incomeForm.amount} onChange={(event) => setIncomeForm((current) => ({ ...current, amount: event.target.value }))} fullWidth />
                        <TextField label="Description" value={incomeForm.description} onChange={(event) => setIncomeForm((current) => ({ ...current, description: event.target.value }))} multiline minRows={3} fullWidth />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIncomeDialogOpen(false)} disabled={busy}>Cancel</Button>
                    <Button onClick={() => void handleRecordIncome()} variant="contained" disabled={busy}>Post income</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={valuationDialogOpen} onClose={() => !busy && setValuationDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Update valuation</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            {assetLabel(selectedPosition?.treasury_assets)}
                        </Typography>
                        <TextField label="Current price (TSh)" value={valuationPrice} onChange={(event) => setValuationPrice(event.target.value)} fullWidth />
                        <Alert severity="info">
                            Valuation updates affect portfolio reporting only. They do not create ledger entries until a realized treasury event happens.
                        </Alert>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setValuationDialogOpen(false)} disabled={busy}>Cancel</Button>
                    <Button onClick={() => void handleSaveValuation()} variant="contained" disabled={busy}>Save valuation</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={reviewDialogOpen} onClose={() => !busy && setReviewDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{reviewDecision === "approved" ? "Review treasury order" : "Reject treasury order"}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            {selectedOrder ? `${assetLabel(selectedOrder.treasury_assets)} • ${formatCurrency(selectedOrder.total_amount)}` : ""}
                        </Typography>
                        <TextField
                            select
                            label="Decision"
                            value={reviewDecision}
                            onChange={(event) => setReviewDecision(event.target.value as "approved" | "rejected")}
                            fullWidth
                        >
                            <MenuItem value="approved">Approve for execution</MenuItem>
                            <MenuItem value="rejected">Reject order</MenuItem>
                        </TextField>
                        {reviewDecision === "rejected" ? (
                            <TextField label="Reason" value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} fullWidth />
                        ) : null}
                        <TextField
                            label="Notes"
                            value={reviewNotes}
                            onChange={(event) => setReviewNotes(event.target.value)}
                            multiline
                            minRows={3}
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReviewDialogOpen(false)} disabled={busy}>Cancel</Button>
                    <Button onClick={() => void handleReviewOrder()} variant="contained" color={reviewDecision === "rejected" ? "error" : "primary"} disabled={busy}>
                        {reviewDecision === "approved" ? "Continue" : "Reject order"}
                    </Button>
                </DialogActions>
            </Dialog>

            <TwoFactorStepUpDialog
                open={stepUpOpen}
                title={stepUpTitle}
                description={stepUpDescription}
                actionLabel={stepUpActionLabel}
                busy={busy}
                onCancel={closeStepUpDialog}
                onConfirm={async (payload) => {
                    if (stepUpHandler) {
                        await stepUpHandler(payload);
                    }
                }}
            />
        </Box>
    );
}
