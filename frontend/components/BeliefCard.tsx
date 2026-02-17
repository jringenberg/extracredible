'use client';

interface BeliefCardProps {
  text: string;
}

function getTextStyle(charCount: number): { fontSize: number; lineHeight: number } {
  if (charCount === 0) return { fontSize: 24, lineHeight: 1.25 };
  if (charCount < 30) return { fontSize: 68, lineHeight: 1.05 };
  if (charCount < 60) return { fontSize: 50, lineHeight: 1.1 };
  if (charCount < 100) return { fontSize: 38, lineHeight: 1.15 };
  if (charCount < 140) return { fontSize: 30, lineHeight: 1.2 };
  if (charCount < 180) return { fontSize: 26, lineHeight: 1.25 };
  if (charCount < 220) return { fontSize: 23, lineHeight: 1.28 };
  if (charCount < 260) return { fontSize: 21, lineHeight: 1.32 };
  if (charCount < 400) return { fontSize: 19, lineHeight: 1.35 };
  return { fontSize: 16, lineHeight: 1.4 };
}

export function BeliefCard({ text }: BeliefCardProps) {
  const textStyle = getTextStyle(text.length);

  return (
    <div className="belief-square">
      <div className="belief-square-text" style={textStyle}>{text}</div>
    </div>
  );
}
