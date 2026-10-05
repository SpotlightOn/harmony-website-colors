/**
 * ThemeScope applies a derived theme to a subtree.
 *
 * Every visual element in the demo page sits inside one of these. Nothing below
 * a scope knows which color scheme it is in, because the role tokens are all it
 * ever references.
 */

import type { CSSProperties, ReactNode } from 'react';
import { themeToStyle } from '@/color/css-vars';
import type { ThemeResult, Variant } from '@/color/theme';
import { cx } from '@/lib/cx';

export interface ThemeScopeProps {
  theme: ThemeResult;
  children: ReactNode;
  className?: string;
  id?: string;
  /** Accessible label for landmarks. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function ThemeScope({
  theme,
  children,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: ThemeScopeProps) {
  // React types do not model custom properties, so the cast is unavoidable.
  const style = themeToStyle(theme.theme) as CSSProperties;

  return (
    <div
      id={id}
      className={cx('scope', className)}
      data-variant={theme.variant satisfies Variant}
      style={style}
      {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
      {...(ariaLabelledBy !== undefined ? { 'aria-labelledby': ariaLabelledBy } : {})}
    >
      {children}
    </div>
  );
}