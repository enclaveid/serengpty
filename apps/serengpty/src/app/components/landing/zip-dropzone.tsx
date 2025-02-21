'use client';

import { useDropzone } from 'react-dropzone';

export function ZipDropzone({ onDrop }: { onDrop: (files: File[]) => void }) {
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'] },
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className="isolate relative z-50 w-full md:w-1/2 mb-8 md:mb-0 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center text-center hover:border-green-800 transition-colors"
    >
      <input {...getInputProps()} />
      <>
        <svg
          className="w-12 h-12 text-gray-400 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 48 48"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 16l8-8m0 0l8 8m-8-8v24"
          />
        </svg>
        <p className="mt-2 text-base text-gray-500">
          Upload your conversations archive zip here
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Only *.zip files are accepted
        </p>
      </>
    </div>
  );
}
