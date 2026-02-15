import React from "react";
import { Svg, G, Path, Text, Rect } from "@react-pdf/renderer";

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: Slice[];
  size?: number;
  title?: string;
  donut?: boolean;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function PdfPieChart({ data, size = 160, title, donut = true }: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = (size - 20) / 2;
  const innerR = donut ? outerR * 0.55 : 0;

  let currentAngle = 0;
  const slices = data.map((d) => {
    const angle = (d.value / total) * 360;
    const start = currentAngle;
    currentAngle += angle;
    return { ...d, startAngle: start, endAngle: start + angle };
  });

  return (
    <Svg
      width={size}
      height={size + (title ? 20 : 0) + data.length * 14}
      viewBox={`0 0 ${size} ${size + (title ? 20 : 0) + data.length * 14}`}
    >
      {title && (
        <Text
          x={cx}
          y={14}
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
      <G transform={title ? "translate(0, 20)" : undefined}>
        {slices.map((slice, i) => {
          if (slice.endAngle - slice.startAngle >= 359.9) {
            // Full circle
            return (
              <G key={i}>
                <Path
                  d={`M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx - 0.01} ${cy - outerR} Z`}
                  fill={slice.color}
                />
                {donut && (
                  <Path
                    d={`M ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx - 0.01} ${cy - innerR} Z`}
                    fill="white"
                  />
                )}
              </G>
            );
          }
          const outerArc = arcPath(
            cx,
            cy,
            outerR,
            slice.startAngle,
            slice.endAngle,
          );
          const outerEnd = polarToCartesian(cx, cy, outerR, slice.startAngle);
          const innerEnd = donut
            ? polarToCartesian(cx, cy, innerR, slice.endAngle)
            : { x: cx, y: cy };

          const d = donut
            ? `${outerArc} L ${innerEnd.x} ${innerEnd.y} ${arcPath(cx, cy, innerR, slice.endAngle, slice.startAngle).replace("M", "L")} L ${outerEnd.x} ${outerEnd.y}`
            : `${outerArc} L ${cx} ${cy} Z`;

          return <Path key={i} d={d} fill={slice.color} />;
        })}
      </G>

      {/* Legend */}
      {data.map((d, i) => {
        const ly = size + (title ? 24 : 4) + i * 14;
        return (
          <G key={i}>
            <Rect x={8} y={ly} width={10} height={10} fill={d.color} rx={2} />
            <Text
              x={22}
              y={ly + 9}
              style={{
                fontSize: 8,
                fontFamily: "Helvetica",
                fill: "#374151",
              }}
            >
              {`${d.label}: ${d.value} (${total > 0 ? Math.round((d.value / total) * 100) : 0}%)`}
            </Text>
          </G>
        );
      })}
    </Svg>
  );
}
