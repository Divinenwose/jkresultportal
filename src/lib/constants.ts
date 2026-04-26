export const SCHOOL_NAME = "John Kennedy International College";
export const SCHOOL_MOTTO = "God's Wisdom Excels";

export const CLASSES = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'] as const;
export type SchoolClass = typeof CLASSES[number];

export const TERMS = ['First Term', 'Second Term', 'Third Term'] as const;
export type SchoolTerm = typeof TERMS[number];

export const CURRENT_SESSION = "2025/2026";
export const CURRENT_TERM: SchoolTerm = "First Term";

export const GRADE_SCALE = [
  { min: 75, max: 100, grade: 'A1', remark: 'Excellent' },
  { min: 70, max: 74.99, grade: 'B2', remark: 'Very Good' },
  { min: 65, max: 69.99, grade: 'B3', remark: 'Good' },
  { min: 50, max: 64.99, grade: 'C4', remark: 'Credit' },
  { min: 40, max: 49.99, grade: 'D7', remark: 'Pass' },
  { min: 0, max: 39.99, grade: 'F9', remark: 'Fail' },
];

export function calculateGrade(total: number): string {
  for (const g of GRADE_SCALE) {
    if (total >= g.min && total <= g.max) return g.grade;
  }
  return 'F9';
}

export const JSS_SUBJECTS = [
  'English Language', 'Mathematics', 'Basic Science', 'Basic Technology',
  'Social Studies', 'Civic Education', 'Computer Studies', 'Agricultural Science',
  'Business Studies', 'French', 'Music', 'Home Economics'
];

export const SS_SUBJECTS = [
  'English Language', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'Economics', 'Government', 'Literature', 'Geography', 'Civic Education',
  'Computer Studies', 'Agricultural Science'
];
