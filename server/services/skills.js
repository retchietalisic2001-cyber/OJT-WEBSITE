export const COURSE_SKILLS = {
  'Information Technology': [
    'Networking Basics',
    'Hardware Troubleshooting',
    'Windows Server',
    'Linux',
    'Database Management',
    'SQL',
    'Cybersecurity Fundamentals',
    'System Administration',
    'Technical Support',
    'Cloud Basics',
    'IT Helpdesk',
    'Scripting (Python)'
  ],
  'Computer Science': [
    'JavaScript',
    'Python',
    'Java',
    'Data Structures',
    'Algorithms',
    'Web Development',
    'React',
    'Node.js',
    'SQL',
    'Git',
    'Problem Solving',
    'Object-Oriented Programming'
  ],
  'Civil Engineering': [
    'AutoCAD',
    'Structural Analysis',
    'Surveying',
    'Technical Drawing',
    'Project Planning',
    'Quantity Surveying',
    'Site Inspection',
    'Engineering Mathematics',
    'Revit',
    'Material Testing'
  ],
  'Electrical Engineering': [
    'Circuit Analysis',
    'PLC Basics',
    'Electrical Wiring',
    'Instrumentation',
    'Power Systems',
    'Motor Control',
    'Schematic Reading',
    'Multimeter/Testing',
    'Preventive Maintenance',
    'AutoCAD Electrical'
  ],
  'Business Administration': [
    'Communication',
    'Customer Service',
    'Microsoft Excel',
    'Marketing Basics',
    'Inventory Management',
    'Data Entry',
    'Procurement',
    'Sales Support',
    'Time Management',
    'Basic Accounting'
  ],
  'Accountancy': [
    'Financial Accounting',
    'Bookkeeping',
    'QuickBooks',
    'Microsoft Excel',
    'Payroll Processing',
    'Tax Preparation Basics',
    'Financial Statements',
    'Audit Assistance',
    'Reconciliation',
    'Budgeting'
  ],
  'Multimedia Arts': [
    'Photoshop',
    'Illustrator',
    'Canva',
    'Video Editing',
    'Premiere Pro',
    'Basic UI/UX',
    'Typography',
    'Color Theory',
    'Photography',
    'Social Media Content'
  ]
}

export const COURSE_OBJECTIVES = {
  'Information Technology':
    'Seeking an OJT position where I can apply my IT troubleshooting and technical support skills while gaining hands-on experience in a professional IT environment.',
  'Computer Science':
    'Looking for an OJT opportunity to apply my programming and software development skills on real-world projects and grow as a developer.',
  'Civil Engineering':
    'Aspiring civil engineer eager to apply my drafting, surveying, and structural knowledge through a hands-on OJT experience on active projects.',
  'Electrical Engineering':
    'Motivated electrical engineering student seeking OJT to apply circuit, power, and instrumentation knowledge on actual industrial systems.',
  'Business Administration':
    'Eager to contribute strong communication, organization, and customer-service skills through an OJT role focused on business operations.',
  'Accountancy':
    'Detail-oriented accounting student seeking OJT to apply bookkeeping, Excel, and financial analysis skills in a professional finance setting.',
  'Multimedia Arts':
    'Creative multimedia student seeking OJT to apply design, editing, and content-creation skills across real client projects.'
}

export function skillSuggestions(course) {
  return COURSE_SKILLS[course] || COURSE_SKILLS['Business Administration']
}

export function objectiveFor(course) {
  return COURSE_OBJECTIVES[course] || COURSE_OBJECTIVES['Business Administration']
}