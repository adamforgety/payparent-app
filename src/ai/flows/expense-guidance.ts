'use server';

/**
 * @fileOverview Provides AI-driven recommendations on appropriate and fair monthly expenses for a child.
 *
 * - getExpenseGuidance - A function that returns expense guidance based on user input.
 * - ExpenseGuidanceInput - The input type for the getExpenseGuidance function.
 * - ExpenseGuidanceOutput - The return type for the getExpenseGuidance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExpenseGuidanceInputSchema = z.object({
  childAge: z.number().describe('The age of the child in years.'),
  location: z.string().describe('The general location where the child lives (e.g., city, state).'),
  currentMonthlyExpenses: z
    .number()
    .describe('The current total monthly expenses for the child.'),
  parent1Income: z.number().describe('The monthly income of parent 1.'),
  parent2Income: z.number().describe('The monthly income of parent 2.'),
});
export type ExpenseGuidanceInput = z.infer<typeof ExpenseGuidanceInputSchema>;

const ExpenseGuidanceOutputSchema = z.object({
  recommendedMonthlyExpenses: z
    .number()
    .describe('The AI-recommended fair monthly expenses for the child.'),
  reasoning: z.string().describe('The AI reasoning behind the expense recommendation.'),
});
export type ExpenseGuidanceOutput = z.infer<typeof ExpenseGuidanceOutputSchema>;

export async function getExpenseGuidance(input: ExpenseGuidanceInput): Promise<ExpenseGuidanceOutput> {
  return expenseGuidanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'expenseGuidancePrompt',
  input: {schema: ExpenseGuidanceInputSchema},
  output: {schema: ExpenseGuidanceOutputSchema},
  prompt: `You are an AI financial advisor specializing in child expenses for divorced parents. Given the following information, provide a recommendation for fair monthly expenses for the child. Consider factors like the child's age, location, current expenses, and the parents' income.

Child's Age: {{{childAge}}}
Location: {{{location}}}
Current Monthly Expenses: {{{currentMonthlyExpenses}}}
Parent 1 Income: {{{parent1Income}}}
Parent 2 Income: {{{parent2Income}}}

Provide a recommended monthly expense amount and explain your reasoning. The recommendation must be a number. The reasoning must be less than 200 words.

Here is the desired format:
{
  "recommendedMonthlyExpenses": "number",
  "reasoning": "string"
}
`,
});

const expenseGuidanceFlow = ai.defineFlow(
  {
    name: 'expenseGuidanceFlow',
    inputSchema: ExpenseGuidanceInputSchema,
    outputSchema: ExpenseGuidanceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
