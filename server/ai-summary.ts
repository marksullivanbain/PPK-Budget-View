import OpenAI from "openai";
import { PORTKEY_GATEWAY_URL, createHeaders } from "portkey-ai";

function createClient(): OpenAI | null {
  try {
    if (process.env.PORTKEY_API_KEY) {
      console.log("Using Portkey gateway for AI summary");
      return new OpenAI({
        apiKey: "X",
        baseURL: PORTKEY_GATEWAY_URL,
        defaultHeaders: createHeaders({
          apiKey: process.env.PORTKEY_API_KEY,
          virtualKey: "openai---ppk-co-d2757e",
        }),
      });
    }
    if (process.env.OPENAI_API_KEY) {
      console.log("Using direct OpenAI for AI summary");
      return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  } catch (e) {
    console.log("Failed to create AI client:", e);
  }
  console.log("No AI provider configured, using rule-based summaries");
  return null;
}

const openai = createClient();

interface SpendCategory {
  categoryName: string;
  actual: number;
  budget: number;
  variance: number;
  isOverBudget: boolean;
  percentUsed: number;
}

interface TopExpense {
  account: string;
  amount: number;
  caseName?: string;
}

interface TopVendor {
  vendorName: string;
  totalAmount: number;
  invoiceCount: number;
  topCaseCode?: string;
  topCaseName?: string;
}

interface SummaryInput {
  practiceName: string;
  periodLabel: string;
  vendorMonthLabel: string;
  totalSpend: number;
  totalBudget: number;
  variance: number;
  isUnderBudget: boolean;
  spendTypeBreakdown: SpendCategory[];
  topExpenses: TopExpense[];
  compensationBreakdown: TopExpense[];
  topVendors: TopVendor[];
}

function consolidateCategories(breakdown: SpendCategory[]): SpendCategory[] {
  const programCategories = ['IP', 'General'];
  const toMerge = breakdown.filter(c => programCategories.includes(c.categoryName));
  const rest = breakdown.filter(c => !programCategories.includes(c.categoryName));

  if (toMerge.length > 0) {
    const merged: SpendCategory = {
      categoryName: 'Programs',
      actual: toMerge.reduce((sum, c) => sum + c.actual, 0),
      budget: toMerge.reduce((sum, c) => sum + c.budget, 0),
      variance: 0,
      isOverBudget: false,
      percentUsed: 0,
    };
    merged.variance = merged.actual - merged.budget;
    merged.isOverBudget = merged.variance > 0;
    merged.percentUsed = merged.budget > 0 ? Math.round((merged.actual / merged.budget) * 100) : (merged.actual > 0 ? 100 : 0);
    rest.push(merged);
  }

  return rest;
}

export async function generateVarianceSummary(input: SummaryInput): Promise<string> {
  const consolidated = {
    ...input,
    spendTypeBreakdown: consolidateCategories(input.spendTypeBreakdown),
  };

  if (openai) {
    try {
      return await generateAISummary(consolidated);
    } catch (error: any) {
      console.log("AI summary failed, falling back to rule-based:", error?.message || error);
    }
  }
  return generateRuleBasedSummary(consolidated);
}

async function generateAISummary(input: SummaryInput): Promise<string> {
  const prompt = buildPrompt(input);

  const response = await openai!.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: "You are a concise financial analyst for an internal cost center management team. Generate a 3-4 sentence natural-language summary of a practice's budget performance. Be specific about dollar amounts (use $K or $M format), name the specific spend categories driving variances, and highlight any notable outliers. Include a mention of the top vendor(s) and what they were charged to. Use a professional but conversational tone. Do not use bullet points or lists — write flowing sentences."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_completion_tokens: 400,
  });

  return response.choices[0].message.content || "Unable to generate summary.";
}

function generateRuleBasedSummary(input: SummaryInput): string {
  const dir = input.isUnderBudget ? "under" : "over";
  const varAmt = formatDollar(Math.abs(input.variance));
  const budgetPct = input.totalBudget > 0 ? Math.round((input.totalSpend / input.totalBudget) * 100) : 0;

  const overBudgetCats = input.spendTypeBreakdown
    .filter(c => c.isOverBudget && Math.abs(c.variance) > 1000)
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  const underBudgetCats = input.spendTypeBreakdown
    .filter(c => !c.isOverBudget && Math.abs(c.variance) > 1000)
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  let sentences: string[] = [];

  sentences.push(
    `${input.practiceName} has spent ${formatDollar(input.totalSpend)} through ${input.periodLabel}, which is ${varAmt} ${dir} the ${formatDollar(input.totalBudget)} budget (${budgetPct}% utilized).`
  );

  if (overBudgetCats.length > 0) {
    const topOver = overBudgetCats.slice(0, 2);
    const overParts = topOver.map(c =>
      `${c.categoryName} (${formatDollar(Math.abs(c.variance))} over, ${c.percentUsed}% of budget)`
    );
    sentences.push(
      `Key areas of overspend include ${overParts.join(" and ")}.`
    );
  }

  if (underBudgetCats.length > 0 && overBudgetCats.length === 0) {
    const topUnder = underBudgetCats.slice(0, 2);
    const underParts = topUnder.map(c =>
      `${c.categoryName} (${formatDollar(Math.abs(c.variance))} under budget)`
    );
    sentences.push(
      `Savings are driven by ${underParts.join(" and ")}.`
    );
  } else if (underBudgetCats.length > 0 && overBudgetCats.length > 0) {
    const topUnder = underBudgetCats[0];
    sentences.push(
      `This is partially offset by ${topUnder.categoryName} savings of ${formatDollar(Math.abs(topUnder.variance))}.`
    );
  }

  if (input.topVendors.length > 0) {
    const monthNote = input.vendorMonthLabel ? `In ${input.vendorMonthLabel}, the` : 'The';
    const topVendors = input.topVendors.slice(0, 2);
    if (topVendors.length === 1) {
      const v = topVendors[0];
      const caseInfo = v.topCaseName ? `, charged to ${v.topCaseName} (${v.topCaseCode})` : '';
      sentences.push(
        `${monthNote} largest vendor invoices were from ${v.vendorName} totaling ${formatDollar(v.totalAmount)} across ${v.invoiceCount} invoice${v.invoiceCount !== 1 ? 's' : ''}${caseInfo}.`
      );
    } else {
      const v1 = topVendors[0];
      const v2 = topVendors[1];
      const v1Case = v1.topCaseName ? ` (${v1.topCaseName}${v1.topCaseCode ? ', ' + v1.topCaseCode : ''})` : '';
      const v2Case = v2.topCaseName ? ` (${v2.topCaseName}${v2.topCaseCode ? ', ' + v2.topCaseCode : ''})` : '';
      sentences.push(
        `${monthNote} largest vendor invoices were from ${v1.vendorName} at ${formatDollar(v1.totalAmount)}${v1Case} and ${v2.vendorName} at ${formatDollar(v2.totalAmount)}${v2Case}.`
      );
    }
  } else if (input.topExpenses.length > 0) {
    const topExp = input.topExpenses[0];
    const expName = topExp.caseName || topExp.account;
    sentences.push(
      `The largest program expense is ${expName} at ${formatDollar(topExp.amount)}.`
    );
  }

  const varianceSentences = sentences.slice(0, -1);
  const vendorSentence = sentences.length > 1 ? sentences[sentences.length - 1] : null;

  if (vendorSentence && varianceSentences.length > 0) {
    return varianceSentences.join(" ") + "\n\n" + vendorSentence;
  }
  return sentences.join(" ");
}

function buildPrompt(input: SummaryInput): string {
  const dir = input.isUnderBudget ? "under" : "over";
  const varAmt = formatDollar(Math.abs(input.variance));

  let prompt = `Practice: ${input.practiceName}\n`;
  prompt += `Period: ${input.periodLabel}\n`;
  prompt += `Total Spend: ${formatDollar(input.totalSpend)} | Budget: ${formatDollar(input.totalBudget)} | ${dir} budget by ${varAmt}\n\n`;

  prompt += `Spend by Category:\n`;
  for (const cat of input.spendTypeBreakdown) {
    const catDir = cat.isOverBudget ? "over" : "under";
    prompt += `- ${cat.categoryName}: Actual ${formatDollar(cat.actual)} vs Budget ${formatDollar(cat.budget)} (${catDir} by ${formatDollar(Math.abs(cat.variance))}, ${cat.percentUsed}% used)\n`;
  }

  if (input.compensationBreakdown.length > 0) {
    prompt += `\nCompensation breakdown:\n`;
    for (const comp of input.compensationBreakdown.slice(0, 5)) {
      prompt += `- ${comp.account}: ${formatDollar(comp.amount)}\n`;
    }
  }

  if (input.topExpenses.length > 0) {
    prompt += `\nTop program expenses:\n`;
    for (const exp of input.topExpenses.slice(0, 8)) {
      prompt += `- ${exp.caseName || exp.account}: ${formatDollar(exp.amount)}\n`;
    }
  }

  if (input.topVendors.length > 0) {
    const vendorMonth = input.vendorMonthLabel || 'the current period';
    prompt += `\nTop vendors by spend (${vendorMonth} only):\n`;
    for (const v of input.topVendors.slice(0, 5)) {
      const caseInfo = v.topCaseName ? ` charged to ${v.topCaseName} (${v.topCaseCode})` : '';
      prompt += `- ${v.vendorName}: ${formatDollar(v.totalAmount)} across ${v.invoiceCount} invoices${caseInfo}\n`;
    }
  }

  prompt += `\nProvide a 3-4 sentence insight about this practice's budget performance, highlighting the key drivers of variance, notable vendor spend patterns, and any outliers.`;

  return prompt;
}

function formatDollar(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (abs >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}
