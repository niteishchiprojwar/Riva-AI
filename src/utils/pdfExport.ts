import { jsPDF } from 'jspdf';
import type { Conversation } from '../types/chat';
import {
  buildPdfExportData,
  type PdfContentBlock,
  type PdfExportDocument,
} from './chatUtils';

const PAGE_WIDTH_PT = 595.28; // A4 width in points
const PAGE_HEIGHT_PT = 841.89; // A4 height in points
const RENDER_SCALE = 2;
const CANVAS_WIDTH = Math.round(PAGE_WIDTH_PT * RENDER_SCALE);
const CANVAS_HEIGHT = Math.round(PAGE_HEIGHT_PT * RENDER_SCALE);

const MARGIN_X = 76; // 38pt * 2
const CONTENT_WIDTH = CANVAS_WIDTH - MARGIN_X * 2;
const TOP_MARGIN = 76;
const BOTTOM_MARGIN = CANVAS_HEIGHT - 84;

const SANS_FONT =
  "'Plus Jakarta Sans', 'DM Sans', 'Noto Sans Devanagari', system-ui, -apple-system, sans-serif";
const MONO_FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

interface CanvasPage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function createCanvasPage(): CanvasPage {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize canvas for PDF rendering.');
  }

  // Crisp light background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.textBaseline = 'top';
  return { canvas, ctx };
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    const words = para.split(/(\s+)/);
    let current = '';

    for (const token of words) {
      const testLine = current + token;
      if (ctx.measureText(testLine).width <= maxWidth) {
        current = testLine;
      } else if (current.trim().length > 0) {
        lines.push(current.trimEnd());
        current = token.trimStart();
        while (
          current.length > 1 &&
          ctx.measureText(current).width > maxWidth
        ) {
          let splitIdx = current.length - 1;
          while (
            splitIdx > 1 &&
            ctx.measureText(current.slice(0, splitIdx)).width > maxWidth
          ) {
            splitIdx--;
          }
          lines.push(current.slice(0, splitIdx));
          current = current.slice(splitIdx);
        }
      } else {
        let remaining = token;
        while (
          remaining.length > 1 &&
          ctx.measureText(remaining).width > maxWidth
        ) {
          let splitIdx = remaining.length - 1;
          while (
            splitIdx > 1 &&
            ctx.measureText(remaining.slice(0, splitIdx)).width > maxWidth
          ) {
            splitIdx--;
          }
          lines.push(remaining.slice(0, splitIdx));
          remaining = remaining.slice(splitIdx);
        }
        current = remaining;
      }
    }

    if (current.trim().length > 0 || lines.length === 0) {
      lines.push(current.trimEnd());
    }
  }

  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawDocumentHeader(
  ctx: CanvasRenderingContext2D,
  docData: PdfExportDocument
): number {
  const headerTop = TOP_MARGIN;
  const gradient = ctx.createLinearGradient(
    MARGIN_X,
    headerTop,
    MARGIN_X + CONTENT_WIDTH,
    headerTop
  );
  gradient.addColorStop(0, '#7c3aed');
  gradient.addColorStop(0.5, '#2563eb');
  gradient.addColorStop(1, '#ec4899');

  drawRoundedRect(ctx, MARGIN_X, headerTop, CONTENT_WIDTH, 10, 5);
  ctx.fillStyle = gradient;
  ctx.fill();

  let y = headerTop + 26;

  ctx.font = `700 22px ${SANS_FONT}`;
  ctx.fillStyle = '#6d28d9';
  ctx.fillText('Riva AI', MARGIN_X, y);

  ctx.font = `500 20px ${SANS_FONT}`;
  ctx.fillStyle = '#64748b';
  const metaText = `${docData.modeLabel}  ·  ${docData.exportedAtLabel}`;
  const metaWidth = ctx.measureText(metaText).width;
  ctx.fillText(metaText, MARGIN_X + CONTENT_WIDTH - metaWidth, y + 2);

  y += 38;

  ctx.font = `700 34px ${SANS_FONT}`;
  ctx.fillStyle = '#0f172a';
  const titleLines = wrapTextLines(ctx, docData.title, CONTENT_WIDTH);
  for (const line of titleLines) {
    ctx.fillText(line, MARGIN_X, y);
    y += 44;
  }

  y += 10;
  ctx.strokeStyle = '#e9d5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, y);
  ctx.lineTo(MARGIN_X + CONTENT_WIDTH, y);
  ctx.stroke();

  return y + 28;
}

function renderBlockOnPages(
  pages: CanvasPage[],
  cursorY: { value: number },
  block: PdfContentBlock,
  isUser: boolean
) {
  const innerX = MARGIN_X + 28;
  const innerWidth = CONTENT_WIDTH - 56;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY.value + neededHeight > BOTTOM_MARGIN) {
      pages.push(createCanvasPage());
      cursorY.value = TOP_MARGIN;
    }
  };

  let activePage = pages[pages.length - 1];

  if (block.kind === 'code') {
    activePage.ctx.font = `400 22px ${MONO_FONT}`;
    const codePaddingX = 24;
    const codePaddingY = 20;
    const lineHeight = 32;
    const lines = wrapTextLines(
      activePage.ctx,
      block.text || ' ',
      innerWidth - codePaddingX * 2
    );

    const headerHeight = block.language ? 34 : 0;
    let remainingLines = [...lines];
    let firstSlice = true;

    while (remainingLines.length > 0) {
      const availableHeight = BOTTOM_MARGIN - cursorY.value - 24;
      const minBlockHeight = codePaddingY * 2 + lineHeight + (firstSlice ? headerHeight : 0);
      if (availableHeight < minBlockHeight) {
        pages.push(createCanvasPage());
        cursorY.value = TOP_MARGIN;
        activePage = pages[pages.length - 1];
      }

      const maxLinesInPage = Math.max(
        1,
        Math.floor(
          (BOTTOM_MARGIN -
            cursorY.value -
            codePaddingY * 2 -
            (firstSlice ? headerHeight : 0)) /
            lineHeight
        )
      );
      const chunk = remainingLines.slice(0, maxLinesInPage);
      remainingLines = remainingLines.slice(maxLinesInPage);

      const boxHeight =
        codePaddingY * 2 +
        (firstSlice ? headerHeight : 0) +
        chunk.length * lineHeight;

      const ctx = activePage.ctx;
      drawRoundedRect(ctx, innerX, cursorY.value, innerWidth, boxHeight, 14);
      ctx.fillStyle = '#171126';
      ctx.fill();

      let textY = cursorY.value + codePaddingY;
      if (firstSlice && block.language) {
        ctx.font = `600 18px ${SANS_FONT}`;
        ctx.fillStyle = '#c4b5fd';
        ctx.fillText(block.language, innerX + codePaddingX, textY);
        textY += headerHeight;
      }

      ctx.font = `400 22px ${MONO_FONT}`;
      ctx.fillStyle = '#f8fafc';
      for (const codeLine of chunk) {
        ctx.fillText(codeLine, innerX + codePaddingX, textY);
        textY += lineHeight;
      }

      cursorY.value += boxHeight + 16;
      firstSlice = false;
    }
    return;
  }

  if (block.kind === 'heading') {
    activePage.ctx.font = `700 28px ${SANS_FONT}`;
    const lines = wrapTextLines(activePage.ctx, block.text, innerWidth);
    const lineHeight = 38;
    ensureSpace(lines.length * lineHeight + 12);
    activePage = pages[pages.length - 1];

    const ctx = activePage.ctx;
    ctx.font = `700 28px ${SANS_FONT}`;
    ctx.fillStyle = '#4c1d95';
    for (const line of lines) {
      ctx.fillText(line, innerX, cursorY.value);
      cursorY.value += lineHeight;
    }
    cursorY.value += 10;
    return;
  }

  if (block.kind === 'bullet') {
    activePage.ctx.font = `400 25px ${SANS_FONT}`;
    const bulletIndent = 28;
    const lines = wrapTextLines(
      activePage.ctx,
      block.text,
      innerWidth - bulletIndent
    );
    const lineHeight = 36;

    for (let idx = 0; idx < lines.length; idx++) {
      ensureSpace(lineHeight + 6);
      activePage = pages[pages.length - 1];
      const ctx = activePage.ctx;
      ctx.font = `400 25px ${SANS_FONT}`;
      ctx.fillStyle = isUser ? '#1e1b4b' : '#1e293b';
      if (idx === 0) {
        ctx.fillStyle = '#7c3aed';
        ctx.fillText('•', innerX + 4, cursorY.value);
        ctx.fillStyle = '#1e293b';
      }
      ctx.fillText(lines[idx], innerX + bulletIndent, cursorY.value);
      cursorY.value += lineHeight;
    }
    cursorY.value += 8;
    return;
  }

  // Paragraph
  activePage.ctx.font = `400 25px ${SANS_FONT}`;
  const lines = wrapTextLines(activePage.ctx, block.text, innerWidth);
  const lineHeight = 36;
  for (const line of lines) {
    ensureSpace(lineHeight + 4);
    activePage = pages[pages.length - 1];
    const ctx = activePage.ctx;
    ctx.font = `400 25px ${SANS_FONT}`;
    ctx.fillStyle = isUser ? '#1e1b4b' : '#1e293b';
    ctx.fillText(line, innerX, cursorY.value);
    cursorY.value += lineHeight;
  }
  cursorY.value += 10;
}

export async function exportConversationToPdf(
  conversation: Conversation,
  modeLabel: string
): Promise<string> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const docData = buildPdfExportData(conversation, modeLabel);
  if (docData.messages.length === 0) {
    throw new Error('There are no messages in this conversation to export.');
  }

  const pages: CanvasPage[] = [createCanvasPage()];
  const cursorY = { value: drawDocumentHeader(pages[0].ctx, docData) };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY.value + neededHeight > BOTTOM_MARGIN) {
      pages.push(createCanvasPage());
      cursorY.value = TOP_MARGIN;
    }
  };

  for (const msg of docData.messages) {
    const isUser = msg.role === 'user';

    // Keep message role header attached to at least first line of content
    ensureSpace(96);
    let activePage = pages[pages.length - 1];
    let ctx = activePage.ctx;

    // Role banner
    drawRoundedRect(ctx, MARGIN_X, cursorY.value, CONTENT_WIDTH, 46, 12);
    ctx.fillStyle = isUser ? '#f3e8ff' : '#f8fafc';
    ctx.fill();

    // Left accent strip
    drawRoundedRect(ctx, MARGIN_X, cursorY.value, 8, 46, 4);
    ctx.fillStyle = msg.isError
      ? '#e11d48'
      : isUser
        ? '#7c3aed'
        : '#2563eb';
    ctx.fill();

    ctx.font = `700 22px ${SANS_FONT}`;
    ctx.fillStyle = msg.isError
      ? '#be123c'
      : isUser
        ? '#5b21b6'
        : '#1d4ed8';
    ctx.fillText(msg.roleLabel, MARGIN_X + 24, cursorY.value + 11);

    ctx.font = `500 18px ${SANS_FONT}`;
    ctx.fillStyle = '#64748b';
    const tsWidth = ctx.measureText(msg.timestampLabel).width;
    ctx.fillText(
      msg.timestampLabel,
      MARGIN_X + CONTENT_WIDTH - 20 - tsWidth,
      cursorY.value + 13
    );

    cursorY.value += 60;

    // Attachment chips summary
    if (msg.attachments.length > 0) {
      for (const attLabel of msg.attachments) {
        ensureSpace(40);
        activePage = pages[pages.length - 1];
        ctx = activePage.ctx;
        ctx.font = `600 20px ${SANS_FONT}`;
        ctx.fillStyle = '#6d28d9';
        ctx.fillText(`[${attLabel}]`, MARGIN_X + 28, cursorY.value);
        cursorY.value += 32;
      }
      cursorY.value += 6;
    }

    // Message blocks
    for (const block of msg.blocks) {
      renderBlockOnPages(pages, cursorY, block, isUser);
    }

    // Sources
    if (msg.sources.length > 0) {
      ensureSpace(64);
      activePage = pages[pages.length - 1];
      ctx = activePage.ctx;
      ctx.font = `700 20px ${SANS_FONT}`;
      ctx.fillStyle = '#475569';
      ctx.fillText('Sources:', MARGIN_X + 28, cursorY.value);
      cursorY.value += 30;

      for (const src of msg.sources) {
        ctx.font = `400 20px ${SANS_FONT}`;
        const lines = wrapTextLines(
          ctx,
          `${src.title} — ${src.uri}`,
          CONTENT_WIDTH - 64
        );
        for (const line of lines) {
          ensureSpace(30);
          activePage = pages[pages.length - 1];
          ctx = activePage.ctx;
          ctx.font = `400 20px ${SANS_FONT}`;
          ctx.fillStyle = '#2563eb';
          ctx.fillText(line, MARGIN_X + 36, cursorY.value);
          cursorY.value += 28;
        }
      }
      cursorY.value += 8;
    }

    // Spacer between messages
    cursorY.value += 18;
  }

  // Draw footers on all pages
  const totalPages = pages.length;
  for (let idx = 0; idx < totalPages; idx++) {
    const { ctx } = pages[idx];
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, CANVAS_HEIGHT - 60);
    ctx.lineTo(MARGIN_X + CONTENT_WIDTH, CANVAS_HEIGHT - 60);
    ctx.stroke();

    ctx.font = `500 18px ${SANS_FONT}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Exported from Riva AI', MARGIN_X, CANVAS_HEIGHT - 46);

    const pageText = `Page ${idx + 1} of ${totalPages}`;
    const pageTextWidth = ctx.measureText(pageText).width;
    ctx.fillText(
      pageText,
      MARGIN_X + CONTENT_WIDTH - pageTextWidth,
      CANVAS_HEIGHT - 46
    );
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  for (let idx = 0; idx < totalPages; idx++) {
    if (idx > 0) {
      pdf.addPage('a4', 'portrait');
    }
    const dataUrl = pages[idx].canvas.toDataURL('image/png');
    pdf.addImage(dataUrl, 'PNG', 0, 0, PAGE_WIDTH_PT, PAGE_HEIGHT_PT, undefined, 'FAST');
  }

  pdf.save(docData.filename);
  return docData.filename;
}
