const MIN_STEP = 0.01;

export function niceTicks(maxValue: number, targetTickCount = 4): number[] {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return [0];
  }

  const roughStep = maxValue / targetTickCount;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalised = roughStep / magnitude;

  const niceNormalised = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  const step = Math.max(MIN_STEP, niceNormalised * magnitude);

  const lastIndex = Math.floor(maxValue / step + 1e-9) + 1;
  const ticks: number[] = [];

  for (let index = 0; index <= lastIndex; index++) {
    ticks.push(Number((index * step).toFixed(10)));
  }

  return ticks;
}
