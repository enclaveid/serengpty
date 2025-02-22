import DiscordIcon from '~icons/mdi/discord.tsx';
import GitHubIcon from '~icons/mdi/github.tsx';
import Image from 'next/image';
import { Logo } from '../../../../libs/ui/src/logo';
import { Button } from '@enclaveid/ui/button';
import Link from 'next/link';
import { LandingGuidance } from './components/landing/landing-guidance';
import { OnboardingForm } from './components/landing/onboarding-form';

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800">
      <Header />

      {/* Global overlay to blur the background on file drag */}
      {/* <GlobalDragBlurOverlay /> */}
      <main className="flex-grow">
        <Hero />
        <PrivacySection />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 bg-offwhite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Company Name */}
          <div className="flex items-center gap-1 font-bold text-2xl text-content-primary">
            <Logo />
            SerenGPTy
          </div>

          {/* Navigation / Social Icons */}
          <nav className="flex gap-4 items-center">
            <a
              href="https://discord.gg/3BHPkHDs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-content-secondary hover:text-content-primary"
            >
              <DiscordIcon className="w-6 h-6" />
            </a>
            <a
              href="https://github.com/enclaveid/enclaveid"
              target="_blank"
              rel="noopener noreferrer"
              className="text-content-secondary hover:text-content-primary"
            >
              <GitHubIcon className="w-6 h-6" />
            </a>

            <Link href="/dashboard/home">
              <Button size="sm">Login</Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-offwhite pt-12 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 my-24">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="w-full md:w-1/2 max-w-2xl md:mt-[-100px]">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              Find similar ChatGPT users, anonymously
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-6">
              That have gone down your same rabbit holes, are exploring the same
              philosophical questions, or are even just working out the exact
              same coding problems!
            </p>
          </div>

          <OnboardingForm />
        </div>
      </div>

      {/* slanted background */}
      {/* <div
        className="absolute bottom-0 left-0 right-0 md:h-[500px] h-[250px] bg-white"
        style={{
          clipPath: 'polygon(0 100%, 100% 100%, 100% 50%, 0 75%)',
        }}
      /> */}

      <div
        className="absolute bottom-0 left-0 right-0 md:h-[500px] h-[250px] bg-white"
        style={{
          clipPath: 'polygon(0 100%, 100% 100%, 100% 75%, 0 75%)',
        }}
      />

      {/* <Image
        src="/arrow-start.svg"
        alt="Arrow start"
        width={100}
        height={100}
        className="absolute bottom-[160px] left-[120px] h-[230px] w-[230px]"
      /> */}

      <LandingGuidance />

      <Image
        src="/arrow-end.svg"
        alt="Arrow end"
        width={100}
        height={100}
        className="absolute bottom-[200px] right-[100px] h-[150px] w-[150px]"
      />
    </section>
  );
}

function PrivacySection() {
  return (
    <section className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
          {/* Left column */}
          <div className="flex flex-col justify-center gap-8 md:gap-16">
            <div className="flex flex-col">
              <div className="flex flex-row md:flex-col text-brand">
                <h2 className="text-3xl md:text-5xl font-bold leading-snug mr-2 opacity-50">
                  Your data,
                </h2>
                <h2 className="text-3xl md:text-5xl font-bold leading-snug">
                  Your rules
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-8 place-items-center md:place-items-start">
              <div className="flex items-center w-32 md:w-40 lg:w-48">
                <Image
                  src="/nvtrust.png"
                  alt="NVIDIA nvtrust logo"
                  width={160}
                  height={160}
                  className="w-full h-auto"
                />
              </div>
              <div className="flex items-center w-32 md:w-40 lg:w-48">
                <Image
                  src="/coco.png"
                  alt="Confidential Containers"
                  width={160}
                  height={160}
                  className="w-full h-auto"
                />
              </div>
              <div className="flex items-center w-32 md:w-40 lg:w-48 col-span-2 md:col-span-1 justify-self-center md:justify-self-start">
                <Image
                  src="/amd.png"
                  alt="AMD SEV-SNP"
                  width={160}
                  height={160}
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>

          {/* Right column: Info blocks */}
          <div className="space-y-8">
            {/* Open Source */}
            <div>
              <h3 className="text-xl font-bold text-brand mb-2">
                As anonymous as you're comfortable with
              </h3>
              <p className="text-gray-700">
                Every single component of EnclaveID is publicly available on
                GitHub and the build pipeline is fully reproducible. Thanks to
                remote
                <em> attestation</em>, this means that you can trust that
                whatever is in the code is what is running in our Kubernetes
                cluster, much like an Ethereum smart contract.
              </p>
            </div>

            {/* Community Owned */}
            <div>
              <h3 className="text-xl font-bold text-brand mb-2">
                100% Open Source and Community Owned
              </h3>
              <p className="text-gray-700">
                EnclaveID is a community-owned project with the goal of
                empowering individuals for a flourishing democratic society. Our
                code is a reflection of the will of such individuals, so
                contributions and feedback are strongly encouraged!
              </p>
            </div>

            {/* Zero Trust */}
            <div>
              <h3 className="text-xl font-bold text-brand mb-2">
                Zero Trust Infrastructure [coming soon!]
              </h3>
              <p className="text-content-secondary">
                EnclaveID runs on AMD SEV-SNP capable hardware – hence "enclave"
                in the name – which guarantees that your data is inaccessible by
                any other software or human (except you), even by the
                infrastructure provider!
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-offwhite text-text">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1">
            <h3 className="text-gray-900 font-bold text-lg mb-4">EnclaveID</h3>
            <p className="text-sm text-gray-900">Get LLMs to know you</p>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-footer-border mt-8 pt-8 text-sm text-gray-900">
          © {new Date().getFullYear()} EnclaveID. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
