import type { FormPayload } from './formHandler';

// Future API layer — swap formHandler.ts import with this when backend is ready
export async function submitToApi(payload: FormPayload): Promise<{ success: boolean; error?: string }> {
  const apiUrl = import.meta.env.PUBLIC_API_URL;
  const apiKey = import.meta.env.PUBLIC_API_KEY;

  if (!apiUrl) {
    return { success: false, error: 'API not configured.' };
  }

  try {
    const response = await fetch(`${apiUrl}/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('API request failed');
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Submission failed. Please try again.' };
  }
}
