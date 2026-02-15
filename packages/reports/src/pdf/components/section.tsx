import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  section: { marginBottom: 16 },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 6 },
});

type ViewStyle = (typeof styles)["section"];

export function Section({
  title,
  subtitle,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.section, ...(style ? [style] : [])]} wrap={false}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}
