import { useState, useMemo, useEffect } from "react";
import { toast } from "react-toastify";
import { SubmitEventParams } from "../../../../types/flow-types";

interface IItem {
    id: string;
    descriptor?: {
        name?: string;
        code?: string;
    };
    fulfillment_ids?: string[];
    quantity?: {
        minimum?: { count: number };
        maximum?: { count: number };
    };
}

interface IFulfillmentCred {
    type: string;
    id?: string;
}

interface IFulfillment {
    id: string;
    type: string;
    customer?: {
        person?: {
            creds?: IFulfillmentCred[];
        };
    };
}

interface IProvider {
    id: string;
    descriptor?: {
        name?: string;
    };
    items?: IItem[];
    fulfillments?: IFulfillment[];
}

interface IOnSearchPayload {
    context: Record<string, unknown>;
    message: {
        catalog: {
            providers: IProvider[];
        };
    };
}

interface IMetroCommonItemFulfillmentProps {
    submitEvent: (data: SubmitEventParams) => Promise<void>;
    flowId?: string;
}

const METRO_UNLIMITED_PASS_FLOW = "METRO_UNLIMITED_PASS_FLOW";
const METRO_CARD_PURCHASE = "METRO_CARD_PURCHASE";
const METRO_CARD_RECHARGE = "METRO_CARD_RECHARGE";



/** descriptor.code to filter items by, keyed by flowId */
const ITEM_CODE_FILTER: Record<string, string> = {
    [METRO_UNLIMITED_PASS_FLOW]: "PASS",
    [METRO_CARD_PURCHASE]: "PURCHASE",
    [METRO_CARD_RECHARGE]: "RECHARGE",
};

/** fulfillment.type to filter fulfillments by, keyed by flowId */
const FULFILLMENT_TYPE_FILTER: Record<string, string> = {
    [METRO_UNLIMITED_PASS_FLOW]: "PASS",
    [METRO_CARD_PURCHASE]: "PASS",
    [METRO_CARD_RECHARGE]: "ONLINE",
};

export default function Metro210CommonItemFulfillmentSelection({
    submitEvent,
    flowId,
}: IMetroCommonItemFulfillmentProps) {
    const [jsonPayload, setJsonPayload] = useState("");
    const [providers, setProviders] = useState<IProvider[]>([]);
    const [isParsed, setIsParsed] = useState(false);
    const [rawPayload, setRawPayload] = useState<IOnSearchPayload | null>(null);

    const [selectedProviderId, setSelectedProviderId] = useState("");
    const [selectedItemId, setSelectedItemId] = useState("");
    const [selectedFulfillmentId, setSelectedFulfillmentId] = useState("");
    const [selectedQuantity, setSelectedQuantity] = useState("");

    // METRO_UNLIMITED_PASS_FLOW — credential fields
    const [credType, setCredType] = useState<string>("");
    const [credValue, setCredValue] = useState("");

    // METRO_CARD_RECHARGE — card identifier
    const [cardIdentifier, setCardIdentifier] = useState("");

    const [cityCode, setCityCode] = useState("std:080");

    const isUnlimitedPassFlow = flowId === METRO_UNLIMITED_PASS_FLOW;
    const isRechargeFlow = flowId === METRO_CARD_RECHARGE;

    // Reset all state whenever the flow changes so stale data from a
    // previous flow never bleeds into the new one.
    useEffect(() => {
        setJsonPayload("");
        setProviders([]);
        setIsParsed(false);
        setRawPayload(null);
        setSelectedProviderId("");
        setSelectedItemId("");
        setSelectedFulfillmentId("");
        setSelectedQuantity("");
        setCredType("");
        setCredValue("");
        setCardIdentifier("");
        setCityCode("std:080");
    }, [flowId]);

    const parsePayload = () => {
        try {
            const payload: IOnSearchPayload = JSON.parse(jsonPayload);
            const parsedProviders = payload?.message?.catalog?.providers;

            if (!parsedProviders || parsedProviders.length === 0) {
                throw new Error("Invalid payload: No providers found");
            }

            setProviders(parsedProviders);
            setRawPayload(payload);
            setIsParsed(true);
            toast.success(`Found ${parsedProviders.length} provider(s)`);
        } catch (e: unknown) {
            console.error(e);
            toast.error("Failed to parse payload: " + (e as Error).message);
        }
    };

    const selectedProvider = useMemo(() => {
        return providers.find((p) => p.id === selectedProviderId) || null;
    }, [providers, selectedProviderId]);

    /** Items filtered by descriptor.code per flow */
    const availableItems = useMemo(() => {
        const allItems = selectedProvider?.items || [];
        const codeFilter = flowId ? ITEM_CODE_FILTER[flowId] : undefined;
        if (!codeFilter) return allItems;
        return allItems.filter((item) => item.descriptor?.code === codeFilter);
    }, [selectedProvider, flowId]);

    /** Fulfillments filtered by type per flow */
    const availableFulfillments = useMemo(() => {
        const allFulfillments = selectedProvider?.fulfillments || [];
        const typeFilter = flowId ? FULFILLMENT_TYPE_FILTER[flowId] : undefined;
        if (!typeFilter) return allFulfillments;
        return allFulfillments.filter((f) => f.type === typeFilter);
    }, [selectedProvider, flowId]);

    /** Full object for the selected fulfillment */
    const selectedFulfillment = useMemo(() => {
        return availableFulfillments.find((f) => f.id === selectedFulfillmentId) || null;
    }, [availableFulfillments, selectedFulfillmentId]);

    /** Cred types sourced from selected fulfillment's customer.person.creds */
    const availableCredTypes = useMemo(() => {
        const creds = selectedFulfillment?.customer?.person?.creds || [];
        return creds.map((c) => c.type).filter(Boolean);
    }, [selectedFulfillment]);

    const selectedItem = useMemo(() => {
        return availableItems.find((item) => item.id === selectedItemId) || null;
    }, [availableItems, selectedItemId]);

    /** Quantity range options for selected item (UNLIMITED_PASS only) */
    const quantityOptions = useMemo(() => {
        if (!selectedItem?.quantity) return [];
        const min = selectedItem.quantity.minimum?.count ?? 1;
        const max = selectedItem.quantity.maximum?.count ?? 1;
        const options: number[] = [];
        for (let i = min; i <= max; i++) {
            options.push(i);
        }
        return options;
    }, [selectedItem]);

    const handleProviderChange = (providerId: string) => {
        setSelectedProviderId(providerId);
        setSelectedItemId("");
        setSelectedFulfillmentId("");
        setSelectedQuantity("");
    };

    const handleItemChange = (itemId: string) => {
        setSelectedItemId(itemId);
        setSelectedQuantity("");
    };

    const handleFulfillmentChange = (fulfillmentId: string) => {
        setSelectedFulfillmentId(fulfillmentId);
        setCredType("");
        setCredValue("");
    };

    const handleSubmit = async () => {
        if (!selectedProviderId) {
            toast.error("Please select a Provider ID");
            return;
        }
        if (!selectedItemId) {
            toast.error("Please select an Item ID");
            return;
        }
        if (!selectedFulfillmentId) {
            toast.error("Please select a Fulfillment ID");
            return;
        }
        if (isUnlimitedPassFlow && !selectedQuantity) {
            toast.error("Please select Item Quantity");
            return;
        }
        if (isUnlimitedPassFlow && !credValue.trim()) {
            toast.error("Please enter the credential value");
            return;
        }
        if (isRechargeFlow && !cardIdentifier.trim()) {
            toast.error("Please enter the Card Identifier");
            return;
        }
        if (!cityCode.trim()) {
            toast.error("Please enter the City Code");
            return;
        }

        const formData: Record<string, string> = {
            provider_id: selectedProviderId,
            item_id: selectedItemId,
            fulfillment_id: selectedFulfillmentId,
            city_code: cityCode.trim(),
            payload: jsonPayload,
        };

        if (isUnlimitedPassFlow) {
            formData.item_quantity = selectedQuantity;
            formData.cred_type = credType;
            formData.cred_value = credValue.trim();
        }

        if (isRechargeFlow) {
            formData.card_identifier = cardIdentifier.trim();
        }

        await submitEvent({
            jsonPath: {},
            formData,
            catalog: rawPayload as any,
        });
    };

    const handleReset = () => {
        setJsonPayload("");
        setProviders([]);
        setIsParsed(false);
        setRawPayload(null);
        setSelectedProviderId("");
        setSelectedItemId("");
        setSelectedFulfillmentId("");
        setSelectedQuantity("");
        setCredType("");
        setCredValue("");
        setCardIdentifier("");
        setCityCode("std:080");
    };

    const inputStyle =
        "border rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
    const labelStyle = "mb-1 font-semibold";
    const fieldWrapperStyle = "flex flex-col mb-2";

    if (!isParsed) {
        return (
            <div className="p-4">
                <h3 className="text-lg font-bold mb-4">Paste the master on_search Payload</h3>
                <textarea
                    className="w-full h-64 p-4 border rounded mb-4 font-mono text-sm bg-gray-900 text-green-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Paste master on_search JSON payload here..."
                    value={jsonPayload}
                    onChange={(e) => setJsonPayload(e.target.value)}
                />
                <button
                    onClick={parsePayload}
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                    Parse Payload
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-[500px] overflow-y-scroll p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Search Configuration</h3>
                <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700">
                    Reset
                </button>
            </div>

            <div className="border p-3 rounded space-y-2">
                {/* City Code */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Enter City Code <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={cityCode}
                        onChange={(e) => setCityCode(e.target.value)}
                        placeholder="std:080"
                        className={inputStyle}
                        required
                    />
                </div>

                {/* Provider ID */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Select Provider ID <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={selectedProviderId}
                        onChange={(e) => handleProviderChange(e.target.value)}
                        required
                        className={inputStyle}
                    >
                        <option value="">-- Select a Provider --</option>
                        {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                                {provider.descriptor?.name
                                    ? `${provider.descriptor.name} (${provider.id})`
                                    : provider.id}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Item ID — filtered by descriptor.code per flow */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Select Item ID <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={selectedItemId}
                        onChange={(e) => handleItemChange(e.target.value)}
                        required
                        disabled={!selectedProviderId}
                        className={inputStyle}
                    >
                        <option value="">-- Select an Item --</option>
                        {availableItems.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.descriptor?.name
                                    ? `${item.descriptor.name} (${item.id})`
                                    : item.id}
                            </option>
                        ))}
                    </select>
                    {selectedProviderId && availableItems.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                            No items with code &ldquo;{flowId ? ITEM_CODE_FILTER[flowId] : ""}&rdquo; found for this provider.
                        </p>
                    )}
                </div>

                {/* Fulfillment ID — filtered by type per flow */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Select Fulfillment ID <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={selectedFulfillmentId}
                        onChange={(e) => handleFulfillmentChange(e.target.value)}
                        required
                        disabled={!selectedProviderId}
                        className={inputStyle}
                    >
                        <option value="">-- Select a Fulfillment --</option>
                        {availableFulfillments.map((fulfillment) => (
                            <option key={fulfillment.id} value={fulfillment.id}>
                                {fulfillment.id} ({fulfillment.type})
                            </option>
                        ))}
                    </select>
                    {selectedProviderId && availableFulfillments.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                            No fulfillments with type &ldquo;{flowId ? FULFILLMENT_TYPE_FILTER[flowId] : ""}&rdquo; found for this provider.
                        </p>
                    )}
                </div>

                {/* Item Quantity — METRO_UNLIMITED_PASS_FLOW only */}
                {isUnlimitedPassFlow && (
                    <div className={fieldWrapperStyle}>
                        <label className={labelStyle}>
                            Item Quantity <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selectedQuantity}
                            onChange={(e) => setSelectedQuantity(e.target.value)}
                            required
                            disabled={!selectedItemId || quantityOptions.length === 0}
                            className={inputStyle}
                        >
                            <option value="">-- Select Quantity --</option>
                            {quantityOptions.map((qty) => (
                                <option key={qty} value={String(qty)}>
                                    {qty}
                                </option>
                            ))}
                        </select>
                        {selectedItemId && quantityOptions.length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">
                                No quantity range defined for the selected item.
                            </p>
                        )}
                    </div>
                )}

                {/* Credential fields — METRO_UNLIMITED_PASS_FLOW only */}
                {isUnlimitedPassFlow && (
                    <>
                        <div className={fieldWrapperStyle}>
                            <label className={labelStyle}>
                                Credential Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={credType}
                                onChange={(e) => setCredType(e.target.value)}
                                disabled={!selectedFulfillmentId || availableCredTypes.length === 0}
                                className={inputStyle}
                            >
                                <option value="">-- Select Credential Type --</option>
                                {availableCredTypes.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                            </select>
                            {selectedFulfillmentId && availableCredTypes.length === 0 && (
                                <p className="text-xs text-amber-600 mt-1">
                                    No credential types found for the selected fulfillment.
                                </p>
                            )}
                        </div>

                        <div className={fieldWrapperStyle}>
                            <label className={labelStyle}>
                                {credType || "Credential"} Value <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={credValue}
                                onChange={(e) => setCredValue(e.target.value)}
                                disabled={!credType}
                                placeholder={credType ? `Enter ${credType} number` : "Select a credential type first"}
                                className={inputStyle}
                            />
                        </div>
                    </>
                )}

                {/* Credential fields — METRO_CARD_RECHARGE only */}
                {isRechargeFlow && (
                    <>
                        <div className={fieldWrapperStyle}>
                            <label className={labelStyle}>Credential Type</label>
                            <div className={`${inputStyle} bg-gray-100 text-gray-600 cursor-not-allowed`}>
                                CARD_IDENTIFIER
                            </div>
                        </div>

                        <div className={fieldWrapperStyle}>
                            <label className={labelStyle}>
                                CARD_IDENTIFIER Value <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={cardIdentifier}
                                onChange={(e) => setCardIdentifier(e.target.value)}
                                placeholder="Enter Card Identifier value"
                                className={inputStyle}
                            />
                        </div>
                    </>
                )}

            </div>

            <button
                onClick={handleSubmit}
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
            >
                Submit
            </button>
        </div>
    );
}
