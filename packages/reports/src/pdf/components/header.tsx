import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ReportData } from "../../types";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: "1 solid #e5e7eb",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#4f46e5" },
  date: { fontSize: 8, color: "#9ca3af" },
  compactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: "0.5 solid #e5e7eb",
  },
  compactBrand: { fontSize: 9, color: "#4f46e5", fontFamily: "Helvetica-Bold" },
});

export function ReportHeader({
  data,
  compact,
}: {
  data: ReportData;
  compact?: boolean;
}) {
  const brandName = data.project.branding?.companyName ?? "LLM Boost";
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (compact) {
    return (
      <View style={styles.compactHeader}>
        <Text style={styles.compactBrand}>{brandName}</Text>
        <Text style={styles.date}>
          {data.project.domain} | {date}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Text style={styles.brandName}>{brandName}</Text>
      </View>
      <Text style={styles.date}>{date}</Text>
    </View>
  );
}
