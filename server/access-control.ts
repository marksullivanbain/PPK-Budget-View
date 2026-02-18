import fs from 'fs';
import path from 'path';

export interface AccessEntry {
  practiceName: string;
  employeeName: string;
  email: string;
}

// Store email-to-practice mappings (email lowercase -> practice names array)
const accessMap = new Map<string, string[]>();

function extractEmail(bainEmailField: string): string {
  // Format: "Name <email@bain.com>" - extract just the email
  const match = bainEmailField.match(/<([^>]+)>/);
  if (match) {
    return match[1].toLowerCase();
  }
  // If no angle brackets, assume the whole thing is the email
  return bainEmailField.toLowerCase().trim();
}

export function parseAccessTable(): AccessEntry[] {
  const entries: AccessEntry[] = [];
  
  // Look for the access table CSV - get the latest one if multiple exist
  const assetsDir = path.join(process.cwd(), 'attached_assets');
  const files = fs.readdirSync(assetsDir);
  const accessFiles = files
    .filter(f => f.includes('Security_Access_Table') && f.endsWith('.csv'))
    .sort((a, b) => {
      const tsA = parseInt(a.match(/_(\d+)\.csv$/)?.[1] || '0');
      const tsB = parseInt(b.match(/_(\d+)\.csv$/)?.[1] || '0');
      return tsB - tsA;
    });
  
  const accessFile = accessFiles[0];
  
  if (!accessFile) {
    console.log('No access table found - all users will have access to all practices');
    return entries;
  }
  
  const filePath = path.join(assetsDir, accessFile);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV with quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    
    const practiceName = fields[0]?.trim();
    const employeeName = fields[1]?.trim();
    const bainEmail = fields[2]?.trim();
    
    const emailSource = bainEmail || employeeName || '';
    
    if (practiceName && emailSource && emailSource.includes('@')) {
      const email = extractEmail(emailSource);
      entries.push({
        practiceName,
        employeeName,
        email
      });
      
      // Add to access map
      const existingPractices = accessMap.get(email) || [];
      if (!existingPractices.includes(practiceName)) {
        existingPractices.push(practiceName);
        accessMap.set(email, existingPractices);
      }
    }
  }
  
  console.log(`Loaded ${entries.length} access control entries for ${accessMap.size} unique users`);
  console.log(`Access map emails: ${Array.from(accessMap.keys()).join(', ')}`);
  return entries;
}

// Get practices accessible by a user email
export function getPracticesForEmail(email: string): string[] | null {
  if (accessMap.size === 0) {
    // No access control configured - return null to indicate all access
    return null;
  }
  
  const normalizedEmail = email?.toLowerCase().trim();
  if (!normalizedEmail) {
    return [];
  }
  
  const practices = accessMap.get(normalizedEmail) || [];
  console.log(`Access check for ${normalizedEmail}: ${practices.length > 0 ? practices.join(', ') : 'NO ACCESS'}`);
  return practices;
}

// Check if a user has access to a specific practice
export function hasAccessToPractice(email: string, practiceName: string): boolean {
  const practices = getPracticesForEmail(email);
  if (practices === null) {
    // No access control - all access granted
    return true;
  }
  // "All Practices" grants access to everything
  if (practices.includes('All Practices')) {
    return true;
  }
  return practices.includes(practiceName);
}

// Initialize access control on startup
parseAccessTable();
