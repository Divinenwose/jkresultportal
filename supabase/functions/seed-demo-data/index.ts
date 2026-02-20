import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const users = [
      { email: 'admin@jkic.edu', password: 'admin123', name: 'Mr. James Okafor', role: 'admin' },
      { email: 'teacher@jkic.edu', password: 'teacher123', name: 'Mrs. Ada Nwosu', role: 'teacher' },
      { email: 'teacher2@jkic.edu', password: 'teacher123', name: 'Mr. Emeka Eze', role: 'teacher' },
      { email: 'teacher3@jkic.edu', password: 'teacher123', name: 'Mrs. Funmi Bello', role: 'teacher' },
      { email: 'parent@jkic.edu', password: 'parent123', name: 'Mrs. Grace Adewale', role: 'parent' },
      { email: 'parent2@jkic.edu', password: 'parent123', name: 'Mr. Chidi Okeke', role: 'parent' },
    ];

    const createdUsers: Record<string, string> = {};

    for (const u of users) {
      // Check if user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(eu => eu.email === u.email);

      let userId: string;
      if (existing) {
        userId = existing.id;
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.name },
        });
        if (error) {
          console.error(`Error creating ${u.email}:`, error);
          continue;
        }
        userId = data.user.id;
      }

      createdUsers[u.email] = userId;

      // Upsert role
      await supabase.from('user_roles').upsert(
        { user_id: userId, role: u.role },
        { onConflict: 'user_id,role' }
      );
    }

    // Create subjects for JSS1
    const jss1Subjects = ['English Language', 'Mathematics', 'Basic Science', 'Basic Technology', 'Social Studies', 'Civic Education'];
    const ss1Subjects = ['English Language', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics'];

    for (const name of jss1Subjects) {
      await supabase.from('subjects').upsert({ name, class: 'JSS1' }, { onConflict: 'name,class' });
    }
    for (const name of ss1Subjects) {
      await supabase.from('subjects').upsert({ name, class: 'SS1' }, { onConflict: 'name,class' });
    }

    // Get subjects
    const { data: allSubjects } = await supabase.from('subjects').select('*');

    // Assign teachers
    const teacher1Id = createdUsers['teacher@jkic.edu'];
    const teacher2Id = createdUsers['teacher2@jkic.edu'];
    const teacher3Id = createdUsers['teacher3@jkic.edu'];

    if (teacher1Id && allSubjects) {
      const englishJSS1 = allSubjects.find(s => s.name === 'English Language' && s.class === 'JSS1');
      const mathJSS1 = allSubjects.find(s => s.name === 'Mathematics' && s.class === 'JSS1');
      if (englishJSS1) {
        await supabase.from('teacher_assignments').upsert(
          { teacher_user_id: teacher1Id, subject_id: englishJSS1.id, class: 'JSS1' },
          { onConflict: 'teacher_user_id,subject_id,class' }
        );
      }
      if (mathJSS1) {
        await supabase.from('teacher_assignments').upsert(
          { teacher_user_id: teacher1Id, subject_id: mathJSS1.id, class: 'JSS1' },
          { onConflict: 'teacher_user_id,subject_id,class' }
        );
      }
    }

    if (teacher2Id && allSubjects) {
      const scienceJSS1 = allSubjects.find(s => s.name === 'Basic Science' && s.class === 'JSS1');
      const techJSS1 = allSubjects.find(s => s.name === 'Basic Technology' && s.class === 'JSS1');
      if (scienceJSS1) {
        await supabase.from('teacher_assignments').upsert(
          { teacher_user_id: teacher2Id, subject_id: scienceJSS1.id, class: 'JSS1' },
          { onConflict: 'teacher_user_id,subject_id,class' }
        );
      }
      if (techJSS1) {
        await supabase.from('teacher_assignments').upsert(
          { teacher_user_id: teacher2Id, subject_id: techJSS1.id, class: 'JSS1' },
          { onConflict: 'teacher_user_id,subject_id,class' }
        );
      }
    }

    // Create students
    const studentNames = [
      { name: 'Adewale Tunde', gender: 'Male', class: 'JSS1' },
      { name: 'Chioma Nwosu', gender: 'Female', class: 'JSS1' },
      { name: 'Bola Adekunle', gender: 'Female', class: 'JSS1' },
      { name: 'Emeka Obi', gender: 'Male', class: 'JSS1' },
      { name: 'Fatima Ibrahim', gender: 'Female', class: 'JSS1' },
      { name: 'David Okafor', gender: 'Male', class: 'SS1' },
      { name: 'Amina Yusuf', gender: 'Female', class: 'SS1' },
      { name: 'Samuel Ojo', gender: 'Male', class: 'SS1' },
      { name: 'Grace Eze', gender: 'Female', class: 'SS1' },
      { name: 'Peter Adewale', gender: 'Male', class: 'SS1' },
    ];

    const parentId1 = createdUsers['parent@jkic.edu'];
    const parentId2 = createdUsers['parent2@jkic.edu'];

    for (let i = 0; i < studentNames.length; i++) {
      const s = studentNames[i];
      const { data: spinData } = await supabase.rpc('generate_spin');
      const spin = spinData || `JKIC/${(10000 + i).toString()}`;

      const parentUserId = i === 0 ? parentId1 : i === 5 ? parentId2 : null;

      await supabase.from('students').upsert({
        full_name: s.name,
        gender: s.gender,
        class: s.class,
        spin,
        date_of_birth: `2010-0${(i % 9) + 1}-15`,
        parent_user_id: parentUserId,
      }, { onConflict: 'spin' });
    }

    return new Response(JSON.stringify({ success: true, message: 'Demo data seeded!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
