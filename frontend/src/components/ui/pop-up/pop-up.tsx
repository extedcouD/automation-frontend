import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { FiMinus, FiMaximize2, FiX } from "react-icons/fi";
import { useSession } from "../../../context/context";

export default function Popup({
    children,
    isOpen,
    onClose,
    disableClose = false,
}: {
    children: React.ReactNode;
    isOpen: boolean;
    onClose?: () => void;
    disableClose?: boolean;
}) {
    const [isVisible, setIsVisible] = useState(false);
    const [isShown, setIsShown] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [portalTarget, setPortalTarget] = useState<Element>(
        () => document.fullscreenElement ?? document.body
    );
    const { activeCallClickedToggle } = useSession();

    useEffect(() => {
        setIsMinimized(false);
    }, [activeCallClickedToggle]);

    // Keep the portal target in sync with the fullscreen element so popups
    // are visible whether or not a Monaco editor / panel is fullscreened
    // when the popup opens (or while it's already open).
    useEffect(() => {
        const update = () => {
            setPortalTarget(document.fullscreenElement ?? document.body);
        };
        update();
        document.addEventListener("fullscreenchange", update);
        return () => document.removeEventListener("fullscreenchange", update);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsMinimized(false);
            // Two rAF calls ensure the browser paints the hidden state before transitioning in
            requestAnimationFrame(() => requestAnimationFrame(() => setIsShown(true)));
        } else {
            setIsShown(false);
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible) return null;

    // ───────────────────────────────
    // MINIMIZED MODE (ONLY small bubble)
    // ───────────────────────────────
    if (isMinimized) {
        return ReactDOM.createPortal(
            <div className="fixed bottom-4 right-4 z-50">
                <div className="bg-white shadow-lg rounded-md px-4 py-2 flex items-center gap-3 border">
                    <span className="font-medium text-sm">Popup minimized</span>

                    {/* Maximize */}
                    <button
                        onClick={() => setIsMinimized(false)}
                        className="text-gray-600 hover:text-black"
                    >
                        <FiMaximize2 size={18} />
                    </button>

                    {/* Close */}
                    {onClose && (
                        <button onClick={onClose} className="text-gray-600 hover:text-black">
                            <FiX size={18} />
                        </button>
                    )}
                </div>
            </div>,
            portalTarget
        );
    }

    return ReactDOM.createPortal(
        <div
            className={`fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 transition-opacity duration-300 p-4 ${
                isShown ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => {
                if (!disableClose && onClose) onClose();
            }}
        >
            <div
                className={`bg-white rounded-lg shadow-lg p-4 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] relative transition-transform duration-300 transform overflow-y-auto overflow-x-hidden ${
                    isShown ? "scale-100" : "scale-95"
                }`}
                style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db #f3f4f6" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top-right buttons */}
                <div className="absolute top-2 right-2 flex gap-2 z-10">
                    {/* Minimize */}
                    <button
                        className="text-gray-500 hover:text-gray-700"
                        onClick={() => setIsMinimized(true)}
                    >
                        <FiMinus size={18} />
                    </button>

                    {/* Close */}
                    {!disableClose && onClose && (
                        <button className="text-gray-500 hover:text-gray-700" onClick={onClose}>
                            <FiX size={18} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="max-h-[calc(90vh-2rem)] overflow-y-auto overflow-x-hidden pr-2">
                    {children}
                </div>
            </div>
        </div>,
        document.fullscreenElement ?? document.body
    );
}
