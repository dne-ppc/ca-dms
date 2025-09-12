#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const ISSUES_FILE = 'ISSUES.md';

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
    const bytesRead = require('fs').readSync(process.stdin.fd, buffer, 0, 1, null);
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
    
    // Add issue to current issues section
    const currentIssuesMatch = updatedContent.match(/(## 📋 Current Issues\s*\n)([\s\S]*?)(\n---\s*\n---)/);
    
    if (currentIssuesMatch) {
      const beforeSection = currentIssuesMatch[1];
      let currentSection = currentIssuesMatch[2];
      const afterSection = currentIssuesMatch[3];
      
      // Remove "*No open issues*" if it exists
      currentSection = currentSection.replace(/\*No open issues\*\s*\n?/, '');
      
      // Add new issue
      const newCurrentSection = beforeSection + currentSection + issueEntry + afterSection;
      updatedContent = updatedContent.replace(currentIssuesMatch[0], newCurrentSection);
    }
    
    writeFileSync(ISSUES_FILE, updatedContent);
    
    console.log(`${colors.green}${colors.bold}✅ Issue #${issueData.number.toString().padStart(3, '0')} added successfully!${colors.reset}`);
    console.log(`${colors.cyan}Updated statistics: ${totalIssues} total issues, ${openIssues} open issues${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Error updating ISSUES.md: ${error.message}${colors.reset}`);
    process.exit(1);
  }
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

main();