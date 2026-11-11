"use client";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import styles from "./ui.module.css";

export function Switch(props: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root {...props} className={styles.switch}>
      <SwitchPrimitive.Thumb className={styles.switchThumb} />
    </SwitchPrimitive.Root>
  );
}
