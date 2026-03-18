import { useEffect, useMemo, useState } from "react";
import { useIotaClient } from "@iota/dapp-kit";
import {
  EXPLORER_URL,
  INTEROP_PLATFORM_LABELS,
  NETWORK,
  PACKAGE_ID,
  explorerTxUrl,
} from "../config/constants";
import {
  clearTxHistory,
  getTxHistory,
  type TxHistoryEntry,
} from "../utils/txHistory";

type HistoryArea = "carrier" | "transfer" | "surrender" | "interop" | "other";
type AreaFilter = "all" | HistoryArea;
type TimeFilter = "all" | "24h" | "7d" | "30d";

type RawHistoryRow = {
  timestamp: number;
  source: "app" | "chain";
  area: HistoryArea;
  action: string;
  reference: string;
  referenceLabel: string;
  details: string;
  digest: string;
};

type UnifiedHistoryRow = Omit<RawHistoryRow, "source">;

type EventQueryConfig = {
  eventType: string;
  label: string;
  area: HistoryArea;
  referenceLabel: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildDetails: (parsed: any) => {
    reference: string;
    details: string;
    referenceLabel?: string;
    timestamp?: number;
  };
};

const EVENT_QUERIES: EventQueryConfig[] = [
  {
    eventType: "ebl::BLIssued",
    label: "eBL Issued",
    area: "carrier",
    referenceLabel: "eBL ID",
    buildDetails: (p) => ({
      reference: p.bl_id || "",
      details: `${p.port_of_loading || "Unknown"} -> ${p.port_of_discharge || "Unknown"}`,
      timestamp: Number(p.timestamp || 0),
    }),
  },
  {
    eventType: "endorsement::EndorsementMade",
    label: "Endorsement",
    area: "transfer",
    referenceLabel: "eBL ID",
    buildDetails: (p) => ({
      reference: p.bl_id || "",
      details: `${shortAddr(p.from)} -> ${shortAddr(p.to)}`,
      timestamp: Number(p.timestamp || 0),
    }),
  },
  {
    eventType: "ebl::BLSurrendered",
    label: "Surrender",
    area: "surrender",
    referenceLabel: "eBL ID",
    buildDetails: (p) => ({
      reference: p.bl_id || "",
      details: `by ${shortAddr(p.surrendered_by)}`,
      timestamp: Number(p.timestamp || 0),
    }),
  },
  {
    eventType: "ebl::BLAccomplished",
    label: "Accomplished",
    area: "surrender",
    referenceLabel: "eBL ID",
    buildDetails: (p) => ({
      reference: p.bl_id || "",
      details: "Goods released",
      timestamp: Number(p.timestamp || 0),
    }),
  },
  {
    eventType: "interop_control::DocumentRegistered",
    label: "Interop Register",
    area: "interop",
    referenceLabel: "Control Object ID",
    buildDetails: (p) => ({
      reference: p.document_id || "",
      details: `${p.controller_party_code || shortAddr(p.controller)} on ${formatPlatform(p.source_platform)}`,
      timestamp: Number(p.timestamp || 0),
    }),
  },
  {
    eventType: "interop_control::TransferInitiated",
    label: "Interop Initiated",
    area: "interop",
    referenceLabel: "Control Object ID",
    buildDetails: (p) => ({
      reference: p.document_id || "",
      details: `${p.to_party_code || shortAddr(p.to)} · nonce ${p.transfer_nonce || "—"}`,
      timestamp: Number(p.timestamp || 0),
    }),
  },
  {
    eventType: "interop_control::TransferAccepted",
    label: "Interop Accepted",
    area: "interop",
    referenceLabel: "Control Object ID",
    buildDetails: (p) => ({
      reference: p.document_id || "",
      details: `${p.to_party_code || shortAddr(p.to)} accepted`,
      timestamp: Number(p.timestamp || 0),
    }),
  },
  {
    eventType: "interop_control::TransferCancelled",
    label: "Interop Cancelled",
    area: "interop",
    referenceLabel: "Control Object ID",
    buildDetails: (p) => ({
      reference: p.document_id || "",
      details: p.reason || `controller ${shortAddr(p.controller)}`,
      timestamp: Number(p.timestamp || 0),
    }),
  },
];

function shortAddr(addr: string): string {
  if (!addr || typeof addr !== "string") return "—";
  return addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : addr;
}

function truncateMiddle(value: string, keepStart = 10, keepEnd = 6): string {
  if (!value) return "—";
  const normalized = value.trim();
  if (normalized.length <= keepStart + keepEnd + 3) return normalized;
  return `${normalized.slice(0, keepStart)}...${normalized.slice(-keepEnd)}`;
}

function compactDetails(value: string): string {
  if (!value) return "—";
  const compactAddr = value.replace(/0x[a-fA-F0-9]{20,}/g, (addr) =>
    shortAddr(addr),
  );
  return compactAddr.length > 92
    ? `${compactAddr.slice(0, 89)}...`
    : compactAddr;
}

function isCopyableReference(label: string, value: string): boolean {
  if (!value) return false;
  if (/id/i.test(label)) return true;
  return value.startsWith("0x");
}

function formatPlatform(platform: unknown): string {
  const code = Number(platform ?? 0);
  return INTEROP_PLATFORM_LABELS[code] ?? `Platform ${code || "?"}`;
}

function normalizeTimestamp(value: unknown): number {
  const numeric = Number(value ?? 0);
  if (!numeric || Number.isNaN(numeric)) return Date.now();
  // Handle seconds-based timestamps defensively.
  if (numeric < 1_000_000_000_000) return numeric * 1000;
  return numeric;
}

function areaLabel(area: HistoryArea): string {
  switch (area) {
    case "carrier":
      return "Carrier";
    case "transfer":
      return "Transfer";
    case "surrender":
      return "Surrender";
    case "interop":
      return "Interop";
    default:
      return "Other";
  }
}

function areaClasses(area: HistoryArea): string {
  switch (area) {
    case "carrier":
      return "bg-[#e7efff] text-[#1f4d87]";
    case "transfer":
      return "bg-[#ebf8ff] text-[#12607f]";
    case "surrender":
      return "bg-[#fff3e7] text-[#8a5200]";
    case "interop":
      return "bg-[#eafaf3] text-[#0e6a47]";
    default:
      return "bg-[#f1f4f8] text-[#526579]";
  }
}

function timeCutoff(filter: TimeFilter): number | null {
  const now = Date.now();
  if (filter === "24h") return now - 24 * 60 * 60 * 1000;
  if (filter === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (filter === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  return null;
}

function inferLocalMeta(entry: TxHistoryEntry): {
  referenceLabel: string;
  details: string;
} {
  if (entry.action === "Register Carrier Profile") {
    return { referenceLabel: "SCAC", details: "Carrier profile registered" };
  }
  if (entry.action === "Register Carrier") {
    return {
      referenceLabel: "CarrierCap ID",
      details: "Carrier profile and capability created",
    };
  }
  if (entry.action === "Mint CarrierCap") {
    return {
      referenceLabel: "CarrierCap ID",
      details: "Carrier capability minted",
    };
  }
  if (entry.action === "Issue eBL") {
    return {
      referenceLabel: "BL Number",
      details: "Electronic Bill of Lading issued",
    };
  }
  if (entry.action === "Create Endorsement Chain") {
    return {
      referenceLabel: "Chain ID",
      details: "Chain of title initialized",
    };
  }
  if (entry.action === "Endorse & Transfer") {
    return {
      referenceLabel: "eBL ID",
      details: "Title transferred to next party",
    };
  }
  if (entry.action === "Surrender eBL") {
    return { referenceLabel: "eBL ID", details: "eBL surrendered for release" };
  }
  if (entry.action === "Accomplish eBL") {
    return { referenceLabel: "eBL ID", details: "Cargo release completed" };
  }
  if (entry.action === "Interop Cancel Transfer") {
    return {
      referenceLabel: "Control Object ID",
      details: "Pending interop transfer cancelled",
    };
  }
  if (entry.action.includes("Interop")) {
    return {
      referenceLabel: "Control Object ID",
      details: "Interop settlement action",
    };
  }
  return { referenceLabel: "Reference", details: "Wallet-signed transaction" };
}

function fromLocal(entry: TxHistoryEntry): RawHistoryRow {
  const inferred = inferLocalMeta(entry);
  return {
    timestamp: normalizeTimestamp(entry.createdAt),
    source: "app",
    area: entry.area,
    action: entry.action,
    reference: entry.referenceId || "",
    referenceLabel: entry.referenceLabel || inferred.referenceLabel,
    details: entry.details || inferred.details,
    digest: entry.digest,
  };
}

export default function History() {
  const client = useIotaClient();
  const [localRows, setLocalRows] = useState<RawHistoryRow[]>([]);
  const [chainRows, setChainRows] = useState<RawHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [copiedKey, setCopiedKey] = useState("");
  const [error, setError] = useState("");

  const loadHistory = async () => {
    setLoading(true);
    setError("");
    setLocalRows(getTxHistory().map(fromLocal));

    try {
      const responses = await Promise.all(
        EVENT_QUERIES.map((cfg) =>
          client.queryEvents({
            query: { MoveEventType: `${PACKAGE_ID}::${cfg.eventType}` },
            limit: 40,
          }),
        ),
      );

      const chain: RawHistoryRow[] = [];

      responses.forEach((response, i) => {
        const cfg = EVENT_QUERIES[i];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (response.data as any[]).forEach((ev) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed = (ev.parsedJson ?? {}) as any;
          const built = cfg.buildDetails(parsed);
          const digest = String(ev.id?.txDigest || "");
          const eventTimestamp = normalizeTimestamp(
            built.timestamp ?? ev.timestampMs,
          );
          chain.push({
            source: "chain",
            area: cfg.area,
            action: cfg.label,
            reference: built.reference || "",
            referenceLabel: built.referenceLabel || cfg.referenceLabel,
            details: built.details || "—",
            timestamp: eventTimestamp,
            digest,
          });
        });
      });

      setChainRows(chain);
    } catch (err) {
      console.error(err);
      setError(
        "Failed to load on-chain event history. Check network/package ID.",
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allRows = useMemo(
    () =>
      [...localRows, ...chainRows].sort((a, b) => b.timestamp - a.timestamp),
    [localRows, chainRows],
  );
  const groupedRows = useMemo(() => {
    const chainByDigest = new Map<string, RawHistoryRow>();
    allRows.forEach((row) => {
      if (
        row.source === "chain" &&
        row.digest &&
        !chainByDigest.has(row.digest)
      ) {
        chainByDigest.set(row.digest, row);
      }
    });

    const enrichedRows = allRows.map((row) => {
      if (row.source !== "app" || row.reference) return row;
      const chainRow = chainByDigest.get(row.digest);
      if (!chainRow?.reference) return row;
      return {
        ...row,
        reference: chainRow.reference,
        referenceLabel: chainRow.referenceLabel,
      };
    });

    const grouped = new Map<string, UnifiedHistoryRow>();

    enrichedRows.forEach((row) => {
      const existing = grouped.get(row.digest);
      if (!existing) {
        grouped.set(row.digest, {
          timestamp: row.timestamp,
          area: row.area,
          action: row.action,
          reference: row.reference,
          referenceLabel: row.referenceLabel,
          details: row.details,
          digest: row.digest,
        });
        return;
      }

      grouped.set(row.digest, {
        timestamp: Math.max(existing.timestamp, row.timestamp),
        area: existing.area !== "other" ? existing.area : row.area,
        action: existing.action,
        reference: existing.reference || row.reference,
        referenceLabel: existing.reference
          ? existing.referenceLabel
          : row.referenceLabel,
        details:
          existing.details && existing.details !== "—"
            ? existing.details
            : row.details,
        digest: existing.digest,
      });
    });

    return Array.from(grouped.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }, [allRows]);
  const actionOptions = useMemo(
    () =>
      Array.from(new Set(groupedRows.map((row) => row.action))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [groupedRows],
  );

  const rows = useMemo(() => {
    const cutoff = timeCutoff(timeFilter);
    let filtered = groupedRows;
    if (areaFilter !== "all") {
      filtered = filtered.filter((row) => row.area === areaFilter);
    }
    if (actionFilter !== "all") {
      filtered = filtered.filter((row) => row.action === actionFilter);
    }
    if (cutoff) {
      filtered = filtered.filter((row) => row.timestamp >= cutoff);
    }
    if (!search.trim()) return filtered;

    const q = search.trim().toLowerCase();
    return filtered.filter(
      (row) =>
        row.action.toLowerCase().includes(q) ||
        row.area.toLowerCase().includes(q) ||
        row.referenceLabel.toLowerCase().includes(q) ||
        row.reference.toLowerCase().includes(q) ||
        row.digest.toLowerCase().includes(q) ||
        row.details.toLowerCase().includes(q),
    );
  }, [groupedRows, search, areaFilter, actionFilter, timeFilter]);

  const resetFilters = () => {
    setSearch("");
    setAreaFilter("all");
    setActionFilter("all");
    setTimeFilter("all");
  };

  const copyText = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? "" : current));
      }, 1200);
    } catch (err) {
      console.warn("Copy failed:", err);
    }
  };

  const latestTimestamp = rows[0]?.timestamp;

  return (
    <div className="space-y-6">
      <section className="surface p-5 md:p-6">
        <h2 className="section-title">Transaction & Event History</h2>
        <p className="section-subtitle mt-1">
          Merged timeline that collapses local app actions and matching on-chain
          events into one row per transaction.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            className="field-input"
            placeholder="Search by tx digest, object ID, action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field-input"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value as AreaFilter)}
          >
            <option value="all">All areas</option>
            <option value="carrier">Carrier</option>
            <option value="transfer">Transfer</option>
            <option value="surrender">Surrender</option>
            <option value="interop">Interop</option>
          </select>
          <select
            className="field-input"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          <select
            className="field-input"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
          >
            <option value="all">All time</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            onClick={() => void loadHistory()}
            disabled={loading}
            className="btn-main"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => {
              clearTxHistory();
              setLocalRows([]);
            }}
            className="btn-alt"
          >
            Clear App History
          </button>
          <button onClick={resetFilters} className="btn-alt">
            Reset Filters
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-[#f2c2c2] bg-[#fff0f0] p-3 text-sm text-[#9f2d2d]">
            {error}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-[#60758c]">
              Showing
            </p>
            <p className="mt-1 text-xl font-bold text-[#173a5a]">
              {rows.length} / {groupedRows.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#d7e2ef] bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-[#60758c]">
              Latest activity
            </p>
            <p className="mt-1 text-sm font-semibold text-[#173a5a]">
              {latestTimestamp
                ? new Date(latestTimestamp).toLocaleString()
                : "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="surface overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-[#f3f8ff]">
              <tr>
                <th className="border-b border-[#d7e2ef] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5f7389]">
                  Time
                </th>
                <th className="border-b border-[#d7e2ef] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5f7389]">
                  Area
                </th>
                <th className="border-b border-[#d7e2ef] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5f7389]">
                  Action
                </th>
                <th className="border-b border-[#d7e2ef] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5f7389]">
                  Reference
                </th>
                <th className="border-b border-[#d7e2ef] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5f7389]">
                  Details
                </th>
                <th className="border-b border-[#d7e2ef] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5f7389]">
                  Tx
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-[#5f7389]"
                  >
                    No history yet. Execute a transaction, then click refresh.
                  </td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr
                  key={`${row.digest}-${i}`}
                  className="odd:bg-white even:bg-[#fbfdff]"
                >
                  <td className="border-b border-[#ecf2f9] px-3 py-3 text-xs text-[#34587f]">
                    {new Date(row.timestamp).toLocaleString()}
                  </td>
                  <td className="border-b border-[#ecf2f9] px-3 py-3 text-xs">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${areaClasses(row.area)}`}
                    >
                      {areaLabel(row.area)}
                    </span>
                  </td>
                  <td className="border-b border-[#ecf2f9] px-3 py-3 text-xs font-semibold text-[#173a5a]">
                    {row.action}
                  </td>
                  <td className="border-b border-[#ecf2f9] px-3 py-3 text-xs text-[#2e4d70]">
                    {row.reference ? (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[#60758c]">
                          {row.referenceLabel || "Reference"}
                        </p>
                        {isCopyableReference(
                          row.referenceLabel,
                          row.reference,
                        ) ? (
                          <button
                            type="button"
                            onClick={() =>
                              void copyText(
                                `ref-${row.digest}-${i}`,
                                row.reference,
                              )
                            }
                            className="mt-1 font-mono text-[11px] text-[#2e4d70] underline decoration-dotted hover:text-[#0e4fbf]"
                            title={row.reference}
                          >
                            {truncateMiddle(row.reference, 12, 10)}
                          </button>
                        ) : (
                          <p
                            className="mt-1 font-mono text-[11px] text-[#2e4d70]"
                            title={row.reference}
                          >
                            {truncateMiddle(row.reference, 12, 10)}
                          </p>
                        )}
                        {copiedKey === `ref-${row.digest}-${i}` && (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#0e6a47]">
                            Copied
                          </p>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border-b border-[#ecf2f9] px-3 py-3 text-xs text-[#4f657d]">
                    <span title={row.details}>
                      {compactDetails(row.details)}
                    </span>
                  </td>
                  <td className="border-b border-[#ecf2f9] px-3 py-3 text-xs">
                    {row.digest ? (
                      <a
                        href={explorerTxUrl(row.digest)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[11px] text-[#0e4fbf] underline"
                        title={row.digest}
                      >
                        {shortAddr(row.digest)}
                      </a>
                    ) : (
                      <a
                        href={`${EXPLORER_URL}?network=${NETWORK}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[11px] text-[#0e4fbf] underline"
                      >
                        open
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
