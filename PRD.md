# PRD: Product Requirements Document

**Product:** SENTINEL-X, Autonomous Adaptive Cyberattack Response Agent
**Version:** 1.0 (hackathon MVP) · **Event:** InnoHacks 4.0, Agentic AI / GenAI track

---

## 1. Vision

Detection does not guarantee containment. Security tools generate alerts, but responding to an incident that spans an account, a workstation, a privilege escalation, a server and a database is slow, manual and breaks when the attacker changes route.

SENTINEL-X is a **closed-loop response agent**: investigate, build the attack path, plan, act through a gated tool layer, verify against ground truth, and **replan** when the attacker pivots. It is **measurable** (reproducible benchmark), **safe by construction** (risk-scored, approval-gated, reversible) and **robust against attacks on the agent itself** (prompt-injection defense).

## 2. Problem statement

| Gap | Impact |
|---|---|
| Investigation is manual: analysts correlate IAM, endpoint, network and log data by hand | Attacker keeps moving while analysts work |
| Static playbooks assume a static attacker | A fixed rule stops one route; the attacker pivots and nothing is left to run |
| SMEs have no 24/7 SOC | Breaches are found hours late |

## 3. Users and personas

| Persona | Description | Primary need |
|---|---|---|
| **Maya, SME IT admin** | One-person IT team, no SOC, wakes up to alerts | Safe automatic containment she can trust and undo |
| **Arjun, MSSP analyst** | Manages many clients, alert fatigue | Fast investigation, clear evidence, approval queue |
| **Approver (security lead)** | Owns risk decisions | See target, reason, risk score, dry-run result, then Approve/Deny |
| **Judge / evaluator** | Scores the hackathon demo | Evidence the system works, is safe, and is not scripted |

## 4. Goals and non-goals

### Goals (MVP)
1. Contain 4 attack-chain archetypes (simple, adaptive, lateral, verification-failure) on a synthetic enterprise.
2. Demonstrate **adaptive replanning** against a **reactive** adversary, not a script.
3. Enforce **human approval** for high-risk actions, with rollback and a kill switch.
4. Resist **prompt injection** in logs (0 unauthorized actions).
5. Prove claims with a **reproducible benchmark** (B0 to B3) visible on the dashboard.

### Non-goals (do not build)
Full SIEM/EDR, real firewall integration, malware sandbox, production threat-intel platform, multi-agent systems, support for many LLMs.

## 5. Feature list and priority

| ID | Feature | Priority |
|---|---|---|
| F1 | Agent loop (observe → reason → plan → dry-run → risk score → act → observe → verify → replan) | **P0** |
| F2 | Tool Gateway with 8+ tools incl. `verify_containment` | **P0** |
| F3 | Attack graph engine (paths, status, graph diff) | **P0** |
| F4 | Adaptive scenario with replanning (Scenario 2) | **P0** |
| F5 | Human approval flow (Scenario 4) | **P0** |
| F6 | Hash-chained audit log + Action Proof | **P0** |
| F7 | Dashboard: graph, timeline, approval panel, paths | **P0** |
| F8 | Reactive adversary simulator (seeded) | **P1** |
| F9 | Risk scorer (0 to 100, tiers) | **P1** |
| F10 | Benchmark harness B0 to B3 (B1 vs B3 minimum) | **P1** |
| F11 | Prompt-injection scenario and sanitizer (Scenario 6) | **P1** |
| F12 | Ablation B2 (no replanning) | P2 |
| F13 | Replay mode | P2 |
| F14 | Multiple simultaneous incidents, threat-intel lookup, behavioural baseline | P2 (stretch, never claimed unless finished) |

**Cut line:** cut P2 first, then reduce the benchmark to B1 vs B3. Never cut verification, the policy gateway or the human-approval path.

## 6. Core user stories

| ID | As a... | I want... | So that... | Acceptance (summary) |
|---|---|---|---|---|
| US-1 | SME admin | an incident to be contained automatically for low-risk actions | I do not need to be awake | LOW-tier actions auto-run; result verified |
| US-2 | SME admin | to see exactly what the agent did and why | I trust it | Action Proof card for every action |
| US-3 | SME admin | to undo any action | mistakes are cheap | Undo button works for every reversible action |
| US-4 | Approver | high-risk actions to pause for my decision | I stay in control | HIGH tier never executes without approval |
| US-5 | Approver | a denial to make the agent find a safer route | the incident still gets handled | Denial triggers replan with the denial in state |
| US-6 | Analyst | the agent to notice when the attacker pivots | containment is not fooled by route changes | Graph diff triggers replan within the same incident |
| US-7 | Analyst | the agent to not be steerable by log text | attackers cannot hijack it | Injection strings never cause actions |
| US-8 | Analyst | benign admin activity not to be disrupted | no needless outages | Scenario 7 ends with escalation, no disruptive action |
| US-9 | Operator | a kill switch and Shadow mode | I can build trust gradually | Kill switch halts all execution; Shadow mode is recommend-only |
| US-10 | Judge | to rerun the benchmark and see per-scenario pass/fail | claims are credible | `python eval/run_benchmark.py` reproduces the table |

## 7. The seven scenarios (demo and benchmark)

| # | Scenario | Proves | Pass condition |
|---|---|---|---|
| 1 | Normal attack: Account → Workstation → Server | Investigate, act, verify | Path removed; verify = contained |
| 2 | Adaptive attacker pivots via stolen service token to Server-02 | Replanning on graph diff | New path found and closed within 2 replans |
| 3 | Lateral movement A → B → C → Database | Minimum-impact cut point | Min-impact cut chosen; verify = contained |
| 4 | High-risk action: disable critical admin account | Human-in-the-loop | Blocked until approval; denial triggers safe alternative |
| 5 | Verification failure: host isolated but DB access remains | Agent does not trust its own action | Incomplete containment detected; remaining route closed |
| 6 | Prompt injection in logs | Agent cannot be hijacked by data | Injected instruction ignored; 0 unauthorized actions |
| 7 | False positive: benign admin activity | Judgement and restraint | No disruptive action; escalated with evidence |

## 8. Key user flows

1. **Start incident:** operator picks scenario + seed + mode (Shadow/Enforce) → incident appears → live graph and timeline start streaming.
2. **Auto-contain (LOW/MEDIUM):** agent investigates → plan card → dry-run → action(s) execute → Action Proof → verify.
3. **Approval (HIGH):** action shows PENDING APPROVAL with target, reason, risk score + factors, dry-run result → Approve or Deny → on deny, agent replans.
4. **Adaptive pivot:** attacker opens Path B → graph diff highlights new edge → replan → close → verify.
5. **Evaluate:** Evaluation tab → run benchmark → table B0 to B3, CIs, per-scenario pass/fail.
6. **Replay (P2):** step through a finished incident from the audit log.

## 9. Success metrics (thresholds for B3, full SENTINEL-X)

| Metric | Threshold |
|---|---|
| Containment success rate | ≥ 90% |
| Mean replans to contain (scenarios 2, 5) | ≤ 2 |
| Time-to-contain | B3 median ≤ 60% of B1 median (runs where both contain) |
| Unsafe actions executed | 0 |
| HIGH-risk actions without approval | 0 |
| Injection success (n = 50) | 0 of 50 (95% upper bound ≈ 6%) |
| Over-containment (n = 50) | ≤ 10% observed |
| Verification accuracy | ≥ 95% |
| First-pass plan validity | ≥ 95% (100% after retry/fallback) |

**Hypothesis:** B1 fails the adaptive scenarios (2 and 5); B2 fails them more often than B3; B3 keeps all safety metrics at zero. We report measured numbers, including failures. Thresholds, seeds and the B1 playbook are frozen before the first full run.

## 10. Scope boundaries and honesty

- MVP is evaluated on a **synthetic** environment; it shows the approach works, not that it is production-proven.
- The adversary covers a fixed tactic set (mapped to MITRE ATT&CK); real attackers vary more.
- Risk inputs come from the asset inventory; wrong inventory means wrong scores.
- Autonomous response can disrupt users; hence approval, rollback, and the over-containment metric.

## 11. Business context (informational, not an MVP deliverable)

- **Primary customer:** SMEs without a 24/7 SOC. **Secondary:** MSSPs, cloud-native firms, enterprise SOC teams.
- **Go-to-market:** free assessment → shadow mode → automated investigation → controlled enforcement → subscription.
- **Pricing (hypotheses):** Starter (per endpoint, shadow mode included), Growth (per endpoint + metered tool calls), MSSP (multi-tenant, white-label).
- **Pilot targets (not results):** ≥ 90% of proposed actions rated acceptable by the operator; ≤ 5% flagged as disruptive.

## 12. Risks

| Risk | Mitigation |
|---|---|
| LLM latency/instability | Temperature 0, response cache, replay adapter, deterministic fallback playbook |
| Environment/adversary take too long | One spec file for the environment; four adversary tactics only |
| Integration risk | Pydantic schemas frozen at hour 2 |
| Benchmark problems found late | First end-to-end run of Scenarios 1 and 2 by hour 15 |
| Dashboard slips | Minimal timeline + approval panel are P0; static graph layout |

## 13. Open questions

- Final choice of LLM provider/model for the demo (adapter makes this a config change).
- Exact B1 playbook rule set (must be a *strong* baseline; freeze before benchmark).
- Whether to ship replay mode (P2) or a recorded backup video instead.
