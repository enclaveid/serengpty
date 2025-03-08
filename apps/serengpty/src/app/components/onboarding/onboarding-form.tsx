'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useToast } from '@enclaveid/ui/hooks/use-toast';
import { Save, Shield, Search, ChevronDown, Check } from 'lucide-react';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { useState, useMemo, useEffect, useRef } from 'react';
import { saveUserProfile } from '../../actions/saveUserProfile';
import { UsernameStatus } from './username-status';
import { getUserProfile } from '../../actions/getUserProfile';
import { getIdenticon } from '../../utils/getIdenticon';

// UI Components
import { Button } from '@enclaveid/ui/button';
import { Input } from '@enclaveid/ui/input';
import { Switch } from '@enclaveid/ui/switch';
import { Card } from '@enclaveid/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@enclaveid/ui/avatar';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@enclaveid/ui/form';
import { ConditionalWrapper } from '../conditional-wrapper';

// Initialize the countries library
countries.registerLocale(enLocale);

// Get all countries in the format we need
const ALL_COUNTRIES = [
  // Add Internet as default option
  {
    code: 'INTERNET',
    name: 'Internet',
    flag: '🌐',
  },
  ...Object.entries(countries.getNames('en'))
    .map(([code, name]) => {
      // Convert country code to flag emoji
      const flag = code
        .toUpperCase()
        .replace(/./g, (char) =>
          String.fromCodePoint(char.charCodeAt(0) + 127397)
        );

      return {
        code,
        name,
        flag,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name)),
];

// Form validation schema
const formSchema = z.object({
  username: z
    .string()
    .min(3, {
      message: 'Username must be at least 3 characters.',
    })
    .max(20, {
      message: 'Username cannot be longer than 20 characters.',
    }),
  country: z.string({
    required_error: 'Please select a country.',
  }),
  sensitiveMatching: z.boolean().default(false),
});

export interface OnboardingFormProps {
  isPreferences?: boolean;
}

// Create a completely redesigned CountrySelector component with custom dropdown
function CountrySelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find the selected country
  const selectedCountry = ALL_COUNTRIES.find(
    (country) => country.code === value
  );

  // Filter countries based on search term
  const filteredCountries = useMemo(() => {
    if (!searchTerm.trim()) return ALL_COUNTRIES;
    const term = searchTerm.toLowerCase();
    return ALL_COUNTRIES.filter((country) =>
      country.name.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus the search input when dropdown opens
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    } else {
      setSearchTerm('');
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle selecting a country
  const handleSelectCountry = (country: (typeof ALL_COUNTRIES)[0]) => {
    onChange(country.code);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Custom trigger button */}
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        className="w-full justify-between font-normal"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {selectedCountry ? (
          <span className="flex items-center">
            <span className="mr-2">{selectedCountry.flag}</span>
            {selectedCountry.name}
          </span>
        ) : (
          'Select your country'
        )}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {/* Custom dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-background p-1 shadow-md">
          {/* Search box */}
          <div className="flex items-center border-b px-3 py-2 sticky top-0 bg-background">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-70" />
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search countries..."
              className="border-0 bg-transparent p-1 text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {/* Country list */}
          <div className="pt-1 pb-1">
            {filteredCountries.length === 0 ? (
              <div className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none text-muted-foreground">
                No countries found
              </div>
            ) : (
              filteredCountries.map((country) => (
                <div
                  key={country.code}
                  className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm font-normal outline-none hover:bg-accent hover:text-accent-foreground ${
                    value === country.code
                      ? 'bg-accent text-accent-foreground'
                      : ''
                  }`}
                  onClick={() => handleSelectCountry(country)}
                >
                  <span className="mr-2">{country.flag}</span>
                  <span className="flex-1">{country.name}</span>
                  {value === country.code && <Check className="h-4 w-4" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function OnboardingForm({ isPreferences = false }: OnboardingFormProps) {
  const { toast } = useToast();
  const [isUsernameValid, setIsUsernameValid] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      country: 'INTERNET',
      sensitiveMatching: false,
    },
  });

  // Fetch user profile data from database
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        setIsLoading(true);
        setIsProfileLoading(true);
        const userData = await getUserProfile();

        if (userData) {
          // Set the username
          if (userData.name) {
            form.setValue('username', userData.name);
            setIsUsernameValid(true);
          }

          // Set the country if it exists in the database
          if (userData.country) {
            form.setValue('country', userData.country);
          }

          // Set the sensitiveMatching value from the database
          form.setValue('sensitiveMatching', userData.sensitiveMatching);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Generate a fallback username in case of error
        form.setValue('username', `user_${Date.now().toString(36)}`);
      } finally {
        setIsLoading(false);
        setIsProfileLoading(false);
      }
    }

    fetchUserProfile();
  }, [form]);

  // Combined loading state for both username and profile data
  const isFormLoading = isLoading || isProfileLoading;

  const watchUsername = form.watch('username');

  // Form submission handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      // Prevent submission if username is invalid
      if (!isUsernameValid) {
        toast({
          title: 'Invalid username',
          description: 'Please choose a valid username before submitting.',
          variant: 'destructive',
          duration: 3000,
        });
        return;
      }

      // Call server action to save the profile
      const result = await saveUserProfile(values);

      if (result.success) {
        toast({
          title: isPreferences ? 'Preferences saved!' : 'Profile saved!',
          description: isPreferences
            ? 'Your preferences have been updated successfully.'
            : 'Your profile has been created successfully.',
          duration: 3000,
        });
      } else {
        toast({
          title: 'Error',
          description:
            result.message ||
            `Failed to save your ${
              isPreferences ? 'preferences' : 'profile'
            }. Please try again.`,
          variant: 'destructive',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error(
        `Error saving ${isPreferences ? 'preferences' : 'profile'}:`,
        error
      );
      toast({
        title: 'Error',
        description: `Failed to save your ${
          isPreferences ? 'preferences' : 'profile'
        }. Please try again.`,
        variant: 'destructive',
        duration: 3000,
      });
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* User profile form */}
      <ConditionalWrapper
        condition={!isPreferences}
        wrapper={(children) => <Card className="p-6">{children}</Card>}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Avatar/Identicon */}
            <div className="flex flex-col items-center mb-6">
              <Avatar className="h-24 w-24 mb-2">
                <AvatarImage
                  src={getIdenticon(watchUsername)}
                  alt="User identicon"
                />
                <AvatarFallback>
                  {watchUsername.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="text-sm text-muted-foreground">
                Your unique identicon
              </p>
            </div>

            {/* Username field */}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isFormLoading} />
                  </FormControl>
                  <div className="flex flex-col space-y-1">
                    <FormDescription>
                      This will be your display name in the system.
                    </FormDescription>
                    {!isFormLoading && (
                      <UsernameStatus
                        username={field.value}
                        isValid={isUsernameValid}
                        setIsValid={setIsUsernameValid}
                      />
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Country selector */}
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <CountrySelector
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isFormLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Select the country you&apos;re based in.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sensitive matching toggle */}
            <FormField
              control={form.control}
              name="sensitiveMatching"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Sensitive Matching
                    </FormLabel>
                    <FormDescription>
                      Enable deeper matching for sensitive data patterns.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                      <Shield
                        className={
                          field.value
                            ? 'text-primary h-4 w-4'
                            : 'text-muted-foreground h-4 w-4'
                        }
                      />
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isFormLoading}
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Save button */}
            <Button
              type="submit"
              className="w-full"
              disabled={!isUsernameValid || isFormLoading}
            >
              <Save className="mr-2 h-4 w-4" />
              {isPreferences ? 'Save Preferences' : 'Save Profile'}
            </Button>
          </form>
        </Form>
      </ConditionalWrapper>
    </div>
  );
}
