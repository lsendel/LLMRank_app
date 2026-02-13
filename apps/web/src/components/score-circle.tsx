"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function getLetterGrade(score: number): string {
  if (score >= 93) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 77) return "B+";
  if (score >= 73) return "B";
  if (score >= 70) return "B-";
  if (score >= 67) return "C+";
  if (score >= 63) return "C";
  if (score >= 60) return "C-";
  if (score >= 57) return "D+";
  if (score >= 53) return "D";
  if (score >= 50) return "D-";
  return "F";
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  if (score >= 40) return "text-orange-500";
  return "text-destructive";
}

function getStrokeColor(score: number): string {
  if (score >= 80) return "stroke-success";
  if (score >= 60) return "stroke-warning";
  if (score >= 40) return "stroke-orange-500";
  return "stroke-destructive";
}

interface ScoreCircleProps {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}

export function ScoreCircle({
  score,
  size = 120,
  label,
  className,
}: ScoreCircleProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  const grade = getLetterGrade(score);
  const colorClass = getScoreColor(score);
  const strokeClass = getStrokeColor(score);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          {/* Score circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={cn(strokeClass, "transition-all duration-1000 ease-out")}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold", colorClass)}>{grade}</span>
          <span className="text-sm text-muted-foreground">{score}</span>
        </div>
      </div>
      {label && (
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
