/**
 * Converts monetary decimal values (e.g. 15000.50) into integer cents/paisa (1500050)
 * to avoid floating point precision loss in Firestore.
 */
export function toCents(val: any | number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'object' && 'toNumber' in val ? (val as any).toNumber() : Number(val);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Converts integer cents/paisa (1500050) back to standard floating decimal (15000.50)
 * for exact API response compatibility.
 */
export function fromCents(cents: number | null | undefined): number {
  if (cents === null || cents === undefined) return 0;
  return Number((cents / 100).toFixed(2));
}

/**
 * Formats JS Date or ISO string safely into ISO 8601 string or Date object.
 */
export function formatDateISO(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Deterministic ID Generators for Compound Unique Constraints in Firestore
 */
export const DeterministicKey = {
  classSection: (classId: string, sectionId: string) => `${classId}_${sectionId}`,
  classSubject: (classSectionId: string, subjectId: string) => `${classSectionId}_${subjectId}`,
  examMark: (examId: string, studentId: string, subjectId: string) => `${examId}_${studentId}_${subjectId}`,
  teacherAssignment: (teacherId: string, classSectionId: string, subjectId: string) => `${teacherId}_${classSectionId}_${subjectId}`,
  teacherSkill: (teacherId: string, subjectId: string) => `${teacherId}_${subjectId}`,
};
