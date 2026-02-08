import { GoogleGenerativeAI } from '@google/generative-ai';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

/** Gemini model for generateContent (stable flash; see https://ai.google.dev/gemini-api/docs/models). */
const GEMINI_MODEL = 'gemini-2.5-flash';

/** Read file with retries (iOS may write recording async after stop). */
async function readFileWithRetries(
  uri: string,
  options: { encoding: EncodingType.Base64 },
  maxAttempts = 6,
  delayMs = 500
): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await readAsStringAsync(uri, options);
    } catch (e) {
      lastErr = e;
      if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

/**
 * Transcribe an audio file using Gemini
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const audioBase64 = await readFileWithRetries(audioUri, {
      encoding: EncodingType.Base64,
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/m4a',
          data: audioBase64,
        },
      },
      'Transcribe this audio recording accurately. Return only the transcription text, nothing else. If the audio is unclear or empty, return an empty string.',
    ]);

    return result.response.text().trim();
  } catch (error) {
    console.error('Transcription error:', error);
    return '';
  }
}

/**
 * Generate a daily summary from activity feed data
 */
export async function generateDailySummary(
  projectName: string,
  activities: Array<{
    action: string;
    userName: string;
    taskTitle?: string;
    metadata?: any;
    created_at: string;
  }>
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const activityText = activities
      .map(
        (a) =>
          `- ${a.userName} ${a.action.replace('_', ' ')}${a.taskTitle ? `: "${a.taskTitle}"` : ''} at ${new Date(a.created_at).toLocaleTimeString()}`
      )
      .join('\n');

    const prompt = `You are a construction project assistant. Summarize the following activity from the "${projectName}" project in a clear, concise way suitable for a field worker. Use bullet points and keep it under 150 words.

Activities:
${activityText || 'No activities recorded.'}

Provide a brief, friendly summary.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Summary generation error:', error);
    return 'Unable to generate summary at this time.';
  }
}

/**
 * Generate a "what's left today" overview
 */
export async function generateTodayOverview(
  projectName: string,
  pendingTasks: Array<{
    title: string;
    priority: string;
    location?: string;
    assignedTo?: string;
  }>
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const taskText = pendingTasks
      .map(
        (t) =>
          `- [${t.priority}] "${t.title}"${t.location ? ` at ${t.location}` : ''}${t.assignedTo ? ` (assigned to ${t.assignedTo})` : ''}`
      )
      .join('\n');

    const prompt = `You are a construction project assistant. Provide a brief overview of what's left to do today on the "${projectName}" project. Be encouraging and concise, under 100 words.

Remaining tasks:
${taskText || 'All tasks completed!'}`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Overview generation error:', error);
    return 'Unable to generate overview at this time.';
  }
}

/**
 * Check if proof-of-work seems complete
 */
export async function checkProofCompleteness(
  taskTitle: string,
  transcript: string,
  photoCount: number
): Promise<{ isComplete: boolean; suggestion?: string }> {
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const prompt = `You are a construction quality assistant. A worker just submitted proof for task: "${taskTitle}".

They provided:
- ${photoCount} photo(s)
- Voice note transcript: "${transcript || 'No voice note'}"

Evaluate if this seems like sufficient documentation. Consider:
1. Is there at least one photo?
2. Does the voice note describe the work done?

Respond in JSON format only:
{"isComplete": true/false, "suggestion": "brief suggestion if incomplete, empty string if complete"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { isComplete: true };
  } catch (error) {
    console.error('Completeness check error:', error);
    return { isComplete: true };
  }
}

/**
 * Bob: AI agent chat. Uses Gemini with context about project and optional file list (RAG-ready).
 * When document content is available, it can be passed as fileContext for true RAG.
 */
export async function bobChat(
  projectName: string,
  userMessage: string,
  fileNames: string[] = [],
  fileContext?: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const contextParts = [
      `You are Bob, the AI assistant for the construction project "${projectName}".`,
      'Answer questions helpfully and concisely. Use general construction knowledge and any provided context.',
    ];
    if (fileNames.length > 0) {
      contextParts.push(`Project documents (from Files): ${fileNames.join(', ')}. When users ask about docs, refer to these by name when relevant.`);
    }
    if (fileContext?.trim()) {
      contextParts.push('Relevant document content:\n' + fileContext.trim());
    }
    const systemPrompt = contextParts.join('\n');
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `User: ${userMessage}\n\nBob:` },
    ]);
    return result.response.text().trim();
  } catch (error) {
    console.error('Bob chat error:', error);
    return "Sorry, I couldn't process that. Please try again.";
  }
}
