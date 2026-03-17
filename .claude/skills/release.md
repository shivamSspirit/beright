# Skill: Release

Version release workflow for BeRight.

## When to Use
- Creating a new version release
- Tagging stable milestones
- Preparing changelogs

## Pre-Release Checklist

### 1. Code Quality
```bash
npm run typecheck
npm run build
npm run lint
```

### 2. Git Status
```bash
git status  # Should be clean
git branch  # Should be on main
git pull origin main
```

### 3. Review Changes
```bash
# Changes since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Files changed
git diff $(git describe --tags --abbrev=0)..HEAD --stat
```

## Release Steps

### 1. Determine Version
Follow semver:
- MAJOR: Breaking changes
- MINOR: New features, backwards compatible
- PATCH: Bug fixes

### 2. Update Version
Edit `package.json`:
```json
{
  "version": "X.Y.Z"
}
```

### 3. Generate Changelog
Create entry in CHANGELOG.md (if exists):
```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Fixed
- Bug fixes

### Security
- Security updates
```

### 4. Commit Version Bump
```bash
git add package.json CHANGELOG.md
git commit -m "chore: release vX.Y.Z"
```

### 5. Create Tag
```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z

- Feature 1
- Feature 2
- Fix 1"
```

### 6. Push
```bash
git push origin main
git push origin vX.Y.Z
```

### 7. Deploy
```bash
railway up
```

### 8. Create GitHub Release (optional)
```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes "Release notes..."
```

## Post-Release

1. Verify production is stable
2. Monitor for issues
3. Announce to team if significant release
