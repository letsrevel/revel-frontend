#!/usr/bin/env python3
"""
Generate updated i18n-sweep.md with scan results.
"""

import json
from pathlib import Path
from collections import defaultdict

def load_scan_results():
    """Load the scan results JSON."""
    with open('i18n-scan-results.json', 'r') as f:
        return json.load(f)

def group_files_by_directory(results):
    """Group files by their directory structure."""
    grouped = defaultdict(list)

    for file_path, data in results.items():
        parts = Path(file_path).parts
        if len(parts) > 1:
            if parts[0] == 'lib':
                if len(parts) > 2:
                    group = f"src/lib/components/{parts[2]}"
                else:
                    group = f"src/lib/components/{parts[1]}"
            elif parts[0] == 'routes':
                group = f"src/routes/{'/'.join(parts[1:-1])}"
            else:
                group = f"src/{parts[0]}"
        else:
            group = "src"

        grouped[group].append({
            'path': file_path,
            'filename': parts[-1],
            'priority': data['priority'],
            'count': data['count'],
            'strings': data['strings']
        })

    return grouped

def generate_markdown(results, all_svelte_files):
    """Generate the updated markdown content."""
    md = []

    md.append("# i18n Translation Sweep - Complete Inventory")
    md.append("")
    md.append("**Total Files**: 213")
    md.append(f"**Files with Hardcoded Strings**: {len(results)}")
    md.append(f"**Files Already Clean**: {213 - len(results)}")
    md.append(f"**Total Strings to Translate**: ~723")
    md.append("**Status**: Initial scan complete - ready for systematic translation")
    md.append("**Created**: 2025-01-04")
    md.append("")
    md.append("---")
    md.append("")
    md.append("## How to Use This File")
    md.append("")
    md.append("- [ ] = Not checked yet / needs translation")
    md.append("- [~] = In progress")
    md.append("- [x] = Completed (all strings translated)")
    md.append("- [SKIP] = No user-facing strings (e.g., test files, demos)")
    md.append("")
    md.append("Mark findings with:")
    md.append("- 🔴 HIGH: User-facing UI strings")
    md.append("- 🟡 MED: Admin/staff strings")
    md.append("- 🟢 LOW: Debug/internal strings")
    md.append("- ⚪ NONE: No hardcoded strings found")
    md.append("")
    md.append("---")
    md.append("")
    md.append("## Summary Statistics")
    md.append("")

    # Calculate stats
    high_count = sum(1 for d in results.values() if d['priority'] == '🔴 HIGH')
    med_count = sum(1 for d in results.values() if d['priority'] == '🟡 MED')
    low_count = sum(1 for d in results.values() if d['priority'] == '🟢 LOW')

    md.append(f"- 🔴 **HIGH Priority**: {high_count} files (~{sum(d['count'] for d in results.values() if d['priority'] == '🔴 HIGH')} strings)")
    md.append(f"- 🟡 **MEDIUM Priority**: {med_count} files (~{sum(d['count'] for d in results.values() if d['priority'] == '🟡 MED')} strings)")
    md.append(f"- 🟢 **LOW Priority**: {low_count} files (~{sum(d['count'] for d in results.values() if d['priority'] == '🟢 LOW')} strings)")
    md.append(f"- ⚪ **Clean**: {213 - len(results)} files")
    md.append("")
    md.append("---")
    md.append("")
    md.append("## Priority Files - Start Here!")
    md.append("")
    md.append("### 🔴 TOP 10 HIGH PRIORITY FILES")
    md.append("")

    # Get top 10 high priority files
    high_priority = [(path, data) for path, data in results.items() if data['priority'] == '🔴 HIGH']
    high_priority_sorted = sorted(high_priority, key=lambda x: x[1]['count'], reverse=True)[:10]

    for i, (path, data) in enumerate(high_priority_sorted, 1):
        md.append(f"{i}. **{Path(path).name}** ({data['count']} strings)")
        md.append(f"   - Path: `{path}`")
        if data['strings']:
            md.append(f"   - Examples: `{data['strings'][0][1][:50]}`, `{data['strings'][1][1][:50] if len(data['strings']) > 1 else '...'}`")
        md.append("")

    md.append("---")
    md.append("")
    md.append("## Complete File List (Grouped by Directory)")
    md.append("")

    # Group files by directory
    grouped = group_files_by_directory(results)

    # Common directory groups
    common_groups = [
        "src/lib/components/common",
        "src/lib/components/events",
        "src/lib/components/events/admin",
        "src/lib/components/organizations",
        "src/lib/components/members",
        "src/lib/components/questionnaires",
        "src/lib/components/forms",
        "src/lib/components/tickets",
        "src/lib/components/tokens",
        "src/lib/components/resources",
        "src/routes/(public)",
        "src/routes/(auth)/dashboard",
        "src/routes/(auth)/account",
        "src/routes/(auth)/org/[slug]/admin",
    ]

    # Add all other groups
    all_groups = sorted(set(list(grouped.keys()) + common_groups))

    for group in all_groups:
        md.append(f"### {group}")
        md.append("")

        files = grouped.get(group, [])
        if files:
            for file_data in sorted(files, key=lambda x: x['filename']):
                status = "[ ]" if file_data['count'] > 0 else "[x]"
                priority = file_data['priority'] if file_data['count'] > 0 else "⚪"
                md.append(f"- {status} `{file_data['filename']}` {priority} ({file_data['count']} strings)")
        else:
            md.append("- (No files with hardcoded strings)")

        md.append("")

    md.append("---")
    md.append("")
    md.append("## Detailed Findings")
    md.append("")
    md.append("### 🔴 HIGH Priority - User-Facing Strings")
    md.append("")

    high_files = sorted(
        [(path, data) for path, data in results.items() if data['priority'] == '🔴 HIGH'],
        key=lambda x: x[1]['count'],
        reverse=True
    )

    for path, data in high_files:
        md.append(f"#### {Path(path).name}")
        md.append(f"**Path**: `{path}`")
        md.append(f"**Count**: {data['count']} hardcoded strings")
        md.append("")
        md.append("**Sample Strings**:")
        for line_num, string in data['strings'][:5]:
            md.append(f"- Line {line_num}: `{string}`")
        if data['count'] > 5:
            md.append(f"- ... and {data['count'] - 5} more")
        md.append("")

    md.append("### 🟡 MEDIUM Priority - Admin/Staff Strings")
    md.append("")

    med_files = sorted(
        [(path, data) for path, data in results.items() if data['priority'] == '🟡 MED'],
        key=lambda x: x[1]['count'],
        reverse=True
    )[:20]  # Show top 20 only

    for path, data in med_files:
        md.append(f"#### {Path(path).name}")
        md.append(f"**Path**: `{path}` | **Count**: {data['count']} strings")
        md.append("")

    md.append("### 🟢 LOW Priority - Internal Strings")
    md.append("")

    low_files = sorted(
        [(path, data) for path, data in results.items() if data['priority'] == '🟢 LOW'],
        key=lambda x: x[1]['count'],
        reverse=True
    )

    for path, data in low_files:
        md.append(f"- `{path}` ({data['count']} strings)")

    md.append("")
    md.append("---")
    md.append("")
    md.append("## Next Steps")
    md.append("")
    md.append("1. **Start with HIGH priority files** - Focus on user-facing components first")
    md.append("2. **Extract strings to translation files** - Add to messages/en.json, de.json, it.json")
    md.append("3. **Replace with m['key']() calls** - Use Paraglide translation syntax")
    md.append("4. **Test in all 3 languages** - Verify translations work correctly")
    md.append("5. **Mark files as complete** - Update checkboxes as you go")
    md.append("6. **Run static checks** - Use `pnpm i18n:check-imports` before committing")
    md.append("")

    return '\n'.join(md)

if __name__ == '__main__':
    import os
    os.chdir('/Users/biagio/repos/letsrevel/revel-frontend')

    results = load_scan_results()
    markdown = generate_markdown(results, 213)

    with open('i18n-sweep.md', 'w') as f:
        f.write(markdown)

    print("✅ Updated i18n-sweep.md with detailed findings")
