/**
 * @file apps/client/components/ui/Card.tsx
 * Shared client component for layout renders and user interaction flows.
 */

import Link from 'next/link';

interface CardProps {
  emoji: string;
  title: string;
  description: string;
  href: string;
}

export function Card({ emoji, title, description, href }: CardProps) {
  return (
    <Link
      href={href}
      prefetch={true}
      className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors block group"
    >
      <div className="text-2xl mb-3">{emoji}</div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        </div>
        <svg
          className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}
