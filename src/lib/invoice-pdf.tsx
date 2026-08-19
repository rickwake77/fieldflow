// src/lib/invoice-pdf.tsx
// PDF layout for invoices — mirrors the letterhead, item table, and totals
// already used in the docx template (public/templates/invoice.docx) so
// either format looks consistent to the customer.

import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const fmtCurrency = (n: number) => `£${n.toFixed(2)}`;

const fmtDate = (d: Date) => {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
};

const BORDER = "#ADADAD";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  headerBlock: { textAlign: "center", marginBottom: 36 },
  companyName: { fontSize: 18, fontWeight: 700, marginBottom: 3 },
  companySub: { fontSize: 10, marginBottom: 8 },
  companyLine: { fontSize: 9, color: "#444444" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 36 },
  customerBlock: { width: "60%" },
  customerLine: { fontSize: 10, marginBottom: 2 },
  invoiceNumCol: { width: "35%", alignItems: "flex-end" },
  invoiceNumLabel: { fontSize: 10, marginBottom: 6 },
  invoiceNumText: { fontSize: 10, fontWeight: 700 },
  table: { borderWidth: 1, borderColor: BORDER },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f5f5f0" },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderColor: BORDER },
  cellDate: { width: "12%", padding: 6, borderRightWidth: 1, borderColor: BORDER },
  cellDesc: { width: "66%", padding: 6, borderRightWidth: 1, borderColor: BORDER },
  cellExVat: { width: "11%", padding: 6, borderRightWidth: 1, borderColor: BORDER, textAlign: "right" },
  cellVat: { width: "11%", padding: 6, textAlign: "right" },
  headerCellText: { fontSize: 9, fontWeight: 700, textAlign: "center" },
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  totalsTable: { width: "45%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 6 },
  totalsRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderColor: BORDER,
    marginTop: 2,
  },
  totalsLabel: { fontSize: 10 },
  totalsLabelBold: { fontSize: 10, fontWeight: 700 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, textAlign: "center", fontSize: 8, color: "#555555" },
});

export function InvoicePdf({ invoice }: { invoice: any }) {
  const dateStr = fmtDate(new Date(invoice.invoiceDate));
  const subtotal = Number(invoice.subtotal);
  const vat = Number(invoice.vat);
  const total = Number(invoice.total);
  const addressLines = (invoice.customer.address || "")
    .split(/[,\n]/)
    .map((l: string) => l.trim())
    .filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBlock}>
          <Text style={styles.companyName}>M. & J. WAKEHAM & SON</Text>
          <Text style={styles.companySub}>(Agricultural Contractors)</Text>
          <Text style={styles.companyLine}>Little Allers · Avonwick · South Brent · Devon · TQ10 9HA</Text>
          <Text style={styles.companyLine}>Tel: 07811 266 791 · 07855 427 510</Text>
        </View>

        <View style={styles.headerRow}>
          <View style={styles.customerBlock}>
            {invoice.customer.contact && <Text style={styles.customerLine}>FAO: {invoice.customer.contact}</Text>}
            <Text style={styles.customerLine}>{invoice.customer.name}</Text>
            {addressLines.map((line: string, i: number) => (
              <Text key={i} style={styles.customerLine}>{line}</Text>
            ))}
          </View>
          <View style={styles.invoiceNumCol}>
            <Text style={styles.invoiceNumLabel}>INVOICE NUMBER:</Text>
            <Text style={styles.invoiceNumText}>{invoice.invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.cellDate, styles.headerCellText]}>Date</Text>
            <Text style={[styles.cellDesc, styles.headerCellText]}> </Text>
            <Text style={[styles.cellExVat, styles.headerCellText]}>ex-VAT</Text>
            <Text style={[styles.cellVat, styles.headerCellText]}>VAT</Text>
          </View>
          {invoice.items.map((item: any, i: number) => {
            const totalPrice = Number(item.totalPrice);
            const vatAmount = item.vatApplicable ? Math.round(totalPrice * 0.2 * 100) / 100 : 0;
            return (
              <View key={item.id ?? i} style={styles.tableRow}>
                <Text style={styles.cellDate}>{dateStr}</Text>
                <Text style={styles.cellDesc}>{item.description}</Text>
                <Text style={styles.cellExVat}>{fmtCurrency(totalPrice)}</Text>
                <Text style={styles.cellVat}>{fmtCurrency(vatAmount)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total ex-VAT</Text>
              <Text style={styles.totalsLabel}>{fmtCurrency(subtotal)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>VAT</Text>
              <Text style={styles.totalsLabel}>{fmtCurrency(vat)}</Text>
            </View>
            <View style={styles.totalsRowFinal}>
              <Text style={styles.totalsLabelBold}>Total</Text>
              <Text style={styles.totalsLabelBold}>{fmtCurrency(total)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          For BACS Payments: 30-93-14 · 05105229{"\n"}VAT Reg No: 501 1588 83
        </Text>
      </Page>
    </Document>
  );
}
