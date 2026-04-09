import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  Packer,
} from 'docx';
import type { ThresholdRecommendation } from './types';
import { formatNumber, formatDate } from './utils';

interface DocxParams {
  handle: string;
  campaignStartDate: string;
  campaignEndDate: string;
  query: string;
  lookbackQuery?: string;
  seasonality: string;
  thresholds: ThresholdRecommendation;
  originalThresholds?: ThresholdRecommendation | null;
  isModified: boolean;
  totalBudget: number;
  estimatedTrendDays: number;
  recommendedMaxDailySpend: number;
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function makeRow(label: string, value: string): TableRow {
  const borderNone = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  } as const;

  return new TableRow({
    children: [
      new TableCell({
        borders: borderNone,
        width: { size: 3000, type: WidthType.DXA },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })],
      }),
      new TableCell({
        borders: borderNone,
        width: { size: 6000, type: WidthType.DXA },
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 20 })] })],
      }),
    ],
  });
}

export async function generateDocx(params: DocxParams): Promise<Blob> {
  const {
    handle,
    campaignStartDate,
    campaignEndDate,
    query,
    lookbackQuery,
    seasonality,
    thresholds,
    originalThresholds,
    isModified,
    totalBudget,
    estimatedTrendDays,
    recommendedMaxDailySpend,
  } = params;

  const sections: Paragraph[] = [];

  // Title
  sections.push(
    new Paragraph({
      text: 'Trend Genius Configuration',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  // Campaign Details heading
  sections.push(
    new Paragraph({
      text: 'Campaign Details',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 100 },
    })
  );

  const detailsTable = new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      makeRow('Handle', `@${handle}`),
      makeRow('Campaign Period', `${formatDate(campaignStartDate)} — ${formatDate(campaignEndDate)}`),
      makeRow('Search Query', query),
      ...(lookbackQuery && lookbackQuery !== query
        ? [makeRow('Lookback Query', lookbackQuery)]
        : []),
      makeRow('Seasonality', seasonality),
    ],
  });
  sections.push(new Paragraph({ children: [] })); // spacer

  // Thresholds heading
  const thresholdsHeading = new Paragraph({
    text: 'Thresholds',
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 100 },
  });

  const thresholdsTable = new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      makeRow('ON Threshold', `${formatNumber(thresholds.onThreshold)} posts/hour`),
      makeRow('OFF Threshold', `${formatNumber(thresholds.offThreshold)} posts/hour`),
      makeRow('Consecutive Hours', `${thresholds.consecutiveHours}`),
      makeRow('Confidence', thresholds.confidence),
    ],
  });

  // Volume Stats
  const statsHeading = new Paragraph({
    text: 'Volume Statistics',
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 100 },
  });

  const statsTable = new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      makeRow('Avg Hourly Volume', `${formatNumber(thresholds.avgHourlyVolume)}/hr`),
      makeRow('Median Hourly Volume', `${formatNumber(thresholds.medianHourlyVolume)}/hr`),
      makeRow('Std Deviation', formatNumber(thresholds.stdDeviation)),
    ],
  });

  // Budget
  const budgetHeading = new Paragraph({
    text: 'Budget',
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 100 },
  });

  const budgetTable = new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      makeRow('Total Budget', formatCurrency(totalBudget)),
      makeRow('Est. Trend Days', `${estimatedTrendDays}`),
      makeRow('Max Daily Spend', formatCurrency(recommendedMaxDailySpend)),
    ],
  });

  // Analysis
  const analysisHeading = new Paragraph({
    text: 'Analysis',
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 100 },
  });

  const analysisParagraphs = [
    new Paragraph({
      children: [new TextRun({ text: 'Threshold Reasoning', bold: true, size: 20 })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: thresholds.reasoning, size: 20 })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Budget Allocation', bold: true, size: 20 })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: thresholds.budgetReasoning, size: 20 })],
      spacing: { after: 200 },
    }),
  ];

  // Peak Hours
  const peakHoursParagraphs: Paragraph[] = [];
  if (thresholds.peakHours.length > 0) {
    peakHoursParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: 'Peak Hours: ', bold: true, size: 20 }), new TextRun({ text: thresholds.peakHours.join(', '), size: 20 })],
        spacing: { after: 200 },
      })
    );
  }

  // Grok Original (if modified)
  const grokOriginalChildren: (Paragraph | Table)[] = [];
  if (isModified && originalThresholds) {
    grokOriginalChildren.push(
      new Paragraph({
        text: 'Grok Original Recommendation',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
      }),
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          makeRow('ON Threshold', `${formatNumber(originalThresholds.onThreshold)} posts/hour`),
          makeRow('OFF Threshold', `${formatNumber(originalThresholds.offThreshold)} posts/hour`),
          makeRow('Consecutive Hours', `${originalThresholds.consecutiveHours}`),
          makeRow('Est. Trend Days', `${originalThresholds.estimatedTrendDays}`),
          makeRow('Max Daily Spend', formatCurrency(originalThresholds.recommendedMaxDailySpend)),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        children: [
          ...sections,
          detailsTable,
          thresholdsHeading,
          thresholdsTable,
          statsHeading,
          statsTable,
          budgetHeading,
          budgetTable,
          analysisHeading,
          ...analysisParagraphs,
          ...peakHoursParagraphs,
          ...grokOriginalChildren,
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}
