import React from "react";
import { Svg, Circle, Text } from "@react-pdf/renderer";

interface Props {
  score: number;
  size?: number;
  label?: string;
}

function gradeColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 80) return "#2563eb";
  if (score >= 70) return "#ca8a04";
  if (score >= 60) return "#ea580c";
  return "#dc2626";
}

export function PdfScoreCircle({ score, size = 120, label }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - 16) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (Math.min(score, 100) / 100) * circumference;
  const color = gradeColor(score);

  return (
    <Svg
      width={size}
      height={size + (label ? 20 : 0)}
      viewBox={`0 0 ${size} ${size + (label ? 20 : 0)}`}
    >
      {/* Background circle */}
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="#e5e7eb"
        strokeWidth={8}
        fill="none"
      />
      {/* Progress arc */}
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={color}
        strokeWidth={8}
        fill="none"
        strokeDasharray={`${progress} ${circumference - progress}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Score number */}
      <Text
        x={cx}
        y={cy + 8}
        textAnchor="middle"
        style={{
          fontSize: size * 0.28,
          fontFamily: "Helvetica-Bold",
          fill: color,
        }}
      >
        {String(Math.round(score))}
      </Text>
      {/* Optional label */}
      {label && (
        <Text
          x={cx}
          y={size + 14}
          textAnchor="middle"
          style={{ fontSize: 9, fontFamily: "Helvetica", fill: "#6b7280" }}
        >
          {label}
        </Text>
      )}
    </Svg>
  );
}
