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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { questionId, setId, answerText, normalizedAnswer, workingOut } = await req.json();

    // Fetch question details
    const { data: question, error: questionError } = await supabase
      .from('practice_questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      throw new Error('Question not found');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Check if this is a table_grid or graph question with deterministic grading
    const isTableGrid = question.question_type === 'table_grid';
    const isGraphInterpretation = question.question_type === 'graph_interpretation';
    const isGraphPlotting = question.question_type === 'graph_plotting';
    const isBearings = question.question_type === 'bearings';
    let tableGridResult: any = null;
    let graphResult: any = null;
    let bearingsResult: any = null;

    // ========================
    // GRAPH ANSWER NORMALIZATION UTILITIES
    // (Matches table question logic exactly)
    // ========================
    
    // Extract numeric value from various formats: "2", "2.0", "y=2x", "m=2", "gradient = 2", "(0,0)" -> 0
    function extractNumericValue(input: string | number | boolean): number | null {
      if (typeof input === 'number') return input;
      if (typeof input === 'boolean') return null;
      
      const str = String(input).trim().toLowerCase();
      
      // Direct number
      const directNum = parseFloat(str);
      if (!isNaN(directNum) && str === String(directNum)) {
        return directNum;
      }
      
      // Handle coordinate format: (0,0) or (x,y) - extract first number for y-intercept context
      const coordMatch = str.match(/^\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*$/);
      if (coordMatch) {
        // For y-intercept, we want the y value when x=0, so return first coordinate if it's the origin
        const x = parseFloat(coordMatch[1]);
        const y = parseFloat(coordMatch[2]);
        if (x === 0) return y; // (0, y) means y-intercept is y
        return y; // Default to y value
      }
      
      // Handle expressions like "y = 2x", "m = 2", "gradient = 2", "intercept at 0"
      // Extract the numeric coefficient or value
      const patterns = [
        /(?:y\s*=\s*)?(-?[\d.]+)\s*x/i,           // "y = 2x" or "2x" -> 2
        /m\s*=\s*(-?[\d.]+)/i,                     // "m = 2" -> 2
        /gradient\s*=?\s*(-?[\d.]+)/i,            // "gradient = 2" or "gradient 2" -> 2
        /slope\s*=?\s*(-?[\d.]+)/i,               // "slope = 2" -> 2
        /intercept\s*(?:at|=|:)?\s*(-?[\d.]+)/i,  // "intercept at 0" -> 0
        /c\s*=\s*(-?[\d.]+)/i,                     // "c = 0" -> 0
        /=\s*(-?[\d.]+)\s*$/,                      // "y = 0" -> 0
        /^(-?[\d.]+)$/                             // Plain number
      ];
      
      for (const pattern of patterns) {
        const match = str.match(pattern);
        if (match && match[1]) {
          return parseFloat(match[1]);
        }
      }
      
      // Final attempt: just extract any number from the string
      const anyNumber = str.match(/(-?[\d.]+)/);
      if (anyNumber) {
        return parseFloat(anyNumber[1]);
      }
      
      return null;
    }
    
    // Normalize boolean inputs: "true", "yes", "increasing" -> true
    function normalizeBoolean(input: string | number | boolean): boolean | null {
      if (typeof input === 'boolean') return input;
      
      const str = String(input).trim().toLowerCase();
      
      const trueValues = ['true', 'yes', 'y', '1', 'increasing', 'positive', 'correct', 'right'];
      const falseValues = ['false', 'no', 'n', '0', 'decreasing', 'negative', 'incorrect', 'wrong'];
      
      if (trueValues.includes(str)) return true;
      if (falseValues.includes(str)) return false;
      
      return null;
    }
    
    // Normalize text inputs for comparison
    function normalizeText(input: string): string {
      return String(input).trim().toLowerCase().replace(/\s+/g, ' ');
    }
    
    // Check if two numeric values match within tolerance
    function numericMatch(studentVal: number, correctVal: number, tolerance: number = 0.01): boolean {
      // Use both relative (1%) and absolute (0.001) tolerance like table questions
      const relativeTolerance = Math.abs(correctVal * tolerance);
      const absoluteTolerance = 0.001;
      return Math.abs(studentVal - correctVal) <= relativeTolerance || 
             Math.abs(studentVal - correctVal) <= absoluteTolerance;
    }
    
    // Handle graph_interpretation deterministic grading with robust normalization
    if (isGraphInterpretation && answerText) {
      try {
        const parsed = JSON.parse(answerText);
        if (parsed._type === 'graph_interpretation') {
          const questionData = JSON.parse(question.correct_answer || '{}');
          const fields = questionData.interpretationFields || [];
          const studentAnswers = parsed.answers || {};
          
          let totalScore = 0;
          const totalMarks = fields.reduce((sum: number, f: any) => sum + (f.marks || 1), 0);
          const perFieldResults: Record<string, any> = {};
          
          console.log('[graph-grading] Starting interpretation grading with normalization');
          
          for (const field of fields) {
            const studentVal = studentAnswers[field.id];
            const correctVal = field.correctAnswer;
            const marks = field.marks || 1;
            let isCorrect = false;
            const hasAnswer = studentVal !== undefined && studentVal !== '' && studentVal !== null;
            
            console.log(`[graph-grading] Field ${field.id}: type=${field.type}, studentVal="${studentVal}", correctVal="${correctVal}"`);
            
            if (hasAnswer) {
              if (field.type === 'numeric') {
                // ROBUST NUMERIC MATCHING with tolerance support
                // Use estimateTolerance for "read-off" / "estimate" questions (absolute value tolerance)
                // Use tolerance for relative tolerance (default 1%)
                const isEstimateQuestion = field.estimateTolerance !== undefined || 
                  field.question?.toLowerCase().includes('estimate') ||
                  field.question?.toLowerCase().includes('read') ||
                  field.question?.toLowerCase().includes('approximately');
                
                // For estimate questions: use absolute tolerance (default ±1 unit)
                // For exact questions: use relative tolerance (default 1%)
                const absoluteTolerance = field.estimateTolerance ?? (isEstimateQuestion ? 1 : 0.001);
                const relativeTolerance = field.tolerance ?? 0.01;
                
                // Try to extract numeric value from student answer (handles "y=2x", "(0,0)", etc.)
                const numStudent = extractNumericValue(studentVal);
                const numCorrect = typeof correctVal === 'number' ? correctVal : parseFloat(String(correctVal));
                
                console.log(`[graph-grading] Numeric: extracted student=${numStudent}, correct=${numCorrect}, isEstimate=${isEstimateQuestion}, absTol=${absoluteTolerance}`);
                
                if (numStudent !== null && !isNaN(numCorrect)) {
                  // For estimate questions, use absolute tolerance
                  // For exact questions, use relative tolerance OR tiny absolute
                  const relTol = Math.abs(numCorrect * relativeTolerance);
                  const diff = Math.abs(numStudent - numCorrect);
                  isCorrect = diff <= absoluteTolerance || diff <= relTol;
                }
                
                // Also check against acceptable answer formats if provided
                if (!isCorrect && field.acceptedFormats) {
                  for (const fmt of field.acceptedFormats) {
                    const fmtNum = extractNumericValue(fmt);
                    if (fmtNum !== null && numStudent !== null) {
                      const diff = Math.abs(numStudent - fmtNum);
                      if (diff <= absoluteTolerance) {
                        isCorrect = true;
                        break;
                      }
                    }
                  }
                }
              } else if (field.type === 'text') {
                // TEXT MATCHING with synonyms (like table questions)
                const normalized = normalizeText(studentVal);
                const correctNorm = normalizeText(correctVal);
                const synonyms = field.synonyms || [];
                
                // Check exact match
                if (normalized === correctNorm) {
                  isCorrect = true;
                } else {
                  // Check synonyms
                  isCorrect = synonyms.some((s: string) => {
                    const synNorm = normalizeText(s);
                    return normalized === synNorm || 
                           normalized.includes(synNorm) ||
                           synNorm.includes(normalized);
                  });
                }
                
                // Also try numeric extraction for text fields that might contain numbers
                if (!isCorrect) {
                  const numStudent = extractNumericValue(studentVal);
                  const numCorrect = extractNumericValue(correctVal);
                  if (numStudent !== null && numCorrect !== null) {
                    isCorrect = numericMatch(numStudent, numCorrect);
                  }
                }
              } else if (field.type === 'boolean') {
                // BOOLEAN MATCHING with normalization
                const normalizedStudent = normalizeBoolean(studentVal);
                const normalizedCorrect = typeof correctVal === 'boolean' ? correctVal : normalizeBoolean(correctVal);
                
                console.log(`[graph-grading] Boolean: normalized student=${normalizedStudent}, correct=${normalizedCorrect}`);
                
                if (normalizedStudent !== null && normalizedCorrect !== null) {
                  isCorrect = normalizedStudent === normalizedCorrect;
                } else {
                  // Fallback to string comparison
                  isCorrect = String(studentVal).toLowerCase() === String(correctVal).toLowerCase();
                }
              } else {
                // MCQ or other types - direct comparison
                isCorrect = studentVal === correctVal || String(studentVal) === String(correctVal);
              }
            }
            
            const earned = isCorrect ? marks : 0;
            totalScore += earned;
            perFieldResults[field.id] = {
              correct: isCorrect,
              earned,
              max: marks,
              studentAnswer: studentVal,
              correctAnswer: correctVal,
              status: !hasAnswer ? 'missed' : isCorrect ? 'correct' : 'incorrect'
            };
            
            console.log(`[graph-grading] Field ${field.id} result: ${perFieldResults[field.id].status}`);
          }
          
          graphResult = {
            score: totalScore,
            feedback: `${Object.values(perFieldResults).filter((r: any) => r.correct).length}/${fields.length} answers correct.`,
            isCorrect: totalScore >= totalMarks,
            markingData: { perFieldResults, totalScore, totalMarks }
          };
          
          console.log('[graph-grading] Final result:', { totalScore, totalMarks, isCorrect: graphResult.isCorrect });
        }
      } catch (e) {
        console.log('[graph-grading] Parse error:', e);
      }
    }

    // Handle graph_plotting deterministic grading with separate x/y tolerance
    if (isGraphPlotting && answerText) {
      try {
        const parsed = JSON.parse(answerText);
        if (parsed._type === 'graph_plotting') {
          const questionData = JSON.parse(question.correct_answer || '{}');
          const expected = questionData.plottingAnswer?.expectedPoints || [];
          const toleranceUnits = questionData.plottingAnswer?.toleranceUnits || 0.5;
          // Support separate x/y tolerance (default ±0.2)
          const toleranceX = questionData.graphConfig?.toleranceX ?? toleranceUnits;
          const toleranceY = questionData.graphConfig?.toleranceY ?? toleranceUnits;
          const studentPoints = parsed.points || [];
          const studentJoinMode = parsed.joinMode;
          const joinPointsMode = questionData.graphConfig?.joinPointsMode;
          
          // Calculate marks: points + optional join mode
          const joinModeMarks = joinPointsMode?.graded ? 1 : 0;
          const pointMarks = question.marks - joinModeMarks;
          const marksPerPoint = pointMarks / Math.max(expected.length, 1);
          
          let totalScore = 0;
          const perPointResults: any[] = [];
          const matchedExpected = new Set<number>();
          
          // Match each student point to closest expected point using separate x/y tolerance
          for (const sp of studentPoints) {
            let bestMatch = -1;
            let bestDist = Infinity;
            expected.forEach((ep: any, idx: number) => {
              if (matchedExpected.has(idx)) return;
              // Check if within tolerance box (separate x and y)
              const withinX = Math.abs(sp.x - ep.x) <= toleranceX;
              const withinY = Math.abs(sp.y - ep.y) <= toleranceY;
              if (withinX && withinY) {
                const dist = Math.sqrt(Math.pow(sp.x - ep.x, 2) + Math.pow(sp.y - ep.y, 2));
                if (dist < bestDist) { bestDist = dist; bestMatch = idx; }
              }
            });
            
            if (bestMatch >= 0) {
              matchedExpected.add(bestMatch);
              totalScore += marksPerPoint;
              perPointResults.push({ studentPoint: sp, expectedPoint: expected[bestMatch], matched: true, distance: bestDist, status: 'correct' });
            } else {
              perPointResults.push({ studentPoint: sp, expectedPoint: null, matched: false, status: 'incorrect' });
            }
          }
          
          // Add missed expected points
          expected.forEach((ep: any, idx: number) => {
            if (!matchedExpected.has(idx)) {
              perPointResults.push({ studentPoint: null, expectedPoint: ep, matched: false, status: 'missed' });
            }
          });
          
          // Grade join mode if enabled
          let joinModeResult = null;
          if (joinPointsMode?.graded && joinPointsMode.correctMode) {
            const isJoinModeCorrect = studentJoinMode === joinPointsMode.correctMode;
            if (isJoinModeCorrect) {
              totalScore += joinModeMarks;
            }
            joinModeResult = {
              studentMode: studentJoinMode || 'none',
              correctMode: joinPointsMode.correctMode,
              correct: isJoinModeCorrect,
              earned: isJoinModeCorrect ? joinModeMarks : 0,
              max: joinModeMarks,
              status: !studentJoinMode ? 'missed' : isJoinModeCorrect ? 'correct' : 'incorrect'
            };
          }
          
          graphResult = {
            score: Math.round(totalScore * 100) / 100,
            feedback: `${matchedExpected.size}/${expected.length} points correct.${joinModeResult ? ` Line type: ${joinModeResult.correct ? 'correct' : 'incorrect'}.` : ''}`,
            isCorrect: matchedExpected.size === expected.length && (!joinModeResult || joinModeResult.correct),
            markingData: { perPointResults, totalScore: Math.round(totalScore * 100) / 100, totalMarks: question.marks, joinModeResult }
          };
        }
      } catch (e) {
        console.log('[graph-grading] Parse error:', e);
      }
    }

    // Handle bearings deterministic grading
    if (isBearings && answerText) {
      try {
        const parsed = JSON.parse(answerText);
        if (parsed._type === 'bearings') {
          const questionData = JSON.parse(question.correct_answer || '{}');
          const config = questionData.bearingsConfig || {};
          const correctBearing = config.correctBearing ?? 0;
          // Increased default tolerance to ±3° for bearings/angles (more forgiving for estimates)
          const tolerance = config.tolerance ?? 3;
          const marks = config.marks ?? question.marks ?? 1;
          
          // Normalize student bearing
          const studentInput = parsed.bearing;
          let studentBearing: number | null = null;
          
          if (studentInput !== undefined && studentInput !== '' && studentInput !== null) {
            if (typeof studentInput === 'number') {
              studentBearing = ((studentInput % 360) + 360) % 360;
            } else {
              const str = String(studentInput).trim().toUpperCase();
              
              // Try direct number: "045", "45°", "45"
              const numMatch = str.match(/^(\d+(?:\.\d+)?)\s*°?$/);
              if (numMatch) {
                studentBearing = ((parseFloat(numMatch[1]) % 360) + 360) % 360;
              }
              
              // Try compass notation: N45E, S30W, etc.
              if (studentBearing === null) {
                const compassMatch = str.match(/^([NSEW])(\d+(?:\.\d+)?)([NSEW])?$/);
                if (compassMatch) {
                  const [, start, angle, end] = compassMatch;
                  const deg = parseFloat(angle);
                  
                  if (start === 'N' && end === 'E') studentBearing = deg;
                  else if (start === 'N' && end === 'W') studentBearing = 360 - deg;
                  else if (start === 'S' && end === 'E') studentBearing = 180 - deg;
                  else if (start === 'S' && end === 'W') studentBearing = 180 + deg;
                  else if (start === 'N' && !end) studentBearing = deg <= 90 ? deg : 360 - deg;
                  else if (start === 'E' && !end) studentBearing = 90;
                  else if (start === 'S' && !end) studentBearing = 180;
                  else if (start === 'W' && !end) studentBearing = 270;
                }
              }
            }
          }
          
          // Calculate difference (accounting for wrap-around at 0/360)
          let difference: number | null = null;
          let isCorrect = false;
          
          if (studentBearing !== null) {
            const diff1 = Math.abs(studentBearing - correctBearing);
            const diff2 = 360 - diff1;
            difference = Math.min(diff1, diff2);
            isCorrect = difference <= tolerance;
          }
          
          const hasAnswer = studentBearing !== null;
          bearingsResult = {
            score: isCorrect ? marks : 0,
            feedback: isCorrect 
              ? `✓ Correct! Bearing: ${correctBearing}°` 
              : hasAnswer 
                ? `✗ Incorrect. Your answer: ${studentBearing?.toFixed(1)}°, Correct: ${correctBearing}° (tolerance: ±${tolerance}°)`
                : `○ No answer provided. Correct: ${correctBearing}°`,
            isCorrect,
            markingData: {
              correct: isCorrect,
              studentBearing,
              correctBearing,
              tolerance,
              difference,
              status: !hasAnswer ? 'missed' : isCorrect ? 'correct' : 'incorrect',
              earned: isCorrect ? marks : 0,
              max: marks
            }
          };
        }
      } catch (e) {
        console.log('[bearings-grading] Parse error:', e);
      }
    }

    // If we have a bearings result, save and return
    if (bearingsResult) {
      await supabase.from('practice_question_answers').upsert({
        user_id: user.id, set_id: setId, question_id: questionId,
        answer_text: answerText || '', working_out: workingOut,
        score: bearingsResult.score, is_correct: bearingsResult.isCorrect,
        feedback: bearingsResult.feedback, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,question_id' });
      
      const { data: allAnswers } = await supabase.from('practice_question_answers').select('is_correct').eq('user_id', user.id).eq('set_id', setId);
      await supabase.from('practice_set_progress').upsert({
        user_id: user.id, set_id: setId,
        questions_attempted: allAnswers?.length || 0,
        questions_correct: allAnswers?.filter(a => a.is_correct).length || 0,
        last_accessed_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,set_id' });
      
      return new Response(JSON.stringify({
        score: bearingsResult.score, feedback: bearingsResult.feedback,
        isCorrect: bearingsResult.isCorrect, markingData: bearingsResult.markingData
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // If we have a graph result, save and return
    if (graphResult) {
      await supabase.from('practice_question_answers').upsert({
        user_id: user.id, set_id: setId, question_id: questionId,
        answer_text: answerText || '', working_out: workingOut,
        score: graphResult.score, is_correct: graphResult.isCorrect,
        feedback: graphResult.feedback, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,question_id' });
      
      const { data: allAnswers } = await supabase.from('practice_question_answers').select('is_correct').eq('user_id', user.id).eq('set_id', setId);
      await supabase.from('practice_set_progress').upsert({
        user_id: user.id, set_id: setId,
        questions_attempted: allAnswers?.length || 0,
        questions_correct: allAnswers?.filter(a => a.is_correct).length || 0,
        last_accessed_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,set_id' });
      
      return new Response(JSON.stringify({
        score: graphResult.score, feedback: graphResult.feedback,
        isCorrect: graphResult.isCorrect, markingData: graphResult.markingData
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    if (isTableGrid && answerText) {
      try {
        const parsed = JSON.parse(answerText);
        if (parsed._type === 'table_grid') {
          console.log('[table-grading] Parsed table answer:', { 
            version: parsed.version, 
            hasCells: !!parsed.cells, 
            hasInputs: !!parsed.inputs,
            cellKeys: Object.keys(parsed.cells || {}),
            inputKeys: Object.keys(parsed.inputs || {})
          });
          
          // Parse student answers (toggle selections)
          let studentAnswers: Record<string, number[]> = {};
          // Parse student inputs (text/numeric entries)
          let studentInputs: Record<string, Record<number, string | number>> = {};
          
          if (parsed.version === 2) {
            // Extract toggle cells - NOTE: UI uses 1-indexed cols, correct_answer uses 0-indexed
            // We convert student answers to 0-indexed to match correct_answer format
            if (parsed.cells) {
              for (const [rowId, colMap] of Object.entries(parsed.cells as Record<string, Record<number, boolean>>)) {
                studentAnswers[rowId] = Object.entries(colMap)
                  .filter(([_, selected]) => selected)
                  .map(([colIdx]) => parseInt(colIdx, 10) - 1); // Convert 1-indexed to 0-indexed
              }
            }
            // Extract input cells (text/numeric) - also convert to 0-indexed
            if (parsed.inputs) {
              for (const [rowId, colMap] of Object.entries(parsed.inputs as Record<string, Record<number, string>>)) {
                studentInputs[rowId] = {};
                for (const [colIdx, value] of Object.entries(colMap)) {
                  // Convert 1-indexed to 0-indexed
                  studentInputs[rowId][parseInt(colIdx, 10) - 1] = value;
                }
              }
            }
          } else if (parsed.answers) {
            studentAnswers = parsed.answers;
          }
          
          // Parse correct answers and table metadata from question
          // Toggle tables: correctAnswers = { rowId: [colIndex, ...] }
          let correctToggleAnswers: Record<string, number[]> | null = null;
          // Text/numeric tables: correctInputs = { rowId: { colIndex: "value" } }
          let correctInputs: Record<string, Record<number, string | string[]>> | null = null;
          let tableType: 'tf_single' | 'grid_single' | 'grid_multi' | 'text_entry' | 'numeric_entry' = 'grid_multi';
          let columnKinds: string[] = [];
          
          if (question.correct_answer) {
            try {
              const ca = JSON.parse(question.correct_answer);
              
              if (ca.table_data?.tableType) {
                const tt = ca.table_data.tableType;
                if (tt === 'tf_single' || tt === 'tick_cross' || tt === 'tf') {
                  const headers = ca.table_data.headers || [];
                  const hasTrue = headers.some((h: string) => h.toLowerCase() === 'true');
                  const hasFalse = headers.some((h: string) => h.toLowerCase() === 'false');
                  tableType = hasTrue && hasFalse ? 'tf_single' : 'grid_multi';
                } else if (tt === 'grid_single' || tt === 'single_select') {
                  tableType = 'grid_single';
                } else if (tt === 'text_entry') {
                  tableType = 'text_entry';
                } else if (tt === 'numeric_entry' || tt === 'number_entry') {
                  tableType = 'numeric_entry';
                }
              }
              
              // Extract column kinds for input tables
              if (ca.table_data?.columns) {
                columnKinds = ca.table_data.columns.map((c: any) => c.kind || c.type || 'toggle');
              }
              
              // Detect text mode from selectionMode
              if (ca.table_data?.selectionMode === 'text') {
                tableType = 'text_entry';
              } else if (ca.table_data?.selectionMode === 'single') {
                tableType = tableType === 'tf_single' ? 'tf_single' : 'grid_single';
              }
              
              // Check column types to detect text/number entry tables
              if (ca.table_data?.columns?.some((c: any) => c.type === 'text' || c.kind === 'text')) {
                tableType = 'text_entry';
              }
              if (ca.table_data?.columns?.some((c: any) => c.type === 'number' || c.kind === 'number')) {
                tableType = 'numeric_entry';
              }
              
              // Parse correctAnswers based on table type
              if (ca.correctAnswers) {
                if (tableType === 'text_entry' || tableType === 'numeric_entry') {
                  // Text/number tables: correctAnswers is { rowId: ["value1", "value2", ...] }
                  // Convert to correctInputs format: { rowId: { 0: "value1", 1: "value2" } }
                  // Note: We use 0-indexed now since we convert student answers to 0-indexed
                  correctInputs = {};
                  for (const [rowId, values] of Object.entries(ca.correctAnswers)) {
                    if (Array.isArray(values) && values.length > 0) {
                      correctInputs[rowId] = {};
                      for (let i = 0; i < values.length; i++) {
                        // Column index is 0-indexed for input columns
                        correctInputs[rowId][i] = values[i] as string;
                      }
                    }
                  }
                  console.log('[table-grading] Converted correctAnswers to correctInputs:', correctInputs);
                } else {
                  // Toggle tables: correctAnswers is { rowId: [colIndex, ...] }
                  correctToggleAnswers = ca.correctAnswers as Record<string, number[]>;
                }
              }
              
              // Use correctInputs directly if provided
              if (ca.correctInputs) {
                correctInputs = ca.correctInputs;
              }
            } catch {
              // Failed to parse correct answer
            }
          }
          
          console.log('[table-grading] Detected tableType:', tableType, 'columnKinds:', columnKinds);
          
          // Handle TEXT_ENTRY and NUMERIC_ENTRY tables
          if ((tableType === 'text_entry' || tableType === 'numeric_entry') || 
              (Object.keys(studentInputs).length > 0 && Object.keys(studentAnswers).length === 0)) {
            console.log('[table-grading] Grading as input table. studentInputs:', studentInputs);
            
            // Count filled cells and grade
            const rowIds = Object.keys(studentInputs);
            const totalRows = rowIds.length || Object.keys(correctInputs || {}).length || 1;
            const marksPerRow = question.marks / Math.max(totalRows, 1);
            let totalScore = 0;
            const rowResults: Record<string, { correct: boolean; earned: number; max: number; details: string; status: 'correct' | 'incorrect' | 'missed' | 'partial' }> = {};
            const feedbackLines: string[] = [];
            const allRowIds = new Set([...Object.keys(studentInputs), ...Object.keys(correctInputs || {})]);
            
            for (const rowId of allRowIds) {
              const studentRowInputs = studentInputs[rowId] || {};
              const correctRowInputs = correctInputs?.[rowId] || {};
              const colIndices = new Set([...Object.keys(studentRowInputs), ...Object.keys(correctRowInputs)]);
              
              let cellsCorrect = 0;
              let cellsTotal = Object.keys(correctRowInputs).length || 1;
              let hasAnyAnswer = false;
              
              for (const colIdx of colIndices) {
                const studentVal = studentRowInputs[parseInt(colIdx)];
                const correctVal = correctRowInputs[parseInt(colIdx)];
                
                // Check if student answered
                if (studentVal !== undefined && studentVal !== '' && studentVal !== null) {
                  hasAnyAnswer = true;
                  
                  // Normalize student answer
                  const normalizedStudent = String(studentVal).trim().toLowerCase().replace(/\s+/g, ' ');
                  
                  if (tableType === 'numeric_entry') {
                    // Numeric comparison with tolerance
                    const numStudent = parseFloat(String(studentVal));
                    const numCorrect = parseFloat(String(correctVal));
                    const tolerance = 0.01; // 1% tolerance
                    if (!isNaN(numStudent) && !isNaN(numCorrect)) {
                      if (Math.abs(numStudent - numCorrect) <= Math.abs(numCorrect * tolerance) || 
                          Math.abs(numStudent - numCorrect) < 0.001) {
                        cellsCorrect++;
                      }
                    }
                  } else {
                    // Text comparison (case-insensitive) - support array of acceptable answers
                    let isCorrect = false;
                    
                    if (Array.isArray(correctVal)) {
                      // correctVal is an array of acceptable synonyms
                      isCorrect = correctVal.some((acceptable: string) => {
                        const normalizedAcceptable = String(acceptable).trim().toLowerCase().replace(/\s+/g, ' ');
                        return normalizedStudent === normalizedAcceptable || 
                               normalizedStudent.includes(normalizedAcceptable) ||
                               normalizedAcceptable.includes(normalizedStudent);
                      });
                    } else if (correctVal) {
                      // Single correct value
                      const normalizedCorrect = String(correctVal).trim().toLowerCase().replace(/\s+/g, ' ');
                      isCorrect = normalizedStudent === normalizedCorrect ||
                                  normalizedStudent.includes(normalizedCorrect) ||
                                  normalizedCorrect.includes(normalizedStudent);
                    }
                    
                    if (isCorrect) {
                      cellsCorrect++;
                    }
                  }
                }
              }
              
              const rowScore = cellsTotal > 0 ? (cellsCorrect / cellsTotal) * marksPerRow : 0;
              totalScore += rowScore;
              
              const isFullyCorrect = cellsCorrect === cellsTotal && cellsTotal > 0;
              const isPartial = cellsCorrect > 0 && cellsCorrect < cellsTotal;
              const status = !hasAnyAnswer ? 'missed' : isFullyCorrect ? 'correct' : isPartial ? 'partial' : 'incorrect';
              
              rowResults[rowId] = {
                correct: isFullyCorrect,
                earned: Math.round(rowScore * 100) / 100,
                max: marksPerRow,
                details: !hasAnyAnswer ? 'No answer provided' : isFullyCorrect ? 'Correct' : `${cellsCorrect}/${cellsTotal} cells correct`,
                status
              };
              
              if (!hasAnyAnswer) {
                feedbackLines.push(`• Row "${rowId}": Unanswered`);
              } else if (isFullyCorrect) {
                feedbackLines.push(`• Row "${rowId}": ✓ Correct`);
              } else if (isPartial) {
                feedbackLines.push(`• Row "${rowId}": Partial credit (${cellsCorrect}/${cellsTotal} correct)`);
              } else {
                feedbackLines.push(`• Row "${rowId}": ✗ Incorrect`);
              }
            }
            
            totalScore = Math.round(totalScore * 100) / 100;
            const correctRows = Object.values(rowResults).filter(r => r.correct).length;
            
            const markingDataJson = JSON.stringify({ perRowResults: rowResults, correctInputs });
            const feedback = `${correctRows}/${allRowIds.size} rows correct.\n\n${feedbackLines.join('\n')}\n\n<!--MARKING_DATA:${markingDataJson}-->`;
            
            tableGridResult = {
              score: totalScore,
              feedback,
              isCorrect: totalScore >= question.marks,
              perRowResults: rowResults,
              correctInputs // Include for direct response
            };
          }
          // Handle TOGGLE tables (TF, grid_single, grid_multi)
          else if (correctToggleAnswers && Object.keys(correctToggleAnswers).length > 0) {
            // DETERMINISTIC GRADING based on table type
            const nonExampleRows = Object.keys(correctToggleAnswers);
            const marksPerRow = question.marks / nonExampleRows.length;
            let totalScore = 0;
            const rowResults: Record<string, { correct: boolean; earned: number; max: number; details: string; status: 'correct' | 'incorrect' | 'missed' | 'partial' }> = {};
            const feedbackLines: string[] = [];
            
            // Validate and sanitize answers for single-select tables
            const sanitizedAnswers: Record<string, number[]> = {};
            for (const [rowId, selections] of Object.entries(studentAnswers)) {
              if (tableType === 'tf_single' || tableType === 'grid_single') {
                sanitizedAnswers[rowId] = selections.length > 0 ? [selections[0]] : [];
              } else {
                sanitizedAnswers[rowId] = selections;
              }
            }
            
            for (const rowId of nonExampleRows) {
              const expected = correctToggleAnswers[rowId] || [];
              const actual = sanitizedAnswers[rowId] || [];
              
              if (tableType === 'tf_single' || tableType === 'grid_single') {
                // Single selection: exact match or nothing
                if (actual.length === 0) {
                  rowResults[rowId] = { correct: false, earned: 0, max: marksPerRow, details: 'No selection made', status: 'missed' };
                  feedbackLines.push(`• Row "${rowId}": Unanswered`);
                } else if (expected.length === 1 && actual[0] === expected[0]) {
                  totalScore += marksPerRow;
                  rowResults[rowId] = { correct: true, earned: marksPerRow, max: marksPerRow, details: 'Correct', status: 'correct' };
                  feedbackLines.push(`• Row "${rowId}": ✓ Correct`);
                } else {
                  rowResults[rowId] = { correct: false, earned: 0, max: marksPerRow, details: 'Incorrect selection', status: 'incorrect' };
                  feedbackLines.push(`• Row "${rowId}": ✗ Incorrect`);
                }
              } else {
                // Multi-select with F1-like scoring
                const expectedSet = new Set(expected);
                let correctCount = 0;
                let incorrectCount = 0;
                
                for (const col of actual) {
                  if (expectedSet.has(col)) correctCount++;
                  else incorrectCount++;
                }
                
                const rawScore = Math.max(0, correctCount - incorrectCount);
                const rowScore = expected.length > 0 
                  ? Math.min((rawScore / expected.length) * marksPerRow, marksPerRow) 
                  : 0;
                
                totalScore += rowScore;
                const isFullyCorrect = correctCount === expected.length && incorrectCount === 0;
                const isPartial = correctCount > 0 && !isFullyCorrect;
                
                rowResults[rowId] = {
                  correct: isFullyCorrect,
                  earned: Math.round(rowScore * 100) / 100,
                  max: marksPerRow,
                  details: isFullyCorrect ? 'Correct' : isPartial ? `Partial (${correctCount}/${expected.length})` : actual.length === 0 ? 'Unanswered' : 'Incorrect',
                  status: isFullyCorrect ? 'correct' : isPartial ? 'partial' : actual.length === 0 ? 'missed' : 'incorrect'
                };
                
                if (isFullyCorrect) {
                  feedbackLines.push(`• Row "${rowId}": ✓ Correct`);
                } else if (isPartial) {
                  feedbackLines.push(`• Row "${rowId}": Partial credit (${correctCount}/${expected.length} correct)`);
                } else if (actual.length === 0) {
                  feedbackLines.push(`• Row "${rowId}": Unanswered`);
                } else {
                  feedbackLines.push(`• Row "${rowId}": ✗ Incorrect`);
                }
              }
            }
            
            totalScore = Math.round(totalScore * 100) / 100;
            const correctRows = Object.values(rowResults).filter(r => r.correct).length;
            
            // Build feedback with embedded marking data for UI hydration
            const markingDataJson = JSON.stringify({ perRowResults: rowResults, correctAnswers: correctToggleAnswers });
            const feedback = `${correctRows}/${nonExampleRows.length} rows correct.\n\n${feedbackLines.join('\n')}\n\n<!--MARKING_DATA:${markingDataJson}-->`;
            
            tableGridResult = {
              score: totalScore,
              feedback,
              isCorrect: totalScore >= question.marks,
              perRowResults: rowResults,
              correctAnswers: correctToggleAnswers // Include for direct response
            };
          }
        }
      } catch (e) {
        console.log('[table-grading] Not a table_grid answer or parse error:', e);
      }
    }
    
    // If we have a deterministic table grid result, use it directly
    if (tableGridResult) {
      // Save answer to database
      const { error: saveError } = await supabase
        .from('practice_question_answers')
        .upsert({
          user_id: user.id,
          set_id: setId,
          question_id: questionId,
          answer_text: answerText || '',
          working_out: workingOut,
          score: tableGridResult.score,
          is_correct: tableGridResult.isCorrect,
          feedback: tableGridResult.feedback,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,question_id'
        });

      if (saveError) {
        console.error('Error saving answer:', saveError);
        throw saveError;
      }

      // Update progress
      const { data: allAnswers } = await supabase
        .from('practice_question_answers')
        .select('score, is_correct')
        .eq('user_id', user.id)
        .eq('set_id', setId);

      const questionsAttempted = allAnswers?.length || 0;
      const questionsCorrect = allAnswers?.filter(a => a.is_correct).length || 0;

      await supabase
        .from('practice_set_progress')
        .upsert({
          user_id: user.id,
          set_id: setId,
          questions_attempted: questionsAttempted,
          questions_correct: questionsCorrect,
          last_accessed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,set_id'
        });

      return new Response(
        JSON.stringify({
          score: tableGridResult.score,
          feedback: tableGridResult.feedback.replace(/<!--MARKING_DATA:.*?-->/g, ''),
          isCorrect: tableGridResult.isCorrect,
          markingData: { 
            perRowResults: tableGridResult.perRowResults,
            correctAnswers: tableGridResult.correctAnswers,
            correctInputs: tableGridResult.correctInputs
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use normalized answer for grading (Unicode math symbols converted to plain text)
    // Fall back to original answerText if no normalized version provided
    const answerForGrading = normalizedAnswer || answerText || '(No answer provided)';
    
    // Also include original answer with Unicode symbols for context
    const displayAnswer = answerText || '(No answer provided)';

    // Prepare grading prompt
    const systemPrompt = `You are a supportive mathematics tutor grading student work. Your role is to:
- Award partial credit generously for correct methods, even if the final answer is wrong
- Provide constructive, encouraging feedback that addresses the student directly ("You")
- Format LaTeX expressions clearly and include decimal equivalents where helpful
- Explain what was done correctly and what needs adjustment
- Use a warm, educational tone - never harsh or discouraging

IMPORTANT: The student's answer may be provided in LaTeX format. Interpret LaTeX notation correctly:
- \\frac{a}{b} means a/b (fraction)
- ^{n} means "to the power of n"
- \\sqrt{x} means square root of x
- \\pi means π (pi)
- \\theta means θ (theta)
- \\sin, \\cos, \\tan are trigonometric functions

FEEDBACK TONE GUIDELINES:
- Full marks (100%): "Excellent! Your answer is completely correct."
- High partial marks (70-99%): "Great work! You're on the right track. [explain minor issue]"
- Medium partial marks (40-69%): "Good effort! You've got the main idea. [guide to completion]"
- Low partial marks (1-39%): "You've made a good start. [explain correct approach]"
- Zero marks: "Let's try a different approach. [guide toward solution without giving answer]"

NEVER use: "Incorrect", "Wrong", "You failed", "This is incorrect"
ALWAYS use: "Almost there", "Good effort", "Let's refine this", "You're close"

For mathematical expressions in feedback:
- Render LaTeX when appropriate but also provide decimal/simplified forms
- Example: "x = π/6 (or 0.524 radians)"
- Include brief explanations like "These values satisfy the equation within 0 ≤ x < 2π"`;

    const userPrompt = `Question: ${question.question_text}

Correct Answer: ${question.correct_answer || 'See worked solution'}

Student's Answer: ${answerForGrading}

${workingOut ? `Student's Working:\n${workingOut}` : ''}

Total Marks Available: ${question.marks}

Grade this answer and provide detailed, constructive feedback. Award partial marks for:
- Method marks: Correct approach, setup, and working (even if answer is wrong)
- Accuracy marks: Correct final answer and precision

Return your grading using the grade_practice_answer function.`;

    // Call Lovable AI with function calling
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'grade_practice_answer',
            description: 'Grade a student practice answer with partial marking',
            parameters: {
              type: 'object',
              properties: {
                score: {
                  type: 'number',
                  description: 'Total score awarded (0 to question.marks)'
                },
                method_marks: {
                  type: 'number',
                  description: 'Marks for correct method/approach'
                },
                accuracy_marks: {
                  type: 'number',
                  description: 'Marks for correct final answer'
                },
                feedback: {
                  type: 'string',
                  description: 'Constructive, encouraging feedback for the student. Include what they did well and what to improve. Format LaTeX with decimal equivalents.'
                },
                is_correct: {
                  type: 'boolean',
                  description: 'True if answer is fully correct (score === marks)'
                }
              },
              required: ['score', 'feedback', 'is_correct'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'grade_practice_answer' } }
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (aiResponse.status === 402) {
        throw new Error('AI service quota exceeded. Please contact support.');
      }
      throw new Error(`AI grading failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No grading result from AI');
    }

    const gradingResult = JSON.parse(toolCall.function.arguments);

    // Save answer to database (with both latex and text)
    const { error: saveError } = await supabase
      .from('practice_question_answers')
      .upsert({
        user_id: user.id,
        set_id: setId,
        question_id: questionId,
        answer_text: answerText || '',
        working_out: workingOut,
        score: gradingResult.score,
        method_marks: gradingResult.method_marks || null,
        accuracy_marks: gradingResult.accuracy_marks || null,
        is_correct: gradingResult.is_correct,
        feedback: gradingResult.feedback,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,question_id'
      });

    if (saveError) {
      console.error('Error saving answer:', saveError);
      throw saveError;
    }

    // Update progress
    const { data: progress } = await supabase
      .from('practice_set_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('set_id', setId)
      .single();

    const { data: allAnswers } = await supabase
      .from('practice_question_answers')
      .select('score, is_correct')
      .eq('user_id', user.id)
      .eq('set_id', setId);

    const questionsAttempted = allAnswers?.length || 0;
    const questionsCorrect = allAnswers?.filter(a => a.is_correct).length || 0;

    await supabase
      .from('practice_set_progress')
      .upsert({
        id: progress?.id || undefined,
        user_id: user.id,
        set_id: setId,
        questions_attempted: questionsAttempted,
        questions_correct: questionsCorrect,
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({
        score: gradingResult.score,
        methodMarks: gradingResult.method_marks,
        accuracyMarks: gradingResult.accuracy_marks,
        feedback: gradingResult.feedback,
        isCorrect: gradingResult.is_correct
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in grade-practice-question:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});