/**
 * How many of each question type a set should contain, and in what order.
 *
 * Import-free and pure, like owner.ts and levels.ts, so the distribution is
 * unit-testable without a model call.
 *
 * **Why this exists.** The prompt used to say "mix the types roughly evenly",
 * and the model read "evenly" as round-robin: MCQ, true/false, short answer,
 * MCQ, true/false, short answer, all the way down. Predictable, and it made
 * a third of every set true/false — which is the cheapest question type to
 * guess and the least informative to grade.
 *
 * Asking a model more nicely does not fix a distribution. The sequence is
 * decided here and handed to the generator as an instruction per slot, so the
 * mix is a property of the code rather than a hope about the prompt.
 */

export type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";

/**
 * Target share per type when all three are on the table.
 *
 * MCQ leads because it carries the most signal per second of a candidate's
 * time. True/false is deliberately the smallest slice: a coin flip scores 50%,
 * so a set full of them measures luck.
 */
const BASE_WEIGHT: Record<QuestionType, number> = {
  MCQ: 0.55,
  SHORT_ANSWER: 0.25,
  TRUE_FALSE: 0.2,
};

/**
 * How far a single generation may drift from those shares. This is what makes
 * two sets on the same settings feel different — one comes back heavier on
 * short answers, the next heavier on MCQ — without any set going lopsided.
 */
const JITTER = 0.08;

/** True/false never exceeds this share while another type is available. */
const TRUE_FALSE_CEILING = 0.25;

/** …and MCQ is never beaten by another type when MCQ is selected. */
const MCQ_FLOOR = 0.4;

/** Longest run of one type before the shuffle breaks it up. */
const MAX_RUN = 3;

type Rand = () => number;

/**
 * The per-type target counts for a set.
 *
 * Exported for the tests and for callers that want the shape without the
 * order; `planTypeMix` is what generation actually uses.
 */
export function targetCounts(
  types: QuestionType[],
  count: number,
  rand: Rand = Math.random,
): Record<QuestionType, number> {
  const selected = dedupe(types);
  const result: Record<QuestionType, number> = {
    MCQ: 0,
    TRUE_FALSE: 0,
    SHORT_ANSWER: 0,
  };

  if (selected.length === 0 || count <= 0) return result;

  // One type selected: the whole set is that type, ceilings included. If
  // someone asks for twenty true/false questions, that is what they meant.
  if (selected.length === 1) {
    result[selected[0]] = count;
    return result;
  }

  const weights = new Map<QuestionType, number>();
  for (const type of selected) {
    const jitter = (rand() * 2 - 1) * JITTER;
    weights.set(type, Math.max(0.05, BASE_WEIGHT[type] + jitter));
  }

  normalise(weights);

  // Both rules exist to stop true/false crowding out the type that carries
  // real signal — so both are conditional on MCQ actually being available to
  // crowd. Asked for true/false and short answer only, the operator has said
  // what they want and gets a straight split between the two.
  if (weights.has("MCQ")) {
    clamp(weights, "TRUE_FALSE", TRUE_FALSE_CEILING);
    floorAndLead(weights, "MCQ", MCQ_FLOOR);
  }

  // Largest-remainder allocation: proportional, and the parts sum to `count`
  // exactly rather than to count ± rounding.
  const exact = selected.map((type) => ({
    type,
    exact: (weights.get(type) ?? 0) * count,
  }));

  let assigned = 0;
  for (const item of exact) {
    const floor = Math.floor(item.exact);
    result[item.type] = floor;
    assigned += floor;
  }

  const remainders = exact
    .map((item) => ({
      type: item.type,
      frac: item.exact - Math.floor(item.exact),
    }))
    .sort((a, b) => b.frac - a.frac);

  let leftover = count - assigned;
  let i = 0;
  while (leftover > 0) {
    result[remainders[i % remainders.length].type]++;
    leftover--;
    i++;
  }

  // Every selected type earns at least one slot when the set is big enough to
  // afford it — a "mixed" set that silently contains none of a chosen type is
  // not what was asked for.
  ensureRepresented(result, selected, count);

  return result;
}

/**
 * The ordered sequence handed to the generator: `count` entries, shuffled, with
 * no run longer than MAX_RUN.
 *
 * Shuffled rather than patterned — that is the whole point — but a pure shuffle
 * of a 60% type will occasionally deal six MCQs in a row, which reads as a bug
 * to whoever is answering. Capping the run keeps it random-feeling without
 * making it predictable.
 */
export function planTypeMix(
  types: QuestionType[],
  count: number,
  rand: Rand = Math.random,
): QuestionType[] {
  const remaining = targetCounts(types, count, rand);
  const order: QuestionType[] = [];

  // Drawn one slot at a time rather than shuffled-then-repaired. Repairing a
  // shuffle by swapping is where the first attempt went wrong: a swap can
  // create a fresh run somewhere the scan has already passed. Choosing each
  // slot from what is still legal cannot produce a violation in the first
  // place.
  for (let i = 0; i < count; i++) {
    const available = (
      ["MCQ", "TRUE_FALSE", "SHORT_ANSWER"] as QuestionType[]
    ).filter((type) => remaining[type] > 0);
    if (available.length === 0) break;

    const slotsLeft = count - i;
    const legal = available.filter((type) => !wouldExceedRun(order, type));

    // Not enough to pick something legal now — it must also leave the rest
    // schedulable. Without this the draw spends the big pile too slowly and
    // strands it: a 20-question set would end ...MMMMM, which is the very
    // clumping the run limit exists to prevent.
    const safe = legal.filter((type) =>
      keepsFeasible(remaining, type, slotsLeft),
    );

    // Genuinely infeasible (a single-type set) — the count is the promise, the
    // run limit only a preference, so the count wins.
    const pool = safe.length > 0 ? safe : legal.length > 0 ? legal : available;

    const chosen = weightedPick(pool, remaining, rand);
    order.push(chosen);
    remaining[chosen]--;
  }

  return order;
}

/**
 * After taking `chosen`, can everything left still be laid out without a run
 * longer than MAX_RUN?
 *
 * `n` items of one type need at least ceil(n / MAX_RUN) - 1 separators between
 * them, so the type fits when its count is within MAX_RUN × (gaps + 1).
 */
function keepsFeasible(
  remaining: Record<QuestionType, number>,
  chosen: QuestionType,
  slotsLeft: number,
): boolean {
  const after = { ...remaining, [chosen]: remaining[chosen] - 1 };
  const slots = slotsLeft - 1;

  for (const type of ["MCQ", "TRUE_FALSE", "SHORT_ANSWER"] as QuestionType[]) {
    const own = after[type];
    if (own === 0) continue;
    const others = slots - own;
    if (own > MAX_RUN * (others + 1)) return false;
  }
  return true;
}

/** Would appending `type` make a run longer than MAX_RUN? */
function wouldExceedRun(order: QuestionType[], type: QuestionType): boolean {
  if (order.length < MAX_RUN) return false;
  for (let i = order.length - MAX_RUN; i < order.length; i++) {
    if (order[i] !== type) return false;
  }
  return true;
}

/**
 * Pick from `pool` in proportion to how many of each type are still owed.
 *
 * Weighted rather than uniform so the big pile drains steadily instead of
 * being left as an unavoidable block at the end — which is precisely the
 * situation that would force a long run.
 */
function weightedPick(
  pool: QuestionType[],
  remaining: Record<QuestionType, number>,
  rand: Rand,
): QuestionType {
  const total = pool.reduce((sum, type) => sum + remaining[type], 0);
  let roll = rand() * total;
  for (const type of pool) {
    roll -= remaining[type];
    if (roll <= 0) return type;
  }
  return pool[pool.length - 1];
}

// ---------------------------------------------------------------------------

function dedupe(types: QuestionType[]): QuestionType[] {
  const seen = new Set<QuestionType>();
  const out: QuestionType[] = [];
  for (const type of types) {
    if (type in BASE_WEIGHT && !seen.has(type)) {
      seen.add(type);
      out.push(type);
    }
  }
  return out;
}

function normalise(weights: Map<QuestionType, number>): void {
  let total = 0;
  for (const value of weights.values()) total += value;
  if (total <= 0) return;
  for (const [key, value] of weights) weights.set(key, value / total);
}

/** Trim a type to a ceiling and spread what it gave up across the others. */
function clamp(
  weights: Map<QuestionType, number>,
  type: QuestionType,
  ceiling: number,
): void {
  const current = weights.get(type) ?? 0;
  if (current <= ceiling) return;

  const excess = current - ceiling;
  weights.set(type, ceiling);

  const others = [...weights.keys()].filter((key) => key !== type);
  const otherTotal = others.reduce(
    (sum, key) => sum + (weights.get(key) ?? 0),
    0,
  );
  if (otherTotal <= 0) return;

  for (const key of others) {
    const share = (weights.get(key) ?? 0) / otherTotal;
    weights.set(key, (weights.get(key) ?? 0) + excess * share);
  }
}

/**
 * Guarantee a type both clears a floor and outranks every other type, taking
 * what it needs proportionally from the rest.
 */
function floorAndLead(
  weights: Map<QuestionType, number>,
  type: QuestionType,
  floor: number,
): void {
  const others = [...weights.keys()].filter((key) => key !== type);
  const highestOther = Math.max(
    ...others.map((key) => weights.get(key) ?? 0),
    0,
  );
  // A hair above, so a tie never leaves the lead ambiguous after rounding.
  const target = Math.max(floor, highestOther + 0.05);
  const current = weights.get(type) ?? 0;
  if (current >= target) return;

  const deficit = target - current;
  const otherTotal = others.reduce(
    (sum, key) => sum + (weights.get(key) ?? 0),
    0,
  );
  if (otherTotal <= 0) return;

  weights.set(type, target);
  for (const key of others) {
    const share = (weights.get(key) ?? 0) / otherTotal;
    weights.set(key, Math.max(0, (weights.get(key) ?? 0) - deficit * share));
  }
  normalise(weights);
}

/** Give every selected type at least one slot, taken from the largest. */
function ensureRepresented(
  result: Record<QuestionType, number>,
  selected: QuestionType[],
  count: number,
): void {
  if (count < selected.length) return;

  for (const type of selected) {
    if (result[type] > 0) continue;

    const donor = selected
      .filter((other) => other !== type)
      .sort((a, b) => result[b] - result[a])[0];
    if (donor && result[donor] > 1) {
      result[donor]--;
      result[type]++;
    }
  }
}
