const DEFAULT_ATS_PERIOD_LIMIT = 1000;

export function atsPeriodLimit(): number {
  const configured =
    process.env.ATS_PERIOD_LIMIT ?? process.env.ATS_CLOUD_PERIOD_LIMIT;
  const value = Number(configured);
  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_ATS_PERIOD_LIMIT;
  }
  return Math.trunc(value);
}
