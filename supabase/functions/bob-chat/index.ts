import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

const GEMINI_MODEL = "gemini-2.5-flash";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, x-client-info, apikey",
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req.headers.get("Origin")) });
  }

  const origin = req.headers.get("Origin");

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const projectId = body?.project_id;
    const message = body?.message;
    const accessTokenFromBody = typeof body?.access_token === "string" ? body.access_token : null;
    const authHeader = req.headers.get("Authorization");
    const tokenFromHeader = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : null;
    const token = accessTokenFromBody ?? tokenFromHeader;
    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Missing auth. Send access_token in body or Authorization: Bearer <token> header.",
        }),
        { status: 401, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }
    if (!projectId || typeof projectId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing project_id in body" }),
        { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }
    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing message in body" }),
        { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const { data: member } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) {
      return new Response(
        JSON.stringify({ error: "Not a member of this project" }),
        { status: 403, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, gemini_file_search_store_name")
      .eq("id", projectId)
      .single();
    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const storeName = project.gemini_file_search_store_name;
    if (!storeName?.trim()) {
      return new Response(
        JSON.stringify({
          error: "No file search store for this project. Open the Bob tab and sync files first.",
        }),
        { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const systemInstruction =
      `You are Bob, the AI assistant for the construction project "${project.name}". ` +
      "Answer questions helpfully and concisely. Use the project documents (file search) as context when relevant. " +
      "When you use information from the documents, mention the source when appropriate.";

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction,
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [storeName],
            },
          },
        ],
      },
    });

    const text = response?.text ?? "";
    const candidate = response?.candidates?.[0] as Record<string, unknown> | undefined;
    const citationMetadata = (candidate?.citationMetadata ?? candidate?.citation_metadata) as { citations?: Array<{ title?: string; uri?: string }> } | undefined;
    const groundingMetadata = (candidate?.groundingMetadata ?? candidate?.grounding_metadata) as { groundingChunks?: unknown[]; groundingSupports?: unknown[] } | undefined;
    const citationsFromApi = citationMetadata?.citations ?? null;
    const groundingChunks = groundingMetadata?.groundingChunks ?? (groundingMetadata as { grounding_chunks?: unknown[] })?.grounding_chunks ?? null;
    const groundingSupports = groundingMetadata?.groundingSupports ?? (groundingMetadata as { grounding_supports?: unknown[] })?.grounding_supports ?? null;

    // Build normalized sources from all possible API shapes (for logs and response)
    type Source = { title?: string; uri?: string };
    const seen = new Set<string>();
    const sources: Source[] = [];
    function addSource(title?: string | null, uri?: string | null) {
      const key = (title ?? uri ?? "").trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      sources.push({ title: title?.trim() || undefined, uri: uri?.trim() || undefined });
    }
    if (Array.isArray(citationsFromApi)) {
      for (const c of citationsFromApi) {
        addSource((c as { title?: string; uri?: string })?.title, (c as { uri?: string })?.uri);
      }
    }
    if (Array.isArray(groundingChunks)) {
      for (const ch of groundingChunks) {
        const raw = ch as Record<string, unknown>;
        const r = (raw?.retrievedContext ?? raw?.retrieved_context) as { title?: string; uri?: string; documentName?: string; document_name?: string } | undefined;
        const w = (raw?.web) as { title?: string; uri?: string } | undefined;
        if (r) addSource(r.title ?? r.documentName ?? r.document_name, r.uri);
        if (w) addSource(w.title, w.uri);
      }
    }

    // Resolve each source to a real view URL (signed Storage URL) when it matches a project file
    const PROJECT_FILES_BUCKET = "project-files";
    const SIGNED_URL_EXPIRY_SEC = 3600; // 1 hour
    const { data: projectFiles } = await supabase
      .from("project_files")
      .select("id, name, file_path")
      .eq("project_id", projectId);
    const fileList = projectFiles ?? [];
    for (const src of sources) {
      const title = (src.title ?? "").trim();
      if (!title) continue;
      const normalizedTitle = title.toLowerCase();
      const match = fileList.find((row: { name: string; file_path: string }) => {
        const rowName = (row.name ?? "").toLowerCase();
        return rowName === normalizedTitle || rowName.includes(normalizedTitle) || normalizedTitle.includes(rowName);
      });
      if (match?.file_path) {
        const { data: signed } = await supabase.storage
          .from(PROJECT_FILES_BUCKET)
          .createSignedUrl(match.file_path, SIGNED_URL_EXPIRY_SEC);
        if (signed?.signedUrl) {
          src.uri = signed.signedUrl;
        }
      }
    }

    console.log("bob-chat sources", {
      candidateKeys: candidate ? Object.keys(candidate) : [],
      hasCitationMetadata: !!citationMetadata,
      citationsCount: Array.isArray(citationsFromApi) ? citationsFromApi.length : 0,
      groundingChunksCount: Array.isArray(groundingChunks) ? groundingChunks.length : 0,
      normalizedSourcesCount: sources.length,
      sources: sources.length ? sources : undefined,
    });

    return new Response(
      JSON.stringify({
        text,
        citations: sources.length > 0 ? sources : (citationsFromApi ?? undefined),
        groundingChunks: groundingChunks ?? undefined,
        groundingSupports: groundingSupports ?? undefined,
      }),
      { status: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("bob-chat error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Chat failed" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
