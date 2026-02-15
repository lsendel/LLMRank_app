import React from "react";
import { Svg, Rect, Text, G } from "@react-pdf/renderer";

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  data: BarData[];
  width?: number;
  height?: number;
  title?: string;
}

const DEFAULT_COLORS = [
  "#2563eb",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#7c3aed",
];

export function PdfBarChart({ data, width = 400, height = 200, title }: Props) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const labelWidth = 80;
  const chartWidth = width - labelWidth - 40;
  const barHeight = Math.min(
    24,
    (height - (title ? 24 : 0) - 10) / data.length - 4,
  );
  const startY = title ? 28 : 4;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {title && (
        <Text
          x={width / 2}
          y={16}
          textAnchor="middle"
          style={{
            fontSize: 11,
            fontFamily: "Helvetica-Bold",
            fill: "#1f2937",
          }}
        >
          {title}
        </Text>
      )}
      {data.map((d, i) => {
        const y = startY + i * (barHeight + 4);
        const barW = (d.value / maxVal) * chartWidth;
        const color = d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
        return (
          <G key={i}>
            <Text
              x={labelWidth - 4}
              y={y + barHeight / 2 + 4}
              textAnchor="end"
              style={{
                fontSize: 9,
                fontFamily: "Helvetica",
                fill: "#374151",
              }}
            >
              {d.label}
            </Text>
            <Rect
              x={labelWidth}
              y={y}
              width={Math.max(barW, 2)}
              height={barHeight}
              rx={3}
              fill={color}
            />
            <Text
              x={labelWidth + barW + 6}
              y={y + barHeight / 2 + 4}
              style={{
                fontSize: 9,
                fontFamily: "Helvetica-Bold",
                fill: "#374151",
              }}
            >
              {String(d.value)}
            </Text>
          </G>
        );
      })}
    </Svg>
  );
}
