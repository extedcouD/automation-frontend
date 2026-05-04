import { useState, useMemo } from "react";
import { toast } from "react-toastify";

interface IStop {
    id: string;
    type: string;
    location?: {
        descriptor?: {
            name?: string;
            code?: string;
        };
        gps?: string;
    };
    instructions?: {
        name?: string;
        short_desc?: string;
    };
    parent_stop_id?: string;
}

interface IFulfillment {
    id: string;
    type: string;
    stops?: IStop[];
}

interface IOnSearchPayload {
    context: Record<string, unknown>;
    message: {
        catalog: {
            providers: Array<{
                fulfillments: IFulfillment[];
            }>;
        };
    };
}

interface IMetroEndStopProps {
    submitEvent: (data: {
        jsonPath: Record<string, string | number>;
        formData: Record<string, string>;
    }) => Promise<void>;
}

export default function Metro200StartEndStopSelection({ submitEvent }: IMetroEndStopProps) {
    const [jsonPayload, setJsonPayload] = useState("");
    const [stops, setStops] = useState<IStop[]>([]);
    const [selectedStartStopCode, setSelectedStartStopCode] = useState("");
    const [selectedEndStopCode, setSelectedEndStopCode] = useState("");
    const [isParsed, setIsParsed] = useState(false);
    const [showPasteInput, setShowPasteInput] = useState(false);
    const [fulfillmentId, setFulfillmentId] = useState("");

    // Additional form fields
    const [cityCode, setCityCode] = useState("std:080");
    const [vehicleCategory, setVehicleCategory] = useState("METRO");
    const [bppId, setBppId] = useState("");
    const [collector, setCollector] = useState("BAP");

    const handleProcessPayload = () => {
        if (!jsonPayload || !jsonPayload.trim()) {
            toast.warn("Please paste a payload first");
            return;
        }

        try {
            const payload: IOnSearchPayload = JSON.parse(jsonPayload);
            const providers = payload?.message?.catalog?.providers;

            if (!providers || providers.length === 0) {
                throw new Error("Invalid payload: No providers found");
            }

            const routeFulfillment = providers[0].fulfillments?.find((f) => f.type === "ROUTE");

            if (!routeFulfillment) {
                throw new Error("No fulfillment of type ROUTE found");
            }

            if (!routeFulfillment.stops || routeFulfillment.stops.length === 0) {
                throw new Error("No stops found in ROUTE fulfillment");
            }

            setFulfillmentId(routeFulfillment.id);

            const bppIdFromPayload = payload?.context?.bpp_id;
            if (bppIdFromPayload) {
                setBppId(bppIdFromPayload as string);
            }

            const allStops = routeFulfillment.stops;
            setStops(allStops);
            setIsParsed(true);
            setShowPasteInput(false);
            toast.success(`Found ${allStops.length} stops`);
        } catch (e: unknown) {
            console.error(e);
            toast.error("Failed to parse payload: " + (e as Error).message);
        }
    };

    // Find the index of selected start station
    const selectedStartIndex = useMemo(() => {
        if (!selectedStartStopCode) return -1;
        return stops.findIndex((stop) => stop.location?.descriptor?.code === selectedStartStopCode);
    }, [stops, selectedStartStopCode]);

    // Find the index of selected end station
    const selectedEndIndex = useMemo(() => {
        if (!selectedEndStopCode) return -1;
        return stops.findIndex((stop) => stop.location?.descriptor?.code === selectedEndStopCode);
    }, [stops, selectedEndStopCode]);

    // Filter available start stations - exclude the selected end station and all stations after it
    const availableStartStops = useMemo(() => {
        if (selectedEndIndex === -1) {
            // No end station selected, show all stops
            return stops;
        }
        // Only show stations BEFORE the selected end station
        return stops.filter((_, index) => index < selectedEndIndex);
    }, [stops, selectedEndIndex]);

    // Filter available end stations - exclude the selected start station and all stations before/at it
    const availableEndStops = useMemo(() => {
        if (selectedStartIndex === -1) {
            // No start station selected, show all stops
            return stops;
        }
        // Only show stations AFTER the selected start station
        return stops.filter((_, index) => index > selectedStartIndex);
    }, [stops, selectedStartIndex]);

    const handleSubmit = async () => {
        if (!cityCode.trim()) {
            toast.error("Please enter city code");
            return;
        }

        if (!bppId.trim()) {
            toast.error("Please enter BPP ID");
            return;
        }

        if (!selectedStartStopCode) {
            toast.error("Please select a start station");
            return;
        }

        if (!selectedEndStopCode) {
            toast.error("Please select an end station");
            return;
        }

        if (selectedStartStopCode === selectedEndStopCode) {
            toast.error("Start and end stations cannot be the same");
            return;
        }

        await submitEvent({
            jsonPath: {},
            formData: {
                city_code: cityCode,
                vehicle_category: vehicleCategory,
                bpp_id: bppId,
                collector: collector,
                fulfillment_id: fulfillmentId,
                start_stop_code: selectedStartStopCode,
                end_stop_code: selectedEndStopCode,
            },
        });
    };

    const handleReset = () => {
        setJsonPayload("");
        setStops([]);
        setSelectedStartStopCode("");
        setSelectedEndStopCode("");
        setIsParsed(false);
        setShowPasteInput(false);
        setCityCode("std:080");
        setVehicleCategory("METRO");
        setBppId("");
        setFulfillmentId("");
        setCollector("BAP");
    };

    const inputStyle =
        "border rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
    const labelStyle = "mb-1 font-semibold";
    const fieldWrapperStyle = "flex flex-col mb-2";

    return (
        <div className="space-y-4 h-[500px] overflow-y-scroll p-4 bg-gray-50/50">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-gray-800">Search Configuration</h3>
                <button
                    onClick={handleReset}
                    className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                    Reset Form
                </button>
            </div>

            {/* Optional Payload Paste Section */}
            {showPasteInput ? (
                <div className="border border-blue-200 bg-blue-50/80 p-4 rounded-xl shadow-inner mb-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-blue-900">
                            Paste on_search Payload
                        </label>
                        <button
                            onClick={() => setShowPasteInput(false)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    </div>
                    <textarea
                        className="w-full h-32 p-3 border border-blue-300 rounded-lg text-xs font-mono bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                        placeholder="Paste master on_search JSON here..."
                        value={jsonPayload}
                        onChange={(e) => setJsonPayload(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleProcessPayload}
                            className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                        >
                            Load Data
                        </button>
                        <button
                            onClick={() => {
                                setJsonPayload("");
                                setShowPasteInput(false);
                            }}
                            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-bold hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between border border-blue-100 bg-blue-50/40 p-3 rounded-xl shadow-sm mb-4">
                    <span className="text-sm font-semibold text-blue-900">
                        Paste on_search payload (optional)
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowPasteInput(true)}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-200"
                        >
                            {isParsed ? "Modify Payload" : "Paste Payload"}
                        </button>
                        {isParsed && (
                            <button
                                onClick={() => {
                                    setJsonPayload("");
                                    setIsParsed(false);
                                    setStops([]);
                                    setFulfillmentId("");
                                    toast.info("Payload cleared");
                                }}
                                className="text-xs text-gray-500 hover:text-red-500 underline underline-offset-2 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="border border-gray-200 bg-white p-4 rounded-xl shadow-sm space-y-4">
                {/* City Code Input */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Enter City Code <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={cityCode}
                        onChange={(e) => setCityCode(e.target.value)}
                        required
                        placeholder="e.g., std:080"
                        className={inputStyle}
                    />
                </div>

                {/* Vehicle Category Dropdown */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Vehicle Category <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={vehicleCategory}
                        onChange={(e) => setVehicleCategory(e.target.value)}
                        required
                        className={inputStyle}
                    >
                        <option value="METRO">METRO</option>
                    </select>
                </div>

                {/* BPP ID Input */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        BPP ID <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={bppId}
                        onChange={(e) => setBppId(e.target.value)}
                        required
                        placeholder="Enter BPP ID"
                        className={inputStyle}
                    />
                </div>

                {/* Fulfillment ID Input */}
                {/* <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Fulfillment ID <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={fulfillmentId}
                        onChange={(e) => setFulfillmentId(e.target.value)}
                        required
                        placeholder="Enter Fulfillment ID"
                        className={inputStyle}
                    />
                </div> */}

                {/* Collector Dropdown */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Choose Collector <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={collector}
                        onChange={(e) => setCollector(e.target.value)}
                        required
                        className={inputStyle}
                    >
                        <option value="BAP">BAP</option>
                        <option value="BPP">BPP</option>
                    </select>
                </div>

                {/* Start Station */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Start Station <span className="text-red-500">*</span>
                    </label>
                    {isParsed ? (
                        <select
                            value={selectedStartStopCode}
                            onChange={(e) => setSelectedStartStopCode(e.target.value)}
                            required
                            className={inputStyle}
                        >
                            <option value="">-- Select a start station --</option>
                            {availableStartStops.map((stop) => (
                                <option
                                    key={stop.id}
                                    value={stop.location?.descriptor?.code || stop.id}
                                >
                                    {stop.location?.descriptor?.name || `Stop ${stop.id}`}
                                    {stop.location?.descriptor?.code
                                        ? ` (${stop.location.descriptor.code})`
                                        : ""}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={selectedStartStopCode}
                            onChange={(e) => setSelectedStartStopCode(e.target.value)}
                            required
                            placeholder="Enter Start Station Code"
                            className={inputStyle}
                        />
                    )}
                </div>

                {/* End Station */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        End Station <span className="text-red-500">*</span>
                    </label>
                    {isParsed ? (
                        <select
                            value={selectedEndStopCode}
                            onChange={(e) => setSelectedEndStopCode(e.target.value)}
                            required
                            className={inputStyle}
                        >
                            <option value="">-- Select an end station --</option>
                            {availableEndStops.map((stop) => (
                                <option
                                    key={stop.id}
                                    value={stop.location?.descriptor?.code || stop.id}
                                >
                                    {stop.location?.descriptor?.name || `Stop ${stop.id}`}
                                    {stop.location?.descriptor?.code
                                        ? ` (${stop.location.descriptor.code})`
                                        : ""}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={selectedEndStopCode}
                            onChange={(e) => setSelectedEndStopCode(e.target.value)}
                            required
                            placeholder="Enter End Station Code"
                            className={inputStyle}
                        />
                    )}
                </div>
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
