import { Card } from "@/model/models";
import React, { useState, useEffect } from "react";


interface CardModalProps {
    isOpen: boolean;
    card: Card | null;
    onSave: (card: Card) => void;
    onClose: () => void;
    tagsAndBranches: string[];
}

export default function CardModal({
    isOpen,
    card,
    onSave,
    onClose,
    tagsAndBranches,
}: CardModalProps) {
    const [name, setName] = useState("");
    const [fromCommit, setFromCommit] = useState("");
    const [toCommit, setToCommit] = useState("");

    useEffect(() => {
        if (card) {
            setName(card.name);
            setFromCommit(card.fromCommit);
            setToCommit(card.toCommit);
        }
    }, [card]);

    const handleSave = () => {
        if (card) {
            const updatedCard: Card = {
                ...card,
                name,
                fromCommit,
                toCommit,
            };
            onSave(updatedCard);
        }
    };

    if (!isOpen || !card) return null;

    return (
        <div className="fixed z-10 inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen">
                <div className="fixed inset-0 bg-black opacity-50"></div>
                <div className="bg-white rounded-lg p-6 z-20 w-full max-w-md">
                    <h2 className="text-2xl font-semibold mb-4">Edit Card</h2>
                    <div className="mb-4">
                        <label htmlFor="cardName" className="block mb-1">
                            Card Name
                        </label>
                        <input
                            type="text"
                            id="cardName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Card Name"
                            className="w-full px-3 py-2 bg-white border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="fromCommit" className="block mb-1">
                            From Commit
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                id="fromCommit"
                                value={fromCommit}
                                onChange={(e) => setFromCommit(e.target.value)}
                                placeholder="From Commit"
                                className="w-full px-3 py-2 pr-24 bg-white border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                            <select
                                value={fromCommit}
                                onChange={(e) => setFromCommit(e.target.value)}
                                className="absolute right-0 top-0 bottom-0 px-2 py-2 border-l bg-white rounded-r-md focus:outline-none"
                            >
                                <option value="">Select</option>
                                {tagsAndBranches.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label htmlFor="toCommit" className="block mb-1">
                            To Commit
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                id="toCommit"
                                value={toCommit}
                                onChange={(e) => setToCommit(e.target.value)}
                                placeholder="To Commit (optional)"
                                className="w-full px-3 py-2 pr-24 border bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <select
                                value={toCommit}
                                onChange={(e) => setToCommit(e.target.value)}
                                className="absolute right-0 top-0 bottom-0 px-2 py-2 border-l bg-white rounded-r-md focus:outline-none"
                            >
                                <option value="">Select</option>
                                {tagsAndBranches.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded mr-2"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}