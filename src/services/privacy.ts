import { supabase } from '@/services/supabase';
import { reportError } from '@/services/errorReporting';

export interface PrivacySettings {
  is_private: boolean;
  is_searchable: boolean;
}

export async function fetchPrivacySettings(userId: string): Promise<PrivacySettings | null> {
  const { data, error } = await supabase
    .from('users')
    .select('is_private, is_searchable')
    .eq('id', userId)
    .single();

  if (error) {
    reportError(error, 'privacy.fetchPrivacySettings');
    return null;
  }

  return {
    is_private: data?.is_private ?? false,
    is_searchable: data?.is_searchable ?? true,
  };
}

export async function updatePrivacySetting(
  userId: string,
  field: keyof PrivacySettings,
  value: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ [field]: value })
    .eq('id', userId);

  if (error) {
    reportError(error, `privacy.updatePrivacySetting.${field}`);
    return false;
  }

  return true;
}
