'use client';

import { useState } from 'react';
import { ZipDropzone } from './zip-dropzone';
// Import the cleanArchive server action.
// Adjust the import path as needed.
import { cleanArchive } from '../../actions/cleanArchive';
import { Button } from '@enclaveid/ui/button';
import { Input } from '@enclaveid/ui/input';
import { FileArchive, Loader2, XCircle } from 'lucide-react';
import { useToast } from '@enclaveid/ui/hooks/use-toast';
import { Toaster } from '@enclaveid/ui/toaster';
/**
 * generatePassword function for client-side password generation.
 */
function generatePassword(length = 24): string {
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
  const { toast } = useToast();

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Here you would handle the sign-up submission using the generated password
    console.log('Signing up with password:', password);
    // Implement the sign-up logic (e.g., call an API or use a server action)
  }

  return (
    <div className="onboarding-form p-4 w-1/2 h-[200px]">
      <Toaster />

      <form onSubmit={handleSubmit}>
        {/* Process indicator */}
        {processing && (
          <div className="mt-4 text-blue-600 flex items-center">
            <Loader2 className="animate-spin mr-2" size={16} />
            <span>{status}</span>
          </div>
        )}

        {/* Error feedback */}
        {error && (
          <div className="mt-4 text-red-600 flex items-center">
            <XCircle className="mr-2" size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* When processing is complete, show the sign-up button */}
        {!ready ? (
          <ZipDropzone onDrop={handleFileDrop} />
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-4">
              <FileArchive className="mb-4 text-gray-700" size={32} />
              <p className="text-md text-gray-700 mb-4 w-[400px]">
                Your archive is ready to be uploaded!
              </p>
            </div>

            <label
              htmlFor="password"
              className="text-md text-gray-700 mb-4 w-[470px]"
            >
              Here is the <span className="font-bold">password</span> for your
              account.
              <br />
              For anonymity reasons, this will be the only identifier for your
              account which you will use to login.{' '}
              <span className="font-bold">Do not lose it!</span>
            </label>
            {password && (
              <div className="flex items-center justify-center gap-4">
                <div className="space-y-2">
                  <div className="relative w-[300px]">
                    <Input
                      id="password"
                      name="password"
                      type="text"
                      value={password}
                      readOnly
                      className="font-mono w-full"
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => {
                        navigator.clipboard.writeText(password);
                        toast({
                          description: 'Password copied to clipboard',
                          duration: 2000,
                        });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <Button type="submit">Upload and Sign Up</Button>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
