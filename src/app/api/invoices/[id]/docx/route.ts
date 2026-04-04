// src/app/api/invoices/[id]/docx/route.ts
//
// Generates a .docx invoice from the template, dynamically building
// line-item rows to match the number of items on the invoice.
//
// Dependencies: npm install jszip
// Template: place your invoice.docx at public/templates/invoice.docx

import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import JSZip from "jszip";

type Params = { params: Promise<{ id: string }> };

// ─── Helpers ────────────────────────────────────────────────────

const fmtCurrency = (n: number) => `\u00A3${n.toFixed(2)}`;

const fmtDate = (d: Date) => {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
};

const esc = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x2019;");

// ─── XML Builders ───────────────────────────────────────────────

const B = "ADADAD"; // border colour from template

function itemRow(
  date: string,
  description: string,
  exVat: string,
  vat: string
): string {
  const borders = (left: boolean, right: boolean) => {
    let x = `<w:tcBorders>`;
    x += `<w:top w:val="single" w:sz="4" w:space="0" w:color="${B}" w:themeColor="background2" w:themeShade="BF"/>`;
    if (left) x += `<w:left w:val="single" w:sz="4" w:space="0" w:color="${B}" w:themeColor="background2" w:themeShade="BF"/>`;
    x += `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="${B}" w:themeColor="background2" w:themeShade="BF"/>`;
    if (right) x += `<w:right w:val="single" w:sz="4" w:space="0" w:color="${B}" w:themeColor="background2" w:themeShade="BF"/>`;
    x += `</w:tcBorders>`;
    return x;
  };

  const cell = (w: number, txt: string, jc: string, l: boolean, r: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${borders(l, r)}</w:tcPr>` +
    `<w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr>` +
    (txt ? `<w:r><w:t>${esc(txt)}</w:t></w:r>` : ``) +
    `</w:p></w:tc>`;

  return (
    `<w:tr>` +
    cell(988, date, "center", false, true) +
    cell(5670, description, "left", true, true) +
    cell(1134, exVat, "right", true, true) +
    cell(1224, vat, "right", true, false) +
    `</w:tr>`
  );
}

function buildItemsTable(
  items: Array<{
    description: string;
    totalPrice: number;
    vatAmount: number;
  }>,
  dateStr: string
): string {
  const hdrCell = (w: number, txt: string) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>` +
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
    (txt ? `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${esc(txt)}</w:t></w:r>` : ``) +
    `</w:p></w:tc>`;

  const hdr =
    `<w:tr>` +
    hdrCell(988, "Date") +
    hdrCell(5670, "") +
    hdrCell(1134, "ex-VAT") +
    hdrCell(1224, "VAT") +
    `</w:tr>`;

  const rows = items
    .map((it) =>
      itemRow(
        dateStr,
        it.description,
        fmtCurrency(it.totalPrice),
        fmtCurrency(it.vatAmount)
      )
    )
    .join("");

  return (
    `<w:tbl>` +
    `<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>` +
    `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="988"/><w:gridCol w:w="5670"/><w:gridCol w:w="1134"/><w:gridCol w:w="1224"/></w:tblGrid>` +
    hdr +
    rows +
    `</w:tbl>`
  );
}

function buildTotals(subtotal: number, vat: number, total: number): string {
  const row = (label: string, value: string, bold = false) => {
    const rp = bold ? `<w:rPr><w:b/><w:bCs/></w:rPr>` : "";
    return (
      `<w:tr>` +
      `<w:tc><w:tcPr><w:tcW w:w="1417" w:type="dxa"/></w:tcPr>` +
      `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${rp}<w:t>${esc(label)}</w:t></w:r></w:p></w:tc>` +
      `<w:tc><w:tcPr><w:tcW w:w="1650" w:type="dxa"/></w:tcPr>` +
      `<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r>${rp}<w:t>${esc(value)}</w:t></w:r></w:p></w:tc>` +
      `</w:tr>`
    );
  };

  return (
    `<w:tbl>` +
    `<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>` +
    `<w:tblInd w:w="5949" w:type="dxa"/>` +
    `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="1417"/><w:gridCol w:w="1650"/></w:tblGrid>` +
    row("Total ex-VAT", fmtCurrency(subtotal)) +
    row("VAT", fmtCurrency(vat)) +
    row("Total", fmtCurrency(total), true) +
    `</w:tbl>`
  );
}

function buildInvNumBox(num: string): string {
  return (
    `<w:tbl>` +
    `<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>` +
    `<w:tblInd w:w="7225" w:type="dxa"/>` +
    `<w:tblBorders>` +
    `<w:top w:val="single" w:sz="4" w:space="0" w:color="${B}" w:themeColor="background2" w:themeShade="BF"/>` +
    `<w:left w:val="single" w:sz="4" w:space="0" w:color="${B}" w:themeColor="background2" w:themeShade="BF"/>` +
    `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="${B}" w:themeColor="background2" w:themeShade="BF"/>` +
    `<w:right w:val="single" w:sz="4" w:space="0" w:color="${B}" w:themeColor="background2" w:themeShade="BF"/>` +
    `<w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `<w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>` +
    `</w:tblBorders>` +
    `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="1791"/></w:tblGrid>` +
    `<w:tr><w:tc><w:tcPr><w:tcW w:w="1791" w:type="dxa"/></w:tcPr>` +
    `<w:p><w:pPr><w:jc w:val="right"/></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${esc(num)}</w:t></w:r></w:p></w:tc></w:tr>` +
    `</w:tbl>`
  );
}

function customerBlock(cust: {
  name: string;
  contact?: string | null;
  address?: string | null;
}): string {
  const lines: string[] = [];
  if (cust.name) lines.push(cust.name);
  if (cust.contact) lines.push(cust.contact);
  if (cust.address) {
    cust.address.split(/[,\n]/).forEach((l) => {
      const t = l.trim();
      if (t) lines.push(t);
    });
  }
  return lines.map((l) => `<w:p><w:r><w:t>${esc(l)}</w:t></w:r></w:p>`).join("");
}

function extractSectPr(xml: string): string {
  const match = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  if (match) return match[0];
  return (
    `<w:sectPr>` +
    `<w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>` +
    `<w:cols w:space="708"/>` +
    `<w:docGrid w:linePitch="360"/>` +
    `</w:sectPr>`
  );
}

// ─── Route Handler ───────────────────────────────────────────────

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        items: {
          include: {
            job: {
              select: {
                id: true,
                title: true,
                field: { select: { fieldName: true } },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Load template
    const templatePath = path.join(process.cwd(), "public", "templates", "invoice.docx");
    const templateBuffer = await fs.readFile(templatePath);
    const zip = await JSZip.loadAsync(templateBuffer);

    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) throw new Error("Invalid template: missing document.xml");
    const originalDocXml = await docXmlFile.async("string");

    const invoiceDate = new Date(invoice.invoiceDate);
    const dateStr = fmtDate(invoiceDate);

    const lineItems = invoice.items.map((item) => ({
      description: item.description,
      totalPrice: Number(item.totalPrice),
      vatAmount: 0,
    }));

    // Distribute VAT proportionally across items
    const invoiceSubtotal = Number(invoice.subtotal);
    const invoiceVat = Number(invoice.vat);
    if (invoiceSubtotal > 0 && invoiceVat > 0) {
      let vatAssigned = 0;
      lineItems.forEach((item, i) => {
        if (i === lineItems.length - 1) {
          item.vatAmount = Math.round((invoiceVat - vatAssigned) * 100) / 100;
        } else {
          item.vatAmount =
            Math.round((item.totalPrice / invoiceSubtotal) * invoiceVat * 100) / 100;
          vatAssigned += item.vatAmount;
        }
      });
    }

    const newBody =
      `<w:body>` +
      `<w:p><w:pPr><w:jc w:val="right"/></w:pPr></w:p>` +
      `<w:p><w:pPr><w:jc w:val="right"/></w:pPr>` +
      `<w:r><w:t>INVOICE NUMBER:</w:t></w:r></w:p>` +
      buildInvNumBox(invoice.invoiceNumber) +
      `<w:p><w:pPr><w:jc w:val="right"/></w:pPr></w:p>` +
      `<w:p><w:pPr><w:jc w:val="right"/></w:pPr></w:p>` +
      customerBlock(invoice.customer) +
      `<w:p/>` +
      buildItemsTable(lineItems, dateStr) +
      `<w:p><w:pPr><w:jc w:val="right"/></w:pPr></w:p>` +
      buildTotals(invoiceSubtotal, invoiceVat, Number(invoice.total)) +
      `<w:p><w:pPr><w:jc w:val="right"/></w:pPr></w:p>` +
      extractSectPr(originalDocXml) +
      `</w:body>`;

    const newDocXml = originalDocXml.replace(
      /<w:body>[\s\S]*<\/w:body>/,
      newBody
    );

    zip.file("word/document.xml", newDocXml);
    const outputBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    return new NextResponse(outputBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.docx"`,
      },
    });
  } catch (err) {
    console.error("Error generating invoice DOCX:", err);
    return NextResponse.json(
      { error: "Failed to generate invoice document" },
      { status: 500 }
    );
  }
}
