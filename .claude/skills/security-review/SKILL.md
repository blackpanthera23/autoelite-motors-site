---
name: security-review
description: Review the security of pending/uncommitted changes in this repository before they get committed or shipped. This is AutoElite Motors, a static HTML/CSS/JS marketing site with no backend, database, or build step, so the review is tuned to client-side risk — DOM-based XSS (innerHTML/outerHTML/document.write/insertAdjacentHTML fed by anything other than a fixed string), eval/Function/setTimeout-with-a-string, hardcoded secrets or real personal data slipping into HTML or inline <script>, unsafe third-party script or link inclusion (http instead of https, unfamiliar domains, target="_blank" without rel="noopener noreferrer"), and forms or client-side checks that could be mistaken for real security when there is no server to enforce anything. Use this whenever the user asks to review security, check for vulnerabilities, "is this safe to commit/ship", or before helping commit/push changes that touch any .html file, inline <script>, or <a>/<form> tag. Trigger even if the user doesn't say the word "security" but describes adding a script tag, a search/filter box, a new link, or anything that writes content into the DOM.
---

You are reviewing the security of this repo's **current changes** — not the whole codebase from scratch, and not a general code-quality pass (that's `code-quality-reviewer`).

## What counts as "current changes"

This repo is a git repository. Run these to see exactly what's new or modified:

```bash
git status --porcelain
git diff HEAD
```

- For modified tracked files, `git diff HEAD` shows the change.
- For new/untracked files, `git diff` shows nothing — read the whole file instead.
- If there are no pending changes at all, say so plainly and stop. Do not review the whole site from scratch or invent findings just to have something to report — that isn't what was asked, and it buries real issues from past reviews in noise.

Always read each changed file **in full**, not just the diff hunk. A line can look safe in isolation but unsafe in the surrounding context — e.g. a new variable that gets assigned safely on the line you see, but is then piped into an existing `innerHTML` sink three lines below the diff window.

## What to check

Given this site has no backend, database, or build pipeline (see CLAUDE.md), skip server-side categories like SQL injection, auth, or response headers — they're not reachable here and flagging them is just noise. Focus on what an attacker could actually do against a static page served as-is:

1. **DOM XSS** — any new or modified `.innerHTML =`, `.outerHTML =`, `document.write(`, `insertAdjacentHTML(` where the value isn't a fixed string literal, especially if it traces back to `location`, `document.referrer`, a URL query param, or any form/input value. This is the most realistic vulnerability class for a site like this (e.g., a new "search inventory" or "filter cars" box that renders results via `innerHTML`).
2. **Dynamic code execution** — `eval(`, `new Function(`, `setTimeout("...")`/`setInterval("...")` with a string argument instead of a function.
3. **Hardcoded secrets or real PII** — API keys, tokens, or credentials added into HTML or inline `<script>`. (Note: the existing placeholder dealership contact info — address, phone, email — is intentional business content, not a leak; don't flag it.)
4. **Unsafe external resources** — a new `<script src=` or `<link href=` pointing at `http://` instead of `https://`, or at a domain that has no obvious reason to be there.
5. **Reverse tabnabbing** — new `target="_blank"` links missing `rel="noopener noreferrer"`.
6. **False sense of security** — a new form or client-side check implemented as if it enforces something (e.g., comments implying validation is "handled", or sensitive-looking fields with no indication this is decorative). Since `contact.html`'s form has no backend by design, anything that implies otherwise is worth flagging so nobody mistakes cosmetic JS for a real control.

## How to report

Follow the same severity convention as this repo's other reviewer agents (`.claude/agents/code-quality-reviewer.md`, `.claude/agents/database-reviewer.md`):

- **Critical** — exploitable as committed (e.g., innerHTML rendering an unescaped URL param).
- **Warning** — a real risk under plausible future use (e.g., a pattern that's safe today only because no attacker-controlled data flows into it yet, but would break the moment it did).
- **Suggestion** — defense-in-depth, not currently exploitable.

For each finding: cite `file:line`, state the concrete exploit scenario (not just "this could be unsafe" — show the input that would trigger it), and give the minimal fix. Don't rewrite unrelated code and don't pad the report — a clean diff gets a short "no security issues in this change" response, not manufactured findings.
