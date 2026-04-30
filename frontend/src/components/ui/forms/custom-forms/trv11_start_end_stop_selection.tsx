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

export default function Metro210StartEndStopSelection({ submitEvent }: IMetroEndStopProps) {
    const [jsonPayload, setJsonPayload] = useState("");
    const [stops, setStops] = useState<IStop[]>([]);
    const [selectedStartStopCode, setSelectedStartStopCode] = useState("");
    const [selectedEndStopCode, setSelectedEndStopCode] = useState("");
    const [isParsed, setIsParsed] = useState(false);
    const [fulfillmentId, setFulfillmentId] = useState("");

    // Additional form fields
    const [cityCode, setCityCode] = useState("");
    const [vehicleCategory, setVehicleCategory] = useState("METRO");
    const [bppId, setBppId] = useState("");
    const [collector, setCollector] = useState("BAP");

    const parsePayload = () => {
        try {
            const payload: IOnSearchPayload = JSON.parse(jsonPayload);
            const providers = payload?.message?.catalog?.providers;

            if (!providers || providers.length === 0) {
                throw new Error("Invalid payload: No providers found");
            }

            // Find TRIP fulfillment from first provider
            const tripFulfillment = providers[0].fulfillments?.find((f) => f.type === "TRIP");

            if (!tripFulfillment) {
                throw new Error("No fulfillment of type TRIP found");
            }

            if (!tripFulfillment.stops || tripFulfillment.stops.length === 0) {
                throw new Error("No stops found in TRIP fulfillment");
            }

            // Store fulfillment ID
            setFulfillmentId(tripFulfillment.id);

            // Extract bpp_id from context if available
            const bppIdFromPayload = payload?.context?.bpp_id;
            if (bppIdFromPayload) {
                setBppId(bppIdFromPayload as string);
            }

            // Get all stops from TRIP fulfillment (all stops can be selected)
            const allStops = tripFulfillment.stops;

            if (allStops.length === 0) {
                throw new Error("No stops found");
            }

            setStops(allStops);
            setIsParsed(true);
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
        setCityCode("");
        setVehicleCategory("METRO");
        setBppId("");
        setCollector("BAP");
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
                    placeholder="Paste on_search JSON payload here..."
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
                        placeholder="e.g., std:011"
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
                {/* <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Enter BPP ID <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={bppId}
                        onChange={(e) => setBppId(e.target.value)}
                        required
                        placeholder="Enter BPP ID"
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

                {/* Start Station Dropdown */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Select Start Station <span className="text-red-500">*</span>
                    </label>
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
                </div>

                {/* End Station Dropdown */}
                <div className={fieldWrapperStyle}>
                    <label className={labelStyle}>
                        Select End Station <span className="text-red-500">*</span>
                    </label>
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
