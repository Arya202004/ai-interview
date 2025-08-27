export interface Viseme {
  time: number; // seconds from start
  shape: string; // normalized name
  weight?: number; // 0..1 intensity
  duration?: number; // seconds duration until next viseme
}

const visemeMap: { [key: string]: { shape: string; baseWeight: number; baseDuration: number } } = {
  a: { shape: 'jawOpen', baseWeight: 0.9, baseDuration: 0.11 },
  i: { shape: 'jawOpen', baseWeight: 0.75, baseDuration: 0.09 },
  u: { shape: 'jawOpen', baseWeight: 0.8, baseDuration: 0.1 },
  e: { shape: 'mouthSmile', baseWeight: 0.7, baseDuration: 0.1 },
  o: { shape: 'mouthFunnel', baseWeight: 0.85, baseDuration: 0.12 },
  b: { shape: 'mouthClose', baseWeight: 0.6, baseDuration: 0.06 },
  m: { shape: 'mouthClose', baseWeight: 0.65, baseDuration: 0.08 },
  p: { shape: 'mouthClose', baseWeight: 0.6, baseDuration: 0.06 },
  f: { shape: 'mouthPucker', baseWeight: 0.7, baseDuration: 0.08 },
  v: { shape: 'mouthPucker', baseWeight: 0.75, baseDuration: 0.08 },
  t: { shape: 'jawOpen', baseWeight: 0.65, baseDuration: 0.07 },
  d: { shape: 'jawOpen', baseWeight: 0.65, baseDuration: 0.07 },
  s: { shape: 'mouthSmile', baseWeight: 0.65, baseDuration: 0.09 },
  r: { shape: 'mouthSmile', baseWeight: 0.55, baseDuration: 0.09 },
  l: { shape: 'mouthSmile', baseWeight: 0.6, baseDuration: 0.08 },
  default: { shape: 'mouthClose', baseWeight: 0.5, baseDuration: 0.06 },
};

export function generateVisemes(text: string): Viseme[] {
  const visemes: Viseme[] = [];
  let currentTime = 0.0;
  const words = text.split(/\s+/).filter(Boolean);

  for (const word of words) {
    const letters = Array.from(word);
    for (let i = 0; i < letters.length; i++) {
      const char = letters[i].toLowerCase();
      const spec = visemeMap[char] || visemeMap.default;
      const duration = spec.baseDuration;
      const weight = spec.baseWeight;
      visemes.push({ time: currentTime, shape: spec.shape, weight, duration });
      currentTime += duration;
    }
    // brief closure between words
    visemes.push({ time: currentTime, shape: 'mouthClose', weight: 0.4, duration: 0.08 });
    currentTime += 0.08;
  }
  return visemes;
}