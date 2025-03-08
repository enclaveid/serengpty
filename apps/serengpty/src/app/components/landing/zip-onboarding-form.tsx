'use client';

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@enclaveid/ui/button';
import { Input } from '@enclaveid/ui/input';
import { FileArchive, Loader2, XCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@enclaveid/ui/hooks/use-toast';
import { Toaster } from '@enclaveid/ui/toaster';
import { processZipFile } from '../../utils/clientZipUtils';
import { Icon } from '@iconify/react';
import { validateUsername } from '../../actions/validateUsername';
import { getUniqueUsername } from '../../actions/getUniqueUsername';

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
 * ZipOnboardingForm component wraps the ZipDropzone.
 * When a file is dropped, we process it on the client side,
 * generate a password, update UI feedback statuses, and then
 * reveal a sign-up button that will handle the final sign-up with just the cleaned conversations data.
 */
export function ZipOnboardingForm() {
  const { toast } = useToast();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [password, setPassword] = useState<string | null>(null);
  const [customUsername, setCustomUsername] = useState('');
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cleanedConversations, setCleanedConversations] = useState<
    Record<string, unknown>
  >({});

  async function handleFileDrop(files: File[]) {
    const file = files[0];
    if (!file) return;

    // Reset state for a new upload.
    setError('');
    setUsernameError('');
    setProcessing(true);
    setReady(false);
    setPassword(null);
    setProgress(0);
    setCustomUsername(await getUniqueUsername());
    setCleanedConversations({});

    try {
      // Reset progress before starting
      setProgress(0);

      // Process the zip file on the client side with progress updates
      const result = await processZipFile(file, (progressValue) => {
        setProgress(progressValue);
      });

      if (!result.success || !result.conversations) {
        setError('Failed to process the archive.');
        setProcessing(false);
        return;
      }

      setCleanedConversations(result.conversations);

      // Generate a strong password on the client.
      const newPassword = generatePassword();
      setPassword(newPassword);
      setReady(true);
    } catch (err) {
      console.error(err);
      setError('An error occurred during processing.');
    } finally {
      setProcessing(false);
    }
  }

  // Add a debounced username validation
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (customUsername) {
        const result = await validateUsername(customUsername);
        if (!result.isValid) {
          setUsernameError(result.message || 'Username is invalid');
        } else {
          setUsernameError('');
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [customUsername]);

  const validateCustomUsername = async (username: string) => {
    if (!username.trim()) {
      setUsernameError('Username is required');
      return false;
    }

    const result = await validateUsername(username);

    if (!result.isValid) {
      setUsernameError(result.message || 'Username is invalid');
      return false;
    }

    setUsernameError('');
    return true;
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!cleanedConversations || !password) {
      setError('Missing required data for submission.');
      return;
    }

    // Validate username if provided
    if (customUsername && !(await validateCustomUsername(customUsername))) {
      return;
    }

    try {
      setProcessing(true);
      // Start with a small progress value to show activity
      setProgress(5);

      // Create FormData with only the cleaned data
      const formData = new FormData();
      // Only add the cleaned conversations.json data to the form
      formData.append('conversations', JSON.stringify(cleanedConversations));
      formData.append('password', password);

      // Add username
      formData.append('username', customUsername);

      // Send the data to our signup API
      // Simulated upload progress
      const simulateProgress = () => {
        setProgress((prev) => {
          // Increment progress but don't reach 100% until complete
          const nextProgress = prev + Math.random() * 15;
          return Math.min(nextProgress, 90);
        });
      };

      // Start progress simulation
      const progressInterval = setInterval(simulateProgress, 500);

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        body: formData,
      });

      // Clear the interval and set to 100% when complete
      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to sign up',
        });
        return;
      }

      // Redirect to the dashboard
      window.location.href = '/onboarding';
    } catch (err: unknown) {
      console.error(err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'An error occurred during sign up.';
      setError(errorMessage);
    } finally {
      setProcessing(false);
    }
  }

  // Set up the dropzone directly in this component
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: handleFileDrop,
    accept: { 'application/zip': ['.zip'] },
    multiple: false,
    disabled: processing,
    // This ensures the dropzone is always ready to accept new files
    noClick: ready,
    noKeyboard: ready,
    noDrag: ready,
  });

  return (
    <div className="onboarding-form p-4 w-1/2">
      <Toaster />

      <form onSubmit={handleSubmit}>
        {/* When processing is complete, show the sign-up button */}
        {!ready ? (
          <div>
            {/* Robot icon message */}
            <div className="mb-2 flex items-center justify-center">
              {error ? (
                <>
                  <Icon
                    icon="mage:robot-sad"
                    width="24"
                    height="24"
                    className="text-red-500 mr-2"
                  />
                  <span className="text-red-500">{error}</span>
                </>
              ) : (
                !processing && (
                  <>
                    <Icon
                      icon="mage:robot-happy"
                      width="24"
                      height="24"
                      className="text-gray-500 mr-2"
                    />
                    <p className="text-sm text-gray-500 font-medium">
                      Your data will be anonymized locally before uploading
                    </p>
                  </>
                )
              )}
            </div>

            {/* Processing indicator or Dropzone */}
            {processing ? (
              <div className="w-full mb-8 md:mb-0 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center text-center">
                <div className="flex flex-col items-center w-full">
                  <Icon
                    icon="mage:robot-happy"
                    width="24"
                    height="24"
                    className="mb-2"
                  />
                  <div className="flex items-center mb-2">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    <span className="">We&apos;re anonymizing the data...</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full mt-2 max-w-md">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Processing conversations.json: {progress}%
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className="relative w-full mb-8 md:mb-0 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center text-center hover:border-green-800 transition-colors cursor-pointer"
              >
                <input {...getInputProps()} />
                {/* <FileArchive className="mb-4 text-gray-500" size={32} /> */}
                <p className="mt-2 text-base text-gray-500">
                  Drop your data export zip here
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Only *.zip files are accepted
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-4">
              <FileArchive className="mb-4 text-gray-700" size={32} />
              <p className="text-md text-gray-700 mb-4 w-[400px]">
                Your archive is ready to be uploaded!
              </p>
            </div>

            {/* <p className="text-md text-gray-700 mb-4 w-[470px]">
              Please create your account to continue.
              <br />
              You will need both your username and password to login.{' '}
              <span className="font-bold">Do not lose these!</span>
            </p> */}
            {password && (
              <div className="flex flex-col items-center gap-4 w-[470px]">
                <div className="w-full">
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium mb-1"
                  >
                    Choose a username
                  </label>
                  <div className="relative">
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      value={customUsername}
                      onChange={(e) => setCustomUsername(e.target.value)}
                      placeholder="Enter your desired username"
                      className="w-full mb-1"
                      autoComplete="username"
                      required
                    />
                    {customUsername &&
                      (!usernameError ? (
                        <CheckCircle
                          className={`absolute right-2 top-1/2 -translate-y-1/2 ${'text-green-500'}`}
                          size={16}
                        />
                      ) : (
                        <XCircle
                          className={`absolute right-2 top-1/2 -translate-y-1/2 ${'text-red-500'}`}
                          size={16}
                        />
                      ))}
                  </div>
                  {usernameError && (
                    <p className="text-sm text-red-500">{usernameError}</p>
                  )}
                </div>

                <div className="w-full">
                  <label
                    htmlFor="passwordDisplay"
                    className="block text-sm font-medium mb-1"
                  >
                    Your generated password
                  </label>
                  <div className="relative">
                    {/* Hidden password field for browser detection */}
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={password || ''}
                      readOnly
                      style={{ display: 'none' }}
                      autoComplete="new-password"
                    />
                    {/* Visible text field for user display */}
                    <Input
                      id="passwordDisplay"
                      type="text"
                      value={password}
                      readOnly
                      className="font-mono w-full"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => {
                        navigator.clipboard.writeText(password || '');
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

                {processing ? (
                  <div className="w-full mt-2">
                    <div className="flex items-center justify-center mb-2">
                      <Loader2 className="animate-spin mr-2" size={16} />
                      <span>Uploading your data...</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 text-center">
                      {progress.toFixed(2)}%
                    </div>
                  </div>
                ) : (
                  <Button
                    type="submit"
                    className="w-full mt-2"
                    disabled={!!usernameError || customUsername === ''}
                  >
                    Upload zip and Sign up
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
