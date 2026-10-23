import type { ReactNode } from 'react'

import { Surface } from './Surface.tsx'

/**
 * THE DRAWER — *"the mechanism behind the product's central bet — that Ask is a
 * capability first and a destination second"* (`design/system/index.html`).
 *
 * 🛑 IT OPENS **OVER** THE REGISTER AND NEVER AWAY FROM IT, AND THAT IS A
 * STRUCTURAL PROPERTY RATHER THAN A VISUAL ONE. The register keeps its columns
 * and keeps its rows; the drawer sits on top. A panel that pushed the register
 * aside — the idiomatic "split view" — would reflow the columns, and the whole
 * argument for asking a question *beside* the evidence is that the evidence does
 * not move while you ask. `tests/design/overlays.test.ts` §1 asserts the column
 * set is byte-identical while the drawer is open, because "it looks the same" is
 * exactly the review a reflow passes.
 *
 * ⚠️ THIS COMPONENT IS DELIBERATELY THIN AND MUST STAY SO. Everything it does is
 * `Surface`'s, which is `behaviour.ts`'s. A drawer that grew its own Escape
 * handler or its own focus restore — the two most natural additions — would be
 * the fifth spelling G247 exists to prevent, and it would be invisible: both
 * would LOOK correct and differ from the modal's only in an edge case.
 */
export interface DrawerProps {
  readonly open: boolean
  readonly onDismiss: () => void
  readonly title: string
  readonly children: ReactNode
  readonly footer?: ReactNode
}

export function Drawer({ open, onDismiss, title, children, footer }: DrawerProps) {
  return (
    <Surface
      kind="drawer"
      open={open}
      onDismiss={onDismiss}
      title={title}
      /* ⚠️ SPREAD CONDITIONALLY. `exactOptionalPropertyTypes` makes
         `footer={undefined}` a different type from an absent `footer`, and
         `Surface` declares the property optional rather than
         possibly-undefined — the same distinction `Shell` depends on for
         `onOpen`. */
      {...(footer === undefined ? {} : { footer })}
    >
      {children}
    </Surface>
  )
}
