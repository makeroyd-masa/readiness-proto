/** SAM's identity mark (ported from masa-sam-advocate `src/sam/icons.tsx`). */
export function SparkIcon({ size = 21, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2}>
      <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" />
      <circle cx="18" cy="17" r="2.4" />
    </svg>
  );
}
