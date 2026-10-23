/**
 * THE LIVE SIGN ON A RUNNING RUN'S PAGE — RMR-07 (G3476), 3 Oct 2026. DERIVED,
 * NOT THE OWNER'S.
 *
 * `/close/run/:runId` for a run that is still `running` drew the still lockup
 * and nothing else, while the same run's strip cell on `/close` carried the
 * light, the sweep and the working mark. The kernel's rule is that the light
 * goes on *"anything the machine is working on RIGHT NOW"* and that the mascot
 * at `working` energy marks a surface where the machine is working — so the
 * run's own page says so too, in words first (the kernel's precondition for
 * both), with the light and the mark beside them.
 *
 * ⚠️ IT IS ONE LIGHT AND IT IS THIS PAGE'S ONLY ONE: the run account draws no
 * other lit thing. It is mounted only while the run reads, and `main.tsx`
 * re-reads the run on an interval while it does (RMR-02), so the sign goes out
 * when the work does — it never asserts liveness from a stale read.
 *
 * It is drawn ABOVE the run account rather than inside it: `RunAccount.tsx`
 * belongs to another slice, and the sign is a statement about the RUN's
 * present tense, which that component's panels (an account of what a run
 * produced) do not carry.
 */
export function LiveRun() {
  return (
    <div className="liverun lit lit--running" data-lit="run" data-live-run="">
      <span className="mascot" data-energy="working" aria-hidden="true">
        <i className="d1">·</i>
        <i className="d2">·</i>
        <i className="d3">·</i>
      </span>
      <p>
        <b>Reading now.</b> This page follows the run and updates when it finishes.
      </p>
    </div>
  )
}
