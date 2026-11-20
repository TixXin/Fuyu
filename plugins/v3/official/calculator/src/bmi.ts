export type BmiStandard = "cn" | "who";
export type BmiLevel = "under" | "normal" | "over" | "obese";

const LIMITS: Record<BmiStandard, [number, number, number]> = {
  cn: [18.5, 24, 28],
  who: [18.5, 25, 30],
};

export function bmiOf(heightCm: number, weightKg: number): number | null {
  if (!(heightCm > 0) || !(weightKg > 0)) return null;
  const meters = heightCm / 100;
  return weightKg / (meters * meters);
}

export function bmiLevel(bmi: number, standard: BmiStandard): BmiLevel {
  const [under, over, obese] = LIMITS[standard];
  if (bmi < under) return "under";
  if (bmi < over) return "normal";
  if (bmi < obese) return "over";
  return "obese";
}

export function healthyRange(heightCm: number, standard: BmiStandard): [number, number] {
  const meters = heightCm / 100;
  const [under, over] = LIMITS[standard];
  return [under * meters * meters, over * meters * meters];
}

export function bmiLimits(standard: BmiStandard): [number, number, number] {
  return LIMITS[standard];
}
