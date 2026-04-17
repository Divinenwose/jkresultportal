import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { calculateGrade, GRADE_SCALE } from "@/lib/constants";
import { useSettings } from "@/hooks/useSettings";
import { Check, Save } from "lucide-react";


type PrevTermScores = Record<string, { term1?: number; term2?: number }>;
type PrevTermIds = Record<string, { term1Id?: string; term2Id?: string }>;
type AutoSaveStatus = Record<string, "saving" | "saved" | "error" | "">;

function commentFromGrade(grade: string): string {
  switch (grade) {
    case "A1":
      return "Excellent";
    case "B2":
    case "B3":
      return "Very Good";
    case "C4":
    case "C5":
    case "C6":
      return "Good";
    case "D7":
    case "E8":
      return "Pass";
    case "F9":
      return "Fail";
    default:
      return "";
  }
}

function getCommentForScore(average: number, isJSSClass: boolean): string {
  if (isJSSClass) return autoComment(average);
  const grade = calculateGrade(average);
  return GRADE_SCALE.find((item) => item.grade === grade)?.remark ?? autoComment(average);
}


export default function ScoreEntryPage() {
  const { user } = useAuth();
  const { settings } = useSettings();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);

  const [scoreMap, setScoreMap] = useState<Record<string, Record<string, any>>>(() => {
    if (typeof window === "undefined") return {};
    const saved = localStorage.getItem("scoreMap");
    return saved ? JSON.parse(saved) : {};
  });
  const [prevTermScores, setPrevTermScores] =
    useState<Record<string, PrevTermScores>>({});

  const prevTermScoresRef = useRef<Record<string, PrevTermScores>>({});
  const [prevTermIds, setPrevTermIds] = useState<Record<string, PrevTermIds>>({});
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>({});

  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const prevTermTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inflightSaves = useRef<Set<Promise<void>>>(new Set());
  const scoreMapRef = useRef<Record<string, any>>({});

  const activeTerm = settings.active_term;
  const isSecondTerm = activeTerm === "Second Term";
  const isThirdTerm = activeTerm === "Third Term";

  useEffect(() => { prevTermScoresRef.current = prevTermScores; }, [prevTermScores]);
  useEffect(() => { scoreMapRef.current = scoreMap; }, [scoreMap]);


  useEffect(() => {
    const handleBeforeUnload = () => {
      Object.keys(autoSaveTimers.current).forEach((id) => clearTimeout(autoSaveTimers.current[id]));
      Object.keys(prevTermTimers.current).forEach((id) => clearTimeout(prevTermTimers.current[id]));
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    localStorage.setItem("scoreMap", JSON.stringify(scoreMap));
    scoreMapRef.current = scoreMap;
  }, [scoreMap]);

  useEffect(() => {
    prevTermScoresRef.current = prevTermScores;
  }, [prevTermScores]);


  useEffect(() => {
    if (!selectedAssignment) return;
    if (!assignments.length) return;

    // re-trigger fetch logic safely
    const assignment = assignments.find((a) => a.id === selectedAssignment);
    if (!assignment) return;

    const fetchId = ++fetchIdRef.current;
    void (async () => {
      const { data: studs } = await supabase
        .from("students")
        .select("*")
        .eq("class", assignment.class)
        .order("full_name");

      if (fetchId !== fetchIdRef.current) return;

      setStudents(studs || []);
    })();
  }, [assignments]);


  useEffect(() => {
    if (!user) return;

    supabase
      .from("teacher_assignments")
      .select("*, subjects(id, name, class)")
      .eq("teacher_user_id", user.id)
      .then(({ data }) => setAssignments(data || []));
  }, [user]);

  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!selectedAssignment || assignments.length === 0) return;

    const fetchId = ++fetchIdRef.current;

    const assignment = assignments.find((a) => a.id === selectedAssignment);
    if (!assignment) return;


    const fetchData = async () => {
      const { data: studs } = await supabase
        .from("students")
        .select("*")
        .eq("class", assignment.class)
        .order("full_name");

      setStudents(studs || []);
      if (fetchId !== fetchIdRef.current) return;

      if (!studs?.length) return;

      const studentIds = studs.map((student) => student.id);

      // CURRENT TERM SCORES
      const { data: existingScores } = await supabase
        .from("scores")
        .select("*")
        .eq("subject_id", assignment.subjects.id)
        .eq("term", settings.active_term as any)
        .eq("session", settings.active_session)
        .in("student_id", studentIds);

      const scoreLookup: Record<string, any> = {};
      (existingScores || []).forEach((score) => {
        scoreLookup[score.student_id] = score;
      });

      setScoreMap((prev) => {
        const updated = { ...prev };

        Object.entries(scoreLookup).forEach(([studentId, score]) => {
          if (!updated[studentId]) {
            updated[studentId] = score;
          } else {
            updated[studentId] = {
              ...updated[studentId],
              ...score,
            };
          }
        });

        return updated;
      });

      if (!assignment) return;
      if (isSecondTerm || isThirdTerm) {
        const prevLookup: PrevTermScores = {};
        const idLookup: PrevTermIds = {};

        // FIRST TERM
        const { data: termOneScores } = await supabase
          .from("scores")
          .select("id, student_id, total")
          .eq("subject_id", assignment.subjects.id)
          .eq("term", "First Term" as any)
          .eq("session", settings.active_session)
          .in("student_id", studentIds);

        termOneScores?.forEach((score) => {
          prevLookup[score.student_id] = {
            ...prevLookup[score.student_id],
            term1: Number(score.total) || 0,
          };

          idLookup[score.student_id] = {
            ...idLookup[score.student_id],
            term1Id: score.id,
          };
        });

        // SECOND TERM (third term only)
        if (isThirdTerm) {
          const { data: termTwoScores } = await supabase
            .from("scores")
            .select("id, student_id, total")
            .eq("subject_id", assignment.subjects.id)
            .eq("term", "Second Term" as any)
            .eq("session", settings.active_session)
            .in("student_id", studentIds);

          termTwoScores?.forEach((score) => {
            prevLookup[score.student_id] = {
              ...prevLookup[score.student_id],
              term2: Number(score.total) || 0,
            };

            idLookup[score.student_id] = {
              ...idLookup[score.student_id],
              term2Id: score.id,
            };
          });
        }

        setPrevTermScores((prev) => {
          const existingAssignment = prev[selectedAssignment] || {};

          const merged = { ...existingAssignment };

          Object.keys(prevLookup).forEach((studentId) => {
            merged[studentId] = {
              ...(existingAssignment[studentId] || {}),
              ...prevLookup[studentId],
            };
          });

          return {
            ...prev,
            [selectedAssignment]: merged,
          };
        });

        setPrevTermIds((prev) => ({
          ...prev,
          [selectedAssignment]: idLookup,
        }));
      }
    };

    void fetchData();
  }, [
    selectedAssignment,
    assignments,
    settings.active_term,
    settings.active_session,
    isSecondTerm,
    isThirdTerm,
    user
  ]);

  const clampValue = (value: string, max: number): string => {
    if (value === "") return "";
    const num = Number(value);
    if (Number.isNaN(num)) return "";
    return String(Math.min(Math.max(0, num), max));
  };

  const calculateAverage = useCallback(
    (studentId: string, scoreData: any, prevOverride?: { term1?: number; term2?: number }) => {
      const total =
        (Number(scoreData.first_test) || 0) +
        (Number(scoreData.second_test) || 0) +
        (Number(scoreData.exam) || 0);
      const prev =
        prevOverride ??
        prevTermScores[selectedAssignment]?.[studentId] ??
        {};
      const term1Val = Number(prev.term1 ?? 0);
      const term2Val = Number(prev.term2 ?? 0);

      if (isThirdTerm) {
        const terms = [total, term1Val, term2Val];
        const nonZeroCount = terms.filter((term) => term > 0).length || 1;
        return terms.reduce((sum, term) => sum + term, 0) / nonZeroCount;
      }

      if (isSecondTerm) {
        const terms = [total, term1Val];
        const nonZeroCount = terms.filter((term) => term > 0).length || 1;
        return terms.reduce((sum, term) => sum + term, 0) / nonZeroCount;
      }

      return total;
    },
    [isSecondTerm, isThirdTerm, prevTermScores, selectedAssignment]
  );

  const setSavedIndicator = useCallback((studentId: string) => {
    setAutoSaveStatus((prev) => ({ ...prev, [studentId]: "saved" }));
    setTimeout(() => {
      setAutoSaveStatus((prev) => ({ ...prev, [studentId]: "" }));
    }, 2000);
  }, []);

  const autoSaveStudent = useCallback(
    async (studentId: string, scoreData: any, submitted = false) => {
      const assignment = assignments.find(
        (item) => item.id === selectedAssignment
      );
      if (!assignment) return;

      const className = assignment.subjects?.class || assignment.class || "";
      const isJSSClass = ["JSS1", "JSS2", "JSS3"].includes(className);
      const isSSSClass = ["SSS1", "SSS2", "SSS3"].includes(className);

      const first = Number(scoreData.first_test) || 0;
      const second = Number(scoreData.second_test) || 0;
      const exam = Number(scoreData.exam) || 0;
      const total = first + second + exam;
      const prev =
        prevTermScoresRef.current[selectedAssignment]?.[studentId] || {};

      const term1 = Number(prev.term1 ?? 0);
      const term2 = Number(prev.term2 ?? 0);
      const average = calculateAverage(studentId, scoreData);
      const comment = getCommentForScore(average, isJSSClass);
      const grade = isSSSClass ? calculateGrade(average) : null;

      setAutoSaveStatus((prev) => ({
        ...prev,
        [studentId]: "saving",
      }));

      const payload = {
        student_id: studentId,
        subject_id: assignment.subjects.id as string,
        term: settings.active_term as "First Term" | "Second Term" | "Third Term",
        session: settings.active_session,
        first_test: first,
        second_test: second,
        exam,
        total,
        term1_total: term1,
        term2_total: term2,
        average,
        grade: isSSSClass ? grade : null,
        subject_comment: comment || null,
        submitted: submitted,
      };

      const { data, error } = await supabase
        .from("scores")
        .upsert(payload, {
          onConflict: "student_id,subject_id,term,session",
        })
        .select()
        .single();

      if (error) {
        setAutoSaveStatus((prev) => ({
          ...prev,
          [studentId]: "error",
        }));
        return;
      }

      if (data) {
        setScoreMap((prev) => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            ...data,
          },
        }));
      }

      setAutoSaveStatus((prev) => ({
        ...prev,
        [studentId]: "saved",
      }));
    },
    [assignments, selectedAssignment, settings]
  );

  const trackSave = useCallback((promise: Promise<void>) => {
    inflightSaves.current.add(promise);
    promise.finally(() => inflightSaves.current.delete(promise));
  }, []);

  const scheduleAutoSave = useCallback(
    (studentId: string, scoreData: any) => {
      if (autoSaveTimers.current[studentId]) {
        clearTimeout(autoSaveTimers.current[studentId]);
      }

      autoSaveTimers.current[studentId] = setTimeout(() => {
        void autoSaveStudent(studentId, scoreData, false);
      }, 1500);
    },
    [autoSaveStudent]
  );

  const schedulePrevTermSave = (studentId: string, termKey: "term1" | "term2") => {
    const timerKey = `${studentId}::${termKey}`;

    if (prevTermTimers.current[timerKey]) {
      clearTimeout(prevTermTimers.current[timerKey]);
    }

    prevTermTimers.current[timerKey] = setTimeout(() => {
      commitPrevTermSave(studentId, termKey);
    }, 1500);
  };

  const autoSavePrevTerm = useCallback(
    async (studentId: string, termKey: "term1" | "term2", totalValue: number) => {
      const assignment = assignments.find((item) => item.id === selectedAssignment);
      if (!assignment) return;

      setAutoSaveStatus((prev) => ({ ...prev, [studentId]: "saving" }));

      const termName = termKey === "term1" ? "First Term" : "Second Term";

      const ids =
        prevTermIds[selectedAssignment]?.[studentId] || {};

      const existingId =
        termKey === "term1" ? ids.term1Id : ids.term2Id;

      const payload = {
        student_id: studentId,
        subject_id: assignment.subjects.id,
        term: termName as any,
        session: settings.active_session,
        total: totalValue,
        submitted: true,
      };

      const { data } = await supabase
        .from("scores")
        .upsert(payload, { onConflict: "student_id,subject_id,term,session" })
        .select()
        .single();

      if (data) {
        setPrevTermIds((prev) => ({
          ...prev,
          [selectedAssignment]: {
            ...(prev[selectedAssignment] || {}),
            [studentId]: {
              ...(prev[selectedAssignment]?.[studentId] || {}),
              [termKey === "term1" ? "term1Id" : "term2Id"]: data.id,
            },
          },
        }));
      }

      setSavedIndicator(studentId);
    },
    [assignments, prevTermIds, selectedAssignment, setSavedIndicator, settings.active_session]
  );

  const commitPrevTermSave = useCallback(
    (studentId: string, termKey: "term1" | "term2") => {
      const timerKey = `${studentId}::${termKey}`;
      if (prevTermTimers.current[timerKey]) {
        clearTimeout(prevTermTimers.current[timerKey]);
        delete prevTermTimers.current[timerKey];
      }

      const value =
        prevTermScoresRef.current[selectedAssignment]?.[studentId]?.[termKey] ?? 0;

      const p = autoSavePrevTerm(studentId, termKey, Number(value));
      trackSave(p);
    },
    [autoSavePrevTerm, selectedAssignment, trackSave]
  );

  const flushPendingSavesRef = useRef<() => Promise<void>>();

  const flushPendingSaves = useCallback(async () => {
    const pendingCurrentStudentIds = Object.keys(autoSaveTimers.current);
    const pendingPrevTermKeys = Object.keys(prevTermTimers.current);

    pendingCurrentStudentIds.forEach((studentId) => {
      clearTimeout(autoSaveTimers.current[studentId]);
      delete autoSaveTimers.current[studentId];
    });

    pendingPrevTermKeys.forEach((timerKey) => {
      clearTimeout(prevTermTimers.current[timerKey]);
      delete prevTermTimers.current[timerKey];
    });

    await Promise.all([
      ...Array.from(inflightSaves.current),
      ...pendingCurrentStudentIds.map((studentId) => autoSaveStudent(studentId, scoreMapRef.current[studentId] || {}, false)),
      ...pendingPrevTermKeys.map((timerKey) => {
        const [studentId, termKey] = timerKey.split("::") as [string, "term1" | "term2"];
        return autoSavePrevTerm(studentId, termKey, Number(prevTermScoresRef.current[selectedAssignment]?.[studentId]?.[termKey] ?? 0));
      }),
    ]);
  }, [autoSavePrevTerm, autoSaveStudent, selectedAssignment]);

  // Keep a ref so handleAssignmentChange always uses latest closure
  useEffect(() => {
    flushPendingSavesRef.current = flushPendingSaves;
  }, [flushPendingSaves]);

  useEffect(() => {
    const handleBeforeSignOut = (event: Event) => {
      const detail = (event as CustomEvent<{ promises?: Promise<void>[] }>).detail;
      detail?.promises?.push(flushPendingSavesRef.current?.() ?? Promise.resolve());
    };

    window.addEventListener("app:before-signout", handleBeforeSignOut);
    return () => window.removeEventListener("app:before-signout", handleBeforeSignOut);
  }, []);

  const updateLocal = (studentId: string, field: string, value: string) => {
    const maxMap: Record<string, number> = { first_test: 20, second_test: 20, exam: 60 };
    const clamped = maxMap[field] ? clampValue(value, maxMap[field]) : value;
    const assignment = assignments.find((item) => item.id === selectedAssignment);
    const className = assignment?.subjects?.class || assignment?.class || "";
    const isJSSClass = ["JSS1", "JSS2", "JSS3"].includes(className);

    setScoreMap((prev) => {
      const updated = {
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [field]: clamped,
        },
      };

      const average = calculateAverage(studentId, updated[studentId]);

      updated[studentId] = {
        ...updated[studentId],
        subject_comment: getCommentForScore(average, isJSSClass),
      };

      scheduleAutoSave(studentId, updated[studentId]);

      return updated;
    });
  };

  const commitCurrentSave = useCallback(
    (studentId: string) => {
      if (autoSaveTimers.current[studentId]) {
        clearTimeout(autoSaveTimers.current[studentId]);
        delete autoSaveTimers.current[studentId];
      }
      const scoreData = scoreMapRef.current[studentId];
      if (scoreData) {
        const p = autoSaveStudent(studentId, scoreData, false);
        trackSave(p);
      }
    },
    [autoSaveStudent, trackSave]
  );

  const updatePrevTerm = (studentId: string, termKey: "term1" | "term2", value: string) => {
    const clamped = clampValue(value, 100);
    const numericValue = clamped === "" ? 0 : Number(clamped);
    const timerKey = `${studentId}::${termKey}`;

    prevTermScoresRef.current = {
      ...prevTermScoresRef.current,
      [selectedAssignment]: {
        ...(prevTermScoresRef.current[selectedAssignment] || {}),
        [studentId]: {
          ...(prevTermScoresRef.current[selectedAssignment]?.[studentId] || {}),
          [termKey]: numericValue,
        },
      },
    };

    setPrevTermScores(prevTermScoresRef.current);

    if (prevTermTimers.current[timerKey]) {
      clearTimeout(prevTermTimers.current[timerKey]);
    }

    prevTermTimers.current[timerKey] = setTimeout(() => {
      delete prevTermTimers.current[timerKey];
      const p = autoSavePrevTerm(studentId, termKey, numericValue);
      trackSave(p);
    }, 800);
  };

  const handleSaveAll = async () => {
    const assignment = assignments.find(
      (item) => item.id === selectedAssignment
    );
    if (!assignment) return;

    setSaving(true);

    try {
      // ✅ FIX 1: flush pending autosaves FIRST
      await flushPendingSaves();

      await Promise.all(
        students.map(async (student) => {
          const scoreData = scoreMapRef.current?.[student.id];
          if (!scoreData) return;

          // ✅ ensures submitted = true
          await autoSaveStudent(student.id, scoreData, true);
        })
      );

      toast.success("Scores submitted successfully!");
    } catch (err) {
      toast.error("Failed to submit scores");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignmentChange = (value: string) => {
    if (value === selectedAssignment) return;

    void (async () => {
      if (flushPendingSavesRef.current) {
        await flushPendingSavesRef.current();
      }
      // Small delay to ensure DB writes are committed before re-fetching
      await new Promise((r) => setTimeout(r, 300));
      setSelectedAssignment(value);
    })();
  };

  const currentAssignment = assignments.find((assignment) => assignment.id === selectedAssignment);
  const currentClass = currentAssignment?.subjects?.class || currentAssignment?.class || "";
  const isJSS = ["JSS1", "JSS2", "JSS3"].includes(currentClass);

  return (
    <DashboardLayout title="Enter Scores">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Select value={selectedAssignment} onValueChange={handleAssignmentChange}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select Subject & Class" />
          </SelectTrigger>
          <SelectContent>
            {assignments.map((assignment) => (
              <SelectItem key={assignment.id} value={assignment.id}>
                {assignment.subjects?.name} — {assignment.subjects?.class}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedAssignment && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Scores auto-save as you type</span>
            <Button onClick={handleSaveAll} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Submitting..." : "Submit All"}
            </Button>
          </div>
        )}
      </div>

      {!selectedAssignment ? (
        <div className="py-12 text-center text-muted-foreground">Select a subject to start entering scores</div>
      ) : (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-display">
              {currentAssignment?.subjects?.name} — {currentAssignment?.subjects?.class} • {settings.active_term} {settings.active_session}
            </CardTitle>
          </CardHeader>

          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Student</TableHead>
                  <TableHead className="w-20">1st Test (20)</TableHead>
                  <TableHead className="w-20">2nd Test (20)</TableHead>
                  <TableHead className="w-20">Exam (60)</TableHead>
                  <TableHead className="w-16">Total (100)</TableHead>
                  {isSecondTerm && (
                    <>
                      <TableHead className="w-24 bg-accent/30 text-accent-foreground">1st Term (100)</TableHead>
                      <TableHead className="w-20 bg-accent/30 text-accent-foreground">Average</TableHead>
                    </>
                  )}
                  {isThirdTerm && (
                    <>
                      <TableHead className="w-24 bg-accent/30 text-accent-foreground">1st Term (100)</TableHead>
                      <TableHead className="w-24 bg-accent/30 text-accent-foreground">2nd Term (100)</TableHead>
                      <TableHead className="w-20 bg-accent/30 text-accent-foreground">Average</TableHead>
                    </>
                  )}
                  {!isJSS && <TableHead className="w-16">Grade</TableHead>}
                  <TableHead className="min-w-[120px]">Comment</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {students.map((student) => {
                  const scoreData = scoreMap[student.id] || {};
                  const first = Number(scoreData.first_test) || 0;
                  const second = Number(scoreData.second_test) || 0;
                  const exam = Number(scoreData.exam) || 0;
                  const total = first + second + exam;
                  const prev = prevTermScores[selectedAssignment]?.[student.id];
                  const average = calculateAverage(student.id, scoreData);
                  const displayGrade = calculateGrade(average);
                  const comment = getCommentForScore(average, isJSS);
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-1">
                          {student.full_name}
                          {autoSaveStatus[student.id] === "saving" && (
                            <span className="text-[10px] text-muted-foreground">saving...</span>
                          )}
                          {autoSaveStatus[student.id] === "saved" && <Check className="h-3 w-3 text-primary" />}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          className="h-8 w-16 text-sm"
                          value={scoreData.first_test ?? ""}
                          onChange={(event) => updateLocal(student.id, "first_test", event.target.value)}
                          onBlur={() => commitCurrentSave(student.id)}
                        />
                      </TableCell>

                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          className="h-8 w-16 text-sm"
                          value={scoreData.second_test ?? ""}
                          onChange={(event) => updateLocal(student.id, "second_test", event.target.value)}
                          onBlur={() => commitCurrentSave(student.id)}
                        />
                      </TableCell>

                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={60}
                          className="h-8 w-16 text-sm"
                          value={scoreData.exam ?? ""}
                          onChange={(event) => updateLocal(student.id, "exam", event.target.value)}
                          onBlur={() => commitCurrentSave(student.id)}
                        />
                      </TableCell>

                      <TableCell className="font-bold text-sm">{total}</TableCell>

                      {isSecondTerm && (
                        <>
                          <TableCell className="bg-accent/10 p-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="h-8 w-20 text-sm"
                              value={prev?.term1 ?? ""}
                              onChange={(event) => {
                                updatePrevTerm(student.id, "term1", event.target.value);
                                schedulePrevTermSave(student.id, "term1");
                              }}
                            />
                          </TableCell>
                          <TableCell className="bg-accent/10 text-center text-sm font-bold text-primary">
                            {average.toFixed(1)}
                          </TableCell>
                        </>
                      )}

                      {isThirdTerm && (
                        <>
                          <TableCell className="bg-accent/10 p-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="h-8 w-20 text-sm"
                              value={prev?.term1 ?? ""}
                              onChange={(event) => {
                                updatePrevTerm(student.id, "term1", event.target.value);
                                schedulePrevTermSave(student.id, "term1");
                              }}
                            />
                          </TableCell>
                          <TableCell className="bg-accent/10 p-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="h-8 w-20 text-sm"
                              value={prev?.term2 ?? ""}
                              onChange={(event) => {
                                updatePrevTerm(student.id, "term2", event.target.value);
                                schedulePrevTermSave(student.id, "term2");
                              }}
                            />
                          </TableCell>
                          <TableCell className="bg-accent/10 text-center text-sm font-bold text-primary">
                            {average.toFixed(1)}
                          </TableCell>
                        </>
                      )}

                      {!isJSS && (
                        <TableCell>
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-bold ${displayGrade === "A1"
                              ? "bg-success/20 text-success"
                              : displayGrade === "F9"
                                ? "bg-destructive/20 text-destructive"
                                : "bg-secondary text-secondary-foreground"
                              }`}
                          >
                            {displayGrade}
                          </span>
                        </TableCell>
                      )}

                      <TableCell className="text-xs font-medium">
                        {comment}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
function autoComment(average: number): string {
  if (average >= 80) return "Excellent";
  if (average >= 70) return "Very Good";
  if (average >= 60) return "Good";
  if (average >= 50) return "Fair";
  if (average >= 40) return "Pass";
  return "Fail";
}

