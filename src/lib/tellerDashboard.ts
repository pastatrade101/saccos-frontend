import type { StatementRow } from "../types/api";

export interface TellerKpis {
    teller_position: number;
    deposits_today: number;
    withdrawals_today: number;
    deposit_intake_7d: number;
    withdrawal_outflow_7d: number;
    tx_count_today: number;
    avg_ticket_today: number;
}

export interface TellerTimePoint {
    date: string;
    deposits: number;
    withdrawals: number;
}

export interface TellerDistributionPoint {
    bucketLabel: string;
    count: number;
}

export interface TellerHourlyPoint {
    hour: string;
    txCount: number;
}

export interface TellerAlert {
    id: string;
    severity: "success" | "warning" | "error" | "info";
    title: string;
    description: string;
}

export interface TellerDashboardData {
    kpis: TellerKpis;
    timeseries_7d: TellerTimePoint[];
    distribution_today: TellerDistributionPoint[];
    hourly_activity: TellerHourlyPoint[];
    opening_cash: number;
    closing_cash: number;
    alerts: TellerAlert[];
}

function isoDateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
}

function getLast7Days() {
    const today = new Date();

    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (6 - index));
        return isoDateOnly(date);
    });
}

function getRecentStatementDates(statements: StatementRow[]) {
    const uniqueDates = [...new Set(
        statements
            .map((entry) => entry.transaction_date)
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    if (!uniqueDates.length) {
        return getLast7Days();
    }

    const latestDates = uniqueDates.slice(-7);

    if (latestDates.length === 7) {
        return latestDates;
    }

    const earliest = new Date(latestDates[0]);
    const paddedDates = Array.from({ length: 7 - latestDates.length }, (_, index) => {
        const date = new Date(earliest);
        date.setDate(earliest.getDate() - (7 - latestDates.length - index));
        return isoDateOnly(date);
    });

    return paddedDates.concat(latestDates);
}

function buildAmountBuckets(amounts: number[]) {
    const buckets = [
        { bucketLabel: "0 - 50k", min: 0, max: 50000, count: 0 },
        { bucketLabel: "50k - 100k", min: 50000, max: 100000, count: 0 },
        { bucketLabel: "100k - 250k", min: 100000, max: 250000, count: 0 },
        { bucketLabel: "250k+", min: 250000, max: Number.POSITIVE_INFINITY, count: 0 }
    ];

    amounts.forEach((amount) => {
        const bucket = buckets.find((candidate) => amount >= candidate.min && amount < candidate.max);

        if (bucket) {
            bucket.count += 1;
        }
    });

    return buckets.map(({ bucketLabel, count }) => ({ bucketLabel, count }));
}

function buildHourlyActivity(statements: StatementRow[]) {
    const hours = new Map<string, number>();

    Array.from({ length: 12 }, (_, index) => index + 8).forEach((hour) => {
        hours.set(`${String(hour).padStart(2, "0")}:00`, 0);
    });

    statements.forEach((entry) => {
        const hour = new Date(entry.created_at).getHours();
        const key = `${String(hour).padStart(2, "0")}:00`;
        hours.set(key, (hours.get(key) || 0) + 1);
    });

    return [...hours.entries()]
        .map(([hour, txCount]) => ({ hour, txCount }))
        .filter((entry) => entry.txCount > 0 || ["08:00", "12:00", "16:00", "18:00"].includes(entry.hour));
}

function average(values: number[]) {
    if (!values.length) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxBy<T>(items: T[], selector: (item: T) => number) {
    return items.reduce<T | null>((currentMax, item) => {
        if (!currentMax || selector(item) > selector(currentMax)) {
            return item;
        }

        return currentMax;
    }, null);
}

export function buildTellerDashboardData(statements: StatementRow[]): TellerDashboardData {
    const dates = getRecentStatementDates(statements);
    const today = dates[dates.length - 1];
    const byDate = new Map<string, { deposits: number; withdrawals: number; txCount: number }>();

    dates.forEach((date) => {
        byDate.set(date, { deposits: 0, withdrawals: 0, txCount: 0 });
    });

    const relevantStatements = statements.filter((entry) => byDate.has(entry.transaction_date));

    relevantStatements.forEach((entry) => {
        const point = byDate.get(entry.transaction_date);

        if (!point) {
            return;
        }

        if (entry.direction === "in") {
            point.deposits += entry.amount;
        } else {
            point.withdrawals += entry.amount;
        }

        point.txCount += 1;
    });

    const timeseries_7d = dates.map((date) => ({
        date,
        deposits: byDate.get(date)?.deposits || 0,
        withdrawals: byDate.get(date)?.withdrawals || 0
    }));

    const todayStatements = relevantStatements.filter((entry) => entry.transaction_date === today);
    const depositsToday = todayStatements
        .filter((entry) => entry.direction === "in")
        .reduce((sum, entry) => sum + entry.amount, 0);
    const withdrawalsToday = todayStatements
        .filter((entry) => entry.direction === "out")
        .reduce((sum, entry) => sum + entry.amount, 0);
    const txCountToday = todayStatements.length;
    const avgTicketToday = txCountToday
        ? todayStatements.reduce((sum, entry) => sum + entry.amount, 0) / txCountToday
        : 0;
    const closingCash = relevantStatements.reduce(
        (sum, entry) => sum + (entry.direction === "in" ? entry.amount : -entry.amount),
        0
    );
    const openingCash = closingCash - depositsToday + withdrawalsToday;

    const depositSeries = timeseries_7d.map((entry) => entry.deposits);
    const withdrawalSeries = timeseries_7d.map((entry) => entry.withdrawals);
    const yesterdayDeposits = depositSeries[depositSeries.length - 2] || 0;
    const yesterdayWithdrawals = withdrawalSeries[withdrawalSeries.length - 2] || 0;
    const deposit7DayAverage = average(depositSeries);
    const withdrawal7DayAverage = average(withdrawalSeries);
    const peakHour = maxBy(buildHourlyActivity(todayStatements), (entry) => entry.txCount);
    const biggestTransaction = maxBy(todayStatements, (entry) => entry.amount);
    const alerts: TellerAlert[] = [];

    if (depositsToday > deposit7DayAverage * 1.25 && depositsToday > 0) {
        alerts.push({
            id: "deposit-spike",
            severity: "success",
            title: "Deposit intake above run rate",
            description: `Today is ${Math.round((depositsToday / Math.max(deposit7DayAverage, 1) - 1) * 100)}% above the 7-day deposit average.`
        });
    }

    if (withdrawalsToday > withdrawal7DayAverage * 1.35 && withdrawalsToday > 0) {
        alerts.push({
            id: "withdrawal-spike",
            severity: "warning",
            title: "High withdrawal spike",
            description: `Withdrawal outflow is above the recent operating pattern and should be reviewed against available float.`
        });
    }

    if (biggestTransaction && biggestTransaction.amount >= 250000) {
        alerts.push({
            id: "high-ticket",
            severity: "info",
            title: "High single transaction",
            description: `Largest ticket today was ${Math.round(biggestTransaction.amount).toLocaleString()} in visible teller activity.`
        });
    }

    if (alerts.length < 3 && Math.abs(closingCash - openingCash) > average(depositSeries.concat(withdrawalSeries))) {
        alerts.push({
            id: "cash-variance",
            severity: "warning",
            title: "Net cash movement expanded",
            description: "Net movement today is materially different from opening position and should be checked before close."
        });
    }

    return {
        kpis: {
            teller_position: closingCash,
            deposits_today: depositsToday,
            withdrawals_today: withdrawalsToday,
            deposit_intake_7d: depositSeries.reduce((sum, value) => sum + value, 0),
            withdrawal_outflow_7d: withdrawalSeries.reduce((sum, value) => sum + value, 0),
            tx_count_today: txCountToday,
            avg_ticket_today: avgTicketToday
        },
        timeseries_7d,
        distribution_today: buildAmountBuckets(todayStatements.map((entry) => entry.amount)),
        hourly_activity: buildHourlyActivity(todayStatements),
        opening_cash: openingCash,
        closing_cash: closingCash,
        alerts: alerts.slice(0, 3).concat(
            alerts.length ? [] : [{
                id: "normal-day",
                severity: "info",
                title: "Normal operating range",
                description: "No material teller-side anomalies were detected in the latest visible activity."
            }]
        )
    };
}

export const mockTellerDashboardData: TellerDashboardData = {
    kpis: {
        teller_position: 4350000,
        deposits_today: 1260000,
        withdrawals_today: 780000,
        deposit_intake_7d: 6840000,
        withdrawal_outflow_7d: 4910000,
        tx_count_today: 28,
        avg_ticket_today: 72857
    },
    timeseries_7d: [
        { date: "2026-02-25", deposits: 840000, withdrawals: 590000 },
        { date: "2026-02-26", deposits: 920000, withdrawals: 650000 },
        { date: "2026-02-27", deposits: 1100000, withdrawals: 720000 },
        { date: "2026-02-28", deposits: 760000, withdrawals: 510000 },
        { date: "2026-03-01", deposits: 980000, withdrawals: 700000 },
        { date: "2026-03-02", deposits: 980000, withdrawals: 960000 },
        { date: "2026-03-03", deposits: 1260000, withdrawals: 780000 }
    ],
    distribution_today: [
        { bucketLabel: "0 - 50k", count: 8 },
        { bucketLabel: "50k - 100k", count: 10 },
        { bucketLabel: "100k - 250k", count: 7 },
        { bucketLabel: "250k+", count: 3 }
    ],
    hourly_activity: [
        { hour: "08:00", txCount: 2 },
        { hour: "09:00", txCount: 5 },
        { hour: "10:00", txCount: 4 },
        { hour: "11:00", txCount: 6 },
        { hour: "12:00", txCount: 3 },
        { hour: "13:00", txCount: 2 },
        { hour: "14:00", txCount: 5 },
        { hour: "15:00", txCount: 7 },
        { hour: "16:00", txCount: 6 },
        { hour: "17:00", txCount: 4 }
    ],
    opening_cash: 3870000,
    closing_cash: 4350000,
    alerts: [
        {
            id: "deposit-spike",
            severity: "success",
            title: "Deposit intake above run rate",
            description: "Counter deposits are outperforming the trailing weekly average by 18%."
        },
        {
            id: "large-ticket",
            severity: "info",
            title: "High single transaction",
            description: "One member posted a transaction above TZS 300,000 and should be reviewed at close."
        },
        {
            id: "cash-balance",
            severity: "warning",
            title: "Cash close watch",
            description: "Withdrawal intensity after 3 PM was above the normal teller close pattern."
        }
    ]
};

export async function fetchTellerDashboardPlaceholder() {
    return new Promise<TellerDashboardData>((resolve) => {
        window.setTimeout(() => resolve(mockTellerDashboardData), 300);
    });
}
