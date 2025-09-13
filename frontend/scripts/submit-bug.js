#!/usr/bin/env node

import { readFileSync, writeFileSync, readSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const ISSUES_FILE = path.join('..', 'ISSUES.md');

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function prompt(question) {
  process.stdout.write(`${colors.cyan}${question}${colors.reset} `);
  const buffer = Buffer.alloc(1);
  let input = '';

  while (true) {
    const bytesRead = readSync(process.stdin.fd, buffer, 0, 1, null);
    if (bytesRead === 0) break;

    const char = buffer.toString('utf8');
    if (char === '\n' || char === '\r') break;

    input += char;
    process.stdout.write(char);
  }

  process.stdout.write('\n');
  return input.trim();
}

function getNextIssueNumber() {
  try {
    const issuesContent = readFileSync(ISSUES_FILE, 'utf8');
    const matches = issuesContent.match(/### Issue #?(\d+):/g);
    
    if (!matches || matches.length === 0) {
      return 1;
    }
    
    const numbers = matches.map(match => {
      const num = match.match(/\d+/);
      return num ? parseInt(num[0]) : 0;
    });
    
    return Math.max(...numbers) + 1;
  } catch (error) {
    return 1;
  }
}

function takeScreenshot() {
  try {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const screenshotPath = `/home/david/Pictures/Screenshots/issue-${timestamp}.png`;
    
    console.log(`${colors.yellow}Taking screenshot...${colors.reset}`);
    
    // Try different screenshot tools
    try {
      execSync(`gnome-screenshot -f "${screenshotPath}"`, { stdio: 'pipe' });
    } catch {
      try {
        execSync(`scrot "${screenshotPath}"`, { stdio: 'pipe' });
      } catch {
        try {
          execSync(`import -window root "${screenshotPath}"`, { stdio: 'pipe' });
        } catch {
          console.log(`${colors.yellow}Could not take screenshot automatically. Please take one manually.${colors.reset}`);
          return null;
        }
      }
    }
    
    console.log(`${colors.green}Screenshot saved: ${screenshotPath}${colors.reset}`);
    return screenshotPath;
  } catch (error) {
    console.log(`${colors.yellow}Could not take screenshot: ${error.message}${colors.reset}`);
    return null;
  }
}

function addIssueToFile(issueData) {
  try {
    const issuesContent = readFileSync(ISSUES_FILE, 'utf8');

    // Parse current statistics
    const totalMatch = issuesContent.match(/- Total Issues: (\d+)/);
    const openMatch = issuesContent.match(/- Open Issues: (\d+)/);

    const totalIssues = totalMatch ? parseInt(totalMatch[1]) + 1 : 1;
    const openIssues = openMatch ? parseInt(openMatch[1]) + 1 : 1;

    // Map issue types to table rows
    const typeMapping = {
      'Bug': 'Bug',
      'Enhancement': 'Enhancement',
      'UI/UX': 'UI/UX',
      'Performance': 'Enhancement' // Map Performance to Enhancement for table
    };
    
    // Create issue entry
    const issueEntry = `
### Issue #${issueData.number.toString().padStart(3, '0')}: ${issueData.title}

**Status:** Open
**Priority:** ${issueData.priority}
**Type:** ${issueData.type}

#### Screenshot
${issueData.screenshot ? `![${issueData.title}](${issueData.screenshot})` : '*No screenshot provided*'}

#### Current Behavior
${issueData.currentBehavior}

#### Expected Behavior
${issueData.expectedBehavior}

#### Steps to Reproduce
${issueData.stepsToReproduce}

#### Environment
- Browser: ${issueData.browser}
- Screen Size: ${issueData.screenSize}
- User Role: ${issueData.userRole}
- OS: ${issueData.os}

#### Additional Context
${issueData.additionalContext}

---
`;

    // Update statistics
    let updatedContent = issuesContent
      .replace(/- Total Issues: \d+/, `- Total Issues: ${totalIssues}`)
      .replace(/- Open Issues: \d+/, `- Open Issues: ${openIssues}`);

    // Update statistics table
    const tableType = typeMapping[issueData.type] || 'Enhancement';

    // Find and update the appropriate row in the statistics table
    const tableRowPattern = new RegExp(`(\\| ${tableType} \\| )(\\d+)( \\| \\d+ \\| )(\\d+)( \\| )(\\d+)( \\|)`);
    const tableRowMatch = updatedContent.match(tableRowPattern);

    if (tableRowMatch) {
      const currentOpen = parseInt(tableRowMatch[2]);
      const currentResolved = parseInt(tableRowMatch[4]);
      const currentTotal = parseInt(tableRowMatch[6]);

      const newOpen = currentOpen + 1;
      const newTotal = currentTotal + 1;

      const newRow = `${tableRowMatch[1]}${newOpen}${tableRowMatch[3]}${currentResolved}${tableRowMatch[5]}${newTotal}${tableRowMatch[7]}`;
      updatedContent = updatedContent.replace(tableRowMatch[0], newRow);
    }

    // Update total row in statistics table
    const totalRowPattern = /(\| \*\*Total\*\* \| \*\*)(\d+)(\*\* \| \*\*\d+\*\* \| \*\*)(\d+)(\*\* \| \*\*)(\d+)(\*\* \|)/;
    const totalRowMatch = updatedContent.match(totalRowPattern);

    if (totalRowMatch) {
      const currentTotalOpen = parseInt(totalRowMatch[2]);
      const currentTotalResolved = parseInt(totalRowMatch[4]);
      const currentTotalAll = parseInt(totalRowMatch[6]);

      const newTotalOpen = currentTotalOpen + 1;
      const newTotalAll = currentTotalAll + 1;

      const newTotalRow = `${totalRowMatch[1]}${newTotalOpen}${totalRowMatch[3]}${currentTotalResolved}${totalRowMatch[5]}${newTotalAll}${totalRowMatch[7]}`;
      updatedContent = updatedContent.replace(totalRowMatch[0], newTotalRow);
    }
    
    // Add issue to current issues section
    // Look for the section and handle both empty and non-empty cases
    const currentIssuesSectionRegex = /(## 📋 Current Open Issues\s*\n)([\s\S]*?)(\n---\s*\n## ✅ Resolved Issues)/;
    const currentIssuesMatch = updatedContent.match(currentIssuesSectionRegex);

    if (currentIssuesMatch) {
      const beforeSection = currentIssuesMatch[1];
      let currentSection = currentIssuesMatch[2];
      const afterSectionStart = currentIssuesMatch[3];

      // Remove "*No open issues*" if it exists
      currentSection = currentSection.replace(/\*No open issues\*\s*\n?/, '');

      // Clean up current section - remove extra dashes if it's empty
      currentSection = currentSection.replace(/^---\s*\n?/, '').trim();

      // Add new issue (with proper spacing)
      const cleanedCurrentSection = currentSection ? currentSection + '\n\n' : '';
      const newCurrentSection = beforeSection + cleanedCurrentSection + issueEntry + '\n' + afterSectionStart;
      updatedContent = updatedContent.replace(currentIssuesMatch[0], newCurrentSection);
    } else {
      console.error(`${colors.red}Could not find Current Open Issues section in ISSUES.md${colors.reset}`);
      console.log(`${colors.yellow}Looking for pattern: ## 📋 Current Open Issues${colors.reset}`);

      // Fallback: try to find just the section header
      const simpleMatch = updatedContent.match(/(## 📋 Current Open Issues\s*\n)([\s\S]*?)(\n---)/);
      if (simpleMatch) {
        console.log(`${colors.cyan}Found section with simple pattern${colors.reset}`);
        const beforeSection = simpleMatch[1];
        let currentSection = simpleMatch[2].replace(/\*No open issues\*\s*\n?/, '').trim();
        const afterSection = simpleMatch[3];

        const cleanedCurrentSection = currentSection ? currentSection + '\n\n' : '';
        const newCurrentSection = beforeSection + cleanedCurrentSection + issueEntry + afterSection;
        updatedContent = updatedContent.replace(simpleMatch[0], newCurrentSection);
      }
    }
    
    writeFileSync(ISSUES_FILE, updatedContent);
    
    console.log(`${colors.green}${colors.bold}✅ Issue #${issueData.number.toString().padStart(3, '0')} added successfully!${colors.reset}`);
    console.log(`${colors.cyan}Updated statistics: ${totalIssues} total issues, ${openIssues} open issues${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Error updating ISSUES.md: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

function testMode() {
  console.log(`${colors.bold}${colors.blue}🧪 Testing Bug Script${colors.reset}\n`);

  const issueNumber = getNextIssueNumber();
  console.log(`${colors.cyan}Creating test Issue #${issueNumber.toString().padStart(3, '0')}${colors.reset}\n`);

  const issueData = {
    number: issueNumber,
    title: 'Test Issue for Script Validation',
    priority: 'Low',
    type: 'Bug',
    screenshot: null,
    currentBehavior: 'Script testing mode is active',
    expectedBehavior: 'Script should add issue to ISSUES.md correctly',
    stepsToReproduce: '1. Run script in test mode\n2. Check ISSUES.md file',
    browser: 'Not specified',
    screenSize: 'Not specified',
    userRole: 'Developer',
    os: 'Linux',
    additionalContext: 'This is a test issue created to validate the bug submission script'
  };

  console.log(`${colors.yellow}Creating test issue...${colors.reset}`);
  addIssueToFile(issueData);
}

function main() {
  console.log(`${colors.bold}${colors.blue}🐛 CA-DMS Bug Reporter${colors.reset}\n`);

  const issueNumber = getNextIssueNumber();
  console.log(`${colors.cyan}Creating Issue #${issueNumber.toString().padStart(3, '0')}${colors.reset}\n`);

  const title = prompt('Issue Title:');
  if (!title) {
    console.log(`${colors.red}Issue title is required.${colors.reset}`);
    process.exit(1);
  }

  const priority = prompt('Priority (Critical/High/Medium/Low) [Medium]:') || 'Medium';
  const type = prompt('Type (Bug/Enhancement/UI/UX/Performance) [Bug]:') || 'Bug';

  console.log(`${colors.yellow}Would you like to take a screenshot? (y/n) [y]:${colors.reset}`);
  const takeScreenshotChoice = prompt('') || 'y';

  let screenshot = null;
  if (takeScreenshotChoice.toLowerCase() === 'y' || takeScreenshotChoice.toLowerCase() === 'yes') {
    screenshot = takeScreenshot();
  }

  const currentBehavior = prompt('Current Behavior:');
  const expectedBehavior = prompt('Expected Behavior:');
  const stepsToReproduce = prompt('Steps to Reproduce:');

  const browser = prompt('Browser [Not specified]:') || 'Not specified';
  const screenSize = prompt('Screen Size [Not specified]:') || 'Not specified';
  const userRole = prompt('User Role [Not specified]:') || 'Not specified';
  const os = prompt('OS [Not specified]:') || 'Not specified';

  const additionalContext = prompt('Additional Context [None]:') || '*None*';

  const issueData = {
    number: issueNumber,
    title,
    priority,
    type,
    screenshot,
    currentBehavior,
    expectedBehavior,
    stepsToReproduce,
    browser,
    screenSize,
    userRole,
    os,
    additionalContext
  };

  console.log(`\n${colors.yellow}Creating issue...${colors.reset}`);
  addIssueToFile(issueData);
}

// Check if running in test mode
if (process.argv.includes('--test')) {
  testMode();
} else {
  main();
}