import { type FC, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchValidationTable } from "@services/developerGuideSpecApi";
import type { ValidationTableAction } from "./types";
import ValidationsTable from "./ValidationsTable";
import Loader from "@components/ui/mini-components/loader";
import { SegmentedTabs, type TabItem } from "@components/ui/SegmentedTabs";

const ValidationsPage: FC = () => {
    const { domain: rawDomain, version: rawVersion } = useParams<{
        domain: string;
        version: string;
    }>();
    const domain = rawDomain ? decodeURIComponent(rawDomain) : "";
    const version = rawVersion ? decodeURIComponent(rawVersion) : "";

    const [table, setTable] = useState<Record<string, ValidationTableAction> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedAction, setSelectedAction] = useState<string>("");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!domain || !version) {
            setError("Missing domain or version in URL.");
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchValidationTable(domain, version)
            .then((result) => {
                if (cancelled) return;
                if (!result?.table || Object.keys(result.table).length === 0) {
                    setTable(null);
                    setSelectedAction("");
                } else {
                    setTable(result.table);
                    const firstAction = Object.keys(result.table).sort()[0];
                    setSelectedAction(firstAction);
                }
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("Failed to fetch validation table", err);
                setError("Failed to load validations. Check domain/version and try again.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [domain, version, reloadKey]);

    const sortedActions = useMemo(() => (table ? Object.keys(table).sort() : []), [table]);

    const tabs: TabItem[] = useMemo(
        () => sortedActions.map((action) => ({ id: action, label: action })),
        [sortedActions]
    );

    const selectedValidations = table && selectedAction ? table[selectedAction] : undefined;

    return (
        <div className="relative bg-white min-h-screen flex flex-col">
            <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-200">
                <div className="px-6 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            X-Validations
                        </p>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-sm text-slate-800 truncate">{domain}</span>
                        {version && (
                            <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-mono font-semibold">
                                v{version}
                            </span>
                        )}
                    </div>
                </div>
                {tabs.length > 0 && (
                    <div className="px-6 pt-3 pb-2 bg-white shadow-sm overflow-x-auto">
                        <SegmentedTabs
                            tabs={tabs}
                            active={selectedAction}
                            onChange={setSelectedAction}
                        />
                    </div>
                )}
            </header>

            <div className="flex-grow px-6 py-6">
                {loading && (
                    <div className="h-[60vh]">
                        <Loader />
                    </div>
                )}
                {!loading && error && (
                    <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
                        <p className="text-sm text-slate-600">{error}</p>
                        <button
                            type="button"
                            onClick={() => setReloadKey((k) => k + 1)}
                            className="px-4 py-2 rounded-lg bg-sky-500 text-white hover:bg-sky-600 text-sm font-medium"
                        >
                            Retry
                        </button>
                    </div>
                )}
                {!loading && !error && !selectedValidations && (
                    <div className="flex items-center justify-center h-[60vh]">
                        <p className="text-sm text-slate-500">
                            No validations found for {domain} v{version}.
                        </p>
                    </div>
                )}
                {!loading && !error && selectedValidations && (
                    <ValidationsTable validations={selectedValidations} />
                )}
            </div>
        </div>
    );
};

export default ValidationsPage;
