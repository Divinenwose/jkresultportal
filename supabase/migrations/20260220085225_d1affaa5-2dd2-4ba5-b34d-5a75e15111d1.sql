
-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'parent');

-- Enum for classes
CREATE TYPE public.school_class AS ENUM ('JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3');

-- Enum for terms
CREATE TYPE public.school_term AS ENUM ('First Term', 'Second Term', 'Third Term');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spin TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
  date_of_birth DATE,
  class school_class NOT NULL,
  photo_url TEXT,
  parent_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  class school_class NOT NULL,
  teacher_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(name, class)
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Teacher assignments
CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  class school_class NOT NULL,
  UNIQUE(teacher_user_id, subject_id, class)
);

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Scores table
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  term school_term NOT NULL,
  session TEXT NOT NULL,
  first_test NUMERIC(5,2) DEFAULT 0,
  second_test NUMERIC(5,2) DEFAULT 0,
  exam NUMERIC(5,2) DEFAULT 0,
  total NUMERIC(5,2) GENERATED ALWAYS AS (COALESCE(first_test, 0) + COALESCE(second_test, 0) + COALESCE(exam, 0)) STORED,
  grade TEXT,
  subject_comment TEXT,
  submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject_id, term, session)
);

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  term school_term NOT NULL,
  session TEXT NOT NULL,
  days_opened INTEGER DEFAULT 0,
  days_present INTEGER DEFAULT 0,
  days_absent INTEGER DEFAULT 0,
  teacher_comment TEXT,
  principal_comment TEXT,
  next_term_begins TEXT,
  approved BOOLEAN DEFAULT false,
  total_marks NUMERIC(7,2) DEFAULT 0,
  average NUMERIC(5,2) DEFAULT 0,
  overall_grade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, term, session)
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grade calculation function
CREATE OR REPLACE FUNCTION public.calculate_grade(score NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF score >= 75 THEN RETURN 'A1';
  ELSIF score >= 70 THEN RETURN 'B2';
  ELSIF score >= 65 THEN RETURN 'B3';
  ELSIF score >= 60 THEN RETURN 'C4';
  ELSIF score >= 55 THEN RETURN 'C5';
  ELSIF score >= 50 THEN RETURN 'C6';
  ELSIF score >= 45 THEN RETURN 'D7';
  ELSIF score >= 40 THEN RETURN 'E8';
  ELSE RETURN 'F9';
  END IF;
END;
$$;

-- Auto-calculate grade trigger
CREATE OR REPLACE FUNCTION public.auto_calculate_grade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.grade := public.calculate_grade(COALESCE(NEW.first_test, 0) + COALESCE(NEW.second_test, 0) + COALESCE(NEW.exam, 0));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_score_change
  BEFORE INSERT OR UPDATE ON public.scores
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_calculate_grade();

-- SPIN generation function
CREATE OR REPLACE FUNCTION public.generate_spin()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_spin TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_spin := 'JKIC/' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.students WHERE spin = new_spin) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_spin;
END;
$$;

-- RLS Policies

-- Profiles: users can see their own, admins can see all
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- User roles: admins can manage, users can see their own
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Students: admin sees all, teacher sees assigned class, parent sees own child
CREATE POLICY "Admin sees all students" ON public.students
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teacher sees assigned class students" ON public.students
  FOR SELECT USING (
    public.has_role(auth.uid(), 'teacher') AND
    class IN (SELECT ta.class FROM public.teacher_assignments ta WHERE ta.teacher_user_id = auth.uid())
  );

CREATE POLICY "Parent sees own child" ON public.students
  FOR SELECT USING (parent_user_id = auth.uid());

CREATE POLICY "Admin manages students" ON public.students
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Subjects: all authenticated can read
CREATE POLICY "Authenticated can view subjects" ON public.subjects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manages subjects" ON public.subjects
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Teacher assignments: all authenticated can read
CREATE POLICY "Authenticated can view assignments" ON public.teacher_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manages assignments" ON public.teacher_assignments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Scores: admin sees all, teacher sees/edits own subject scores, parent sees child
CREATE POLICY "Admin sees all scores" ON public.scores
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teacher sees assigned scores" ON public.scores
  FOR SELECT USING (
    public.has_role(auth.uid(), 'teacher') AND
    subject_id IN (SELECT ta.subject_id FROM public.teacher_assignments ta WHERE ta.teacher_user_id = auth.uid())
  );

CREATE POLICY "Teacher edits assigned scores" ON public.scores
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'teacher') AND
    subject_id IN (SELECT ta.subject_id FROM public.teacher_assignments ta WHERE ta.teacher_user_id = auth.uid())
  );

CREATE POLICY "Teacher updates assigned scores" ON public.scores
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'teacher') AND
    subject_id IN (SELECT ta.subject_id FROM public.teacher_assignments ta WHERE ta.teacher_user_id = auth.uid())
  );

CREATE POLICY "Parent sees child scores" ON public.scores
  FOR SELECT USING (
    student_id IN (SELECT s.id FROM public.students s WHERE s.parent_user_id = auth.uid())
  );

-- Reports: admin manages, parent reads own child
CREATE POLICY "Admin manages reports" ON public.reports
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teacher views reports" ON public.reports
  FOR SELECT USING (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Parent sees child report" ON public.reports
  FOR SELECT USING (
    student_id IN (SELECT s.id FROM public.students s WHERE s.parent_user_id = auth.uid())
  );
