'use client';

import { useState } from 'react';
import { ZipDropzone } from './zip-dropzone';
// Import the cleanArchive server action.
// Adjust the import path as needed.
import { cleanArchive } from '../../actions/cleanArchive';
import { Button } from '@enclaveid/ui/button';
import { Input } from '@enclaveid/ui/input';

/**
 * generatePassword function for client-side password generation.
 */
function generatePassword(length = 12): string {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  let retVal = '';
  for (let i = 0; i < length; i++) {
    retVal += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return retVal;
}

/**
 * OnboardingForm component wraps the ZipDropzone.
 * When a file is dropped, we call the cleanArchive action,
 * generate a password, update UI feedback statuses, and then
 * reveal a sign-up button that will handle the final sign-up with the complete form data.
 */
export function OnboardingForm() {
  const [showPassword, setShowPassword] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // Add other form fields and states as needed

  async function handleFileDrop(files: File[]) {
    const file = files[0];
    if (!file) return;

    // Reset state for a new upload.
    setError('');
    setStatus('Cleaning archive...');
    setProcessing(true);
    setReady(false);
    setPassword(null);

    try {
      // Create FormData and append the file
      const formData = new FormData();
      formData.append('file', file);

      // Call cleanArchive with FormData instead of the raw file
      const result = await cleanArchive(formData);
      if (!result.success) {
        setError('Failed to clean the archive.');
        setProcessing(false);
        return;
      }
      setStatus('Generating password...');
      // Generate a strong password on the client.
      const newPassword = generatePassword();
      setPassword(newPassword);
      setStatus('All done! You are now ready to sign up.');
      setReady(true);
    } catch (err) {
      console.error(err);
      setError('An error occurred during processing.');
    } finally {
      setProcessing(false);
    }
  }

  function handleSignup() {
    // Here you would handle the sign-up submission using the generated password
    // along with any other form fields.
    console.log('Signing up with password:', password);
    // Implement the sign-up logic (e.g., call an API or use a server action)
  }

  return (
    <div className="onboarding-form p-4">
      <form>
        {/* Provide user feedback during processing */}
        {processing && <div className="mt-4 text-blue-600">{status}</div>}

        {error && <div className="mt-4 text-red-600">{error}</div>}

        {/* When processing is complete, show the sign-up button */}
        {!ready ? (
          <ZipDropzone onDrop={handleFileDrop} />
        ) : (
          <div className="mt-4">
            {password && (
              <div className="mt-2 space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700"
                >
                  Generated Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
            )}
            <Button
              type="button"
              onClick={handleSignup}
              className="mt-4 w-full"
            >
              Sign Up
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
