# Notification Channels — Teams and Slack

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** NO — vendor research. It constrains a design; it decides nothing.
> **Captured 4 August 2026 against vendor documentation and not re-checked since**, and §6 lists items that were never verified at all. `docs/HANDOFF.md` §3c is the standing lesson: a vendor page changes without notice, and two such readings on 8 Aug each reversed a decision. **Re-verify before any of this becomes a commitment.** ⚠️ Its §2 constraints are framed as binding *the resale model*; **G51 narrowed partner to a commercial record**, so that framing is wider than v1's.
> *Banner added 8 Aug 2026.*

> **Status:** research findings, captured 4 Aug 2026.
> **Why this is a separate document:** both channels turned out to constrain the
> **partner-resale model** and the **evaluation design**, not just the
> integration work. Those consequences belong with the model, not buried in a
> vendor comparison.
>
> Claims below were verified against official documentation and licence files.
> Items marked ⚠️ are explicitly unverified.

---

## 1. The headline: neither channel is a webhook any more

### Microsoft Teams — Office 365 Connectors are dead

Incoming Webhooks / O365 Connectors reached **final deprecation 18–22 May
2026**. New connector registration was blocked well before that. *"Just POST to
a webhook URL"* is no longer an available design.

⚠️ The announcement is verified; that it executed on schedule is not — no
post-hoc completion notice was found. Two `learn.microsoft.com` pages still
carry stale softer wording and should not be cited as evidence connectors work.

**The blocking constraint:** a vendor-hosted service **cannot post channel
messages app-only**. `POST /teams/{id}/channels/{id}/messages` has exactly one
application permission — `Teamwork.Migrate.All` — and Microsoft states plainly
that *"application permissions are only supported for migration."*

The Power Automate "Workflows" replacement is **not ISV-provisionable**:
workflows are owned by an individual user, not a team or channel, and orphan
when that person leaves. Across dozens of reseller-sold tenants that is a
support burden, not an integration.

**Only viable path: a multi-tenant Teams bot** doing proactive messaging,
registered `AzureADMultipleOrgs`, with publisher verification completed.

> **SDK trap:** the Bot Framework SDK is **archived and unsupported since 31 Dec
> 2025**. Use the **Microsoft 365 Agents SDK** (MIT, active) or the Teams SDK.
> Anyone starting from an older tutorial will build on a dead SDK.

Pair the bot with `sendActivityNotification`, which *does* support app-only
(`TeamsActivity.Send.Group`), for targeted "this needs you" pings.

### Slack — webhooks work but are the wrong shape

Incoming Webhooks are still supported and not deprecated, but they bind to **one
fixed channel** and cannot update, delete or thread. An exception lifecycle
(open → assigned → resolved) needs all three.

**Use `chat.postMessage`** with a bot token: any channel per call, returns a
`ts` for threading, and supports `chat.update`. It is also untouched by the 2026
rate-limit clampdown, which hit read methods only.

**Architecture: one distributed app, OAuth v2 per workspace.** One-app-per-tenant
is not a Slack-supported distribution model and leans on an "internal app"
exemption in a way that risks the anti-circumvention clause.

---

## 2. Three constraints that bind the resale model ⚖️

These are the findings that matter beyond integration work.

### 2.1 Neither vendor permits reselling API access

| Vendor | Clause |
|---|---|
| Microsoft | APIs ToU §3(b)(14): may not *"redistribute or resell, or sublicense access to, the Microsoft APIs"*. §11(c): *"you may not assign or delegate any rights or obligations under these API Terms"* — including on change of control. |
| Slack | API ToS: *"you may not sell, rent, lease, sublicense, redistribute or syndicate access to any of our APIs."* |

**Consequence for our model:** partners resell **ReconcileAI**, and each end
customer installs the integration into **its own** Teams/Slack tenant under its
own consent. A partner must never be granted, or appear to be granted, API
access it passes on. The app registration stays owned by 1CloudHub.

This is compatible with the design in `docs/data-governance.md` — but it means
the reselling partner is a **channel for ReconcileAI, not a party to the
Microsoft or Slack relationship**. ⚖️ Worth counsel confirming the structure.

### 2.2 Slack requires a Marketplace listing for any paid product

*"You may not Commercially Distribute an Application that integrates with the
Slack APIs unless you are authorised to do so under a separate agreement."*
Commercial distribution explicitly includes **a free app that connects to a paid
product** — so a free Slack connector to paid ReconcileAI still counts.

There is a chicken-and-egg gate: apps on **fewer than 5 workspaces or 10 weekly
active users are ineligible to list**. So the sequence is forced:

1. Ship **unlisted** to pilot customers (Slack explicitly blesses this for pilots)
2. Clear 5 workspaces / 10 WAU
3. Submit — budget **~10 business days** to first feedback and **up to 10 weeks**
   functional review

**Open the Slack Marketplace/partner conversation early.** The ToS gate binds
from the first paying customer, and the runway is roughly a quarter.

⚠️ Reseller/channel distribution is **not addressed** in Slack's public
Marketplace documentation. Confirm with their partner team before launch.

### 2.3 Slack forbids cross-tenant use of data — and this touches our model

> *"Use data collected from one organisation to directly benefit a different
> organisation or any third party"* — prohibited.
> Apps offered beyond your own org *"may not use API Data to train a large
> language model."*

This is an **external legal confirmation of an isolation boundary our own red
team is currently attacking**. It directly constrains `model/evaluation.ts`:

- `Scorer` with `tenantId: null` is a *platform* scorer running across tenants.
  If it ever scored Slack-derived content, that is cross-tenant benefit.
- `LabelledExample` with `provenance: 'observed'` is customer data. It must
  never leave its tenant, and must never contribute to a platform-level model.
- `PackQualityReport` is documented as computed over **seeded examples only** —
  and nothing in the type enforces it. That gap is now not merely a design
  weakness but a licence-compliance risk.

**Action:** the isolation of observed labels needs to be enforced in the type
system, not documented. Folded into the swarm adjudication.

---

## 3. Operational limits worth designing to

| Constraint | Teams | Slack |
|---|---|---|
| Send rate | ≤4 req/s per channel; **≤3,000 messages per app per day per channel**; 50 rps per tenant | 1 msg/s per channel; *"several hundred per minute"* workspace-wide |
| Message size | 28 KB | Block Kit: ≤50 blocks/message, ≤3,000 chars per text object, ≤10 fields × 2,000 chars |
| Cards | Adaptive Cards **≤1.5**; **mobile only reliably renders ≤1.2** | Block Kit, actively maintained |
| Uninstall | Treat `403 MessageWritesBlocked` as a first-class tenant state | `app_uninstalled` → purge tokens **and Slack-derived data within 14 business days, backups included** |

> **Design consequence:** *"It's a violation of the terms of use to use Microsoft
> Teams as a log file. Only send messages that people will read."* A
> per-exception firehose is a **terms violation**, not merely poor UX.
> **Aggregate into digest cards.** With 3,000 messages/channel/day as a hard
> cap, a busy finance tenant would hit it on volume alone.

That backup-purge requirement is also a real constraint on our retention design
— `RetentionPolicy` currently has no concept of purging from backups.

---

## 4. Licensing — clean

Every relevant SDK is **MIT** and healthy: Microsoft 365 Agents SDK, Teams SDK,
Graph SDKs, MSAL, Adaptive Cards, `node-slack-sdk`, `python-slack-sdk`,
`bolt-js`, `bolt-python`. No component requires a commercial licence.

Two notes: `bolt-js` carries **dual copyright** (Robots & Pencils and Slack) —
attribute both. `@slack/oauth@4.0.0` requires **Node ≥20**.

**All the cost and risk sit in platform terms, not in code.**

---

## 5. Recommendation

| Decision | Choice |
|---|---|
| Teams send path | Multi-tenant bot on **Microsoft 365 Agents SDK**; never Bot Framework SDK |
| Teams targeting | Pair with `sendActivityNotification` for personal pings |
| Slack send path | `chat.postMessage` + Block Kit; not Incoming Webhooks |
| Slack distribution | Unlisted pilot → Marketplace listing; start the conversation now |
| Both | Digest aggregation, not per-exception messages |
| Both | Per-tenant encrypted token store; hard delete on uninstall |
| Both | Treat as a **delivery channel, never a dependency** — both vendors reserve termination without cause |

---

## 6. ⚠️ Unverified / needs follow-up

1. Whether the Teams connector disablement executed as announced.
2. Azure Bot Service pricing — not fetched. Do not budget without it.
3. Slack reseller/channel distribution — silent in public docs.
4. Slack data-residency obligations for third-party apps — no statement located.
5. Marketplace/partner agreement commercials, including any revenue share.
6. ⚖️ Counsel review of the resale structure against both vendors' no-sublicence clauses.
