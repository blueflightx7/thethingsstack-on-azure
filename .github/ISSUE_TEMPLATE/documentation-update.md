---
name: Documentation Update
about: Template for updating existing documentation
title: '[DOCS] '
labels: documentation
assignees: ''
---

## Documentation to Update

**File(s)**: 
- [ ] Specify which documentation file(s) need updating

**Section(s)**:
- [ ] List specific sections that need changes

---

## Proposed Changes

### What needs to change?
<!-- Describe what content needs to be updated, added, or removed -->

### Why is this change needed?
<!-- Explain the reason: outdated info, missing details, user feedback, etc. -->

---

## Documentation Checklist

Before submitting documentation updates, ensure:

### Content Quality
- [ ] Information is accurate and up-to-date
- [ ] Examples have been tested and work correctly
- [ ] Command snippets use correct PowerShell/Bash syntax
- [ ] All links (internal and external) are valid
- [ ] Screenshots/diagrams are current (if applicable)

### Style Guide Compliance
- [ ] Front matter metadata is complete (title, description, status, owner, lastUpdated)
- [ ] Headings follow proper hierarchy (H1 → H2 → H3, no skipping)
- [ ] Code blocks have language identifiers (```powershell, ```bash, etc.)
- [ ] Tables are properly formatted with headers
- [ ] Admonitions use standard icons (⚠️, 💡, 📝, ✅, ❌)
- [ ] File names and commands are wrapped in backticks

### Cross-References
- [ ] Updated Table of Contents (if applicable)
- [ ] Added links to related documentation
- [ ] Updated docs/index.md navigation (if new doc or major restructure)
- [ ] Referenced critical fixes when modifying deployment docs

### Technical Accuracy
- [ ] Deployment parameters are correct
- [ ] File paths and line numbers are accurate
- [ ] Bicep/PowerShell code follows project conventions
- [ ] Security best practices are maintained

### Testing
- [ ] Ran markdownlint on updated files
- [ ] Verified all code examples execute successfully
- [ ] Tested links don't return 404s
- [ ] Previewed documentation rendering

---

## Impact Assessment

**Affected Documentation Areas**:
- [ ] Learn (getting started, concepts)
- [ ] Deploy (deployment guides)
- [ ] Operate (operations, troubleshooting)
- [ ] Reference (technical deep-dives)
- [ ] History (project timeline)

**Breaking Changes**: 
- [ ] Yes (describe below)
- [ ] No

<!-- If yes, explain what existing workflows/commands will change -->

---

## Related Issues/PRs

- Related to #
- Fixes #

---

## Additional Context

<!-- Add any other context, screenshots, or examples about the documentation update here -->

---

## Reviewer Notes

**Review Focus Areas**:
- [ ] Technical accuracy
- [ ] Style guide compliance
- [ ] Completeness of examples
- [ ] Link validity
- [ ] Critical fix preservation (if applicable)
