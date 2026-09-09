/**
 * Shared by the Discord /setup labels command, the admin API's config route, and the admin
 * dashboard, so "what counts as a valid label list" and "what counts as a conflict" behave
 * identically no matter which surface someone uses to change it.
 */

export function normalizeLabelList(input: string): string[] {
  return input
    .split(",")
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
}

/**
 * Labels present (case-insensitively) in both lists — ambiguous, since messageForGithubEvent
 * would match either. Returns each conflicting label at most once, in its `backlogLabels` casing.
 */
export function findLabelConflicts(backlogLabels: string[], inProgressLabels: string[]): string[] {
  const inProgressLower = new Set(inProgressLabels.map((label) => label.toLowerCase()));
  const conflicts: string[] = [];
  const seen = new Set<string>();

  for (const label of backlogLabels) {
    const lower = label.toLowerCase();
    if (inProgressLower.has(lower) && !seen.has(lower)) {
      seen.add(lower);
      conflicts.push(label);
    }
  }

  return conflicts;
}
