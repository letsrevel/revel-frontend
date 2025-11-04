#!/usr/bin/env python3
"""
Scan all .svelte files for hardcoded strings that need i18n translation.
Generates a comprehensive report for the i18n sweep.
"""

import re
import os
from pathlib import Path
from typing import List, Tuple
import json

# Patterns to identify hardcoded English strings
PATTERNS = [
    # Quoted strings that look like English text (capital letter start, spaces, common words)
    r'"([A-Z][a-z\s,\']{4,})"',
    r"'([A-Z][a-z\s,\']{4,})'",
    # Common error/success message patterns
    r'(Failed to \w+)',
    r'(Successfully \w+)',
    r'(Error:? [A-Z][a-z\s]+)',
    r'(Unable to \w+)',
    r'(Please \w+)',
    r'(Are you sure)',
    r'(Do you want)',
]

# Patterns to EXCLUDE (false positives)
EXCLUDE_PATTERNS = [
    r'import\s+',
    r'from\s+["\']',
    r'm\[',  # Already using i18n
    r'aria-',
    r'class=',
    r'id=',
    r'name=',
    r'type=',
    r'placeholder=',  # Will check these separately
    r'\.svelte',
    r'^\$',  # Svelte stores/runes
    r'http[s]?://',
    r'^\d+$',  # Numbers
]

# Common false positive strings to skip
FALSE_POSITIVES = {
    'Check', 'Submit', 'Cancel', 'Delete', 'Edit', 'Save', 'Close',
    'Loading', 'Error', 'Success', 'Warning', 'Info',
    'Yes', 'No', 'OK', 'Back', 'Next', 'Previous',
}

def should_exclude(line: str, match: str) -> bool:
    """Check if a matched string should be excluded."""
    # Check if line contains exclude patterns
    for pattern in EXCLUDE_PATTERNS:
        if re.search(pattern, line):
            return True

    # Check if match is a common false positive
    if match.strip() in FALSE_POSITIVES:
        return True

    # Skip if it's a translation key (contains dots or underscores)
    if '.' in match or '_' in match:
        return True

    # Skip very short strings (likely not user-facing)
    if len(match.strip()) < 4:
        return True

    return False

def extract_hardcoded_strings(file_path: Path) -> List[Tuple[int, str]]:
    """Extract hardcoded strings from a Svelte file."""
    findings = []

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        for line_num, line in enumerate(lines, 1):
            # Skip script imports section
            if 'import ' in line and 'from ' in line:
                continue

            # Check each pattern
            for pattern in PATTERNS:
                matches = re.finditer(pattern, line)
                for match in matches:
                    text = match.group(1) if match.groups() else match.group(0)
                    text = text.strip('"\'')

                    if not should_exclude(line, text):
                        findings.append((line_num, text))

        # Also check for text content in HTML (between tags)
        content = ''.join(lines)
        # Match text between > and < that looks like English
        html_text_pattern = r'>([A-Z][a-zA-Z\s,\.!?]{5,})<'
        for match in re.finditer(html_text_pattern, content):
            text = match.group(1).strip()
            if not any(char in text for char in ['{', '}', '$', '@']) and text not in FALSE_POSITIVES:
                # Find approximate line number
                text_pos = match.start()
                line_num = content[:text_pos].count('\n') + 1
                findings.append((line_num, text))

    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return []

    # Deduplicate findings
    seen = set()
    unique_findings = []
    for line_num, text in findings:
        if text not in seen:
            seen.add(text)
            unique_findings.append((line_num, text))

    return unique_findings

def classify_priority(file_path: Path, strings: List[Tuple[int, str]]) -> str:
    """Classify priority based on file path and content."""
    path_str = str(file_path)

    # HIGH priority: Public-facing, auth, events, organizations
    if any(keyword in path_str for keyword in [
        '(public)', 'events/', 'organizations/', 'login', 'register',
        'dashboard', 'EventCard', 'OrganizationCard', 'Header', 'Footer',
        'Navigation', 'Landing'
    ]):
        return '🔴 HIGH'

    # MEDIUM priority: Admin, forms, modals
    if any(keyword in path_str for keyword in [
        'admin/', 'forms/', 'Modal', 'Dialog', 'members/', 'questionnaires/'
    ]):
        return '🟡 MED'

    # LOW priority: UI components, utilities
    if any(keyword in path_str for keyword in [
        'ui/', 'utils/', 'types', 'skeleton', 'Badge', 'Button'
    ]):
        return '🟢 LOW'

    # Default to MEDIUM if uncertain
    return '🟡 MED'

def scan_all_files():
    """Scan all .svelte files and generate report."""
    src_dir = Path('src')
    svelte_files = list(src_dir.rglob('*.svelte'))

    results = {}
    total_files_with_findings = 0
    total_strings_found = 0

    print(f"🔍 Scanning {len(svelte_files)} .svelte files...\n")

    for file_path in sorted(svelte_files):
        findings = extract_hardcoded_strings(file_path)

        if findings:
            priority = classify_priority(file_path, findings)
            relative_path = file_path.relative_to(src_dir)

            results[str(relative_path)] = {
                'priority': priority,
                'count': len(findings),
                'strings': findings[:10]  # Show first 10
            }

            total_files_with_findings += 1
            total_strings_found += len(findings)

    # Generate summary report
    print(f"\n📊 SCAN SUMMARY")
    print(f"=" * 60)
    print(f"Total files scanned: {len(svelte_files)}")
    print(f"Files with hardcoded strings: {total_files_with_findings}")
    print(f"Total hardcoded strings found: {total_strings_found}")
    print(f"Files already clean: {len(svelte_files) - total_files_with_findings}")
    print(f"=" * 60)

    # Breakdown by priority
    high_priority = [f for f, d in results.items() if d['priority'] == '🔴 HIGH']
    med_priority = [f for f, d in results.items() if d['priority'] == '🟡 MED']
    low_priority = [f for f, d in results.items() if d['priority'] == '🟢 LOW']

    print(f"\n🔴 HIGH Priority: {len(high_priority)} files")
    print(f"🟡 MEDIUM Priority: {len(med_priority)} files")
    print(f"🟢 LOW Priority: {len(low_priority)} files")

    # Show top offenders
    print(f"\n📋 TOP 20 FILES WITH MOST HARDCODED STRINGS:")
    print(f"-" * 60)
    sorted_results = sorted(results.items(), key=lambda x: x[1]['count'], reverse=True)
    for i, (file_path, data) in enumerate(sorted_results[:20], 1):
        print(f"{i:2}. {data['priority']} {file_path}")
        print(f"    {data['count']} hardcoded strings")
        if data['strings']:
            print(f"    Examples: {data['strings'][0][1][:60]}...")

    # Save detailed results to JSON
    with open('i18n-scan-results.json', 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\n✅ Detailed results saved to i18n-scan-results.json")

    return results

if __name__ == '__main__':
    os.chdir('/Users/biagio/repos/letsrevel/revel-frontend')
    scan_all_files()
