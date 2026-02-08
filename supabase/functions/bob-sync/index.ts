import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

const PROJECT_FILES_BUCKET = "project-files";

// Supported MIME types for File Search RAG (text/document). Images may fail; we skip on error.
const RAG_FRIENDLY_TYPES = new Set([
  "text/plain",
  "application/pdf",
  "text/csv",
  "text/html",
  "application/json",
]);

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
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
    if (!projectId || typeof projectId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing project_id in body" }),
        { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
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
      .select("id, name")
      .eq("id", projectId)
      .single();
    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const { data: projectFiles, error: filesError } = await supabase
      .from("project_files")
      .select("id, name, file_path, content_type")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (filesError) {
      return new Response(
        JSON.stringify({ error: "Failed to load project files" }),
        { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const displayName = `project-${projectId}`.slice(0, 100);

    const fileSearchStore = await ai.fileSearchStores.create({
      config: { displayName },
    });
    const storeName = fileSearchStore.name!;
    let uploadedCount = 0;

    for (const row of projectFiles || []) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .download(row.file_path);
      if (downloadError || !fileData) {
        console.warn(`Skip file ${row.name}: download failed`, downloadError?.message);
        continue;
      }
      const mimeType = row.content_type || "application/octet-stream";
      const isRagFriendly = RAG_FRIENDLY_TYPES.has(mimeType) || mimeType.startsWith("text/");
      if (!isRagFriendly) {
        console.warn(`Skip file ${row.name}: unsupported type ${mimeType}`);
        continue;
      }
      try {
        let operation = await ai.fileSearchStores.uploadToFileSearchStore({
          fileSearchStoreName: storeName,
          file: fileData as Blob,
          config: {
            displayName: row.name || row.file_path,
            mimeType,
          },
        });
        while (operation?.done === false) {
          await new Promise((r) => setTimeout(r, 2000));
          operation = await ai.operations.get({ operation });
        }
        if (operation?.error) {
          console.warn(`Skip file ${row.name}: upload failed`, operation.error);
          continue;
        }
        uploadedCount += 1;
      } catch (e) {
        console.warn(`Skip file ${row.name}:`, e);
      }
    }

    const { error: updateError } = await supabase
      .from("projects")
      .update({
        gemini_file_search_store_name: storeName,
        gemini_file_search_synced_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to save store name" }),
        { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ storeName, fileCount: uploadedCount }),
      { status: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("bob-sync error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Sync failed" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
