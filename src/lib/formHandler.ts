export interface FormPayload {
  formType: string;
  firstName: string;
  lastName: string;
  email: string;
  agency?: string;
  phone?: string;
  state?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  eventSlug?: string;
  partnerSlug?: string;
  timestamp: string;
  pageUrl: string;
}

export async function submitForm(payload: FormPayload): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = import.meta.env.PUBLIC_ZAPIER_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('No webhook URL configured. Set PUBLIC_ZAPIER_WEBHOOK_URL.');
    return { success: false, error: 'Form is not configured yet. Please contact us directly.' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Webhook failed');
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Submission failed. Please try again.' };
  }
}
