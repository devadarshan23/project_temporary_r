# Infrastructure Risk Register — AWS account `000000000000`

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** NO — it governs the inherited AWS account, not v1 scope.
> The one unambiguously live register in this repository: K1–K6 are open findings in an account that is running now, and decision F commits the rebuild to that same account. ⚠️ **This said K1–K5 until 16 Aug 2026**, when **K6** was added — the first finding here observed after 4 Aug 2026, and the only one derived from a live API call rather than transplanted. **Keep it current; close a finding here when it is closed in AWS.** ⚠️ **Nothing in it has been re-verified since it was observed on 4 August 2026** — it is a transplant, not a re-audit, and the account can have moved under it. ⚠️ **Numbering collision:** `docs/HANDOFF.md` §4.5 uses K1–K3 for a different list.
> *Banner added 8 Aug 2026.*

> **Why this file exists.** The two documents that held these findings —
> `docs/architecture-deployment.md` and `docs/compliance-checklist.md` — left the
> trunk on 6 August 2026. They remain readable in full at the annotated tag
> `archive/design-record`. The findings below do not leave with them: every one
> was observed live in AWS account `000000000000` on 4 August 2026, and
> **decision F** in `docs/HANDOFF.md` §3 commits the rebuild to that same
> account — *"Same AWS account (000000000000); the team fixes the existing
> security issues. We inherit the account's current posture, including the live
> IAM key."* These are therefore properties of the account, not of the code being
> deleted. A risk that is live needs a stable container with its own change
> history, so it does not stop being tracked when a document is retired.
>
> This register is a **transplant, not a re-audit.** Nothing here was re-verified
> against AWS on 6 Aug 2026. Every finding is stated at its 4 Aug 2026 observed
> state, taking the union of what both source documents recorded. Status language
> is reproduced exactly — `OPEN — accepted and deferred by the product owner on
> 4 Aug 2026` is a decision record, not prose to improve.

---

## Account facts

Verified 4 August 2026, by read-only API calls against the AWS control plane and
by live HTTP requests against the public endpoints.

| Property | Value |
| --- | --- |
| AWS account | `000000000000` |
| Primary region | `us-west-2` |
| REST APIs (API Gateway v1) | 3 — `agbmqz53j0`, `24m9hiutid`, `66idp859fe` |
| WebSocket APIs (API Gateway v2) | 6 |
| Lambda functions | 23 (Python 3.12) |
| EC2 instances | 2 × `t3.medium` |
| RDS instances | 2 × PostgreSQL 17.9, `db.t3.micro`, single-AZ |
| Cognito user pools | `us-west-2_55AG9CPSd` |
| Foundation model | `us.anthropic.claude-sonnet-4-20250514-v1:0` (Bedrock) |
| Other clouds in play | GCP (Firebase Hosting, API Gateway, Firebase Auth), Azure (Static Web Apps, Entra ID) |

There is **no SAP system deployed anywhere in this account.** Everything named
`sap-*` or `SAP-*` is a PostgreSQL database, a Lambda, or a frontend build label.
The "SAP data" the product reconciles against lives in the two RDS PostgreSQL
instances named below.

---

## Register at a glance

| # | Finding | Primary resources | Status |
|---|---|---|---|
| K1 | Long-lived IAM access key in a Lambda environment variable, reachable from an unauthenticated public form | `sap_erp_website_lambda`, IAM user `<redacted-iam-user>` | **OPEN — accepted and deferred by the product owner on 4 Aug 2026** |
| K2 | PostgreSQL 5432 and SSH 22 open to `0.0.0.0/0`, across 16 ports | `sg-<redacted-01>`, `sg-<redacted-02>` | OPEN — observed 4 Aug 2026; no remediation or acceptance recorded |
| K3 | Four API Gateway routes proxy request bodies, `Authorization` and `x-api-key` in cleartext, to IP addresses the account no longer owns | `agbmqz53j0` — `/ERA_Demo`, `/sap_demo`, `/sap_ec2_ec2`, `/sap_ec2` | OPEN — observed 4 Aug 2026; no remediation or acceptance recorded |
| K4 | The API Gateway → EC2 hop is unencrypted and carries no IAM identity | All EC2 `HTTP_PROXY` integrations (7 routes) | OPEN — observed 4 Aug 2026; no remediation or acceptance recorded |
| K5 | Unhandled Lambda errors return HTTP 200 with a Python stack trace to an unauthenticated caller | `POST …/dev/config` on `24m9hiutid`, and the handler pattern generally | OPEN — observed 4 Aug 2026; no remediation or acceptance recorded |

| K6 | An IAM role **named for this project** carries `AdministratorAccess`. It is attached to no instance profile, which is the only reason it is not live exposure | `ReconcileaiNoSapCdkStack-reconcileainosapEC2Rolekg8-Vx7bpu46UTzU` | **OPEN — observed 16 Aug 2026. The FIRST finding in this register observed after 4 Aug 2026, and the only one re-verified against live AWS** |

> **On the status column.** Only K1 carries a recorded decision. For K2–K5
> neither source document records a remediation date, an owner, or an acceptance;
> the status shown is the absence of such a record, not an assertion that anyone
> has triaged them.

> **Numbering note.** `docs/HANDOFF.md` §4.5 also uses K1–K3, for a *different*
> and shorter list: its K1 is the IAM key below, but its K2 is the PITR window
> versus erasure and its K3 is traces exported to a customer endpoint. Only K1 is
> common to both. The K1–K5 numbering in this file is this register's own.

---

## 1. K1 — Long-lived IAM credentials in a Lambda environment variable

**CRITICAL.** Transplanted from `docs/compliance-checklist.md` §6.1 (Addendum —
Secrets Management, added 4 Aug 2026).

### What it is

`sap_erp_website_lambda` — the backend for the public landing page's
demo-request form, wired to `POST /dev/website` on API Gateway `agbmqz53j0` —
carries a long-lived AWS access key pair in **plaintext environment variables**,
together with database credentials.

The invoking form is **unauthenticated and public**: anyone on the internet can
reach the function.

The secret values are deliberately **not reproduced in this repository** —
recording them here would widen the exposure. Read them from the live function
configuration if remediating.

### Where it is

| Item | Detail |
|---|---|
| Access key ID | `AKIAXXXXXXXXXXXXXXXX` (secret omitted by design) |
| Owning IAM user | `<redacted-iam-user>` |
| Key status | **Active** — last used 30 Jul 2026 against `bedrock-agentcore` in us-west-2 |
| Also exposed | `db_user`, `db_password`, `db_host` for `<redacted-rds-host>.us-west-2.rds.amazonaws.com` (values redacted here; read them from the live function configuration) |
| Scope | 1 of 23 Lambdas — all others scanned clean |
| Execution role | `sap-mcp-data-lambda-role-<redacted>` |

### Why it matters

**The key is redundant as well as dangerous:** the function already runs under
execution role `sap-mcp-data-lambda-role-<redacted>`. It does not need static
credentials at all.

**Compounding factors, recorded as K2 below:** security group
`sg-<redacted-01>` opens SSH (22) to `0.0.0.0/0` on a public EC2 instance in
the same VPC, and two security groups open PostgreSQL (5432) to `0.0.0.0/0`. The
RDS instance is not directly internet-facing, but any foothold inside that VPC
reaches a database whose password is a trivial default.

### Remediation, in order

```bash
# 1. Deactivate (reversible) — do NOT delete until dependants are confirmed
aws iam update-access-key --access-key-id AKIAXXXXXXXXXXXXXXXX \
  --status Inactive --user-name <redacted-iam-user>

# 2. Remove the static keys from the function; rely on the execution role
aws lambda update-function-configuration --function-name sap_erp_website_lambda \
  --environment "Variables={...omit aws_access_key_id and aws_secret_access_key...}"

# 3. Move DB credentials to Secrets Manager and rotate off the default password
# 4. Close 22 and 5432 to 0.0.0.0/0
# 5. Review CloudTrail for use of this key from unexpected sources
```

### Status

**Status: OPEN — accepted and deferred by the product owner on 4 Aug 2026.**
Recorded here so the decision is traceable, not to imply it has been resolved.

### Standing rule (`compliance-checklist.md` §6.2)

```
✅ Lambda authenticates through its execution role; secrets from Secrets Manager
❌ Never — aws_access_key_id / aws_secret_access_key in Lambda env vars,
   .env files, or committed source
```

---

## 2. K2 — PostgreSQL 5432 and SSH 22 open to the entire internet

**CRITICAL.** Union of `architecture-deployment.md` §Security findings 1 and
`compliance-checklist.md` §2.3 and §4.4.

### What it is

Security group `sg-<redacted-01>`, attached to the dev EC2 instance, permits
ingress from `0.0.0.0/0` on **sixteen ports**, including `22` (SSH) and `5432`
(PostgreSQL). A second group, `sg-<redacted-02>`, also opens `5432` to
`0.0.0.0/0`.

The named ports, as recorded:

```text
# ❌ Dev EC2 security group — 16 ports to 0.0.0.0/0
      22    tcp  0.0.0.0/0      ← SSH, world-reachable
      5432  tcp  0.0.0.0/0      ← PostgreSQL, world-reachable
      6969  tcp  0.0.0.0/0      ← agent services, unauthenticated
      7171  tcp  0.0.0.0/0
      8000  tcp  0.0.0.0/0
      8083  tcp  0.0.0.0/0
      8084  tcp  0.0.0.0/0
      … and 9 more
```

### Where it is

- `sg-<redacted-01>` — dev EC2 instance, 16 ports to `0.0.0.0/0`
- `sg-<redacted-02>` — a second group, also `5432` to `0.0.0.0/0`
- The databases behind it: `sap-erp` and `sap-erp-2`, PostgreSQL 17.9,
  `db.t3.micro`, **single-AZ**

### Why it matters

The RDS instances carry `PubliclyAccessible: false`, but **that flag only
suppresses a public DNS address.** Any workload inside that VPC is reachable on
the database port from anywhere the security group allows, and the EC2 host
itself is directly exposed on SSH.

An internet-reachable `5432` on a database that holds ERP transaction data was
recorded as **the single highest-severity item** in the compliance checklist. It
is remote-credential-guessing distance from full data access — and per
`docs/data-governance.md` §2, that database's password is a trivial default
(the literal value appears in that document; it is deliberately not repeated
here). An internet-reachable `22` alongside it means credential-stuffing and
key-scanning traffic reaches the host continuously, and removes any pretence of
network isolation. Neither port should ever carry a `0.0.0.0/0` rule, in any
environment, including dev.

### Remediation

Restrict `22` to a bastion or SSM Session Manager only; restrict `5432` to the
security groups of the Lambda ENIs and the EC2 instances that legitimately need
it; delete the remaining fourteen `0.0.0.0/0` rules or scope them to known CIDRs.

```text
# ✅ Always
      22    → no inbound rule at all; access via AWS Systems Manager Session Manager
      5432  → source = the security group id of the compute that needs it, never a CIDR
      app   → source = ALB security group only; ALB terminates TLS and carries the public listener
```

Audit checklist, as recorded:

- [ ] Zero security-group rules with `0.0.0.0/0` on port 22?
- [ ] Zero security-group rules with `0.0.0.0/0` on port 5432?
- [ ] Agent ports (6969, 7171, 8000, 8083, 8084) reachable only from an ALB or API Gateway VPC link?
- [ ] RDS `PubliclyAccessible = false`?
- [ ] Every remaining `0.0.0.0/0` rule justified in writing, or deleted?

### Status

OPEN — observed directly in account `000000000000` on 4 Aug 2026. Neither source
records a remediation, an owner, or an acceptance. Step 4 of the K1 remediation
above ("Close 22 and 5432 to `0.0.0.0/0`") is the only place this finding is
attached to an action, and that action sits inside a deferred item.

---

## 3. K3 — Four API Gateway routes proxy credentials and payloads to IP addresses this account no longer owns

**CRITICAL — active credential disclosure, not routing hygiene.** This finding
only reads correctly as the union of both sources: `architecture-deployment.md`
§Security findings 2 supplies the routes and addresses;
`compliance-checklist.md` §2.4 and §4.5–§4.6 supply what is on the wire.

### What it is

`/ERA_Demo`, `/sap_demo`, `/sap_ec2_ec2` and `/sap_ec2` on `agbmqz53j0` are
`HTTP_PROXY` integrations pointing at bare public IP addresses. **None of those
addresses match a running or stopped instance in the account.** AWS recycles
released public IPv4 addresses back into the EC2 pool, where any other AWS
customer can claim them.

The traffic on those routes is unencrypted (`http://`, see K4). Per
`compliance-checklist.md` §2.4 and §4.6, what crosses that hop includes:

- the `Authorization` header,
- the `x-api-key` header,
- ERP payloads and chat transcripts,

with **no IAM identity, no VPC link, and no request signing** on the hop. The
endpoint is an address, not an identity — whoever holds the IP serves the route.

### Where it is

| Route (on `agbmqz53j0`) | Target IP | Owned by this account? |
|---|---|---|
| `/ERA_Demo` | `34.215.129.104` | No |
| `/sap_demo` | `52.12.168.127` | No |
| `/sap_ec2_ec2` | `16.147.15.128` | No |
| `/sap_ec2` | `35.91.131.56` | No |
| — | `18.246.217.215` | **Yes** — the only one that matches an instance |
| (route not named in either source) | `16.147.37.101`, on `24m9hiutid` | No — also unmatched |

Seven `HTTP_PROXY` routes to bare IPs exist in total; four of them — the four
named above — point at unowned addresses.

### Why it matters

Recorded verbatim from `compliance-checklist.md` §4.6:

> This is not a stale-config annoyance; it is an open channel that delivers
> credentials and business data to an unknown third party on every request.

And from §2.4:

> The four stale routes are an active data-exfiltration path, not a latent risk.
> They should be disabled before anything else in this document is addressed.

Any AWS customer can allocate one of those addresses and receive this
application's traffic — over plain HTTP, with the `Authorization` header and
`x-api-key` attached.

### Remediation

```text
# ✅ Immediate
      1. Disable the four routes.
      2. Rotate the API key and any token that could have transited them.
      3. Enable API Gateway access logging and determine when the IPs were released.

# ✅ Structural
      4. Re-point at Lambda ARNs or a VPC-linked internal ALB (see K4).
      5. Allocate Elastic IPs for anything that must keep a stable public address.
```

Audit checklist, as recorded:

- [ ] All four routes pointing at unowned IPs disabled *today*?
- [ ] Any credential or token that transited those routes rotated?
- [ ] Zero `http://` integration URIs across all API Gateway stages?
- [ ] Zero integrations targeting a bare IP — Lambda ARNs or VPC-link DNS names only?
- [ ] Elastic IPs allocated for anything that must keep a stable address?
- [ ] API Gateway access logging enabled so the blast radius of the stale routes can be measured?

### Status

OPEN — observed directly on 4 Aug 2026. No source records the routes as
disabled, the API key as rotated, or access logging as enabled. The blast radius
is therefore **unmeasured**: without access logging, neither source can say how
long the addresses have been out of the account's control or how much traffic
reached them.

---

## 4. K4 — The API Gateway → EC2 hop is unencrypted and carries no identity

**HIGH.** Union of `architecture-deployment.md` §Security findings 3 and
`compliance-checklist.md` §2.4 and §4.5.

### What it is

All EC2 integrations use `http://`, not `https://`. TLS terminates at API
Gateway and the payload crosses the remaining hop in clear text. The same hop
bypasses the Lambda execution role, so those calls carry **no IAM identity at
all** — the EC2 service has no way to attribute or authorise a request.

```text
# ❌ Never — HTTP_PROXY integration to a bare public IP
      Integration type: HTTP_PROXY
      Endpoint:         http://<public-ip>:8000/…
      × 7 routes
```

### Where it is

All seven `HTTP_PROXY` EC2 integrations across the account's API Gateway stages,
on ports including `8000` and `8083`. Four of the seven are additionally K3.

### Why it matters

Everything on that hop — the `Authorization` header, the `x-api-key`, ERP
payloads, chat transcripts — crosses the public internet unencrypted. There is
no IAM identity on the integration and no VPC link; the target is an address,
not a principal. This is what converts K3 from a misrouting problem into a
credential-disclosure problem: the traffic that reaches a stranger's IP is
readable when it gets there.

### Remediation

Terminate TLS at the EC2 service, or front it with an internal ALB and use a VPC
Link with `https://`. Add a shared-secret or SigV4 check at minimum.

```text
# ✅ Lambda integration
      Integration type: AWS_PROXY
      Endpoint: arn:aws:lambda:us-west-2:000000000000:function:<name>

# ✅ Or, for a long-running service: VPC link to a private ALB, TLS end to end
      Integration type: HTTP_PROXY
      Connection type:  VPC_LINK
      Endpoint:         https://<internal-alb-dns>/…
```

### Status

OPEN — observed directly on 4 Aug 2026. No remediation, owner, or acceptance
recorded in either source.

---

## 5. K5 — Unhandled Lambda errors return HTTP 200 with a Python stack trace

**HIGH.** Union of `architecture-deployment.md` §Security findings 4 and
`compliance-checklist.md` §2.1 and §4.3.

### What it is

`POST https://24m9hiutid.execute-api.us-west-2.amazonaws.com/dev/config` with a
body that omits `event_type` returns status **200** carrying:

```json
{
  "errorMessage": "'event_type'",
  "errorType": "KeyError",
  "stackTrace": ["  File \"/var/task/lambda_function.py\", line 945, in lambda_handler\n..."]
}
```

The caller need not be authenticated.

### Where it is

Observed on `POST /dev/config` on REST API `24m9hiutid`. The compliance
checklist records the same shape as the general deployed-Lambda handler pattern
rather than a single function's defect, and its illustrative renderings show
additional frames (`lambda_function.py` line 412 in `lambda_handler`, line 187
in `fetch_exceptions`). Neither source enumerates which of the 23 Lambda
functions are affected.

### Why it matters

Two defects in one response.

1. **Failures are reported as success.** Callers and monitoring cannot
   distinguish them — and every client in the frontend codebase branches on
   `response.ok`, which is `true` here. The frontend treats a crash as a
   successful empty result; the `if (!response.ok) throw` in `src/services/`
   never fires.
2. **Internal detail is disclosed to any unauthenticated caller** — the handler
   filename, exact line numbers, the exception type, the internal call chain,
   and by extension the file layout and library versions of the function.

### Remediation

Wrap the handler in a try/except that returns a proper `statusCode` and a
generic error body; never return `stackTrace` to a client.

```python
# ✅ Always — non-2xx status, opaque body, detail only in CloudWatch
import logging, uuid, json
logger = logging.getLogger()

def lambda_handler(event, context):
    try:
        return {"statusCode": 200, "body": json.dumps(handle(event))}
    except Exception:
        ref = str(uuid.uuid4())
        logger.exception("unhandled error ref=%s", ref)   # full trace → CloudWatch only
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"message": "Internal server error", "reference": ref}),
        }
```

Audit checklist, as recorded:

- [ ] Every Lambda handler wrapped in a top-level `try/except` that returns a non-2xx status?
- [ ] Zero `stackTrace`, `errorMessage`, `/var/task/`, or `Traceback` strings in any response body?
- [ ] Error detail written to CloudWatch, correlated to the client by an opaque reference id?
- [ ] Frontend `response.ok` checks meaningful again once statuses are correct?

### Status

OPEN — observed directly on 4 Aug 2026. No remediation, owner, or acceptance
recorded in either source.

---

## 6. K6 — An IAM role named for this project carries `AdministratorAccess`

**HIGH, and it is the only finding in this register that was observed live rather
than transplanted.** Observed **16 August 2026** by read-only IAM calls against
account `000000000000`, during the pass that put CI on a self-hosted runner in
this same account.

> ⚠️ **THIS FINDING IS NOT FROM THE 4 AUGUST OBSERVATION AND IS NOT A TRANSPLANT.**
> Every other row here was extracted from two documents that left the trunk on
> 6 Aug 2026. **This one was found by looking**, which is worth saying because the
> register's own banner warns that *"the account can have moved under it"* — and
> it had.

### What it is

```bash
R=ReconcileaiNoSapCdkStack-reconcileainosapEC2Rolekg8-Vx7bpu46UTzU
aws iam list-attached-role-policies --role-name $R --output text
```

Returns **three** managed policies:

```
arn:aws:iam::aws:policy/AdministratorAccess
arn:aws:iam::aws:policy/AmazonEC2FullAccess
arn:aws:iam::aws:policy/AmazonS3FullAccess
```

`aws iam list-role-policies --role-name $R` returns **no inline policies**, so
`AdministratorAccess` is the whole of it and there is no narrower intent recorded
anywhere on the role. `AmazonEC2FullAccess` and `AmazonS3FullAccess` are
**subsumed and therefore decorative** — their presence is evidence that somebody
intended a scoped role and attached the broad one as well.

### Where it is

An **EC2 role** in the CDK stack `ReconcileaiNoSapCdkStack` — **named for this
project**, which is what makes it this record's business rather than the
inherited account's alone. Created `2026-04-22`; `RoleLastUsed` is
`2026-04-22T10:43:12Z` in `us-west-2`, so it has been assumed **once**, on the
day it was made.

🟢 **IT IS ATTACHED TO NO INSTANCE PROFILE, AND THAT IS THE ONLY REASON IT IS NOT
LIVE EXPOSURE:**

```bash
aws iam list-instance-profiles-for-role --role-name $R \
  --query 'InstanceProfiles[].InstanceProfileName' --output text   # empty
```

### Why it matters

**An EC2 role is assumed by whatever runs on the instance.** The gap between this
finding and account takeover is **one `aws iam add-role-to-instance-profile` call
plus one instance launch** — both ordinary operations that no control in this
account currently distinguishes from routine work, and neither of which changes
the role.

🛑 **AND THE RELEVANT CONTEXT IS THAT CI NOW RUNS PULL-REQUEST CODE IN THIS
ACCOUNT.** `.github/workflows/check.yml:26` is `runs-on: [self-hosted,
reconcile]`; the runner is instance `i-08138159a56213f42` in **`us-east-1`**,
using role **`instanceRole`** — `AmazonSSMManagedInstanceCore` and
`CloudWatchAgentServerPolicy`, **no inline policy**, deliberately narrow because
**contributor code executes under it**. An inline `s3-test` policy granting
read/write on bucket `panasonic-test-aug5` was **removed from `instanceRole` on
16 Aug 2026** for exactly that reason (backup and restore command:
`~/.claude/instanceRole-s3-test-backup.json`). **K6 is the same class of question
answered the other way, on a role nobody narrowed** — and a host in this account
that attached *this* role instead would hold the account.

⚠️ **This is not an assertion that anything has been compromised.** `RoleLastUsed`
shows one assumption in April and nothing since. **It is a statement that the
blast radius of one routine mistake is total**, which is the same argument K1
makes about a long-lived key.

### Remediation, in order

```bash
# 1. Detach the broad policy (reversible; the role is used by nothing today)
aws iam detach-role-policy --role-name $R \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# 2. Decide whether the role has a purpose at all. RoleLastUsed is 22 Apr 2026
#    and no instance profile references it. If nothing needs it, DELETE it —
#    a detached admin role is still an admin role waiting for an attachment.

# 3. If it is kept, replace the two remaining full-access policies with the
#    specific actions the instance needs, in an inline policy that states them.

# 4. Fix it IN THE CDK STACK, not only in the console. It is stack-managed;
#    a console detach is reverted by the next `cdk deploy`, silently.
```

🛑 **Step 4 is the one that decides whether this stays fixed.** The role's name
carries `ReconcileaiNoSapCdkStack`, so its policy attachments are declared in
infrastructure code that is **not in this repository**. **A remediation applied
only through the API is a remediation with an expiry date nobody has written
down.**

### Status

**OPEN — observed 16 Aug 2026, filed the same day. No remediation, owner, or
acceptance recorded.** ⚠️ **Unlike K1–K5 this finding has a named observation
method that anyone can re-run**: the four `aws iam` commands above are read-only
and take seconds. **Re-run them before quoting this section** — the register's
standing warning applies most sharply to its own newest row.

---

## Provenance and known tensions between the sources

**Sources.** `docs/architecture-deployment.md` (account facts, L13–33; security
findings, L381–435) and `docs/compliance-checklist.md` (§2.1, §2.3, §2.4, §4.3,
§4.4, §4.5, §4.6, §6.1), both at their 6 Aug 2026 state on branch
`docs/reconcileai-documentation`, plus `docs/HANDOFF.md` §3 decision F and §4.5,
and `docs/data-governance.md` §2. Both source documents are retrievable at the
annotated tag `archive/design-record`.

**Where the two sources differ, and what this register used:**

1. **How many findings there are.** `architecture-deployment.md` opens its
   security section with *"Ranked by exposure. All four were observed directly,
   not inferred"* and lists four. `compliance-checklist.md` carries the same
   four plus §6.1, the IAM key, which is an addendum dated 4 Aug 2026 and has no
   counterpart in `architecture-deployment.md`. **Used: five.** The "four" is a
   count of that document's own list, made before the addendum existed, not a
   claim that no fifth finding exists.

2. **Unowned IP addresses: four or five?** `compliance-checklist.md` §2.4 and
   §4.6 both say *"4 of those 7"* routes point at unowned addresses.
   `architecture-deployment.md` names those four on `agbmqz53j0` and then adds
   *"`24m9hiutid` adds `16.147.37.101`, also unmatched"* — a fifth unmatched
   address, on a different API. **Used: both, stated separately.** The four
   named routes are the remediation target both documents agree on; the fifth
   address is recorded in the K3 table with its route left blank, because
   neither source names the route it serves.

3. **Which stack-trace line numbers are real.** `architecture-deployment.md`
   shows a live captured response citing `lambda_function.py` line 945;
   `compliance-checklist.md` §2.1 and §4.3 show lines 412 and 187 in elided
   examples. **Used: the live capture as the evidence**, with the checklist's
   renderings noted as illustrative. They are not in conflict — they are
   different responses from a pattern that is not function-specific.

**Values deliberately redacted here.**

- The secret half of access key `AKIAXXXXXXXXXXXXXXXX` — carried exactly as
  `compliance-checklist.md` §6.1 carries it, with its `(secret omitted by
  design)` marker. The source never held the secret.
- The `db_user` / `db_password` / `db_host` values for
  `<redacted-rds-host>.us-west-2.rds.amazonaws.com`. The source names the
  variables and the host, not the values.
- The literal RDS password. Neither this register nor `docs/data-governance.md`
  §2 records it; both describe it only as *"a trivial default"* (the phrasing
  `compliance-checklist.md` §6.1 uses). Read the live value from the function
  configuration or Secrets Manager if remediating — never from this tree.

**Not recorded anywhere, and therefore absent here:** an owner, a due date, or a
severity rating for K2–K5; a CloudTrail review outcome for K1; API Gateway access
log evidence for K3; and the identity of which of the 23 Lambda functions share
the K5 handler pattern.

---

*Extracted 6 August 2026 from `docs/architecture-deployment.md` and
`docs/compliance-checklist.md` on their removal from the trunk. Findings observed
4 August 2026. Not re-verified since. Sources readable at tag
`archive/design-record`.*

*⚠️ **K6 is the exception to the sentence above** — it was observed **16 August
2026** by live read-only IAM calls, not extracted from either source, and it is
the only row here that has been verified against AWS since 4 August.*
