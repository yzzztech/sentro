import { evaluateAlertRules } from "@/lib/alerts/evaluator";

export async function runAlertCheck(): Promise<void> {
  await evaluateAlertRules();
}
