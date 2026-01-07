"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ExpandableTextProps {
    text: string;
    maxLines?: number;
    className?: string;
}

export function ExpandableText({ text, maxLines = 3, className = "" }: ExpandableTextProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className={`space-y-2 ${className}`}>
            <p className={`text-gray-300 leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
                {text}
            </p>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
                {isExpanded ? (
                    <>
                        See Less <ChevronUp className="h-3 w-3" />
                    </>
                ) : (
                    <>
                        See More <ChevronDown className="h-3 w-3" />
                    </>
                )}
            </button>
        </div>
    );
}
