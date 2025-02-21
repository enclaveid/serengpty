import Image from 'next/image';
import MaterialSymbolsArrowForwardIosRounded from '~icons/material-symbols/arrow-forward-ios-rounded';
import React from 'react';
import { Card, CardContent } from '@enclaveid/ui/card';

const steps = [
  {
    text: 'Navigate to chatgpt.com and open Settings',
    imageSrc: '/1.png',
    scale: 1.2,
    objectPosition: 'right top',
  },
  {
    text: "Click 'Data controls' and 'Export'",
    imageSrc: '/2.png',
    scale: 1,
    objectPosition: 'center top',
  },
  {
    text: "Select 'Confirm export'",
    imageSrc: '/3.png',
    scale: 1,
    objectPosition: 'center',
  },
  {
    text: "Navigate to your inbox and 'Download data export'",
    imageSrc: '/4.png',
    scale: 1.15,
    objectPosition: 'left bottom',
  },
];

export function LandingGuidance() {
  return (
    <Card className="max-w-7xl mx-auto relative">
      <CardContent className="py-4">
        <div className="flex flex-col items-center">
          {/* Row: Images and Arrows */}
          <div className="flex items-center justify-center gap-4">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <div className="w-64 h-32 relative overflow-hidden rounded-lg">
                  <Image
                    src={step.imageSrc}
                    alt={step.text}
                    fill
                    className="object-cover"
                    style={{
                      transform: `scale(${step.scale})`,
                      transformOrigin: step.objectPosition,
                      objectPosition: step.objectPosition,
                      filter: 'brightness(1.15)',
                    }}
                  />
                </div>
                {index < steps.length - 1 && (
                  <div className="flex items-center justify-center">
                    <MaterialSymbolsArrowForwardIosRounded className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          {/* Row: Texts */}
          <div className="flex items-center justify-center gap-4 mt-4">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <div className="w-64 text-center text-gray-600">
                  <p>{step.text}</p>
                </div>
                {index < steps.length - 1 && (
                  // Empty spacer that matches the width of the arrow container.
                  <div className="w-8" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
