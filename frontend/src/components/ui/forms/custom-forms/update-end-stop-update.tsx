import { useState } from "react";
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

export default function Metro210EndStopUpdate({ submitEvent }: IMetroEndStopProps) {
    const [jsonPayload, setJsonPayload] = useState("");
    const [stops, setStops] = useState<IStop[]>([]);
    const [selectedStopId, setSelectedStopId] = useState("");
    const [isParsed, setIsParsed] = useState(false);
    const [fulfillmentId, setFulfillmentId] = useState("");

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

            // Filter out START and END stops
            const filteredStops = tripFulfillment.stops.filter((stop) => stop.type !== "START");

            if (filteredStops.length === 0) {
                throw new Error("No intermediate stops found");
            }

            // Get only the last 3 stops
            const last3Stops = filteredStops.slice(-3);

            setStops(last3Stops);
            setIsParsed(true);
            toast.success(
                `Showing last ${last3Stops.length} stops (out of ${filteredStops.length} total)`
            );
        } catch (e: unknown) {
            console.error(e);
            toast.error("Failed to parse payload: " + (e as Error).message);
        }
    };

    const handleSubmit = async () => {
        if (!selectedStopId) {
            toast.error("Please select an end station");
            return;
        }

        const selectedStop = stops.find((s) => s.id === selectedStopId);

        await submitEvent({
            jsonPath: {},
            formData: {
                fulfillment_id: fulfillmentId,
                stops: JSON.stringify(selectedStop),
            },
        });
    };

    const handleReset = () => {
        setJsonPayload("");
        setStops([]);
        setSelectedStopId("");
        setIsParsed(false);
    };

    if (!isParsed) {
        return (
            <div className="p-4">
                <h3 className="text-lg font-bold mb-4">Paste the master on_search Payload</h3>
                <textarea
                    className="w-full h-64 p-4 border-2 border-gray-300 rounded mb-4 font-mono text-sm bg-gray-900 text-green-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Select End Station</h3>
                <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700">
                    Reset
                </button>
            </div>

            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select End Station <span className="text-red-500">*</span>
                </label>
                <select
                    value={selectedStopId}
                    onChange={(e) => setSelectedStopId(e.target.value)}
                    required
                    className="w-full p-3 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                    <option value="">-- Select a station --</option>
                    {stops.map((stop) => (
                        <option key={stop.id} value={stop.id}>
                            {stop.location?.descriptor?.name || `Stop ${stop.id}`}
                            {stop.location?.descriptor?.code
                                ? ` (${stop.location.descriptor.code})`
                                : ""}
                        </option>
                    ))}
                </select>
            </div>

            <button
                onClick={handleSubmit}
                className="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700"
            >
                Confirm Selection
            </button>
        </div>
    );
}
