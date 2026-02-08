import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';

/**
 * Upload a photo to Supabase storage
 */
export async function uploadPhoto(
  uri: string,
  userId: string
): Promise<string | null> {
  try {
    const fileName = `${userId}/${Date.now()}.jpg`;
    const base64 = await readAsStringAsync(uri, {
      encoding: EncodingType.Base64,
    });

    const { data, error } = await supabase.storage
      .from('task-photos')
      .upload(fileName, decode(base64), {
        contentType: 'image/jpeg',
      });

    if (error) {
      console.error('Photo upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('task-photos')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Photo upload error:', error);
    return null;
  }
}

/**
 * Upload a voice note to Supabase storage
 */
export async function uploadVoiceNote(
  uri: string,
  userId: string
): Promise<string | null> {
  try {
    const fileName = `${userId}/${Date.now()}.m4a`;
    const base64 = await readAsStringAsync(uri, {
      encoding: EncodingType.Base64,
    });

    const { data, error } = await supabase.storage
      .from('voice-notes')
      .upload(fileName, decode(base64), {
        contentType: 'audio/m4a',
      });

    if (error) {
      console.error('Voice upload error:', error);
      return null;
    }

    // voice-notes is private, generate signed URL
    const { data: urlData } = await supabase.storage
      .from('voice-notes')
      .createSignedUrl(data.path, 60 * 60 * 24 * 365); // 1 year

    return urlData?.signedUrl || null;
  } catch (error) {
    console.error('Voice upload error:', error);
    return null;
  }
}

const PROJECT_FILES_BUCKET = 'project-files';

/**
 * Get a signed URL to view a project file (read-only). Use for opening PDFs/docs in browser or system viewer.
 */
export async function getProjectFileViewUrl(filePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(PROJECT_FILES_BUCKET)
      .createSignedUrl(filePath, 60 * 60); // 1 hour
    if (error) {
      console.error('Project file signed URL error:', error);
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (error) {
    console.error('Project file signed URL error:', error);
    return null;
  }
}
