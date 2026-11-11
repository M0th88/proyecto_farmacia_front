import type { CSSProperties } from "react";
import styles from "./ui.module.css";
export function Skeleton({
  style,
  className = "",
}: {
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.skeleton} ${className}`}
      style={style}
    />
  );
}
