#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ISSUES_FILE = path.join(__dirname, '../ISSUES.md');
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function getNextIssueNumber() {
  try {
    const content = fs.readFileSync(ISSUES_FILE, 'utf8');
    const match = content.match(/Next Issue Number: #(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
  } catch (error) {
    console.log('Could not read ISSUES.md, starting from issue #001');
  }
  return 1;
}

function updateNextIssueNumber(current) {
  try {
    let content = fs.readFileSync(ISSUES_FILE, 'utf8');
    const next = String(current + 1).padStart(3, '0');
    content = content.replace(
      /Next Issue Number: #\d+/,
      `Next Issue Number: #${next}`
    );
    fs.writeFileSync(ISSUES_FILE, content);
  } catch (error) {
    console.log('Warning: Could not update issue counter');
  }
}

function updateIssueStats(type) {
  try {
    let content = fs.readFileSync(ISSUES_FILE, 'utf8');
    
    // Update total issues
    content = content.replace(/Total Issues: (\d+)/, (match, num) => {
      return `Total Issues: ${parseInt(num) + 1}`;
    });
    
    // Update open issues
    content = content.replace(/Open Issues: (\d+)/, (match, num) => {
      return `Open Issues: ${parseInt(num) + 1}`;
    });
    
    // Update type-specific counter
    const typeMap = {
      'Bug': 'Bug',
      'Enhancement': 'Enhancement', 
      'UI/UX': 'UI/UX',
      'Performance': 'Performance'
    };
    
    if (typeMap[type]) {
      const regex = new RegExp(`(\\| ${typeMap[type]} \\| )(\\d+)( \\| \\d+ \\| \\d+ \\| )(\\d+)( \\|)`);
      content = content.replace(regex, (match, prefix, openCount, middle, totalCount, suffix) => {
        return `${prefix}${parseInt(openCount) + 1}${middle}${parseInt(totalCount) + 1}${suffix}`;
      });
    }
    
    fs.writeFileSync(ISSUES_FILE, content);
  } catch (error) {
    console.log('Warning: Could not update issue statistics');
  }
}

function addIssueToMarkdown(issueData) {
  try {
    let content = fs.readFileSync(ISSUES_FILE, 'utf8');
    
    const issueEntry = `
### Issue ${issueData.number}: ${issueData.title}

**Status:** Open
**Priority:** ${issueData.priority}
**Type:** ${issueData.type}

#### Screenshot
${issueData.screenshotPath ? `![${issueData.title}](${issueData.screenshotPath})` : '*No screenshot provided*'}

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

    // Find where to insert (after "## 📋 Current Issues" and before "### Critical Issues")
    const insertPoint = content.indexOf('*No open issues*');
    if (insertPoint !== -1) {
      // Replace "No open issues" with the new issue
      content = content.replace('*No open issues*', issueEntry.trim());
    } else {
      // Find a good insertion point
      const currentIssuesIndex = content.indexOf('## 📋 Current Issues');
      const criticalIssuesIndex = content.indexOf('### Critical Issues');
      
      if (currentIssuesIndex !== -1 && criticalIssuesIndex !== -1) {
        const insertionPoint = criticalIssuesIndex;
        content = content.slice(0, insertionPoint) + issueEntry + content.slice(insertionPoint);
      }
    }
    
    fs.writeFileSync(ISSUES_FILE, content);
    console.log('✅ Issue added to ISSUES.md successfully!');
  } catch (error) {
    console.log('❌ Error adding issue to ISSUES.md:', error.message);
  }
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function formatSteps(stepsText) {
  if (!stepsText.trim()) return '*No steps provided*';
  
  const steps = stepsText.split('\n').filter(step => step.trim());
  return steps.map((step, index) => `${index + 1}. ${step.trim()}`).join('\n');
}

async function main() {
  console.log('🐛 CA-DMS Bug Submission Tool\n');
  
  const issueNumber = String(getNextIssueNumber()).padStart(3, '0');
  console.log(`📋 Creating Issue #${issueNumber}\n`);
  
  try {
    const title = await question('📝 Issue Title (brief description): ');
    if (!title) {
      console.log('❌ Issue title is required');
      process.exit(1);
    }
    
    console.log('\n🔍 Priority Level:');
    console.log('  1. Critical (system broken, data loss, security)');
    console.log('  2. High (core functionality impaired)');
    console.log('  3. Medium (partial issues, workarounds available)');
    console.log('  4. Low (minor UI issues, cosmetic problems)');
    const priorityNum = await question('Select priority (1-4): ');
    const priorities = { '1': 'Critical', '2': 'High', '3': 'Medium', '4': 'Low' };
    const priority = priorities[priorityNum] || 'Medium';
    
    console.log('\n🏷️ Issue Type:');
    console.log('  1. Bug (something is broken)');
    console.log('  2. Enhancement (new feature/improvement)');  
    console.log('  3. UI/UX (user interface/experience issue)');
    console.log('  4. Performance (speed/efficiency problem)');
    const typeNum = await question('Select type (1-4): ');
    const types = { '1': 'Bug', '2': 'Enhancement', '3': 'UI/UX', '4': 'Performance' };
    const type = types[typeNum] || 'Bug';
    
    const screenshotPath = await question('\n📷 Screenshot path (or press Enter to skip): ');
    
    const currentBehavior = await question('\n❌ Current Behavior (what actually happens): ');
    const expectedBehavior = await question('✅ Expected Behavior (what should happen): ');
    
    console.log('\n🔄 Steps to Reproduce (one per line, press Enter twice when done):');
    let stepsLines = [];
    let stepInput;
    do {
      stepInput = await question('');
      if (stepInput.trim()) {
        stepsLines.push(stepInput);
      }
    } while (stepInput.trim() !== '' || stepsLines.length === 0);
    
    const stepsToReproduce = formatSteps(stepsLines.join('\n'));
    
    const browser = await question('\n🌐 Browser (Chrome 118, Firefox 119, etc.): ') || 'Not specified';
    const screenSize = await question('📐 Screen Size (Desktop 1920x1080, Mobile, etc.): ') || 'Not specified';
    const userRole = await question('👤 User Role (Admin, Editor, Viewer): ') || 'Not specified';
    const os = await question('💻 Operating System (Windows 11, macOS 14, Ubuntu 22.04): ') || 'Not specified';
    
    const additionalContext = await question('\n💭 Additional Context (optional): ') || '*None*';
    
    const issueData = {
      number: issueNumber,
      title,
      priority,
      type,
      screenshotPath,
      currentBehavior,
      expectedBehavior,
      stepsToReproduce,
      browser,
      screenSize,
      userRole,
      os,
      additionalContext
    };
    
    console.log('\n📋 Issue Summary:');
    console.log(`Issue #${issueNumber}: ${title}`);
    console.log(`Priority: ${priority} | Type: ${type}`);
    console.log(`Current: ${currentBehavior}`);
    console.log(`Expected: ${expectedBehavior}`);
    
    const confirm = await question('\n❓ Submit this issue? (y/N): ');
    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
      addIssueToMarkdown(issueData);
      updateNextIssueNumber(parseInt(issueNumber));
      updateIssueStats(type);
      
      console.log('\n🎉 Issue submitted successfully!');
      console.log(`📄 Added to ISSUES.md as Issue #${issueNumber}`);
      console.log('📊 Statistics updated');
      
      if (screenshotPath) {
        console.log(`📷 Don't forget to place your screenshot at: ${screenshotPath}`);
      }
    } else {
      console.log('❌ Issue submission cancelled');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  rl.close();
}

main();