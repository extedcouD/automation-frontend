import { FC, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FiCode, FiShield, FiUpload, FiDownload } from "react-icons/fi";
import { SegmentedTabs, type TabItem } from "@components/ui/SegmentedTabs";
import type { OpenAPISpecification, FlowEntry, FlowStep, ValidationTableAction } from "./types";
import { getActionId } from "./utils";
import FlowDetailsAndSummary from "./FlowDetailsAndSummary";
import ActionOverview from "./ActionOverview";
import { FlowActionDetails } from "./flowActionDetails";
import Loader from "@components/ui/mini-components/loader";
import ValidationsTable from "./ValidationsTable";
import Chatbot from "@components/Chatbot";
import { RequestTab, ResponseTab } from "./RequestResponseTabs";
import { fetchValidationTable } from "@services/developerGuideSpecApi";
import { AiFillBoxPlot } from "react-icons/ai";

interface FlowInformationProps {
    data: OpenAPISpecification;
    flows: FlowEntry[];
    selectedFlow: string;
    selectedFlowAction: string;
    domain: string;
    version: string;
}

function getExamplesFromStep(
    step: FlowStep | undefined
): Array<{ name: string; payload: unknown }> {
    if (!step) return [];
    const fromStep = step.examples?.map((ex) => ({
        name: ex.name ?? ex.description ?? "Example",
        payload: ex.payload,
    }));
    if (fromStep && fromStep.length > 0) return fromStep;
    const fromMock = step.mock?.examples?.map((ex) => ({
        name: ex.name ?? ex.description ?? "Example",
        payload: ex.payload,
    }));
    if (fromMock && fromMock.length > 0) return fromMock;
    if (step.example?.value != null)
        return [
            {
                name: (step.example as { summary?: string }).summary ?? "Example",
                payload: step.example.value,
            },
        ];
    if (step.mock?.defaultPayload != null)
        return [{ name: "Default", payload: step.mock.defaultPayload }];
    return [];
}

type Section = "preview" | "x-validations" | "request" | "response" | "chatbot";

const FlowInformation: FC<FlowInformationProps> = ({
    data,
    flows,
    selectedFlow,
    selectedFlowAction,
    domain,
    version,
}) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedExampleIndex, setSelectedExampleIndex] = useState(0);
    const [activeSection, setActiveSection] = useState<Section>("preview");
    const [showPreviewDetails, setShowPreviewDetails] = useState(false);
    const isFirstActionEffect = useRef(true);
    const rafRef = useRef<number | null>(null);

    // Double-rAF: guarantees the browser paints at least one frame (showing the
    // loader) before React mounts the heavy FlowActionDetails + JsonViewer tree.
    const scheduleShowDetails = useCallback(() => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        setShowPreviewDetails(false);
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = requestAnimationFrame(() => {
                setShowPreviewDetails(true);
                rafRef.current = null;
            });
        });
    }, []);

    useEffect(() => {
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    // Lazy-loaded sections
    const [validationTable, setValidationTable] = useState<Record<
        string,
        ValidationTableAction
    > | null>(null);
    const validationTableFetched = useRef(false);

    // Load validation table once (non-blocking, after mount)
    useEffect(() => {
        if (validationTableFetched.current || !domain || !version) return;
        validationTableFetched.current = true;
        fetchValidationTable(domain, version)
            .then((result) => {
                if (result?.table) setValidationTable(result.table);
            })
            .catch(() => {
                /* silently ignore */
            });
    }, [domain, version]);

    const isEmpty = !selectedFlow;

    const selectedFlowData = flows.find((f) => f.flowId === selectedFlow);
    const steps = selectedFlowData?.config?.steps ?? [];
    const selectedStep = steps.find((s) => getActionId(s) === selectedFlowAction);
    const examples = useMemo(() => getExamplesFromStep(selectedStep), [selectedStep]);
    const selectedExample = examples[selectedExampleIndex] ?? examples[0];
    const examplePayload = selectedExample?.payload;
    const hasExampleObject =
        examplePayload != null &&
        typeof examplePayload === "object" &&
        !Array.isArray(examplePayload);

    // Validation table for the selected action
    const apiForValidations = selectedStep?.api ?? selectedFlowAction;
    const selectedValidations = useMemo(
        () => (validationTable ? validationTable[apiForValidations] : undefined),
        [validationTable, apiForValidations]
    );
    const hasXValidations = !!selectedValidations;
    const canShowChatbot = Boolean(selectedStep) && domain === "ONDC:FIS12" && version === "2.3.0";

    const hasTabs = hasExampleObject || hasXValidations || !!selectedStep;

    const urlTab = searchParams.get("tab") as Section | null;

    useEffect(() => {
        const validSections: Section[] = canShowChatbot
            ? ["preview", "x-validations", "request", "response", "chatbot"]
            : ["preview", "x-validations", "request", "response"];

        if (isFirstActionEffect.current) {
            isFirstActionEffect.current = false;
            if (urlTab && validSections.includes(urlTab)) {
                setActiveSection(urlTab);
                if (urlTab === "preview") {
                    scheduleShowDetails();
                }
                return;
            }
        }

        // Keep section in sync with URL tab changes (e.g. browser nav or tab click),
        // and avoid resetting to default on every search param update.
        if (urlTab && validSections.includes(urlTab)) {
            if (activeSection !== urlTab) {
                setActiveSection(urlTab);
                if (urlTab === "preview") {
                    scheduleShowDetails();
                } else {
                    setShowPreviewDetails(false);
                }
            }
            return;
        }

        const defaultSection: Section = hasExampleObject
            ? "preview"
            : selectedStep
              ? "request"
              : hasXValidations
                ? "x-validations"
                : "preview";

        setActiveSection(defaultSection);
        setSelectedExampleIndex(0);
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set("tab", defaultSection);
                next.delete("attr");
                next.delete("panel");
                return next;
            },
            { replace: true }
        );
        if (defaultSection === "preview") {
            scheduleShowDetails();
        } else {
            setShowPreviewDetails(false);
        }
    }, [
        selectedFlowAction,
        scheduleShowDetails,
        canShowChatbot,
        urlTab,
        hasExampleObject,
        selectedStep,
        hasXValidations,
        setSearchParams,
    ]);

    if (isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[480px] text-center px-8 py-16">
                <div className="rounded-2xl bg-slate-100 p-10 mb-6 ring-1 ring-slate-200/50">
                    <svg
                        className="mx-auto h-14 w-14 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.25}
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-800 mb-2">No flow selected</h2>
                <p className="text-slate-600 text-sm max-w-md leading-relaxed">
                    Select a flow from the sidebar, then choose an action to view its documentation,
                    example payload, and schema validations.
                </p>
            </div>
        );
    }

    const handleSectionChange = (section: Section) => {
        setActiveSection(section);
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set("tab", section);
                next.delete("attr");
                next.delete("panel");
                return next;
            },
            { replace: true }
        );
        if (section === "preview") {
            scheduleShowDetails();
        } else {
            setShowPreviewDetails(false);
        }
    };

    return (
        <div className="px-8 py-8 space-y-0 w-full">
            {/* Always-visible Overview */}
            {selectedFlowData && (
                <div className="mb-6">
                    <FlowDetailsAndSummary flow={selectedFlowData} />
                </div>
            )}

            {selectedFlowAction && selectedStep && (
                <>
                    {/* Action card */}
                    <div className="mb-10">
                        <ActionOverview step={selectedStep} actionId={selectedFlowAction} />
                    </div>

                    {/* Detail tabs section */}
                    {hasTabs && (
                        <div className="border-t border-slate-200 pt-8">
                            <div className="flex items-end justify-between mb-5">
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                                        Details
                                    </p>
                                    <h3 className="text-lg font-semibold text-slate-800">
                                        {activeSection === "preview"
                                            ? "Examples & Schema"
                                            : activeSection === "request"
                                              ? "Request"
                                              : activeSection === "response"
                                                ? "Response"
                                                : activeSection === "chatbot"
                                                  ? "Chatbot"
                                                  : "Validations"}
                                    </h3>
                                </div>
                                <SegmentedTabs<Section>
                                    active={activeSection}
                                    onChange={handleSectionChange}
                                    tabs={
                                        [
                                            {
                                                id: "preview",
                                                label: "Example Payload",
                                                icon: FiCode,
                                                visible: hasExampleObject,
                                            },
                                            {
                                                id: "request",
                                                label: "Request Schema",
                                                icon: FiUpload,
                                                visible: !!selectedStep,
                                            },
                                            {
                                                id: "response",
                                                label: "Response Schema",
                                                icon: FiDownload,
                                                visible: !!selectedStep,
                                            },
                                            {
                                                id: "x-validations",
                                                label: "Validations",
                                                icon: FiShield,
                                                visible: hasXValidations,
                                            },
                                            {
                                                id: "chatbot",
                                                label: "Chatbot",
                                                icon: AiFillBoxPlot,
                                                visible: canShowChatbot,
                                            },
                                        ] satisfies TabItem<Section>[]
                                    }
                                />
                            </div>

                            {/* Preview tab */}
                            {activeSection === "preview" && hasExampleObject && (
                                <div className="flex flex-col gap-4">
                                    {examples.length > 1 && (
                                        <div className="flex items-center gap-3">
                                            <label
                                                htmlFor="example-select"
                                                className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0"
                                            >
                                                Example
                                            </label>
                                            <div className="relative w-full max-w-xs">
                                                <select
                                                    id="example-select"
                                                    value={selectedExampleIndex}
                                                    onChange={(e) =>
                                                        setSelectedExampleIndex(
                                                            Number(e.target.value)
                                                        )
                                                    }
                                                    className="w-full pl-4 pr-9 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-300 appearance-none shadow-sm"
                                                >
                                                    {examples.map((ex, i) => (
                                                        <option key={i} value={i}>
                                                            {ex.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                                                    <svg
                                                        className="w-4 h-4 text-slate-400"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth={2}
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M19 9l-7 7-7-7"
                                                        />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="w-full h-[700px] min-h-0 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                                        {showPreviewDetails ? (
                                            <FlowActionDetails
                                                exampleValue={examplePayload as object}
                                                actionApi={selectedFlowAction}
                                                stepApi={selectedStep.api}
                                                spec={data}
                                                useCaseId={selectedFlowData?.usecase}
                                                flowId={selectedFlowData?.flowId ?? selectedFlow}
                                                validationTableData={validationTable}
                                            />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center">
                                                <Loader />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Request tab */}
                            {activeSection === "request" && selectedStep && (
                                <RequestTab
                                    spec={data}
                                    api={selectedStep.api ?? selectedFlowAction}
                                />
                            )}

                            {/* Response tab */}
                            {activeSection === "response" && selectedStep && (
                                <ResponseTab
                                    spec={data}
                                    api={selectedStep.api ?? selectedFlowAction}
                                />
                            )}

                            {/* Validations tab */}
                            {activeSection === "x-validations" &&
                                hasXValidations &&
                                selectedValidations && (
                                    <ValidationsTable validations={selectedValidations} />
                                )}

                            {/* Chatbot tab */}
                            {activeSection === "chatbot" && canShowChatbot && selectedStep && (
                                <Chatbot
                                    domain={domain}
                                    version={version}
                                    flowId={selectedFlowData?.flowId ?? selectedFlow}
                                    actionId={selectedFlowAction}
                                    actionApi={selectedStep.api ?? selectedFlowAction}
                                />
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default FlowInformation;
