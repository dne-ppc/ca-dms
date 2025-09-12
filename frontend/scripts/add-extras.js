#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const EXTRAS_FILE = 'EXTRAS.md';

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
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

function promptMultiline(question) {
  console.log(`${colors.cyan}${question}${colors.reset}`);
  console.log(`${colors.yellow}(Enter multiple lines, press Ctrl+D when done)${colors.reset}`);
  
  let input = '';
  const buffer = Buffer.alloc(1);
  
  while (true) {
    try {
      const bytesRead = require('fs').readSync(process.stdin.fd, buffer, 0, 1, null);
      if (bytesRead === 0) break; // EOF (Ctrl+D)
      
      const char = buffer.toString('utf8');
      input += char;
      process.stdout.write(char);
    } catch (error) {
      break;
    }
  }
  
  return input.trim();
}

function getNextExtraNumber() {
  try {
    if (!existsSync(EXTRAS_FILE)) {
      return 1;
    }
    
    const extrasContent = readFileSync(EXTRAS_FILE, 'utf8');
    const matches = extrasContent.match(/## EXTRA\.(\d+):/g);
    
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

function createExtrasFileIfNotExists() {
  if (!existsSync(EXTRAS_FILE)) {
    const template = `# CA-DMS Enhancement Backlog

This document tracks feature enhancements, improvements, and nice-to-have additions for the CA-DMS system.

**Enhancement Tracking Status: ACTIVE**
- Total Enhancements: 0
- Planned: 0
- In Progress: 0
- Completed: 0

---

## 🎯 Enhancement Categories

### 🚀 Performance Improvements
Enhancements focused on speed, efficiency, and scalability.

### 🎨 UI/UX Enhancements  
Improvements to user interface design and user experience.

### 🔧 Developer Experience
Tools and improvements to make development easier and more efficient.

### 📱 New Features
Entirely new functionality to extend the system's capabilities.

### 🔒 Security Enhancements
Improvements to system security and data protection.

### 📊 Analytics & Reporting
Data visualization and reporting capabilities.

---

## 📋 Enhancement List

*No enhancements tracked yet. Use \`npm run extras\` to add one!*

---

## ✅ Completed Enhancements

*No completed enhancements yet.*

---

## 📊 Enhancement Statistics

| Category | Planned | In Progress | Completed | Total |
|----------|---------|-------------|-----------|-------|
| Performance | 0 | 0 | 0 | 0 |
| UI/UX | 0 | 0 | 0 | 0 |
| Developer Experience | 0 | 0 | 0 | 0 |
| New Features | 0 | 0 | 0 | 0 |
| Security | 0 | 0 | 0 | 0 |
| Analytics | 0 | 0 | 0 | 0 |
| **Total** | **0** | **0** | **0** | **0** |

---

## 🛠️ Enhancement Workflow

### When Adding an Enhancement:
1. **Run Script** - Use \`npm run extras\` to add new enhancement
2. **Describe Value** - Focus on user/developer benefit
3. **Estimate Effort** - Rough complexity assessment
4. **Set Priority** - Based on impact vs. effort

### Enhancement Lifecycle:
\`\`\`
[New] → [Planned] → [In Progress] → [Testing] → [Completed]
             ↓           ↓             ↓
         [Deferred]  [Blocked]    [Needs Review]
\`\`\`

### Priority Guidelines:
- **Critical**: Essential for system functionality
- **High**: Significant user/developer value
- **Medium**: Nice improvements with clear benefit
- **Low**: Minor improvements or optimizations

---

*Ready to track enhancements! Use \`npm run extras\` to add new feature ideas and improvements.*
`;
    
    writeFileSync(EXTRAS_FILE, template);
    console.log(`${colors.green}Created ${EXTRAS_FILE} file.${colors.reset}`);
  }
}

function addEnhancementToFile(enhancementData) {
  try {
    createExtrasFileIfNotExists();
    const extrasContent = readFileSync(EXTRAS_FILE, 'utf8');
    
    // Parse current statistics
    const totalMatch = extrasContent.match(/- Total Enhancements: (\d+)/);
    const plannedMatch = extrasContent.match(/- Planned: (\d+)/);
    
    const totalEnhancements = totalMatch ? parseInt(totalMatch[1]) + 1 : 1;
    const plannedEnhancements = plannedMatch ? parseInt(plannedMatch[1]) + 1 : 1;
    
    // Create enhancement entry
    const enhancementEntry = `
## EXTRA.${enhancementData.number}: ${enhancementData.title}

**Status:** Planned  
**Priority:** ${enhancementData.priority}  
**Category:** ${enhancementData.category}  
**Effort Estimate:** ${enhancementData.effort}

### Description
${enhancementData.description}

### User Value
${enhancementData.userValue}

### Technical Requirements
${enhancementData.technicalRequirements}

### Acceptance Criteria
${enhancementData.acceptanceCriteria}

### Implementation Notes
${enhancementData.implementationNotes}

**Added:** ${new Date().toISOString().split('T')[0]}

---
`;

    // Update statistics
    let updatedContent = extrasContent
      .replace(/- Total Enhancements: \d+/, `- Total Enhancements: ${totalEnhancements}`)
      .replace(/- Planned: \d+/, `- Planned: ${plannedEnhancements}`);
    
    // Add enhancement to list section
    const listMatch = updatedContent.match(/(## 📋 Enhancement List\s*\n)([\s\S]*?)(\n---\s*\n)/);
    
    if (listMatch) {
      const beforeSection = listMatch[1];
      let currentSection = listMatch[2];
      const afterSection = listMatch[3];
      
      // Remove "*No enhancements tracked yet*" if it exists
      currentSection = currentSection.replace(/\*No enhancements tracked yet.*?\*\s*\n?/, '');
      
      // Add new enhancement
      const newCurrentSection = beforeSection + currentSection + enhancementEntry + afterSection;
      updatedContent = updatedContent.replace(listMatch[0], newCurrentSection);
    }
    
    // Update category statistics table
    const categoryMap = {
      'Performance': 'Performance',
      'UI/UX': 'UI/UX',
      'Developer Experience': 'Developer Experience',
      'New Features': 'New Features',
      'Security': 'Security',
      'Analytics': 'Analytics'
    };
    
    const categoryKey = categoryMap[enhancementData.category];
    if (categoryKey) {
      const categoryRegex = new RegExp(`(\\| ${categoryKey} \\| )(\\d+)( \\| \\d+ \\| \\d+ \\| )(\\d+)( \\|)`);
      const categoryMatch = updatedContent.match(categoryRegex);
      
      if (categoryMatch) {
        const currentPlanned = parseInt(categoryMatch[2]);
        const currentTotal = parseInt(categoryMatch[4]);
        
        updatedContent = updatedContent.replace(
          categoryRegex,
          `$1${currentPlanned + 1}$3${currentTotal + 1}$5`
        );
      }
    }
    
    writeFileSync(EXTRAS_FILE, updatedContent);
    
    console.log(`${colors.green}${colors.bold}✅ Enhancement EXTRA.${enhancementData.number} added successfully!${colors.reset}`);
    console.log(`${colors.cyan}Updated statistics: ${totalEnhancements} total enhancements, ${plannedEnhancements} planned${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Error updating ${EXTRAS_FILE}: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

function main() {
  console.log(`${colors.bold}${colors.magenta}🎯 CA-DMS Enhancement Tracker${colors.reset}\n`);
  
  const enhancementNumber = getNextExtraNumber();
  console.log(`${colors.cyan}Creating EXTRA.${enhancementNumber}${colors.reset}\n`);
  
  const title = prompt('Enhancement Title:');
  if (!title) {
    console.log(`${colors.red}Enhancement title is required.${colors.reset}`);
    process.exit(1);
  }
  
  const priority = prompt('Priority (Critical/High/Medium/Low) [Medium]:') || 'Medium';
  
  console.log(`${colors.yellow}Categories:${colors.reset}`);
  console.log('1. Performance');
  console.log('2. UI/UX');
  console.log('3. Developer Experience');
  console.log('4. New Features');
  console.log('5. Security');
  console.log('6. Analytics');
  
  const categoryChoice = prompt('Category (1-6) [4]:') || '4';
  const categories = ['Performance', 'UI/UX', 'Developer Experience', 'New Features', 'Security', 'Analytics'];
  const category = categories[parseInt(categoryChoice) - 1] || 'New Features';
  
  const effort = prompt('Effort Estimate (Small/Medium/Large/XL) [Medium]:') || 'Medium';
  
  console.log(`\n${colors.yellow}Please provide detailed information:${colors.reset}\n`);
  
  const description = prompt('Description:');
  const userValue = prompt('User Value (what benefit does this provide?):');
  const technicalRequirements = prompt('Technical Requirements:') || '*To be determined*';
  const acceptanceCriteria = prompt('Acceptance Criteria:') || '*To be defined during planning*';
  const implementationNotes = prompt('Implementation Notes:') || '*None yet*';
  
  const enhancementData = {
    number: enhancementNumber,
    title,
    priority,
    category,
    effort,
    description,
    userValue,
    technicalRequirements,
    acceptanceCriteria,
    implementationNotes
  };
  
  console.log(`\n${colors.yellow}Creating enhancement...${colors.reset}`);
  addEnhancementToFile(enhancementData);
}

main();