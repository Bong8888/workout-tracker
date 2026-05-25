import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MUSCLE_MAP: Record<string, string> = {
  'chest': 'chest',
  'back': 'back',
  'lats': 'back',
  'middle back': 'back',
  'lower back': 'back',
  'quadriceps': 'legs',
  'hamstrings': 'legs',
  'glutes': 'legs',
  'calves': 'legs',
  'shoulders': 'shoulders',
  'traps': 'shoulders',
  'biceps': 'arms',
  'triceps': 'arms',
  'forearms': 'arms',
  'abdominals': 'core',
  'abductors': 'legs',
  'adductors': 'legs',
  'neck': 'shoulders',
};

const EQUIPMENT_MAP: Record<string, string> = {
  'barbell': 'barbell',
  'dumbbell': 'dumbbell',
  'machine': 'machine',
  'cable': 'cable',
  'body only': 'bodyweight',
  'kettlebells': 'kettlebell',
  'bands': 'resistance_band',
  'medicine ball': 'other',
  'exercise ball': 'other',
  'e-z curl bar': 'barbell',
  'foam roll': 'other',
  'other': 'other',
};

const BODYWEIGHT_EQUIPMENT = ['body only'];

async function run() {
  const rawPath = path.join(process.cwd(), 'src', 'data', 'exercises-raw.json');
  const outputPath = path.join(process.cwd(), 'src', 'data', 'exercises.json');

  if (!fs.existsSync(rawPath)) {
    console.error(`Error: raw exercises file not found at ${rawPath}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(rawPath, 'utf-8');
  const rawData = JSON.parse(rawContent);

  const transformed = rawData.map((ex: any) => {
    const primaryMuscle = ex.primaryMuscles?.[0];
    const muscleGroup = MUSCLE_MAP[primaryMuscle] || 'full_body';

    const secondaryMuscles = (ex.secondaryMuscles || [])
      .map((m: string) => MUSCLE_MAP[m])
      .filter(Boolean);

    // Remove duplicates and primary muscle group from secondary
    const uniqueSecondary = Array.from(new Set(secondaryMuscles))
      .filter(m => m !== muscleGroup);

    const equipment = EQUIPMENT_MAP[ex.equipment] || 'other';

    return {
      id: crypto.randomUUID(),
      name: ex.name,
      muscle_group: muscleGroup,
      secondary_muscles: uniqueSecondary,
      equipment: equipment,
      measurement_type: 'reps',
      is_bodyweight: BODYWEIGHT_EQUIPMENT.includes(ex.equipment),
      description: (ex.instructions || []).join('\n\n'),
      is_custom: false,
      created_at: new Date().toISOString(),
    };
  });

  // Ensure directories exist
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(transformed, null, 2));

  console.log(`✓ Transformed ${transformed.length} exercises successfully.`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
